import { equals, gin, gout, lamp, positions, radiostop, section } from "../helpers";
import type { Command, Loco } from "../types";

const IN = "physics_input_163";
const OUT = "physics_output_163";

const radio = section("radio", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

/** Radio keypad buttons: 1 while pressed, 0 when released. */
const KEYPAD: [string, string, string][] = [
	["radio_onoff", "on/off", "Radio\non/off"],
	["radio_enter", "Enter", "Radio\nEnter"],
	["radio_up", "▲", "Radio\n▲"],
	["radio_down", "▼", "Radio\n▼"],
	["radio_left", "◀", "Radio\n◀"],
	["radio_right", "▶", "Radio\n▶"],
	["radio_f", "F", "Radio\nF"],
	["radio_simplex", "SIMPLEX", "Radio\nSIMPLEX"],
	["radio_system", "SYSTEM", "Radio\nSYSTEM"],
	["radio_null", "NULL", "Radio\nNULL"],
	["radio_tab", "TAB", "Radio\nTAB"],
	["radio_hash", "#", "Radio\n#"],
	...Array.from({ length: 10 }, (_, i): [string, string, string] => [`radio_${i}`, `${i}`, `Radio\n${i}`]),
	...Array.from({ length: 9 }, (_, i): [string, string, string] => [`radio_f${i + 1}`, `F${i + 1}`, `Radio\nF${i + 1}`]),
];

const signalLamp = (field: string, where: string): Command[] =>
	positions(lights, `light.${field}`, `${IN}/${field}`, [
		{ value: 0, label: "off", short: `${where}\noff` },
		{ value: 1, label: "white", short: `${where}\nwhite` },
		{ value: 2, label: "red", short: `${where}\nred` },
	], `Lights – ${where.replace("\n", " ")} lamp`);

const pair = (a: string, b: string, value: number) => [
	{ topic: `${IN}/${a}`, value },
	{ topic: `${IN}/${b}`, value },
];

/** ČD 163 (wiki 71E). Not yet checked against a dump. */
export const cd163: Loco = {
	id: "cd163",
	name: "ČD 163 (71E)",
	inputPrefix: "163",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/71E",
	commands: [
		radio.momentary({ id: "radio.power", fn: "radio.power", label: "Radio – on/off button", short: "Radio\non/off", topic: `${IN}/radio_onoff`, press: 1, release: 0, feedback: lamp(gout("radio_on_lamp")) }),
		...KEYPAD.slice(1).map(([f, label, short]) =>
			radio.momentary({ id: `radio.key.${f}`, label: `Radio keypad – ${label}`, short, topic: `${IN}/${f}`, press: 1, release: 0 }),
		),
		radio.momentary({ id: "radio.ch.up", fn: "radio.ch.up", label: "Radio – channel up", short: "CH +", topic: gin("radio_channel_change"), press: 1, release: 0, feedback: { topics: ["trainset/radio_channel"], mode: "value", format: "CH {v}" }, note: "values not documented; ±1 assumed like Traxx DE" }),
		radio.momentary({ id: "radio.ch.down", fn: "radio.ch.down", label: "Radio – channel down", short: "CH −", topic: gin("radio_channel_change"), press: -1, release: 0, feedback: { topics: ["trainset/radio_channel"], mode: "value", format: "CH {v}" }, note: "values not documented; ±1 assumed like Traxx DE" }),
		radio.set({ id: "radio.ch.show", fn: "radio.ch.show", label: "Radio – show channel (display only)", short: "Channel", publish: [], feedback: { topics: ["trainset/radio_channel"], mode: "value", format: "CH {v}" } }),

		horn.momentary({ id: "horn.left", fn: "horn.low", label: "Horn – left button", short: "Horn\nleft", topic: `${IN}/horn_l`, press: 1, release: 0, note: "tone not documented" }),
		horn.momentary({ id: "horn.right", fn: "horn.high", label: "Horn – right button", short: "Horn\nright", topic: `${IN}/horn_r`, press: 1, release: 0, note: "tone not documented" }),
		horn.momentary({ id: "horn.pedal", label: "Horn pedal", short: "Horn\npedal", topic: `${IN}/horn_pedal`, press: 1, release: 0 }),

		lights.set({ id: "light.preset.front_drive", fn: "lights.front_drive", label: "Lights – front: both white", short: "Front\nwhite", publish: pair("headlight_individual_fl", "headlight_individual_fr", 1) }),
		lights.set({ id: "light.preset.front_tail", fn: "lights.front_tail", label: "Lights – front: both red", short: "Front\nred", publish: pair("headlight_individual_fl", "headlight_individual_fr", 2) }),
		lights.set({ id: "light.preset.front_off", fn: "lights.front_off", label: "Lights – front: off", short: "Front\noff", publish: pair("headlight_individual_fl", "headlight_individual_fr", 0) }),
		lights.set({ id: "light.preset.rear_drive", fn: "lights.rear_drive", label: "Lights – rear: both white", short: "Rear\nwhite", publish: pair("headlight_individual_rl", "headlight_individual_rr", 1) }),
		lights.set({ id: "light.preset.rear_tail", fn: "lights.rear_tail", label: "Lights – rear: both red", short: "Rear\nred", publish: pair("headlight_individual_rl", "headlight_individual_rr", 2) }),
		lights.set({ id: "light.preset.rear_off", fn: "lights.rear_off", label: "Lights – rear: off", short: "Rear\noff", publish: pair("headlight_individual_rl", "headlight_individual_rr", 0) }),
		...signalLamp("headlight_individual_fl", "Front L"),
		...signalLamp("headlight_individual_fr", "Front R"),
		...signalLamp("headlight_individual_rl", "Rear L"),
		...signalLamp("headlight_individual_rr", "Rear R"),
		lights.toggle({ id: "light.dim", fn: "lights.dim", label: "Lights – dim headlights", short: "Lights\ndim", topic: `${IN}/dim_headlights`, off: 0, on: 1 }),
		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light (TL)", short: "Cab\nlight", topic: `${IN}/cabin_light`, off: 0, on: 1, feedback: lamp(`${OUT}/cab_light`) }),
		lights.set({ id: "light.cab_pl", label: "Lights – cab light (PL)", short: "Cab\nPL", publish: { topic: `${IN}/cabin_light`, value: 2 }, feedback: equals(`${IN}/cabin_light`, 2) }),
		lights.toggle({ id: "light.instruments", fn: "lights.instruments", label: "Lights – instrument backlight (TL)", short: "Instr\nlight", topic: `${IN}/instrument_light`, off: 0, on: 1, feedback: lamp(`${OUT}/instrument_light`) }),
		lights.toggle({ id: "light.dashboard", fn: "lights.dashboard", label: "Lights – dashboard light (left)", short: "Dash\nleft", topic: `${IN}/dashboard_light_l`, off: -1, on: 1, feedback: lamp(`${OUT}/dashboard_light_l`) }),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "Alerter acknowledge (both buttons)", short: "Alerter", topic: `${IN}/alerter_l`, also: [`${IN}/alerter_r`], press: 1, release: -1, feedback: lamp(`${OUT}/ca_lamp`, `${OUT}/shp_lamp`) }),
		radiostop(safety, undefined, `${IN}/radio_radiostop`),
	],
};
