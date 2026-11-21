/**
 * Catalog types. A catalog entry describes one Stream Deck command for one loco:
 * which topic(s) to publish, how the key behaves, and where its displayed state comes from.
 */

export type Category = "radio" | "doors" | "horn" | "lights" | "safety";

export const CATEGORIES: { id: Category; label: string }[] = [
	{ id: "radio", label: "Radio" },
	{ id: "doors", label: "Doors" },
	{ id: "horn", label: "Horn" },
	{ id: "lights", label: "Lights" },
	{ id: "safety", label: "Safety systems" },
];

/** One float published to one topic. */
export type Pub = { topic: string; value: number };

export type Behaviour =
	/** Key down sends `press`, key up sends `release` (buttons, horn levers that spring back). */
	| { type: "momentary"; topic: string; press: number; release: number; also?: string[] }
	/** Key down sends every publish in order (fixed positions, presets). */
	| { type: "set"; publish: Pub[] }
	/** Key down flips between `off` and `on`, using the displayed state to decide. */
	| { type: "toggle"; topic: string; off: number; on: number }
	/** Key down adds `delta` to the current value, clamped to min..max. */
	| { type: "step"; topic: string; delta: number; min: number; max: number }
	/** Key down moves to the next value in the list (wraps). */
	| { type: "cycle"; topic: string; values: number[] };

export type Feedback = {
	/** Topics the state is read from. `lamp` is on if any of them is lit. */
	topics: string[];
	/**
	 * lamp   – on when the value is > threshold (indicator lamps, output switches)
	 * equals – on when the value equals `equals` (selected position / channel)
	 * value  – show the number on the key using `format`
	 */
	mode: "lamp" | "equals" | "value";
	threshold?: number;
	equals?: number;
	format?: string;
};

/**
 * live = confirmed in a running game, dump = topic exists in a real topic dump (values from the wiki),
 * wiki = taken from the SimRail wiki only.
 */
export type Verified = "live" | "dump" | "wiki";

export type Command = {
	/** Unique within the loco. */
	id: string;
	/** Loco-independent function used by Auto mode (see functions.ts). */
	fn?: string;
	category: Category;
	label: string;
	/** Short text drawn on the key (2 lines max, ~10 chars each). */
	short: string;
	behaviour: Behaviour;
	feedback?: Feedback;
	verified: Verified;
	note?: string;
};

export type Loco = {
	id: string;
	name: string;
	/** `physics_input_<inputPrefix>/` topics identify the loco in the topic list. */
	inputPrefix: string;
	/** Extra detection rules for locos that share a prefix. */
	detect?: { requires?: string[]; excludes?: string[] };
	/** false = never picked by Auto (its topic list can't be told apart); the user selects it by hand. */
	autoDetect?: false;
	/** Wiki page the entries were taken from. */
	source: string;
	commands: Command[];
};
