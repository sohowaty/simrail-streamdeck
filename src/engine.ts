import type { Command, Pub } from "./catalog";

/** Latest known value of a topic (from the game, or the broker echoing a publish). */
export type Lookup = (topic: string) => number | string | undefined;

/** Per-key memory of what this key last sent, used when the game doesn't report the state. */
export type LocalState = Map<string, number>;

const num = (v: number | string | undefined): number | undefined => (typeof v === "number" ? v : undefined);
const same = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-4;

function current(topic: string, get: Lookup, local: LocalState): number | undefined {
	return num(get(topic)) ?? local.get(topic);
}

/** Is the key's feedback "on"? undefined = no feedback source with a known value. */
export function feedbackOn(cmd: Command, get: Lookup): boolean | undefined {
	const f = cmd.feedback;
	if (!f || f.mode === "value") return undefined;
	const values = f.topics.map((t) => num(get(t)));
	if (values.every((v) => v === undefined)) return undefined;
	if (f.mode === "lamp") return values.some((v) => v !== undefined && v > (f.threshold ?? 0));
	return values.some((v) => same(v, f.equals ?? 1));
}

/** What a key press publishes. */
export function keyDown(cmd: Command, get: Lookup, local: LocalState): Pub[] {
	const b = cmd.behaviour;
	switch (b.type) {
		case "momentary":
			return [b.topic, ...(b.also ?? [])].map((topic) => ({ topic, value: b.press }));
		case "set":
			return b.publish;
		case "toggle": {
			const on = feedbackOn(cmd, get) ?? same(current(b.topic, get, local), b.on);
			return [{ topic: b.topic, value: on ? b.off : b.on }];
		}
		case "step": {
			const valueTopic = cmd.feedback?.mode === "value" ? cmd.feedback.topics[0] : b.topic;
			const cur = num(get(valueTopic)) ?? current(b.topic, get, local) ?? (b.delta > 0 ? b.min - b.delta : b.max - b.delta);
			const next = Math.min(b.max, Math.max(b.min, Math.round(cur) + b.delta));
			return [{ topic: b.topic, value: next }];
		}
		case "cycle": {
			const cur = current(b.topic, get, local);
			const i = cur === undefined ? -1 : b.values.findIndex((v) => same(cur, v));
			return [{ topic: b.topic, value: b.values[(i + 1) % b.values.length] }];
		}
	}
}

/** What releasing the key publishes (only momentary commands send anything). */
export function keyUp(cmd: Command): Pub[] {
	const b = cmd.behaviour;
	return b.type === "momentary" ? [b.topic, ...(b.also ?? [])].map((topic) => ({ topic, value: b.release })) : [];
}

export type KeyView = { on: boolean; value?: string };

/** What the key shows. */
export function view(cmd: Command, get: Lookup, local: LocalState, pressed: boolean): KeyView {
	const f = cmd.feedback;
	if (f?.mode === "value") {
		const v = get(f.topics[0]);
		const text = v === undefined ? "?" :typeof v === "number" ? String(Math.round(v * 10) / 10) : v;
		return { on: pressed, value: (f.format ?? "{v}").replace("{v}", text) };
	}
	const fb = feedbackOn(cmd, get);
	const b = cmd.behaviour;
	if (fb !== undefined) return { on: fb || (pressed && b.type === "momentary") };
	switch (b.type) {
		case "momentary":
			return { on: pressed };
		case "toggle":
			return { on: same(current(b.topic, get, local), b.on) };
		case "set":
			return { on: b.publish.length > 0 && b.publish.every((p) => same(current(p.topic, get, local), p.value)) };
		case "cycle": {
			const cur = current(b.topic, get, local);
			return { on: false, value: cur === undefined ? undefined : String(cur) };
		}
		default:
			return { on: pressed };
	}
}
