import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AUTO_BY_ID, AUTO_FUNCTIONS, commandTopics, detectLoco, LOCO_BY_ID, LOCOS, publishTopics, resolveAuto } from "../src/catalog";

/** Topic list from a real game dump (copied into test/fixtures/dumps). */
function dumpTopics(file: string): string[] {
	const d = JSON.parse(readFileSync(new URL(`./fixtures/dumps/${file}`, import.meta.url), "utf8"));
	return [...d.Inputs, ...d.Outputs].map((e: { Topic: string }) => e.Topic);
}

const DUMPS = [
	{ file: "topics_dump_eu07.json", loco: "eu07" },
	{ file: "topics_dump_en76.json", loco: "en76" },
	{ file: "topics_dump_ed250.json", loco: "ed250" },
	{ file: "topics_dump_traxx_e186.json", loco: "traxx" },
	{ file: "topics_dump_163.json", loco: "cd163" },
	{ file: "topics_dump_et22.json", loco: "et22" },
	{ file: "topics_dump_e6act.json", loco: "dragon2" },
	{ file: "topics_dump_impuls.json", loco: "impuls2" },
	{ file: "topics_dump_en57.json", loco: "en57" },
];

describe("catalog structure", () => {
	for (const loco of LOCOS) {
		it(`${loco.id}: unique ids, known functions, well-formed topics`, () => {
			const ids = loco.commands.map((c) => c.id);
			expect(new Set(ids).size, `duplicate ids in ${loco.id}`).toBe(ids.length);
			for (const c of loco.commands) {
				if (c.fn) expect(AUTO_BY_ID.has(c.fn), `${loco.id}/${c.id}: unknown fn ${c.fn}`).toBe(true);
				for (const t of publishTopics(c.behaviour)) {
					expect(t, `${loco.id}/${c.id}`).toMatch(new RegExp(`^physics_input_(general|${loco.inputPrefix})/[a-zA-Z0-9_]+$`));
				}
				for (const t of c.feedback?.topics ?? []) {
					expect(t, `${loco.id}/${c.id}`).toMatch(/^(physics_(input|output)_[a-z0-9_]+|trainset|etcs)\/[a-zA-Z0-9_]+$/);
				}
				expect(c.short.split("\n").length).toBeLessThanOrEqual(2);
			}
		});
	}

	it("every Auto function is offered by at least one loco", () => {
		for (const f of AUTO_FUNCTIONS) {
			expect(LOCOS.some((l) => resolveAuto(l, f.id)), f.id).toBe(true);
		}
	});
});

describe("real dumps", () => {
	for (const { file, loco: id } of DUMPS) {
		const topics = dumpTopics(file);
		const loco = LOCO_BY_ID.get(id)!;

		it(`${file} is detected as ${id}`, () => {
			expect(detectLoco(topics)?.id).toBe(id);
		});

		it(`every ${id} topic exists in ${file}`, () => {
			const known = new Set(topics);
			const missing = loco.commands.flatMap((c) => commandTopics(c).filter((t) => !known.has(t)).map((t) => `${c.id}: ${t}`));
			expect(missing).toEqual([]);
		});
	}

	it("Auto picks the E186 for the shared Traxx prefix; Traxx DE is manual only", () => {
		const base = ["physics_input_general/horn_signal", "physics_input_traxx_e186/activation_handle"];
		expect(detectLoco(base)?.id).toBe("traxx");
		expect(detectLoco([...base, "physics_input_traxx_e186/diesel_engine_disable_rq"])?.id).toBe("traxx");
		expect(LOCO_BY_ID.get("traxx_de")?.autoDetect).toBe(false);
	});
});

describe("Auto mode", () => {
	it("maps the same function to each loco's own topic", () => {
		expect(resolveAuto(LOCO_BY_ID.get("eu07")!, "horn.high")?.behaviour).toMatchObject({ topic: "physics_input_general/horn_signal", press: 2 });
		expect(resolveAuto(LOCO_BY_ID.get("en76")!, "horn.high")?.behaviour).toMatchObject({ topic: "physics_input_elf_34we/warning_signal_handle", press: 1 });
	});
	it("falls back for single-tone horns", () => {
		expect(resolveAuto(LOCO_BY_ID.get("en57")!, "horn.high")?.id).toBe("horn");
	});
	it("returns nothing where a loco has no such function", () => {
		expect(resolveAuto(LOCO_BY_ID.get("eu07")!, "doors.left")).toBeUndefined();
	});
});
