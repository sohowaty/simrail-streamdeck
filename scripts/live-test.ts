/**
 * Live catalog test: run while a SimRail session is active.
 *
 *   npm run live-test -- [--loco <id>] [--only id1,id2] [--category lights] [--unsafe] [--host 127.0.0.1]
 *
 * Detects the loco, then presses each of its commands the way the Stream Deck key would and records what the game
 * reports back: the command's feedback topics, and every other topic the game changes while the command runs.
 * Toggles, sets, steps and cycles are put back to their previous value afterwards.
 * RADIOSTOP, the emergency brake and the safety-system disable/isolation switches are skipped unless --unsafe is given.
 * Results go to stdout and dist/live-test-<loco>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import mqtt from "mqtt";

import { type Command, detectLoco, LOCO_BY_ID, publishTopics } from "../src/catalog";
import { keyDown, keyUp } from "../src/engine";
import { decode, encodeFloat } from "../src/mqtt/codec";

const args = process.argv.slice(2);
const opt = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};
const host = opt("host") ?? "127.0.0.1";
const only = opt("only")?.split(",");
const category = opt("category");
const unsafe = args.includes("--unsafe");
// --slow: hold buttons 2 s and leave each state 4 s, so someone in the cab can watch and listen.
const slow = args.includes("--slow");
// --ca-test: hold SHP/CA acknowledge 3.5 s so the game runs its CA test (lamp on until release), which checks the
// key lamp. Without it, acknowledge is always a short tap so it never starts the test by accident.
const caTest = args.includes("--ca-test");
const UNSAFE = /^(radiostop|safety\.ebrake|safety\.disable_|safety\.etcs_isolate|safety\.shp_isolate)/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const values = new Map<string, number | string>();
let changes: { t: number; topic: string; value: number | string; game: boolean }[] = [];
let topicList: string[] | undefined;

const client = mqtt.connect(`mqtt://${host}:1883`, { clientId: "simrail-live-test", reconnectPeriod: 0, connectTimeout: 5000 });
client.on("error", (e) => {
	console.error(`MQTT error: ${e.message}`);
	process.exit(1);
});
client.on("message", (topic, payload) => {
	if (topic === "request_topics_response") {
		const text = decode(payload);
		if (typeof text !== "string" || !text.includes("physics_input_")) return;
		const d = JSON.parse(text);
		topicList = [...d.Inputs, ...d.Outputs].map((e: { Topic: string }) => e.Topic);
		for (const e of d.Inputs) if (e.CurrentValue !== "" && e.CurrentValue != null) values.set(e.Topic, Number(e.CurrentValue));
		return;
	}
	const v = decode(payload);
	if (v === undefined) return;
	// The game sends 0x01+float; raw 4-byte floats are our own (or another client's) publishes echoed back.
	const game = !(payload.length === 4);
	if (values.get(topic) !== v) changes.push({ t: Date.now(), topic, value: v, game });
	values.set(topic, v);
});

const pub = (topic: string, value: number) => client.publishAsync(topic, encodeFloat(value), { qos: 0 });

async function run(c: Command) {
	const b = c.behaviour;
	const sent: string[] = [];
	const send = async (topic: string, value: number) => {
		sent.push(`${topic.split("/").pop()}=${value}`);
		await pub(topic, value);
	};
	const restore: [string, number][] = [];
	let held: (number | string | undefined)[] | undefined;
	// Same key logic as the plugin (src/engine.ts), so the test presses exactly what a key would send.
	const get = (t: string) => values.get(t);
	const down = keyDown(c, get, new Map());
	if (b.type === "momentary") {
		// Holding CA acknowledge for over 2 s starts the game's CA test (lamp lights, ends on release).
		// --ca-test uses that to check the key's lamp; otherwise acks are always short taps.
		const ack = c.fn === "safety.ack" || c.id.startsWith("safety.ack");
		for (const p of down) await send(p.topic, p.value);
		await sleep(ack ? (caTest ? 3500 : 700) : slow ? 2000 : 700);
		if (ack && caTest) held = (c.feedback?.topics ?? []).map(get);
		for (const p of keyUp(c)) await send(p.topic, p.value);
	} else {
		for (const p of down) {
			// What to put back afterwards: the other toggle position, the channel the game reported for a step with
			// a value display, otherwise the last known value of the topic.
			const prev =
				b.type === "toggle" ? (p.value === b.on ? b.off : b.on)
				: b.type === "step" && c.feedback?.mode === "value" ? get(c.feedback.topics[0])
				: get(p.topic);
			if (typeof prev === "number" && prev !== p.value) restore.push([p.topic, prev]);
			await send(p.topic, p.value);
		}
	}
	await sleep(slow ? 4000 : 1200);
	return { sent, restore, held };
}

function fmt(v: unknown) {
	return v === undefined ? "?" : String(v);
}

async function main() {
	await new Promise<void>((r) => client.once("connect", () => r()));
	await client.subscribeAsync("request_topics_response");
	for (let i = 0; i < 10 && !topicList; i++) {
		client.publish("request_topics", "all");
		await sleep(1500);
	}
	if (!topicList) throw new Error("No topic list from the game: is a session running?");
	await client.subscribeAsync(topicList.filter((t) => !t.startsWith("etcs/")));
	await client.subscribeAsync("trainset/#");
	// The broker replays every cached value after subscribing; wait until that flood has stopped.
	// Analog values (time, pressures, speeds) keep changing on a live loco, so give up after 6 s.
	for (let quiet = 0, n = -1, i = 0; quiet < 3 && i < 12; i++) {
		await sleep(500);
		quiet = changes.length - n < 20 ? quiet + 1 : 0;
		n = changes.length;
	}
	changes = [];

	const loco = opt("loco") ? LOCO_BY_ID.get(opt("loco")!) : detectLoco(topicList);
	if (!loco) throw new Error("Loco not detected");
	console.log(`Loco: ${loco.name}  (${topicList.length} topics)\n`);

	const known = new Set(topicList);
	const results = [];
	for (const c of loco.commands) {
		if (only && !only.includes(c.id)) continue;
		if (category && c.category !== category) continue;
		if (!unsafe && UNSAFE.test(c.id)) {
			console.log(`SKIP  ${c.id}  (unsafe, use --unsafe)`);
			continue;
		}
		if (c.behaviour.type === "set" && c.behaviour.publish.length === 0) continue;
		const missing = publishTopics(c.behaviour).filter((t) => !known.has(t));
		if (missing.length) {
			console.log(`MISS  ${c.id}  ${missing.join(" ")}`);
			continue;
		}
		const fb = c.feedback?.topics ?? [];
		const before = fb.map((t) => values.get(t));
		if (slow) {
			console.log(`\n>>> NOW: ${c.label}`);
			await sleep(1500);
		}
		changes = [];
		const { sent, restore, held } = await run(c);
		const during = changes.filter((x) => x.game);
		const after = fb.map((t) => values.get(t));
		const fbChanged = fb.length > 0 && fb.some((t) => during.some((x) => x.topic === t));
		// CA test passes when a lamp was lit at the end of the hold and is out again after release.
		const lit = (v: unknown) => typeof v === "number" && v > 0;
		const caLit = held ? fb.filter((_, i) => lit(held[i]) && !lit(after[i])).map((t) => t.split("/").pop()) : [];
		const others = [...new Map(during.filter((x) => !fb.includes(x.topic)).map((x) => [x.topic, x.value])).entries()]
			.filter(([t]) => !/^etcs\/|odometer|speed|distance|velocity|time|pressure|current|voltage|rpm/i.test(t))
			.map(([t, v]) => `${t.replace(/^physics_(input|output)_/, "")}=${v}`);
		const verdict = held ? (caLit.length ? "OK  " : "FAIL") : fbChanged ? "OK  " : during.length ? "SEEN" : "----";
		console.log(
			`${verdict}  ${c.id.padEnd(28)} sent ${sent.join(", ")}` +
				(held ? `\n      CA test: at end of hold ${fb.map((t, i) => `${t.split("/").pop()}=${fmt(held[i])}`).join(", ")}; lit then out after release: ${caLit.join(", ") || "none"}` : "") +
				(fb.length ? `\n      feedback ${fb.map((t, i) => `${t.split("/").pop()} ${fmt(before[i])}→${fmt(after[i])}`).join(", ")}` : "") +
				(others.length ? `\n      game changed ${others.slice(0, 8).join("  ")}${others.length > 8 ? ` (+${others.length - 8})` : ""}` : ""),
		);
		results.push({ id: c.id, label: c.label, verdict: verdict.trim(), sent, held, feedback: fb.map((t, i) => ({ topic: t, before: before[i], after: after[i] })), others });
		for (const [t, v] of restore) await pub(t, v);
		if (restore.length) await sleep(800);
	}
	mkdirSync("dist", { recursive: true });
	writeFileSync(`dist/live-test-${loco.id}.json`, JSON.stringify({ loco: loco.id, at: new Date().toISOString(), results }, null, 2));
	console.log(`\nSaved dist/live-test-${loco.id}.json`);
	await client.endAsync();
}

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
