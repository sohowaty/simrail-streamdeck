import type { Category } from "./catalog";

/** Key colours per category: [lit background, dim accent]. */
const COLORS: Record<Category | "raw", { on: string; dim: string }> = {
	radio: { on: "#3b82f6", dim: "#5b8fd9" },
	doors: { on: "#22c55e", dim: "#4fae74" },
	horn: { on: "#f59e0b", dim: "#d39a3a" },
	lights: { on: "#facc15", dim: "#d4b33a" },
	safety: { on: "#ef4444", dim: "#d0605f" },
	raw: { on: "#a855f7", dim: "#9b77c9" },
};

/** 24x24 line icons, drawn with stroke="currentColor". */
const ICONS: Record<Category | "raw", string> = {
	radio: `<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M7 8 17 3"/><circle cx="15" cy="14.5" r="3"/><path d="M6 13h3M6 16h3"/>`,
	doors: `<rect x="5" y="2.5" width="14" height="19" rx="1"/><rect x="8" y="5.5" width="8" height="6" rx="0.5"/><path d="M15.5 14.5v2.5"/>`,
	horn: `<path d="M3 9.5h4l9-5v15l-9-5H3z"/><path d="M19 8.5c1.5 1.5 1.5 5.5 0 7"/>`,
	lights: `<circle cx="12" cy="11" r="5"/><path d="M10 19h4M10.5 22h3M12 2v1.5M4 11H2.5M21.5 11H20M5.6 4.6l1 1M18.4 4.6l-1 1"/>`,
	safety: `<path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>`,
	raw: `<path d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16"/>`,
};

export type KeyLook = {
	category: Category | "raw";
	label: string;
	on: boolean;
	value?: string;
	/** offline = no game session, na = this loco has no such command, unset = not configured yet. */
	problem?: "offline" | "na" | "unset";
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function textLines(lines: string[], startY: number, size: number, fill: string): string {
	return lines
		.map((l, i) => {
			const fs = l.length > 8 ? Math.max(14, Math.floor((size * 8) / l.length)) : size;
			return `<text x="72" y="${startY + i * (size + 6)}" font-size="${fs}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" fill="${fill}">${esc(l)}</text>`;
		})
		.join("");
}

/** Builds the 144x144 key image as an SVG data URL. */
export function renderKey(look: KeyLook): string {
	const c = COLORS[look.category];
	const lit = look.on && !look.problem;
	const bg = lit ? c.on : "#17191e";
	const fg = lit ? "#111111" : "#e8e8e8";
	const accent = lit ? "#111111" : look.problem ? "#6b6b6b" : c.dim;
	const lines = look.label.split("\n").slice(0, 2);

	let body = `<g transform="translate(${look.value ? 50 : 46} ${look.value ? 10 : 12}) scale(${look.value ? 1.8 : 2.2})" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[look.category]}</g>`;

	if (look.value) {
		body += textLines([lines.join(" ")], 76, 18, look.problem ? "#8a8a8a" : fg);
		body += `<text x="72" y="122" font-size="34" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" fill="${look.problem ? "#8a8a8a" : fg}">${esc(look.value)}</text>`;
	} else {
		body += textLines(lines, lines.length > 1 ? 92 : 104, 22, look.problem ? "#8a8a8a" : fg);
	}

	if (look.problem === "na") {
		body += `<rect x="6" y="6" width="132" height="132" rx="16" fill="none" stroke="#ef4444" stroke-width="4" stroke-dasharray="10 8"/>`;
		body += `<text x="128" y="28" font-size="18" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-weight="800" fill="#ef4444">n/a</text>`;
	} else if (look.problem === "offline") {
		body += `<circle cx="124" cy="20" r="7" fill="#6b7280"/>`;
	} else if (look.problem === "unset") {
		body += `<text x="72" y="138" font-size="14" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" fill="#9ca3af">set up ›</text>`;
	}

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="18" fill="${bg}"/>${body}</svg>`;
	return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}
