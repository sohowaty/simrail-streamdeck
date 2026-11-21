import { gin, gout, lamp, positions, radioPanel, radiostop, section } from "../helpers";
import type { Loco } from "../types";

const IN = "physics_input_ed250";
const OUT = "physics_output_ed250";

const radio = section("radio", "dump");
const doors = section("doors", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

const MODES = [
	{ value: 1, label: "Pc1", short: "Lights\nPc1", fn: "lights.drive" },
	{ value: 3, label: "Pc2", short: "Lights\nPc2" },
	{ value: 7, label: "Pc5", short: "Lights\nPc5", fn: "lights.tail" },
	{ value: 0, label: "Pc5 AUT", short: "Pc5\nAUT" },
	{ value: 2, label: "Tb1a", short: "Lights\nTb1a", fn: "lights.shunt" },
	{ value: 6, label: "Tb1b", short: "Lights\nTb1b" },
	{ value: 4, label: "SCZ", short: "Lights\nSCZ" },
	{ value: 5, label: "LCZ", short: "Lights\nLCZ" },
];

/** ED250 Pendolino. Topics checked against test/fixtures/dumps/topics_dump_ed250.json. */
export const ed250: Loco = {
	id: "ed250",
	name: "ED250 (Pendolino)",
	inputPrefix: "ed250",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/Pendolino",
	commands: [
		// Tested in game 2026-11-21: channel up/down and ZEW calls work. No on/off: the ED250 radio can't be switched off
		// (radio_enable_set has no effect and radio_on_lamp is never published).
		...radioPanel(radio)
			.filter((c) => c.id !== "radio.on" && c.id !== "radio.off")
			.map((c) => ({ ...c, verified: "live" as const })),

		doors.momentary({ id: "doors.left", fn: "doors.left", label: "Doors – open left", short: "Doors\nleft", topic: `${IN}/door_open_left`, press: 1, release: 0, feedback: lamp(`${OUT}/door_left_allowed`), verified: "live" }),
		doors.momentary({ id: "doors.right", fn: "doors.right", label: "Doors – open right", short: "Doors\nright", topic: `${IN}/door_open_right`, press: 1, release: 0, feedback: lamp(`${OUT}/door_right_allowed`), verified: "live" }),
		doors.momentary({ id: "doors.close", fn: "doors.close", label: "Doors – close", short: "Doors\nclose", topic: `${IN}/door_close`, press: 1, release: 0, feedback: lamp(`${OUT}/door`), verified: "live", note: "live-tested: clears both door_left_allowed and door_right_allowed" }),

		horn.momentary({ id: "horn.low", fn: "horn.low", label: "Horn – low tone", short: "Horn\nlow", topic: gin("horn_signal"), press: 1, release: 0, verified: "live" }),
		horn.momentary({ id: "horn.high", fn: "horn.high", label: "Horn – high tone", short: "Horn\nhigh", topic: gin("horn_signal"), press: 2, release: 0, verified: "live" }),
		horn.momentary({ id: "horn.both", fn: "horn.both", label: "Horn – both tones", short: "Horn\nboth", topic: gin("horn_signal"), press: 3, release: 0, verified: "live" }),

		...positions(lights, "light.mode", gin("light_pos"), MODES, "Front lights").map((c) => (["light.mode.1","light.mode.2"].includes(c.id) ? { ...c, verified: "live" as const } : c)),
		...positions(lights, "light.rear", `${IN}/rear_light_pos`, MODES.map((m) => ({ ...m, fn: m.fn === "lights.tail" ? "lights.rear_tail" : undefined, short: `Rear\n${m.label}` })), "Rear lights").map((c) => (["light.rear.7"].includes(c.id) ? { ...c, verified: "live" as const } : c)),
		lights.cycle({ id: "light.mode.next", fn: "lights.mode.next", label: "Front lights – next mode", short: "Lights\nmode ›", topic: gin("light_pos"), values: [1, 3, 7, 2] }),
		lights.toggle({ id: "light.dim", fn: "lights.dim", label: "Headlights – low beam / signal light", short: "Low\nbeam", topic: gin("lights_power"), off: -1, on: 1, verified: "live" }),
		lights.toggle({ id: "light.high_beam", label: "Headlights – high beam", short: "High\nbeam", topic: `${IN}/high_beam_headlights`, off: -1, on: 1, feedback: lamp(`${OUT}/high_beam_headlights`) }),
		lights.toggle({ id: "light.upper", label: "Headlights – upper headlight", short: "Upper\nlight", topic: `${IN}/upper_headlight`, off: -1, on: 1, verified: "live" }),
		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light", short: "Cab\nlight", topic: gin("cabin_light"), off: -1, on: 1, feedback: lamp(gout("cab_light")), verified: "live" }),
		lights.toggle({ id: "light.dashboard", fn: "lights.dashboard", label: "Lights – desk light", short: "Desk\nlight", topic: gin("dashboard_light"), off: -1, on: 1, feedback: lamp(gout("dashboard_light")), verified: "live" }),
		lights.toggle({ id: "light.spot_driver", label: "Lights – reading spotlight (driver)", short: "Spot\ndriver", topic: `${IN}/spotlight_driver`, off: -1, on: 1, note: "from the topic dump; values assumed like the other ED250 switches", verified: "live" }),
		lights.toggle({ id: "light.spot_helper", label: "Lights – reading spotlight (assistant)", short: "Spot\nassist", topic: `${IN}/spotlight_helper`, off: -1, on: 1, note: "from the topic dump; values assumed like the other ED250 switches", verified: "live" }),
		lights.toggle({ id: "light.corridor", label: "Lights – corridor light", short: "Corridor\nlight", topic: `${IN}/corridor_light`, off: -1, on: 1, note: "from the topic dump; values assumed like the other ED250 switches", verified: "live" }),
		lights.momentary({ id: "light.passenger_on", label: "Lights – passenger compartment on", short: "Pass.\non", topic: `${IN}/pas_comp_light`, press: 1, release: 0, verified: "live" }),
		lights.momentary({ id: "light.passenger_off", label: "Lights – passenger compartment off", short: "Pass.\noff", topic: `${IN}/pas_comp_light`, press: -1, release: 0, verified: "live" }),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / SIFA acknowledge", short: "SHP\nSIFA", topic: `${IN}/shp_button`, also: [gin("security_system_button")], press: 1, release: -1, feedback: lamp(`${OUT}/shp`, `${OUT}/sifa`), verified: "live", note: "live-tested: clears both SHP and SIFA (the general security_system_button alone does not); holding it over 2 s runs the SIFA lamp test and the key lights" }),
		safety.momentary({ id: "safety.shp_button", label: "SHP button (ED250 panel)", short: "SHP", topic: `${IN}/shp_button`, press: 1, release: -1, feedback: lamp(`${OUT}/shp`) }),
		radiostop(safety, `${OUT}/radiostop_active`),
		safety.momentary({ id: "safety.etcs_ack", fn: "safety.etcs_ack", label: "ETCS acknowledge", short: "ETCS\nACK", topic: gin("etcs_ack_button"), press: 1, release: 0, feedback: lamp(gout("etcs_ack_light")), verified: "live", note: "works from the deck; the game decides the press length (sometimes a tap is enough, sometimes it must be held)" }),
		safety.toggle({ id: "safety.ebrake", fn: "safety.ebrake", label: "Emergency brake switch", short: "Emerg.\nbrake", topic: gin("emergency_brake_button"), off: -1, on: 1, feedback: lamp(`${OUT}/emergency_brake_engaged`) }),
		safety.toggle({ id: "safety.etcs_isolate", fn: "safety.etcs_isolate", label: "ETCS isolation", short: "ETCS\nisolate", topic: gin("etcs_isolation_rq"), off: -1, on: 1, feedback: lamp(`${OUT}/etcs_disabled`) }),
		safety.toggle({ id: "safety.disable_shp", label: "Disable SHP", short: "SHP\noff", topic: `${IN}/disable_shp`, off: -1, on: 1, feedback: lamp(`${OUT}/shp_disabled`) }),
		safety.toggle({ id: "safety.disable_sifa", label: "Disable SIFA", short: "SIFA\noff", topic: `${IN}/disable_sifa`, off: -1, on: 1, feedback: lamp(`${OUT}/sifa_disabled`) }),
		safety.toggle({ id: "safety.disable_radiostop", label: "Disable RADIOSTOP", short: "RSTOP\noff", topic: `${IN}/disable_radiostop`, off: -1, on: 1, feedback: lamp(`${OUT}/radiostop_disabled`) }),
		safety.toggle({ id: "safety.disable_pzb", label: "Disable PZB", short: "PZB\noff", topic: `${IN}/disable_pzb`, off: -1, on: 1, feedback: lamp(`${OUT}/pzb_disabled`) }),
		safety.toggle({ id: "safety.disable_lzb", label: "Disable LZB", short: "LZB\noff", topic: `${IN}/disable_lzb`, off: -1, on: 1, feedback: lamp(`${OUT}/lzb_disabled`) }),
		safety.momentary({ id: "safety.test_sifa", label: "SIFA test", short: "SIFA\ntest", topic: `${IN}/test_sifa`, press: 1, release: 0, verified: "live" }),
	],
};
