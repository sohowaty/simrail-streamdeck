import { gin, gout, lamp, positions, radioPanel, radiostop, section } from "../helpers";
import type { Loco } from "../types";

const IN = "physics_input_impuls";
const OUT = "physics_output_impuls";

const radio = section("radio", "dump");
const doors = section("doors", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

/** Impuls 2 (36WEd). Topics checked against test/fixtures/dumps/topics_dump_impuls.json. */
export const impuls2: Loco = {
	id: "impuls2",
	name: "Impuls 2 (36WEd)",
	inputPrefix: "impuls",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/Impuls2",
	commands: [
		...radioPanel(radio).map((c) => ({ ...c, note: "radio fields aren't on the Impuls 2 wiki page; radio panel assumed" })),

		doors.momentary({ id: "doors.left", fn: "doors.left", label: "Doors – open left", short: "Doors\nleft", topic: `${IN}/door_left`, press: 1, release: 0, feedback: lamp(`${OUT}/door_left_allowed`) }),
		doors.momentary({ id: "doors.right", fn: "doors.right", label: "Doors – open right", short: "Doors\nright", topic: `${IN}/door_right`, press: 1, release: 0, feedback: lamp(`${OUT}/door_right_allowed`) }),
		doors.momentary({ id: "doors.close", fn: "doors.close", label: "Doors – close", short: "Doors\nclose", topic: `${IN}/door_close`, press: 1, release: 0 }),

		horn.momentary({ id: "horn.low", fn: "horn.low", label: "Horn – low tone", short: "Horn\nlow", topic: `${IN}/horn`, press: 1, release: 0 }),
		horn.momentary({ id: "horn.high", fn: "horn.high", label: "Horn – high tone", short: "Horn\nhigh", topic: `${IN}/horn`, press: 2, release: 0 }),
		horn.momentary({ id: "horn.left", label: "Horn – left button", short: "Horn\nleft", topic: `${IN}/horn_l`, press: 1, release: 0, note: "from the topic dump (rests at 0); not on the wiki, 0/1 assumed" }),
		horn.momentary({ id: "horn.pedal", label: "Horn pedal", short: "Horn\npedal", topic: `${IN}/horn_pedal`, press: 1, release: 0 }),
		horn.momentary({ id: "horn.whistle", fn: "horn.whistle", label: "Whistle", short: "Whistle", topic: `${IN}/whistle`, press: 1, release: 0 }),

		...positions(lights, "light.mode", `${IN}/light_pos`, [
			{ value: 0, label: "off", short: "Lights\noff", fn: "lights.off" },
			{ value: 1, label: "front marking (dimmed)", short: "Front\ndimmed" },
			{ value: 2, label: "normal drive", short: "Lights\ndrive", fn: "lights.drive" },
			{ value: 3, label: "shunting (end of train)", short: "Shunt\nend" },
			{ value: 4, label: "shunting", short: "Lights\nshunt", fn: "lights.shunt" },
			{ value: 5, label: "left track drive", short: "Left\ntrack" },
			{ value: 6, label: "emergency stop", short: "Emerg.\nstop", fn: "lights.alarm" },
			{ value: 7, label: "end of train", short: "Lights\nend", fn: "lights.tail" },
		], "Headlights"),
		lights.cycle({ id: "light.mode.next", fn: "lights.mode.next", label: "Headlights – next mode", short: "Lights\nmode ›", topic: `${IN}/light_pos`, values: [0, 2, 4, 7] }),
		lights.toggle({ id: "light.dim", fn: "lights.dim", label: "Lights – signal lamp dimming", short: "Lights\ndim", topic: `${IN}/signal_lamps_dim`, off: 1, on: 0.5 }),
		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light", short: "Cab\nlight", topic: `${IN}/cablight`, off: 0, on: 1, feedback: lamp(`${OUT}/cabin_light_on`) }),
		lights.toggle({ id: "light.dashboard", fn: "lights.dashboard", label: "Lights – dashboard light", short: "Dash\nlight", topic: `${IN}/dashboard_light`, off: 0, on: 1, feedback: lamp(`${OUT}/dashboard_light_on`) }),

		lights.toggle({ id: "light.dashboard_l", label: "Lights – dashboard light (left)", short: "Dash\nleft", topic: `${IN}/dashboard_lights_l`, off: 0, on: 1, feedback: lamp(`${OUT}/dashboard_light_l_on`), note: "from the topic dump; 0/1 assumed like dashboard_light" }),
		lights.toggle({ id: "light.instruments", fn: "lights.instruments", label: "Lights – instrument backlight", short: "Instr\nlight", topic: gin("instrument_light"), off: -1, on: 1, feedback: lamp(`${OUT}/instrument_light_on`), note: "the dump has instrument_light_on but no Impuls input of its own; general instrument_light assumed, -1 = off as live-tested on the EP08" }),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / CA acknowledge", short: "SHP\nCA", topic: `${IN}/security_system_button`, press: 1, release: 0, feedback: lamp(`${OUT}/alerter_lit`, `${OUT}/alerter`, `${OUT}/shp`) }),
		radiostop(safety, `${OUT}/radiostop_active`),
		safety.momentary({ id: "safety.ebrake", fn: "safety.ebrake", label: "Emergency brake button", short: "Emerg.\nbrake", topic: `${IN}/emergency_brake_bt`, press: 1, release: -1 }),
		safety.momentary({ id: "safety.etcs_ack", fn: "safety.etcs_ack", label: "ETCS acknowledge", short: "ETCS\nACK", topic: gin("etcs_ack_button"), press: 1, release: -1, feedback: lamp(gout("etcs_ack_light")) }),
		safety.toggle({ id: "safety.etcs_isolate", fn: "safety.etcs_isolate", label: "ETCS isolation", short: "ETCS\nisolate", topic: gin("etcs_isolation_rq"), off: -1, on: 1 }),
		safety.toggle({ id: "safety.shp_isolate", label: "SHP isolation", short: "SHP\nisolate", topic: `${IN}/shp_isolation`, off: 0, on: 1 }),
	],
};
