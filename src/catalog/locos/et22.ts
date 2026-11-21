import { individualLights, lamp, radioBox, radiostop, section } from "../helpers";
import type { Loco } from "../types";

const IN = "physics_input_et22";
const OUT = "physics_output_et22";

const radio = section("radio", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

/** ET22 (wiki 201E). Not yet checked against a dump. */
export const et22: Loco = {
	id: "et22",
	name: "ET22",
	inputPrefix: "et22",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/201E",
	commands: [
		...radioBox(radio).map((c) => ({ ...c, note: "radio fields aren't on the ET22 wiki page; old radio box assumed" })),

		horn.momentary({ id: "horn.low", fn: "horn.low", label: "Horn – low tone", short: "Horn\nlow", topic: `${IN}/warning_signal_rq`, press: 1, release: 0 }),
		horn.momentary({ id: "horn.high", fn: "horn.high", label: "Horn – high tone", short: "Horn\nhigh", topic: `${IN}/warning_signal_rq`, press: 2, release: 0 }),

		lights.toggle({ id: "light.instruments", fn: "lights.instruments", label: "Lights – instrument backlight", short: "Instr\nlight", topic: `${IN}/instrument_light`, off: -1, on: 1, feedback: lamp(`${OUT}/instrument_light_1`) }),
		lights.toggle({ id: "light.dim", fn: "lights.dim", label: "Lights – headlight dimming", short: "Lights\ndim", topic: `${IN}/dim_headlights`, off: -1, on: 1 }),
		lights.toggle({ id: "light.dim_right", label: "Lights – dim right headlight", short: "Dim\nright", topic: `${IN}/dim_right_headlight`, off: -1, on: 1 }),
		...individualLights(lights, IN, "Cab A", "Cab B"),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / CA acknowledge", short: "SHP\nCA", topic: `${IN}/security_system_button`, press: 1, release: -1, feedback: lamp(`${OUT}/alerter`, `${OUT}/shp`) }),
		radiostop(safety),
		safety.toggle({ id: "safety.ebrake", fn: "safety.ebrake", label: "Emergency brake button", short: "Emerg.\nbrake", topic: `${IN}/emergency_brake_button_rq`, off: -4, on: 4 }),
	],
};
