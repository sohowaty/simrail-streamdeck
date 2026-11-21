import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import {
	AUTO_BY_ID,
	type Category,
	type Command,
	commandTopics,
	findCommand,
	publishTopics,
	resolveAuto,
} from "../catalog";
import { keyDown, keyUp, type LocalState, view } from "../engine";
import type { SimRailBus } from "../mqtt/bus";
import { type KeyLook, renderKey } from "../render";

export type CommandSettings = {
	/** "auto", "raw" or a loco id. */
	loco?: string;
	/** Command id (loco), function id (auto). */
	command?: string;
	/** Overrides the text drawn on the key ("\n" or "|" for a second line). */
	label?: string;
	rawTopic?: string;
	rawMode?: "momentary" | "set" | "toggle";
	rawPress?: string;
	rawRelease?: string;
};

type KeyState = {
	action: KeyAction<CommandSettings>;
	settings: CommandSettings;
	/** Command captured on key down, so key up releases the same topic even if settings change. */
	pressed?: Command;
	local: LocalState;
	lastImage?: string;
};

type Resolved = { cmd?: Command; category: Category | "raw"; label: string; problem?: KeyLook["problem"] };

export const ACTION_UUID = "com.simrailmqtt.streamdeck.command";

@action({ UUID: ACTION_UUID })
export class SimRailCommand extends SingletonAction<CommandSettings> {
	private readonly keys = new Map<string, KeyState>();
	private dirty = new Set<string>();
	private flushTimer: NodeJS.Timeout | undefined;

	constructor(private readonly bus: SimRailBus) {
		super();
		bus.on("value", (topic: string) => this.onValue(topic));
		bus.on("topics", () => this.renderAll());
		bus.on("status", () => {
			this.renderAll();
			this.sendStatus();
		});
		// Stream Deck only lets us message a panel after telling us it opened, so push status then.
		streamDeck.ui.onDidAppear(() => this.sendStatus());
	}

	override onWillAppear(ev: WillAppearEvent<CommandSettings>): void {
		if (!ev.action.isKey()) return;
		this.keys.set(ev.action.id, { action: ev.action, settings: ev.payload.settings, local: new Map() });
		streamDeck.logger.debug(`willAppear ${ev.action.id} ${JSON.stringify(ev.payload.settings)}`);
		this.render(ev.action.id);
	}

	override onWillDisappear(ev: WillDisappearEvent<CommandSettings>): void {
		const key = this.keys.get(ev.action.id);
		// Never leave a horn or button "held" because the page changed mid-press.
		if (key?.pressed) this.bus.publish(keyUp(key.pressed));
		this.keys.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<CommandSettings>): void {
		const key = this.keys.get(ev.action.id);
		if (!key) return;
		streamDeck.logger.debug(`didReceiveSettings ${ev.action.id} ${JSON.stringify(ev.payload.settings)}`);
		key.settings = ev.payload.settings;
		key.local.clear();
		this.render(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<CommandSettings>): Promise<void> {
		const key = this.keys.get(ev.action.id);
		if (!key) return;
		key.settings = ev.payload.settings;
		const r = this.resolve(key.settings);
		if (!r.cmd || r.problem || !this.bus.connected) {
			await ev.action.showAlert();
			return;
		}
		const pubs = keyDown(r.cmd, (t) => this.bus.values.get(t), key.local);
		this.bus.publish(pubs);
		for (const p of pubs) key.local.set(p.topic, p.value);
		key.pressed = r.cmd;
		this.render(ev.action.id);
	}

	override onKeyUp(ev: KeyUpEvent<CommandSettings>): void {
		const key = this.keys.get(ev.action.id);
		if (!key?.pressed) return;
		const pubs = keyUp(key.pressed);
		this.bus.publish(pubs);
		for (const p of pubs) key.local.set(p.topic, p.value);
		key.pressed = undefined;
		this.render(ev.action.id);
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, CommandSettings>): void {
		const p = ev.payload as { event?: string } | null;
		if (p?.event === "getStatus") this.sendStatus();
		if (p?.event === "refreshTopics") this.bus.requestTopics();
	}

	/** Live connection status for the property inspector (the catalog itself ships as ui/catalog.js). */
	private sendStatus(): void {
		void streamDeck.ui.sendToPropertyInspector({
			event: "status",
			status: JSON.parse(JSON.stringify(this.bus.status())),
			topics: this.bus.topics ? [...this.bus.topics] : null,
		});
	}

	private resolve(s: CommandSettings): Resolved {
		const custom = s.label?.replace(/\|/g, "\n");
		if (s.loco === "raw") {
			const cmd = rawCommand(s);
			return { cmd, category: "raw", label: custom || (cmd ? s.rawTopic!.split("/").pop()! : "Raw"), problem: cmd ? this.problemFor(cmd) : "unset" };
		}
		if (s.loco === "auto") {
			const fn = s.command ? AUTO_BY_ID.get(s.command) : undefined;
			if (!fn) return { category: "raw", label: custom || "SimRail", problem: "unset" };
			const fallbackLabel = custom || shortFromLabel(fn.label);
			if (!this.bus.loco) return { category: fn.category, label: fallbackLabel, problem: this.bus.connected ? "na" : "offline" };
			const cmd = resolveAuto(this.bus.loco, fn.id);
			if (!cmd) return { category: fn.category, label: fallbackLabel, problem: "na" };
			return { cmd, category: cmd.category, label: custom || cmd.short, problem: this.problemFor(cmd) };
		}
		const cmd = s.loco && s.command ? findCommand(s.loco, s.command) : undefined;
		if (!cmd) return { category: "raw", label: custom || "SimRail", problem: "unset" };
		return { cmd, category: cmd.category, label: custom || cmd.short, problem: this.problemFor(cmd) };
	}

	/** offline when there's no session; n/a when the game's topic list lacks a topic this command publishes. */
	private problemFor(cmd: Command): KeyLook["problem"] {
		if (!this.bus.connected) return "offline";
		const topics = this.bus.topics;
		if (topics && publishTopics(cmd.behaviour).some((t) => !topics.has(t))) return "na";
		return undefined;
	}

	private render(id: string): void {
		const key = this.keys.get(id);
		if (!key) return;
		const r = this.resolve(key.settings);
		const look: KeyLook = { category: r.category, label: r.label, on: false, problem: r.problem };
		if (r.cmd) Object.assign(look, view(r.cmd, (t) => this.bus.values.get(t), key.local, key.pressed !== undefined));
		const image = renderKey(look);
		if (image === key.lastImage) return;
		key.lastImage = image;
		void key.action.setImage(image);
	}

	private renderAll(): void {
		for (const id of this.keys.keys()) this.render(id);
	}

	/** Coalesces bursts of game updates (lamps blink, values stream) into ~20 redraws/s. */
	private onValue(topic: string): void {
		for (const [id, key] of this.keys) {
			const r = this.resolve(key.settings);
			if (r.cmd && commandTopics(r.cmd).includes(topic)) this.dirty.add(id);
		}
		if (this.dirty.size && !this.flushTimer) {
			this.flushTimer = setTimeout(() => {
				this.flushTimer = undefined;
				const ids = [...this.dirty];
				this.dirty.clear();
				ids.forEach((id) => this.render(id));
			}, 50);
		}
	}
}

/** "Radio – channel up" -> "Radio\nchannel up" */
function shortFromLabel(label: string): string {
	return label.replace(" – ", "\n");
}

function rawCommand(s: CommandSettings): Command | undefined {
	const topic = s.rawTopic?.trim();
	const press = Number(s.rawPress);
	if (!topic || s.rawPress === undefined || s.rawPress === "" || !Number.isFinite(press)) return undefined;
	const release = Number(s.rawRelease);
	const second = s.rawRelease !== undefined && s.rawRelease !== "" && Number.isFinite(release) ? release : undefined;
	const base = { id: "raw", category: "radio" as const, label: topic, short: topic, verified: "wiki" as const };
	switch (s.rawMode) {
		case "set":
			return { ...base, behaviour: { type: "set", publish: [{ topic, value: press }] } };
		case "toggle":
			return { ...base, behaviour: { type: "toggle", topic, on: press, off: second ?? 0 } };
		default:
			return { ...base, behaviour: { type: "momentary", topic, press, release: second ?? 0 } };
	}
}
