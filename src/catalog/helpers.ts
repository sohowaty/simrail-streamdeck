import type { Category, Command, Feedback, Pub, Verified } from "./types";

export const IN_GENERAL = "physics_input_general";
export const OUT_GENERAL = "physics_output_general";

export const gin = (field: string) => `${IN_GENERAL}/${field}`;
export const gout = (field: string) => `${OUT_GENERAL}/${field}`;

type Common = {
	id: string;
	fn?: string;
	label: string;
	short: string;
	feedback?: Feedback;
	verified?: Verified;
	note?: string;
};

/**
 * Builds commands for one category with a default verification level, so loco files stay short.
 */
export function section(category: Category, verified: Verified) {
	const base = (c: Common) => ({
		id: c.id,
		fn: c.fn,
		category,
		label: c.label,
		short: c.short,
		feedback: c.feedback,
		verified: c.verified ?? verified,
		note: c.note,
	});
	return {
		momentary: (c: Common & { topic: string; press: number; release: number; also?: string[] }): Command => ({
			...base(c),
			behaviour: { type: "momentary", topic: c.topic, press: c.press, release: c.release, also: c.also },
		}),
		set: (c: Common & { publish: Pub[] | Pub }): Command => ({
			...base(c),
			behaviour: { type: "set", publish: Array.isArray(c.publish) ? c.publish : [c.publish] },
		}),
		toggle: (c: Common & { topic: string; off: number; on: number }): Command => ({
			...base(c),
			behaviour: { type: "toggle", topic: c.topic, off: c.off, on: c.on },
		}),
		step: (c: Common & { topic: string; delta: number; min: number; max: number }): Command => ({
			...base(c),
			behaviour: { type: "step", topic: c.topic, delta: c.delta, min: c.min, max: c.max },
		}),
		cycle: (c: Common & { topic: string; values: number[] }): Command => ({
			...base(c),
			behaviour: { type: "cycle", topic: c.topic, values: c.values },
		}),
	};
}

export const lamp = (...topics: string[]): Feedback => ({ topics, mode: "lamp" });
export const equals = (topic: string, value: number): Feedback => ({ topics: [topic], mode: "equals", equals: value });
export const showValue = (topic: string, format: string): Feedback => ({ topics: [topic], mode: "value", format });

/** One `set` command per named position of a selector (light modes, door side switch). */
export function positions(
	s: ReturnType<typeof section>,
	idPrefix: string,
	topic: string,
	items: { value: number; label: string; short: string; fn?: string }[],
	labelPrefix: string,
): Command[] {
	return items.map((it) =>
		s.set({
			id: `${idPrefix}.${it.value}`,
			fn: it.fn,
			label: `${labelPrefix} – ${it.label}`,
			short: it.short,
			publish: { topic, value: it.value },
			feedback: equals(topic, it.value),
		}),
	);
}

/**
 * Individual headlight / end-signal switches used by EU07, EP08, ET22 and EN57.
 * Each lamp has its own magic value: +v = on, -v = off.
 */
export const HEADLIGHT_VALUES = {
	headlight_individual_fl: 128,
	headlight_individual_fr: 2,
	headlight_individual_ft: 16,
	headlight_individual_rl: 65536,
	headlight_individual_rr: 1024,
	headlight_individual_rt: 8192,
	endsignal_individual_fl: 128,
	endsignal_individual_fr: 2,
	endsignal_individual_rl: 65536,
	endsignal_individual_rr: 1024,
} as const;

export function individualLights(s: ReturnType<typeof section>, prefix: string, cabA: string, cabB: string): Command[] {
	const t = (f: keyof typeof HEADLIGHT_VALUES) => `${prefix}/${f}`;
	const on = (f: keyof typeof HEADLIGHT_VALUES): Pub => ({ topic: t(f), value: HEADLIGHT_VALUES[f] });
	const off = (f: keyof typeof HEADLIGHT_VALUES): Pub => ({ topic: t(f), value: -HEADLIGHT_VALUES[f] });
	const names: [keyof typeof HEADLIGHT_VALUES, string, string][] = [
		["headlight_individual_fl", cabA, "headlight left"],
		["headlight_individual_ft", cabA, "headlight top"],
		["headlight_individual_fr", cabA, "headlight right"],
		["endsignal_individual_fl", cabA, "end signal left"],
		["endsignal_individual_fr", cabA, "end signal right"],
		["headlight_individual_rl", cabB, "headlight left"],
		["headlight_individual_rt", cabB, "headlight top"],
		["headlight_individual_rr", cabB, "headlight right"],
		["endsignal_individual_rl", cabB, "end signal left"],
		["endsignal_individual_rr", cabB, "end signal right"],
	];
	const shortName = (what: string) =>
		(what.startsWith("headlight") ? "Head " : "Red ") + what.split(" ").pop()![0].toUpperCase();
	const toggles = names.map(([f, cab, what]) =>
		s.toggle({
			id: `light.${f}`,
			label: `Lights – ${cab} ${what}`,
			short: `${cab}\n${shortName(what)}`,
			topic: t(f),
			off: -HEADLIGHT_VALUES[f],
			on: HEADLIGHT_VALUES[f],
			feedback: equals(t(f), HEADLIGHT_VALUES[f]),
		}),
	);
	const presets = [
		s.set({
			id: "light.preset.front_pc1",
			fn: "lights.front_drive",
			label: `Lights – ${cabA}: 3 white (Pc1)`,
			short: `${cabA}\nPc1`,
			publish: [on("headlight_individual_fl"), on("headlight_individual_ft"), on("headlight_individual_fr"), off("endsignal_individual_fl"), off("endsignal_individual_fr")],
		}),
		s.set({
			id: "light.preset.front_pc5",
			fn: "lights.front_tail",
			label: `Lights – ${cabA}: 2 red (Pc5, end of train)`,
			short: `${cabA}\nPc5`,
			publish: [off("headlight_individual_fl"), off("headlight_individual_ft"), off("headlight_individual_fr"), on("endsignal_individual_fl"), on("endsignal_individual_fr")],
		}),
		s.set({
			id: "light.preset.front_off",
			fn: "lights.front_off",
			label: `Lights – ${cabA}: all off`,
			short: `${cabA}\noff`,
			publish: [off("headlight_individual_fl"), off("headlight_individual_ft"), off("headlight_individual_fr"), off("endsignal_individual_fl"), off("endsignal_individual_fr")],
		}),
		s.set({
			id: "light.preset.rear_pc1",
			fn: "lights.rear_drive",
			label: `Lights – ${cabB}: 3 white (Pc1)`,
			short: `${cabB}\nPc1`,
			publish: [on("headlight_individual_rl"), on("headlight_individual_rt"), on("headlight_individual_rr"), off("endsignal_individual_rl"), off("endsignal_individual_rr")],
		}),
		s.set({
			id: "light.preset.rear_pc5",
			fn: "lights.rear_tail",
			label: `Lights – ${cabB}: 2 red (Pc5, end of train)`,
			short: `${cabB}\nPc5`,
			publish: [off("headlight_individual_rl"), off("headlight_individual_rt"), off("headlight_individual_rr"), on("endsignal_individual_rl"), on("endsignal_individual_rr")],
		}),
		s.set({
			id: "light.preset.rear_off",
			fn: "lights.rear_off",
			label: `Lights – ${cabB}: all off`,
			short: `${cabB}\noff`,
			publish: [off("headlight_individual_rl"), off("headlight_individual_rt"), off("headlight_individual_rr"), off("endsignal_individual_rl"), off("endsignal_individual_rr")],
		}),
	];
	return [...presets, ...toggles];
}

/** Old radio box (EU07, EN57, ...): absolute channel knob 1–10, volume 0–5. */
export function radioBox(s: ReturnType<typeof section>, radioLamp = gout("radio_on_lamp")): Command[] {
	const ch = gin("radio_channel_set");
	const channels = Array.from({ length: 10 }, (_, i) =>
		s.set({
			id: `radio.ch.${i + 1}`,
			fn: `radio.ch.${i + 1}`,
			label: `Radio – channel ${i + 1}`,
			short: `CH ${i + 1}`,
			publish: { topic: ch, value: i + 1 },
			feedback: equals("trainset/radio_channel", i + 1),
		}),
	);
	return [
		s.toggle({
			id: "radio.power",
			fn: "radio.power",
			label: "Radio – on/off",
			short: "Radio\non/off",
			topic: gin("radio_enable_set"),
			off: -1,
			on: 1,
			feedback: lamp(radioLamp),
		}),
		s.step({
			id: "radio.ch.up",
			fn: "radio.ch.up",
			label: "Radio – channel up",
			short: "CH +",
			topic: ch,
			delta: 1,
			min: 1,
			max: 10,
			feedback: showValue("trainset/radio_channel", "CH {v}"),
		}),
		s.step({
			id: "radio.ch.down",
			fn: "radio.ch.down",
			label: "Radio – channel down",
			short: "CH −",
			topic: ch,
			delta: -1,
			min: 1,
			max: 10,
			feedback: showValue("trainset/radio_channel", "CH {v}"),
		}),
		s.set({
			id: "radio.ch.show",
			fn: "radio.ch.show",
			label: "Radio – show channel (display only)",
			short: "Channel",
			publish: [],
			feedback: showValue("trainset/radio_channel", "CH {v}"),
		}),
		...channels,
		s.step({
			id: "radio.vol.up",
			fn: "radio.vol.up",
			label: "Radio – volume up",
			short: "Vol +",
			topic: gin("radio_volume_set"),
			delta: 1,
			min: 0,
			max: 5,
			feedback: showValue(gin("radio_volume_set"), "Vol {v}"),
		}),
		s.step({
			id: "radio.vol.down",
			fn: "radio.vol.down",
			label: "Radio – volume down",
			short: "Vol −",
			topic: gin("radio_volume_set"),
			delta: -1,
			min: 0,
			max: 5,
			feedback: showValue(gin("radio_volume_set"), "Vol {v}"),
		}),
		...radioCommon(s),
	];
}

/** Newer radio panel: channel up/down are pulses, enable is a pulse too. */
/**
 * Newer radio panel with CH +/− buttons. Live-tested on the ED250: `radio_channel_change` ±1 steps the channel, while
 * `radio_channel_set` takes an absolute channel number (so ±1 there would jump to channel 1 or -1).
 */
export function radioPanel(s: ReturnType<typeof section>, channelTopic = gin("radio_channel_change")): Command[] {
	return [
		s.momentary({
			id: "radio.on",
			fn: "radio.on",
			label: "Radio – power on",
			short: "Radio\non",
			topic: gin("radio_enable_set"),
			press: 1,
			release: 0,
			feedback: lamp(gout("radio_on_lamp")),
		}),
		s.momentary({
			id: "radio.off",
			fn: "radio.off",
			label: "Radio – power off",
			short: "Radio\noff",
			topic: gin("radio_enable_set"),
			press: -1,
			release: 0,
			feedback: lamp(gout("radio_on_lamp")),
		}),
		s.momentary({
			id: "radio.ch.up",
			fn: "radio.ch.up",
			label: "Radio – channel up",
			short: "CH +",
			topic: channelTopic,
			press: 1,
			release: 0,
			feedback: showValue("trainset/radio_channel", "CH {v}"),
		}),
		s.momentary({
			id: "radio.ch.down",
			fn: "radio.ch.down",
			label: "Radio – channel down",
			short: "CH −",
			topic: channelTopic,
			press: -1,
			release: 0,
			feedback: showValue("trainset/radio_channel", "CH {v}"),
		}),
		s.set({
			id: "radio.ch.show",
			fn: "radio.ch.show",
			label: "Radio – show channel (display only)",
			short: "Channel",
			publish: [],
			feedback: showValue("trainset/radio_channel", "CH {v}"),
		}),
		...radioCommon(s),
	];
}

function radioCommon(s: ReturnType<typeof section>): Command[] {
	return [
		s.momentary({
			id: "radio.zew1",
			fn: "radio.zew1",
			label: "Radio – call ZEW 1",
			short: "ZEW 1",
			topic: gin("radio_selective_call"),
			press: 1,
			release: 0,
		}),
		s.momentary({
			id: "radio.zew3",
			fn: "radio.zew3",
			label: "Radio – call ZEW 3",
			short: "ZEW 3",
			topic: gin("radio_selective_call"),
			press: 3,
			release: 0,
		}),
	];
}

/** RADIOSTOP button (general topic on most locos). Belongs to the safety section. */
export function radiostop(s: ReturnType<typeof section>, activeTopic?: string, topic = gin("radiostop_rq")): Command {
	return s.momentary({
		id: "radiostop",
		fn: "safety.radiostop",
		label: "RADIOSTOP",
		short: "RADIO\nSTOP",
		topic,
		press: 1,
		release: 0,
		feedback: activeTopic ? lamp(activeTopic) : undefined,
	});
}
