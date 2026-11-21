import { equals, gin, gout, lamp, positions, radioPanel, radiostop, section } from "../helpers";
import type { Loco } from "../types";

const IN = "physics_input_elf_34we";
const OUT = "physics_output_elf_34we";

const radio = section("radio", "dump");
const doors = section("doors", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

/** EN76 / EN96 "Elf" (wiki Elf). Topics checked against test/fixtures/dumps/topics_dump_en76.json. */
export const en76: Loco = {
	id: "en76",
	name: "EN76 / EN96 (Elf)",
	inputPrefix: "elf_34we",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/Elf",
	commands: [
		...radioPanel(radio),

		...positions(doors, "doors.side", `${IN}/door_allow_switch`, [
			{ value: 0, label: "selector: open left", short: "Doors\nleft", fn: "doors.left" },
			{ value: 2, label: "selector: open right", short: "Doors\nright", fn: "doors.right" },
			{ value: 3, label: "selector: open both", short: "Doors\nboth", fn: "doors.both" },
			{ value: 1, label: "selector: closed", short: "Doors\nlocked", fn: "doors.lock" },
		], "Doors"),
		doors.momentary({ id: "doors.open", fn: "doors.open", label: "Doors – open button", short: "Doors\nopen", topic: `${IN}/door_open`, press: 1, release: 0, feedback: lamp(`${OUT}/door`) }),
		doors.momentary({ id: "doors.close", fn: "doors.close", label: "Doors – close button", short: "Doors\nclose", topic: `${IN}/door_close`, press: 1, release: 0, feedback: lamp(`${OUT}/door`) }),
		doors.toggle({ id: "doors.step", fn: "doors.step", label: "Doors – step button", short: "Door\nstep", topic: `${IN}/door_step_allow`, off: 0, on: 1, feedback: lamp(`${OUT}/door_step`) }),

		// warning_signal_handle rests at 2 (= disabled).
		horn.momentary({ id: "horn.high", fn: "horn.high", label: "Horn – high tone", short: "Horn\nhigh", topic: `${IN}/warning_signal_handle`, press: 1, release: 2 }),
		horn.momentary({ id: "horn.low", fn: "horn.low", label: "Horn – low tone", short: "Horn\nlow", topic: `${IN}/warning_signal_handle`, press: 3, release: 2 }),
		horn.momentary({ id: "horn.both", fn: "horn.both", label: "Horn – both tones", short: "Horn\nboth", topic: `${IN}/warning_signal_handle`, press: 0, release: 2 }),
		horn.momentary({ id: "horn.whistle", fn: "horn.whistle", label: "Whistle", short: "Whistle", topic: gin("horn_signal"), press: 4, release: 0 }),

		...positions(lights, "light.mode", gin("light_pos"), [
			{ value: 0, label: "off", short: "Lights\noff", fn: "lights.off" },
			{ value: 1, label: "Pc1 (normal drive)", short: "Lights\nPc1", fn: "lights.drive" },
			{ value: 2, label: "Pc2 (left track)", short: "Lights\nPc2" },
			{ value: 3, label: "L (no cars)", short: "Lights\nL" },
			{ value: 4, label: "Tb1 (shunting)", short: "Lights\nTb1", fn: "lights.shunt" },
			{ value: 5, label: "A1 (alarm)", short: "Lights\nA1", fn: "lights.alarm" },
		], "Headlights"),
		lights.cycle({ id: "light.mode.next", fn: "lights.mode.next", label: "Headlights – next mode", short: "Lights\nmode ›", topic: gin("light_pos"), values: [0, 1, 2, 3, 4], feedback: { topics: [gin("light_pos")], mode: "value", format: "Mode {v}" } }),
		lights.toggle({ id: "light.dim", fn: "lights.dim", label: "Headlights – near / far", short: "Lights\nnear", topic: gin("lights_power"), off: 0, on: 1, feedback: equals(gin("lights_power"), 1) }),
		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light", short: "Cab\nlight", topic: gin("cabin_light"), off: -1, on: 1, feedback: lamp(gout("cab_light")), note: "values not documented, -1/1 assumed" }),
		lights.toggle({ id: "light.dashboard", fn: "lights.dashboard", label: "Lights – dashboard light", short: "Dash\nlight", topic: gin("dashboard_light"), off: -1, on: 1, feedback: lamp(`${OUT}/dashboard_lights_on`), note: "values not documented, -1/1 assumed" }),
		lights.momentary({ id: "light.dashboard_impulse", label: "Lights – dashboard (hold)", short: "Dash\nhold", topic: `${IN}/dashboard_light_impulse`, press: 1, release: -1, feedback: lamp(`${OUT}/dashboard_lights_on`) }),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / CA acknowledge", short: "SHP\nCA", topic: gin("security_system_button"), press: 1, release: -1, feedback: lamp(`${OUT}/alerter_lit`, `${OUT}/alerter`, `${OUT}/shp`) }),
		radiostop(safety, `${OUT}/radiostop_active`),
	],
};
