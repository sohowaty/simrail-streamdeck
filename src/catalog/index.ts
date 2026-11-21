import { AUTO_BY_ID, AUTO_FUNCTIONS } from "./functions";
import { cd163 } from "./locos/cd163";
import { dragon2 } from "./locos/dragon2";
import { ed250 } from "./locos/ed250";
import { en57 } from "./locos/en57";
import { en76 } from "./locos/en76";
import { et22 } from "./locos/et22";
import { eu07 } from "./locos/eu07";
import { impuls2 } from "./locos/impuls2";
import { traxx, traxxDe } from "./locos/traxx";
import { type Behaviour, CATEGORIES, type Command, type Loco } from "./types";

export * from "./types";
export { AUTO_FUNCTIONS, AUTO_BY_ID } from "./functions";

export const LOCOS: Loco[] = [eu07, et22, en57, en76, ed250, dragon2, traxx, traxxDe, impuls2, cd163];
export const LOCO_BY_ID = new Map(LOCOS.map((l) => [l.id, l]));

export function findCommand(locoId: string, commandId: string): Command | undefined {
	return LOCO_BY_ID.get(locoId)?.commands.find((c) => c.id === commandId);
}

/**
 * Picks the loco from the list of topics the game reports (`request_topics` response).
 * Locos sharing a prefix are told apart by their `detect` rules.
 */
export function detectLoco(topics: Iterable<string>): Loco | undefined {
	const all = new Set(topics);
	const prefixes = new Set<string>();
	for (const t of all) {
		const m = /^physics_input_([^/]+)\//.exec(t);
		if (m && m[1] !== "general") prefixes.add(m[1]);
	}
	return LOCOS.find(
		(l) =>
			l.autoDetect !== false &&
			prefixes.has(l.inputPrefix) &&
			(l.detect?.requires ?? []).every((t) => all.has(t)) &&
			!(l.detect?.excludes ?? []).some((t) => all.has(t)),
	);
}

/** Maps an Auto function to the command of the given loco, trying fallbacks in order. */
export function resolveAuto(loco: Loco, fnId: string): Command | undefined {
	const order = [fnId, ...(AUTO_BY_ID.get(fnId)?.fallbacks ?? [])];
	for (const id of order) {
		const cmd = loco.commands.find((c) => c.fn === id);
		if (cmd) return cmd;
	}
	return undefined;
}

/** Every topic a command publishes to. */
export function publishTopics(b: Behaviour): string[] {
	switch (b.type) {
		case "set":
			return b.publish.map((p) => p.topic);
		case "momentary":
			return [b.topic, ...(b.also ?? [])];
		default:
			return [b.topic];
	}
}

/** Every topic a command touches: published ones plus feedback sources. */
export function commandTopics(c: Command): string[] {
	return [...new Set([...publishTopics(c.behaviour), ...(c.feedback?.topics ?? [])])];
}

/** Everything the property inspector needs to build its lists (sent as JSON). */
export function catalogPayload(status: object, topics: Set<string> | undefined) {
	return {
		event: "catalog",
		categories: CATEGORIES,
		auto: AUTO_FUNCTIONS.map((f) => ({ id: f.id, category: f.category, label: f.label, fallbacks: f.fallbacks ?? [] })),
		locos: LOCOS.map((l) => ({
			id: l.id,
			name: l.name,
			source: l.source,
			commands: l.commands.map((c) => ({
				id: c.id,
				fn: c.fn ?? null,
				category: c.category,
				label: c.label,
				verified: c.verified,
				note: c.note ?? null,
				topics: commandTopics(c),
			})),
		})),
		status: JSON.parse(JSON.stringify(status)),
		topics: topics ? [...topics] : null,
	};
}
