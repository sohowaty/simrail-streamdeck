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
 * Individual headlights of the old Polish locos (EU07/EP07/EP08, ET22, EN57). Live-tested on the EP08 2026-11-21:
 * each `headlight_individual_*` topic is the lamp's own switch: any positive value = white, 0 = off,
 * -1 = red (left/right lamps; the top lamp has no red filter and goes dark). The `endsignal_individual_*` topics
 * listed in the dumps had no visible effect, and the wiki's 2/16/128/… values only worked because the game
 * looks at the sign.
 */
export const LAMP = { white: 1, off: 0, red: -1 } as const;
/** Shown under every lamp command in the settings panel. */
const SWITCH_NOTE = "sets the lamp directly: the lamp switch on the cab panel does not move";

export function individualLights(s: ReturnType<typeof section>, prefix: string, cabA: string, cabB: string): Command[] {
	const ends = [
		{ cab: cabA, key: "front", l: "headlight_individual_fl", t: "headlight_individual_ft", r: "headlight_individual_fr" },
		{ cab: cabB, key: "rear", l: "headlight_individual_rl", t: "headlight_individual_rt", r: "headlight_individual_rr" },
	];
	const pub = (field: string, value: number): Pub => ({ topic: `${prefix}/${field}`, value });
	const out: Command[] = [];
	for (const e of ends) {
		out.push(
			s.set({
				id: `light.preset.${e.key}_pc1`,
				fn: `lights.${e.key}_drive`,
				label: `Lights – ${e.cab}: 3 white (Pc1)`,
				short: `${e.cab}\nPc1`,
				publish: [pub(e.l, LAMP.white), pub(e.t, LAMP.white), pub(e.r, LAMP.white)],
			}),
			s.set({
				id: `light.preset.${e.key}_pc5`,
				fn: `lights.${e.key}_tail`,
				label: `Lights – ${e.cab}: 2 red (Pc5, end of train)`,
				short: `${e.cab}\nPc5`,
				publish: [pub(e.l, LAMP.red), pub(e.t, LAMP.off), pub(e.r, LAMP.red)],
			}),
			s.set({
				id: `light.preset.${e.key}_off`,
				fn: `lights.${e.key}_off`,
				label: `Lights – ${e.cab}: all off`,
				short: `${e.cab}\noff`,
				publish: [pub(e.l, LAMP.off), pub(e.t, LAMP.off), pub(e.r, LAMP.off)],
			}),
		);
	}
	// Single lamps: left/right step white → red → off; the top lamp toggles white / off.
	for (const e of ends) {
		for (const [field, side] of [[e.l, "left"], [e.r, "right"]] as const) {
			out.push(
				s.cycle({
					id: `light.${field}`,
					label: `Lights – ${e.cab} ${side} lamp (white → red → off)`,
					short: `${e.cab}\nLamp ${side[0].toUpperCase()}`,
					topic: `${prefix}/${field}`,
					values: [LAMP.white, LAMP.red, LAMP.off],
				}),
			);
		}
		out.push(
			s.toggle({
				id: `light.${e.t}`,
				label: `Lights – ${e.cab} top lamp`,
				short: `${e.cab}\nLamp top`,
				topic: `${prefix}/${e.t}`,
				off: LAMP.off,
				on: LAMP.white,
				feedback: equals(`${prefix}/${e.t}`, LAMP.white),
			}),
		);
	}
	return out.map((c) => ({ ...c, note: SWITCH_NOTE }));
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
