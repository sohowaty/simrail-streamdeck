/**
 * SimRail payload format:
 *   game -> client : 0x01 + float32 LE (5 bytes)  or  0x02 + UTF-8 string
 *   client -> game : raw float32 LE, no type byte (4 bytes). The broker echoes these back unchanged.
 */

export function encodeFloat(value: number): Buffer {
	const buf = Buffer.alloc(4);
	buf.writeFloatLE(value, 0);
	return buf;
}

export function decode(payload: Uint8Array): number | string | undefined {
	const buf = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
	if (buf.length === 0) return undefined;
	if (buf.length === 5 && buf[0] === 0x01) return round(buf.readFloatLE(1));
	// Our own publishes (and other clients') come back as raw 4-byte floats.
	if (buf.length === 4) return round(buf.readFloatLE(0));
	if (buf[0] === 0x02) return buf.subarray(1).toString("utf8");
	const text = buf.toString("utf8");
	const n = Number(text);
	return text.trim() !== "" && Number.isFinite(n) ? n : text;
}

/** float32 -> readable number (2.0000000298 -> 2, 0.6000000238 -> 0.6). */
function round(v: number): number {
	return Number.isFinite(v) ? Number(v.toPrecision(7)) : v;
}
