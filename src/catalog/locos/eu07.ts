import { gin, gout, individualLights, lamp, radioBox, radiostop, section } from "../helpers";
import type { Loco } from "../types";

const IN = "physics_input_eu07";
const OUT = "physics_output_eu07";

const radio = section("radio", "dump");
const horn = section("horn", "dump");
const lights = section("lights", "dump");
const safety = section("safety", "dump");

/** EU07 / EP07 (wiki 4E) and EP08 (wiki 102E) share the `eu07` topic group. Topics checked against test/fixtures/dumps/topics_dump_eu07.json. */
export const eu07: Loco = {
	id: "eu07",
	name: "EU07 / EP07 / EP08",
	inputPrefix: "eu07",
	source: "https://wiki.simrail.eu/en/MQTT/Trains/4E",
	commands: [
		// Tested in game 2026-11-21: radio on/off, channel up/down, channel 3.
		...radioBox(radio).map((c) => (["radio.power", "radio.ch.up", "radio.ch.down", "radio.ch.3"].includes(c.id) ? { ...c, verified: "live" as const } : c)),

		horn.momentary({ id: "horn.low", fn: "horn.low", label: "Horn – low tone", short: "Horn\nlow", topic: gin("horn_signal"), press: 1, release: 0 }),
		horn.momentary({ id: "horn.high", fn: "horn.high", label: "Horn – high tone", short: "Horn\nhigh", topic: gin("horn_signal"), press: 2, release: 0, verified: "live" }),

		lights.toggle({ id: "light.cab", fn: "lights.cab", label: "Lights – cab light (cab A)", short: "Cab\nlight", topic: gin("cabin_light"), off: -1, on: 1, feedback: lamp(gout("cab_light")), verified: "live" }),
		lights.toggle({ id: "light.cab_b", label: "Lights – cab light (cab B)", short: "Cab B\nlight", topic: gin("cabin_light_b"), off: -1, on: 1 }),
		// No dashboard_light here: tested 2026-11-21, the game accepts it (output follows) but the EU07 cab has no such lamp.
		lights.toggle({ id: "light.instruments", fn: "lights.instruments", label: "Lights – instrument backlight", short: "Instr\nlight", topic: gin("instrument_light"), off: 0, on: 1, feedback: lamp(gout("instrument_light")) }),
		lights.toggle({ id: "light.dim", fn: "lights.dim", label: "Lights – dimming", short: "Lights\ndim", topic: gin("lights_power"), off: 0, on: 1, feedback: { topics: [gin("lights_power")], mode: "equals", equals: 1 } }),
		lights.toggle({ id: "light.general", label: "Lights – general lights", short: "General\nlights", topic: `${IN}/general_lights`, off: 0, on: 1 }),
		// Tested in game 2026-11-21: Cab A Pc1 and all-off presets.
		...individualLights(lights, IN, "Cab A", "Cab B").map((c) => (["light.preset.front_pc1", "light.preset.front_off"].includes(c.id) ? { ...c, verified: "live" as const } : c)),

		safety.momentary({ id: "safety.ack", fn: "safety.ack", label: "SHP / CA acknowledge", short: "SHP\nCA", topic: gin("security_system_button"), press: 1, release: -1, feedback: lamp(`${OUT}/alerter_state`, `${OUT}/shp_state`), verified: "live" }),
		radiostop(safety, `${OUT}/radiostop_active`),
		safety.momentary({ id: "safety.etcs_ack", fn: "safety.etcs_ack", label: "ETCS acknowledge", short: "ETCS\nACK", topic: gin("etcs_ack_button"), press: 1, release: -1, feedback: lamp(gout("etcs_ack_light")) }),
		safety.toggle({ id: "safety.etcs_isolate", fn: "safety.etcs_isolate", label: "ETCS isolation", short: "ETCS\nisolate", topic: gin("etcs_isolation_rq"), off: -1, on: 1, feedback: lamp(gout("security_system_etcs_disabled")) }),
	],
};
