import { gin, gout, lamp, positions, radioPanel, radiostop, section } from "../helpers";
import type { Command, Loco } from "../types";

const IN = "physics_input_traxx_e186";
const OUT = "physics_output_traxx_e186";

const LIGHT_MODES = [
	{ value: 0, label: "train drive", short: "Lights\ndrive", fn: "lights.drive" },
	{ value: 1, label: "end of train", short: "Lights\nend", fn: "lights.tail" },
	{ value: 2, label: "left track drive (I)", short: "Left\ntrack I" },
	{ value: 3, label: "normal drive (I)", short: "Drive\nI" },
	{ value: 4, label: "warning signal (NL)", short: "Warn\nNL" },
	{ value: 5, label: "left track drive", short: "Left\ntrack" },
	{ value: 6, label: "warning flash (F, L)", short: "Flash\nF L" },
	{ value: 7, label: "warning flash (B)", short: "Flash\nB" },
	{ value: 8, label: "warning signal (CH)", short: "Warn\nCH" },
	{ value: 9, label: "shunting (NL)", short: "Shunt\nNL" },
	{ value: 10, label: "shunting (DK, F, L, S, N, H)", short: "Shunt", fn: "lights.shunt" },
	{ value: 11, label: "shunting / stop (CH)", short: "Shunt\nCH" },
];

function traxxCommands(diesel: boolean): Command[] {
	const radio = section("radio", diesel ? "wiki" : "dump");
	const horn = section("horn", diesel ? "wiki" : "dump");
	const lights = section("lights", diesel ? "wiki" : "dump");
	const safety = section("safety", diesel ? "wiki" : "dump");
	return [
		...radioPanel(radio),
		...(diesel
			? Array.from({ length: 10 }, (_, i) =>
					radio.set({ id: `radio.ch.${i + 1}`, fn: `radio.ch.${i + 1}`, label: `Radio – channel ${i + 1}`, short: `CH ${i + 1}`, publish: { topic: gin("radio_channel_set"), value: i + 1 }, feedback: { topics: ["trainset/radio_channel"], mode: "equals", equals: i + 1 } }),
				)
			: []),

		horn.momentary({ id: "horn.low", fn: "horn.low", label: "Horn – low tone", short: "Horn\nlow", topic: gin("horn_signal"), press: 1, release: 0 }),
		horn.momentary({ id: "horn.high", fn: "horn.high", label: "Horn – high tone", short: "Horn\nhigh", topic: gin("horn_signal"), press: 2, release: 0 }),
		...(diesel ? [horn.momentary({ id: "horn.both", fn: "horn.both", label: "Horn – both tones", short: "Horn\nboth", topic: gin("horn_signal"), press: 3, release: 0 })] : []),

		...positions(lights, "light.mode", gin("light_pos"), LIGHT_MODES, "Headlights"),
		lights.cycle({ id: "light.mode.next", fn: "lights.mode.next", label: "Headlights – next mode (drive / end / shunting)", short: "Lights\nmode ›", topic: gin("light_pos"), values: [0, 1, 10] }),
		...positions(lights, "light.power", gin("lights_power"), [
			{ value: 1, label: "dimmed signal lights", short: "Signal\ndim" },
			{ value: 2, label: "signal lights", short: "Signal\nlights" },
			{ value: 3, label: "low beams", short: "Low\nbeams", fn: "lights.dim" },
			{ value: 4, label: "high beams", short: "High\nbeams" },
		], "Headlights"),
		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light", short: "Cab\nlight", topic: gin("cabin_light"), off: -1, on: 1, feedback: lamp(`${OUT}/cab_light`) }),
		lights.set({ id: "light.cab_desk", fn: "lights.dashboard", label: "Lights – cab switch: desk light", short: "Desk\nlight", publish: { topic: gin("cabin_light"), value: 2 }, feedback: lamp(`${OUT}/desk_light`) }),
		lights.toggle({ id: "light.instruments", fn: "lights.instruments", label: "Lights – instrument backlight", short: "Instr\nlight", topic: gin("instrument_light"), off: diesel ? 0 : -1, on: 1, feedback: lamp(`${OUT}/instrument_light`) }),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / CA acknowledge", short: "SHP\nCA", topic: gin("security_system_button"), press: 1, release: diesel ? -1 : 0, feedback: lamp(`${OUT}/alerter`, `${OUT}/shp`) }),
		radiostop(safety, `${OUT}/radiostop_active`),
		safety.toggle({ id: "safety.ebrake", fn: "safety.ebrake", label: "Emergency brake button", short: "Emerg.\nbrake", topic: gin("emergency_brake_button_flag"), off: -1, on: 1 }),
		safety.momentary({ id: "safety.etcs_ack", fn: "safety.etcs_ack", label: "ETCS acknowledge", short: "ETCS\nACK", topic: gin("etcs_ack_button"), press: 1, release: 0, feedback: lamp(gout("etcs_ack_light")), note: "not on the Traxx wiki page; same as the live-tested ED250 key" }),
		safety.toggle({ id: "safety.etcs_isolate", fn: "safety.etcs_isolate", label: "ETCS isolation", short: "ETCS\nisolate", topic: gin("etcs_isolation_rq"), off: -1, on: 1, feedback: lamp(gout("security_system_etcs_disabled")), note: "not on the Traxx wiki page" }),
	];
}

/**
 * Traxx E186 (electric). Shares the `traxx_e186` group with Traxx DE, and the game reports the same topic names for
 * both (the E186 dump includes `diesel_engine_disable_rq` too), so Auto always picks the E186 and Traxx DE is chosen by hand.
 */
export const traxx: Loco = {
	id: "traxx",
	name: "Traxx (E186)",
	inputPrefix: "traxx_e186",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/Traxx",
	commands: traxxCommands(false),
};

export const traxxDe: Loco = {
	id: "traxx_de",
	name: "Traxx DE (BR285)",
	inputPrefix: "traxx_e186",
	autoDetect: false,
	source: "https://wiki.simrail.eu/en/MQTT/Trains/TraxxDE",
	commands: traxxCommands(true),
};
