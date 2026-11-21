import { describe, expect, it } from "vitest";

import { decode, encodeFloat } from "../src/mqtt/codec";

describe("codec", () => {
	it("publishes raw little-endian float32 (no type byte)", () => {
		// Same bytes as struct.pack("<f", 1.0) in tools/simrail_probe.py
		expect([...encodeFloat(1)]).toEqual([0x00, 0x00, 0x80, 0x3f]);
		expect([...encodeFloat(-1)]).toEqual([0x00, 0x00, 0x80, 0xbf]);
		expect(encodeFloat(2).length).toBe(4);
	});

	it("decodes game floats with the 0x01 prefix", () => {
		const buf = Buffer.concat([Buffer.from([0x01]), encodeFloat(0.6)]);
		expect(decode(buf)).toBe(0.6);
	});

	it("decodes echoed raw floats", () => {
		expect(decode(encodeFloat(65536))).toBe(65536);
		expect(decode(encodeFloat(-8192))).toBe(-8192);
	});

	it("decodes strings with the 0x02 prefix", () => {
		const json = JSON.stringify({ Inputs: [{ Topic: "a/b" }] });
		expect(decode(Buffer.concat([Buffer.from([0x02]), Buffer.from(json)]))).toBe(json);
	});

	it("falls back to plain text (except 4-byte payloads, which are always raw floats)", () => {
		expect(decode(Buffer.from("120.5"))).toBe(120.5);
		expect(decode(Buffer.from("hello"))).toBe("hello");
		expect(decode(Buffer.alloc(0))).toBeUndefined();
	});
});
