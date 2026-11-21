import { gin, individualLights, lamp, radioBox, radiostop, section } from "../helpers";
import type { Loco } from "../types";

const IN = "physics_input_en57";
const OUT = "physics_output_en57";

const radio = section("radio", "dump");
const doors = section("doors", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

/** EN57 / EN71 "Kibel" (wiki Kibel). Not yet checked against a dump. */
export const en57: Loco = {
	id: "en57",
	name: "EN57 / EN71 (Kibel)",
	inputPrefix: "en57",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/Kibel",
	commands: [
		...radioBox(radio, `${OUT}/radio_lamp`),

		doors.toggle({ id: "doors.left", fn: "doors.left", label: "Doors – left switch", short: "Doors\nleft", topic: `${IN}/door_left`, off: -1, on: 1, feedback: lamp(`${OUT}/doors_left_lamp`) }),
		doors.toggle({ id: "doors.right", fn: "doors.right", label: "Doors – right switch", short: "Doors\nright", topic: `${IN}/door_right`, off: -1, on: 1, feedback: lamp(`${OUT}/doors_right_lamp`) }),
		doors.set({ id: "doors.close", fn: "doors.close", label: "Doors – close both sides", short: "Doors\nclose", publish: [{ topic: `${IN}/door_left`, value: -1 }, { topic: `${IN}/door_right`, value: -1 }], feedback: lamp(`${OUT}/doors_left_lamp`, `${OUT}/doors_right_lamp`) }),
		doors.momentary({ id: "doors.signal", fn: "doors.signal", label: "Doors – departure signal", short: "Depart\nsignal", topic: `${IN}/door_signal`, press: 1, release: -1, feedback: lamp(`${OUT}/departure_signal_lamp`) }),

		horn.momentary({ id: "horn", fn: "horn.low", label: "Horn (pedal)", short: "Horn", topic: `${IN}/warning_signal_rq`, press: 1, release: -1 }),

		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light", short: "Cab\nlight", topic: `${IN}/cabin_light`, off: -1, on: 1 }),
		lights.toggle({ id: "light.instruments", fn: "lights.instruments", label: "Lights – instrument backlight", short: "Instr\nlight", topic: `${IN}/instrument_light`, off: -1, on: 1, feedback: lamp(`${OUT}/instrument_light`) }),
		lights.toggle({ id: "light.dim", fn: "lights.dim", label: "Lights – headlight dimming", short: "Lights\ndim", topic: gin("lights_power"), off: -1, on: 1 }),
		lights.toggle({ id: "light.dim_right", label: "Lights – dim right headlight", short: "Dim\nright", topic: `${IN}/dim_right_headlight`, off: -1, on: 1 }),
		lights.momentary({ id: "light.passenger_on", label: "Lights – passenger lights on", short: "Pass.\non", topic: `${IN}/passanger_light_enable_rq`, press: 1, release: -1 }),
		lights.momentary({ id: "light.passenger_off", label: "Lights – passenger lights off", short: "Pass.\noff", topic: `${IN}/passanger_light_disable_rq`, press: 1, release: -1 }),
		lights.toggle({ id: "light.destination", label: "Lights – destination board", short: "Dest.\nboard", topic: `${IN}/destination_board_backlight`, off: -1, on: 1 }),
		...individualLights(lights, IN, "Cab A", "Cab B"),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / CA acknowledge (both cabs)", short: "SHP\nCA", topic: `${IN}/security_system_button_a`, also: [`${IN}/security_system_button_b`], press: 1, release: -1, feedback: lamp(`${OUT}/alerter`, `${OUT}/shp`) }),
		safety.momentary({ id: "safety.ack_a", label: "SHP / CA acknowledge (cab A)", short: "SHP CA\nA", topic: `${IN}/security_system_button_a`, press: 1, release: -1, feedback: lamp(`${OUT}/alerter`, `${OUT}/shp`) }),
		safety.momentary({ id: "safety.ack_b", label: "SHP / CA acknowledge (cab B)", short: "SHP CA\nB", topic: `${IN}/security_system_button_b`, press: 1, release: -1, feedback: lamp(`${OUT}/alerter`, `${OUT}/shp`) }),
		radiostop(safety),
	],
};
