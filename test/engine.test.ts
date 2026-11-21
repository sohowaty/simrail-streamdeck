import { describe, expect, it } from "vitest";

import { type Command, findCommand } from "../src/catalog";
import { keyDown, keyUp, view } from "../src/engine";

const cmd = (loco: string, id: string): Command => {
	const c = findCommand(loco, id);
	if (!c) throw new Error(`${loco}/${id} missing`);
	return c;
};
const lookup = (values: Record<string, number>) => (t: string) => values[t];

describe("momentary", () => {
	it("EU07 high horn: 2 while held, 0 on release", () => {
		const horn = cmd("eu07", "horn.high");
		expect(keyDown(horn, lookup({}), new Map())).toEqual([{ topic: "physics_input_general/horn_signal", value: 2 }]);
		expect(keyUp(horn)).toEqual([{ topic: "physics_input_general/horn_signal", value: 0 }]);
	});

	it("EN76 horn rests at 2 (disabled)", () => {
		expect(keyUp(cmd("en76", "horn.high"))).toEqual([{ topic: "physics_input_elf_34we/warning_signal_handle", value: 2 }]);
	});

	it("EU07 SHP/CA: 1 / -1, lit while the alerter lamp is on", () => {
		const ack = cmd("eu07", "safety.ack");
		expect(keyDown(ack, lookup({}), new Map())[0].value).toBe(1);
		expect(keyUp(ack)[0].value).toBe(-1);
		expect(view(ack, lookup({ "physics_output_eu07/alerter_state": 0.8 }), new Map(), false).on).toBe(true);
		expect(view(ack, lookup({ "physics_output_eu07/alerter_state": 0, "physics_output_eu07/shp_state": 0 }), new Map(), false).on).toBe(false);
	});

	it("EN57 acknowledge presses both cab buttons", () => {
		const topics = keyDown(cmd("en57", "safety.ack"), lookup({}), new Map()).map((p) => p.topic);
		expect(topics).toEqual(["physics_input_en57/security_system_button_a", "physics_input_en57/security_system_button_b"]);
	});
});

describe("toggle", () => {
	const cab = cmd("eu07", "light.cab");
	it("turns on when the lamp output is off", () => {
		expect(keyDown(cab, lookup({ "physics_output_general/cab_light": 0 }), new Map())).toEqual([{ topic: "physics_input_general/cabin_light", value: 1 }]);
	});
	it("turns off when the lamp output is lit", () => {
		expect(keyDown(cab, lookup({ "physics_output_general/cab_light": 0.7 }), new Map())[0].value).toBe(-1);
	});
	it("falls back to the echoed input value, then local memory", () => {
		expect(keyDown(cab, lookup({ "physics_input_general/cabin_light": 1 }), new Map())[0].value).toBe(-1);
		expect(keyDown(cab, lookup({}), new Map([["physics_input_general/cabin_light", 1]]))[0].value).toBe(-1);
		expect(keyDown(cab, lookup({}), new Map())[0].value).toBe(1);
	});
});

describe("step", () => {
	const up = cmd("eu07", "radio.ch.up");
	const down = cmd("eu07", "radio.ch.down");
	it("steps from the reported channel and clamps", () => {
		expect(keyDown(up, lookup({ "trainset/radio_channel": 3 }), new Map())[0].value).toBe(4);
		expect(keyDown(up, lookup({ "trainset/radio_channel": 10 }), new Map())[0].value).toBe(10);
		expect(keyDown(down, lookup({ "trainset/radio_channel": 1 }), new Map())[0].value).toBe(1);
	});
	it("shows the channel number", () => {
		expect(view(up, lookup({ "trainset/radio_channel": 2 }), new Map(), false).value).toBe("CH 2");
	});
});

describe("set / cycle", () => {
	it("radio channel key is lit when that channel is active", () => {
		const ch3 = cmd("eu07", "radio.ch.3");
		expect(keyDown(ch3, lookup({}), new Map())).toEqual([{ topic: "physics_input_general/radio_channel_set", value: 3 }]);
		expect(view(ch3, lookup({ "trainset/radio_channel": 3 }), new Map(), false).on).toBe(true);
		expect(view(ch3, lookup({ "trainset/radio_channel": 2 }), new Map(), false).on).toBe(false);
	});

	it("EU07 Pc1 preset switches all five front lamps", () => {
		const pubs = keyDown(cmd("eu07", "light.preset.front_pc1"), lookup({}), new Map());
		expect(pubs).toContainEqual({ topic: "physics_input_eu07/headlight_individual_ft", value: 16 });
		expect(pubs).toContainEqual({ topic: "physics_input_eu07/endsignal_individual_fr", value: -2 });
		expect(pubs).toHaveLength(5);
	});

	it("cycle moves to the next mode and wraps", () => {
		const next = cmd("en76", "light.mode.next");
		expect(keyDown(next, lookup({ "physics_input_general/light_pos": 1 }), new Map())[0].value).toBe(2);
		expect(keyDown(next, lookup({ "physics_input_general/light_pos": 4 }), new Map())[0].value).toBe(0);
		expect(keyDown(next, lookup({}), new Map())[0].value).toBe(0);
	});
});
