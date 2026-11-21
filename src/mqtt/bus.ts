import { EventEmitter } from "node:events";
import mqtt, { type MqttClient } from "mqtt";

import { detectLoco, type Loco, type Pub } from "../catalog";
import { decode, encodeFloat } from "./codec";

export type BusConfig = { host: string; port: number; clientId: string };

export const DEFAULT_CONFIG: BusConfig = { host: "127.0.0.1", port: 1883, clientId: "simrail-streamdeck" };

export type BusStatus = {
	connected: boolean;
	host: string;
	port: number;
	loco: { id: string; name: string } | null;
	topicCount: number;
};

/**
 * One shared connection to SimRail's broker for every key.
 *
 * The broker only exists while the player is in a session, so the client reconnects forever. After each
 * connect it asks for the topic list (`request_topics`), which tells us the loco and which commands exist.
 *
 * Events: "status" (BusStatus), "value" (topic), "topics" ().
 */
export class SimRailBus extends EventEmitter {
	readonly values = new Map<string, number | string>();
	topics: Set<string> | undefined;
	loco: Loco | undefined;
	private client: MqttClient | undefined;
	private config: BusConfig = DEFAULT_CONFIG;
	private topicRetry: NodeJS.Timeout | undefined;
	private lastStatus = "";

	get connected(): boolean {
		return this.client?.connected ?? false;
	}

	status(): BusStatus {
		return {
			connected: this.connected,
			host: this.config.host,
			port: this.config.port,
			loco: this.loco ? { id: this.loco.id, name: this.loco.name } : null,
			topicCount: this.topics?.size ?? 0,
		};
	}

	/** (Re)connects if the config changed. */
	configure(config: Partial<BusConfig>): void {
		const next: BusConfig = {
			host: (config.host || DEFAULT_CONFIG.host).trim(),
			port: Number(config.port) || DEFAULT_CONFIG.port,
			clientId: (config.clientId || DEFAULT_CONFIG.clientId).trim(),
		};
		if (this.client && JSON.stringify(next) === JSON.stringify(this.config)) return;
		this.config = next;
		this.start();
	}

	private start(): void {
		this.stop();
		const { host, port, clientId } = this.config;
		const client = mqtt.connect({
			host,
			port,
			protocol: "mqtt",
			protocolVersion: 4,
			clientId,
			clean: true,
			keepalive: 10,
			reconnectPeriod: 3000,
			connectTimeout: 4000,
		});
		this.client = client;

		client.on("connect", () => {
			client.subscribe("#", { qos: 0 });
			this.requestTopics();
			this.emitStatus();
		});
		client.on("close", () => {
			this.clearSession();
			this.emitStatus();
		});
		client.on("error", () => {
			/* ECONNREFUSED while not in a session is normal; mqtt.js keeps retrying. */
		});
		client.on("message", (topic, payload) => this.onMessage(topic, payload));
	}

	stop(): void {
		clearTimeout(this.topicRetry);
		this.client?.removeAllListeners();
		this.client?.on("error", () => {});
		this.client?.end(true);
		this.client = undefined;
		this.clearSession();
	}

	/** Publishes each value as a raw float32 (the only format the game accepts). */
	publish(pubs: Pub[]): boolean {
		if (!this.client?.connected) return false;
		for (const p of pubs) this.client.publish(p.topic, encodeFloat(p.value), { qos: 0 });
		return true;
	}

	/** Asks the game for its topic list; retried until it answers. */
	requestTopics(): void {
		clearTimeout(this.topicRetry);
		if (!this.client?.connected) return;
		this.client.publish("request_topics", "all", { qos: 0 });
		this.topicRetry = setTimeout(() => {
			if (!this.topics || !this.loco) this.requestTopics();
		}, 5000);
	}

	private onMessage(topic: string, payload: Buffer): void {
		const value = decode(payload);
		if (topic === "request_topics_response") {
			this.onTopicList(value);
			return;
		}
		if (topic === "request_topics" || value === undefined) return;
		if (this.locoChanged(topic, payload)) {
			this.clearSession();
			this.emitStatus();
			this.requestTopics();
		}
		if (this.values.get(topic) === value) return;
		const isNew = !this.values.has(topic);
		this.values.set(topic, value);
		// The broker replays cached input states on subscribe, so the loco can show up before the topic list.
		if (isNew && !this.loco && topic.startsWith("physics_input_") && !topic.startsWith("physics_input_general/")) this.detect();
		this.emit("value", topic);
	}

	/**
	 * The game can keep the broker running across a scenario change, so the plugin can't rely on a reconnect to
	 * notice a new loco. A game-sent output (0x01/0x02 prefixed, never an echoed raw-float publish from some
	 * client) from another loco's topic group means the loco has changed.
	 */
	private locoChanged(topic: string, payload: Buffer): boolean {
		if (!this.loco || payload.length === 4) return false;
		const m = /^physics_output_([^/]+)\//.exec(topic);
		return !!m && m[1] !== "general" && m[1] !== this.loco.inputPrefix;
	}

	private onTopicList(value: number | string | undefined): void {
		if (typeof value !== "string") return;
		type Entry = { Topic: string; CurrentValue?: string };
		let data: { Inputs?: Entry[]; Outputs?: Entry[] };
		try {
			data = JSON.parse(value);
		} catch {
			return;
		}
		const entries = [...(data.Inputs ?? []), ...(data.Outputs ?? [])];
		const list = entries.map((e) => e.Topic);
		// The response goes to every subscriber and the broker replays the last one on subscribe, so it may be
		// an answer to someone else's prefix request (e.g. only etcs/). Only a list with inputs is the full one.
		if (!list.some((t) => t.startsWith("physics_input_"))) return;
		const known = this.topics;
		this.topics = new Set(list);

		// Seed state from the list (inputs carry their current value; outputs are often empty until they change).
		for (const e of entries) {
			const n = e.CurrentValue === undefined || e.CurrentValue === "" ? NaN : Number(e.CurrentValue);
			if (Number.isFinite(n) && !this.values.has(e.Topic)) {
				this.values.set(e.Topic, n);
				this.emit("value", e.Topic);
			}
		}
		// A `#` subscription only gets live changes; explicit topic subscriptions make the broker replay its
		// cached value (lamps that are already lit, the radio channel, ...).
		// Subscribe whenever the list is new (first list, or a new loco after a scenario change).
		if (!known) this.client?.subscribe(list, { qos: 0 });

		this.detect();
		this.emit("topics");
		this.emitStatus();
	}

	private detect(): void {
		const seen = [...this.values.keys()];
		this.loco = detectLoco(this.topics ? [...this.topics, ...seen] : seen);
		if (this.loco && this.topics) clearTimeout(this.topicRetry);
		this.emitStatus();
	}

	private clearSession(): void {
		this.values.clear();
		this.topics = undefined;
		this.loco = undefined;
	}

	/** Only on real changes: mqtt.js fires "close" on every failed reconnect while there's no session. */
	private emitStatus(): void {
		const status = this.status();
		const key = JSON.stringify(status);
		if (key === this.lastStatus) return;
		this.lastStatus = key;
		this.emit("status", status);
	}
}
