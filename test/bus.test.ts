import { createServer, type Server } from "node:net";
import { Aedes } from "aedes";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SimRailBus } from "../src/mqtt/bus";
import { encodeFloat } from "../src/mqtt/codec";

const packet = (topic: string, payload: Buffer) => ({ cmd: "publish" as const, topic, payload, qos: 0 as const, retain: false, dup: false });

/**
 * Integration test against an in-process MQTT broker playing the game: it answers request_topics with an
 * EN76 topic list and records what the plugin publishes.
 */
describe("SimRailBus against a mock broker", () => {
	let broker: Aedes;
	let server: Server;
	let port: number;
	const published: { topic: string; payload: Buffer }[] = [];
	let requests = 0;
	/** Loco the "game" is in; changed mid-test to simulate a scenario change that keeps the broker running. */
	let currentLoco: "en76" | "eu07" = "en76";
	const LISTS = {
		en76: {
			Inputs: [{ Topic: "physics_input_general/horn_signal" }, { Topic: "physics_input_elf_34we/warning_signal_handle" }],
			Outputs: [{ Topic: "trainset/radio_channel", CurrentValue: "2" }, { Topic: "physics_output_general/radio_on_lamp", CurrentValue: "" }],
		},
		eu07: {
			Inputs: [{ Topic: "physics_input_general/horn_signal" }, { Topic: "physics_input_eu07/general_lights", CurrentValue: "0" }],
			Outputs: [{ Topic: "physics_output_eu07/alerter_state", CurrentValue: "" }],
		},
	};

	beforeAll(async () => {
		broker = await Aedes.createBroker();
		broker.on("publish", (p, client) => {
			if (!client) return; // ignore broker-originated messages
			published.push({ topic: p.topic, payload: Buffer.from(p.payload as Buffer) });
			if (p.topic === "request_topics") {
				requests++;
				// First answer is someone else's prefix request (etcs only), as seen live on 2026-11-21.
				const partial = { Inputs: [], Outputs: [{ Topic: "etcs/is_ready" }, { Topic: "etcs/level" }] };
				const list = requests === 1 ? partial : LISTS[currentLoco];
				broker.publish(packet("request_topics_response", Buffer.concat([Buffer.from([2]), Buffer.from(JSON.stringify(list))])), () => {});
			}
		});
		server = createServer(broker.handle);
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		port = (server.address() as { port: number }).port;
	});

	afterAll(async () => {
		await new Promise<void>((r) => broker.close(() => r()));
		await new Promise<void>((r) => server.close(() => r()));
	});

	it("connects, ignores a partial topic list, detects the loco, publishes raw floats and decodes game values", { timeout: 15000 }, async () => {
		const bus = new SimRailBus();
		const detected = new Promise<void>((resolve) => bus.once("topics", () => resolve()));
		bus.configure({ host: "127.0.0.1", port, clientId: "test" });
		await detected;

		// The etcs-only answer was ignored and the plugin asked again (retry after 5 s).
		expect(requests).toBe(2);
		expect(bus.connected).toBe(true);
		expect(bus.loco?.id).toBe("en76");
		expect(bus.status().topicCount).toBe(4);
		// Seeded from CurrentValue; empty values stay unknown.
		expect(bus.values.get("trainset/radio_channel")).toBe(2);
		expect(bus.values.has("physics_output_general/radio_on_lamp")).toBe(false);

		expect(bus.publish([{ topic: "physics_input_elf_34we/warning_signal_handle", value: 1 }])).toBe(true);
		await new Promise((r) => setTimeout(r, 100));
		const sent = published.find((p) => p.topic === "physics_input_elf_34we/warning_signal_handle");
		expect(sent && [...sent.payload]).toEqual([...encodeFloat(1)]);

		const got = new Promise<void>((resolve) => bus.on("value", (t: string) => t === "trainset/radio_channel" && resolve()));
		broker.publish(packet("trainset/radio_channel", Buffer.concat([Buffer.from([1]), encodeFloat(5)])), () => {});
		await got;
		expect(bus.values.get("trainset/radio_channel")).toBe(5);

		// Scenario change without a reconnect (seen live 2026-11-21, ED250 → EP08).
		currentLoco = "eu07";
		// A raw 4-byte publish is some client's echo, not the game: it must not trigger a re-detect.
		broker.publish(packet("physics_output_eu07/alerter_state", encodeFloat(1)), () => {});
		await new Promise((r) => setTimeout(r, 200));
		expect(bus.loco?.id).toBe("en76");
		// A game-sent output from another loco's group does.
		const redetected = new Promise<void>((resolve) => bus.on("topics", () => bus.loco?.id === "eu07" && resolve()));
		broker.publish(packet("physics_output_eu07/alerter_state", Buffer.concat([Buffer.from([1]), encodeFloat(0)])), () => {});
		await redetected;
		expect(bus.topics?.has("physics_input_elf_34we/warning_signal_handle")).toBe(false);
		expect(bus.values.has("trainset/radio_channel")).toBe(false);

		bus.stop();
		expect(bus.connected).toBe(false);
		expect(bus.loco).toBeUndefined();
	});
});
