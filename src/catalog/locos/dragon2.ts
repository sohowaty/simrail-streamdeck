import { gin, gout, lamp, positions, radioPanel, radiostop, section } from "../helpers";
import type { Loco } from "../types";

const IN = "physics_input_e6act";
const OUT = "physics_output_e6act";

const radio = section("radio", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

/** Dragon 2 (ET25 / E6ACTa). Topics checked against test/fixtures/dumps/topics_dump_e6act.json. */
export const dragon2: Loco = {
	id: "dragon2",
	name: "Dragon 2 (ET25 / E6ACTa)",
	inputPrefix: "e6act",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/Dragon2",
	commands: [
		...radioPanel(radio),

		horn.momentary({ id: "horn.low", fn: "horn.low", label: "Horn – low tone", short: "Horn\nlow", topic: gin("horn_signal"), press: 1, release: 0 }),
		horn.momentary({ id: "horn.high", fn: "horn.high", label: "Horn – high tone", short: "Horn\nhigh", topic: gin("horn_signal"), press: 2, release: 0 }),

		...positions(lights, "light.mode", gin("light_pos"), [
			{ value: 4, label: "off", short: "Lights\noff", fn: "lights.off" },
			{ value: 5, label: "Pc1 (train drive)", short: "Lights\nPc1", fn: "lights.drive" },
			{ value: 7, label: "Pc1 dimmed", short: "Lights\nPc1 dim" },
			{ value: 6, label: "Pc2", short: "Lights\nPc2" },
			{ value: 8, label: "Pc6", short: "Lights\nPc6" },
			{ value: 2, label: "Tb1 (shunting)", short: "Lights\nTb1", fn: "lights.shunt" },
			{ value: 3, label: "Pc5 (end of train)", short: "Lights\nPc5", fn: "lights.tail" },
			{ value: 1, label: "LCZ", short: "Lights\nLCZ" },
			{ value: 0, label: "A1 (alarm)", short: "Lights\nA1", fn: "lights.alarm" },
		], "Headlights"),
		lights.cycle({ id: "light.mode.next", fn: "lights.mode.next", label: "Headlights – next mode", short: "Lights\nmode ›", topic: gin("light_pos"), values: [4, 5, 6, 2, 3] }),
		...positions(lights, "light.power", gin("lights_power"), [
			{ value: 1, label: "low beams", short: "Low\nbeams", fn: "lights.dim" },
			{ value: 0, label: "high beams", short: "High\nbeams" },
			{ value: -1, label: "fog lights", short: "Fog\nlights" },
		], "Headlights"),
		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light", short: "Cab\nlight", topic: gin("cabin_light"), off: -1, on: 1, feedback: lamp(gout("cab_light")) }),
		lights.set({ id: "light.cab_desk", label: "Lights – cab switch: desk light", short: "Desk\nlight", publish: { topic: gin("cabin_light"), value: 2 } }),
		lights.toggle({ id: "light.dashboard", fn: "lights.dashboard", label: "Lights – desk backlight", short: "Dash\nlight", topic: `${IN}/dashboard_light_secondary`, off: -1, on: 1, feedback: lamp(gout("dashboard_light")) }),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / CA acknowledge", short: "SHP\nCA", topic: gin("security_system_button"), press: 1, release: 0, feedback: lamp(`${OUT}/alerter`, `${OUT}/shp`) }),
		radiostop(safety, `${OUT}/radiostop_active`),
		safety.toggle({ id: "safety.ebrake", fn: "safety.ebrake", label: "Emergency brake button", short: "Emerg.\nbrake", topic: gin("emergency_brake_button_flag"), off: -1, on: 1 }),
		safety.momentary({ id: "safety.etcs_ack", fn: "safety.etcs_ack", label: "ETCS acknowledge", short: "ETCS\nACK", topic: gin("etcs_ack_button"), press: 1, release: 0, feedback: lamp(gout("etcs_ack_light")) }),
		safety.toggle({ id: "safety.etcs_isolate", fn: "safety.etcs_isolate", label: "ETCS isolation", short: "ETCS\nisolate", topic: gin("etcs_isolation_rq"), off: -1, on: 1 }),
		safety.toggle({ id: "safety.disable_shp", label: "Disable SHP", short: "SHP\noff", topic: `${IN}/disable_shp`, off: 0, on: 1, feedback: lamp(gout("security_system_shp_disabled")), note: "from the topic dump (rests at 0); 0/1 assumed" }),
		safety.momentary({ id: "safety.shp_test", label: "SHP test", short: "SHP\ntest", topic: `${IN}/shp_test`, press: 1, release: 0, note: "from the topic dump (rests at 0); 0/1 assumed" }),
	],
};
