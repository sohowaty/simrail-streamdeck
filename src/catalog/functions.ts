import type { Category } from "./types";

/**
 * Loco-independent functions offered in Auto mode. At runtime each one is mapped to the command with the
 * same `fn` in the detected loco's catalog. `fallbacks` are tried in order when the loco has no exact match
 * (e.g. a loco with a single horn tone answers both "low" and "high").
 */
export type AutoFunction = { id: string; category: Category; label: string; fallbacks?: string[] };

const channels: AutoFunction[] = Array.from({ length: 10 }, (_, i) => ({
	id: `radio.ch.${i + 1}`,
	category: "radio" as const,
	label: `Radio – channel ${i + 1}`,
}));

export const AUTO_FUNCTIONS: AutoFunction[] = [
	// Radio
	{ id: "radio.power", category: "radio", label: "Radio – on/off", fallbacks: ["radio.on"] },
	{ id: "radio.on", category: "radio", label: "Radio – power on", fallbacks: ["radio.power"] },
	{ id: "radio.off", category: "radio", label: "Radio – power off", fallbacks: ["radio.power"] },
	{ id: "radio.ch.up", category: "radio", label: "Radio – channel up" },
	{ id: "radio.ch.down", category: "radio", label: "Radio – channel down" },
	{ id: "radio.ch.show", category: "radio", label: "Radio – show channel (display only)" },
	...channels,
	{ id: "radio.vol.up", category: "radio", label: "Radio – volume up" },
	{ id: "radio.vol.down", category: "radio", label: "Radio – volume down" },
	{ id: "radio.zew1", category: "radio", label: "Radio – call ZEW 1" },
	{ id: "radio.zew3", category: "radio", label: "Radio – call ZEW 3" },

	// Doors
	{ id: "doors.left", category: "doors", label: "Doors – open / release left" },
	{ id: "doors.right", category: "doors", label: "Doors – open / release right" },
	{ id: "doors.both", category: "doors", label: "Doors – release both sides" },
	{ id: "doors.open", category: "doors", label: "Doors – open button" },
	{ id: "doors.close", category: "doors", label: "Doors – close" },
	{ id: "doors.lock", category: "doors", label: "Doors – lock (selector closed)", fallbacks: ["doors.close"] },
	{ id: "doors.signal", category: "doors", label: "Doors – departure signal" },
	{ id: "doors.step", category: "doors", label: "Doors – steps" },

	// Horn
	{ id: "horn.low", category: "horn", label: "Horn – low tone", fallbacks: ["horn.high", "horn.both"] },
	{ id: "horn.high", category: "horn", label: "Horn – high tone", fallbacks: ["horn.low", "horn.both"] },
	{ id: "horn.both", category: "horn", label: "Horn – both tones", fallbacks: ["horn.high", "horn.low"] },
	{ id: "horn.whistle", category: "horn", label: "Whistle" },

	// Lights
	{ id: "lights.cab", category: "lights", label: "Lights – cab light" },
	{ id: "lights.dashboard", category: "lights", label: "Lights – dashboard / desk light" },
	{ id: "lights.instruments", category: "lights", label: "Lights – instrument backlight" },
	{ id: "lights.dim", category: "lights", label: "Lights – headlight dimming" },
	{ id: "lights.mode.next", category: "lights", label: "Lights – next headlight mode" },
	{ id: "lights.off", category: "lights", label: "Lights – headlights off", fallbacks: ["lights.front_off"] },
	{ id: "lights.drive", category: "lights", label: "Lights – train drive (Pc1)", fallbacks: ["lights.front_drive"] },
	{ id: "lights.shunt", category: "lights", label: "Lights – shunting (Tb1)" },
	{ id: "lights.tail", category: "lights", label: "Lights – end of train (Pc5)", fallbacks: ["lights.rear_tail"] },
	{ id: "lights.alarm", category: "lights", label: "Lights – alarm (A1)" },
	{ id: "lights.front_drive", category: "lights", label: "Lights – front: drive (white)", fallbacks: ["lights.drive"] },
	{ id: "lights.front_tail", category: "lights", label: "Lights – front: end of train (red)" },
	{ id: "lights.front_off", category: "lights", label: "Lights – front: off", fallbacks: ["lights.off"] },
	{ id: "lights.rear_drive", category: "lights", label: "Lights – rear: drive (white)" },
	{ id: "lights.rear_tail", category: "lights", label: "Lights – rear: end of train (red)", fallbacks: ["lights.tail"] },
	{ id: "lights.rear_off", category: "lights", label: "Lights – rear: off" },

	// Safety
	{ id: "safety.ack", category: "safety", label: "SHP / CA acknowledge" },
	{ id: "safety.radiostop", category: "safety", label: "RADIOSTOP" },
	{ id: "safety.ebrake", category: "safety", label: "Emergency brake button" },
	{ id: "safety.etcs_ack", category: "safety", label: "ETCS acknowledge" },
	{ id: "safety.etcs_isolate", category: "safety", label: "ETCS isolation" },
];

export const AUTO_BY_ID = new Map(AUTO_FUNCTIONS.map((f) => [f.id, f]));
