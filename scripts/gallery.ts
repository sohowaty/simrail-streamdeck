/**
 * Dev preview: renders every key image (off state) into dist/preview/gallery.html and writes the
 * property-inspector catalog to dist/preview/catalog.json.
 *   npm run preview:build
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { catalogPayload, LOCOS } from "../src/catalog";
import { view } from "../src/engine";
import { type KeyLook, renderKey } from "../src/render";

const dir = "dist/preview";
mkdirSync(dir, { recursive: true });

const cell = (look: KeyLook, caption: string) =>
	`<figure><img src="${renderKey(look)}" width="96" height="96"><figcaption>${caption}</figcaption></figure>`;

let html = `<!doctype html><meta charset="utf-8"><title>Key gallery</title><style>
body{background:#111;color:#ccc;font:12px system-ui;margin:16px}h2{margin:24px 0 8px}
.grid{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;width:96px}figcaption{font-size:10px;opacity:.7;overflow-wrap:anywhere}</style>`;

html += `<h2>States</h2><div class="grid">`;
html += cell({ category: "safety", label: "SHP\nCA", on: false }, "idle");
html += cell({ category: "safety", label: "SHP\nCA", on: true }, "lamp lit");
html += cell({ category: "lights", label: "Cab\nlight", on: true }, "lights on");
html += cell({ category: "radio", label: "CH +", on: false, value: "CH 3" }, "value");
html += cell({ category: "horn", label: "Horn\nhigh", on: true }, "held");
html += cell({ category: "doors", label: "Doors\nleft", on: true }, "doors on");
html += cell({ category: "horn", label: "Horn\nhigh", on: false, problem: "offline" }, "no session");
html += cell({ category: "doors", label: "Doors\nleft", on: false, problem: "na" }, "n/a on this loco");
html += cell({ category: "raw", label: "SimRail", on: false, problem: "unset" }, "not configured");
html += `</div>`;

for (const loco of LOCOS) {
	html += `<h2>${loco.name} (${loco.commands.length})</h2><div class="grid">`;
	for (const c of loco.commands) {
		const v = view(c, () => undefined, new Map(), false);
		html += cell({ category: c.category, label: c.short, on: false, value: v.value }, c.id);
	}
	html += `</div>`;
}
writeFileSync(`${dir}/gallery.html`, html);

const status = { connected: true, host: "127.0.0.1", port: 1883, loco: { id: "eu07", name: "EU07 / EP07 / EP08" }, topicCount: 165 };
writeFileSync(`${dir}/catalog.json`, JSON.stringify(catalogPayload(status, undefined)));
console.log(`wrote ${dir}/gallery.html and catalog.json`);
