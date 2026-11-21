// Property inspector for the "SimRail command" action.
// Talks to Stream Deck over the documented property-inspector WebSocket; the plugin sends the catalog.
"use strict";

const $ = (id) => document.getElementById(id);

let ws;
let pluginUuid; // this panel's registration id: Stream Deck expects it as `context` for every command it sends
let actionUuid;
let context; // the key this panel belongs to (differs from pluginUuid on Stream Deck 7)
let settings = {};
let globals = {};
const OFFLINE = { connected: false, host: "", port: 0, loco: null, topicCount: 0 };
let catalog = { ...window.SIMRAIL_CATALOG, status: OFFLINE, topics: null };
let statusReceived = false;
let statusTimer;

const VERIFIED_TEXT = {
	live: "tested in game",
	dump: "topic seen in a game dump",
	wiki: "from the wiki, not tested yet",
};

window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
	pluginUuid = uuid;
	const ai = JSON.parse(actionInfo);
	actionUuid = ai.action;
	context = ai.context;
	settings = ai.payload.settings || {};

	ws = new WebSocket(`ws://127.0.0.1:${port}`);
	ws.onopen = () => {
		send({ event: registerEvent, uuid });
		send({ event: "getGlobalSettings", context: pluginUuid });
		render();
		// The plugin can only answer once Stream Deck has told it this panel is open; ask until it does.
		const ask = () => {
			if (statusReceived) return;
			toPlugin({ event: "getStatus" });
			statusTimer = setTimeout(ask, 1500);
		};
		ask();
	};
	ws.onmessage = (msg) => {
		const data = JSON.parse(msg.data);
		switch (data.event) {
			case "sendToPropertyInspector":
				if (data.payload && data.payload.event === "status") {
					statusReceived = true;
					clearTimeout(statusTimer);
					catalog.status = data.payload.status;
					catalog.topics = data.payload.topics;
					render();
				}
				break;
			case "didReceiveGlobalSettings":
				globals = data.payload.settings || {};
				$("host").value = globals.host || "";
				$("port").value = globals.port || "";
				break;
			case "didReceiveSettings":
				if (data.context === context) {
					settings = data.payload.settings || {};
					render();
				}
				break;
		}
	};
};

function send(obj) {
	if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function toPlugin(payload) {
	send({ event: "sendToPlugin", action: actionUuid, context: pluginUuid, payload });
}

function save() {
	send({ event: "setSettings", action: actionUuid, context: pluginUuid, payload: settings });
}

function saveGlobals() {
	send({ event: "setGlobalSettings", context: pluginUuid, payload: globals });
}

// ---------------------------------------------------------------------------------------------

/** Entries (id, label, category) for the selected loco, or the Auto functions. */
function entriesFor(locoId) {
	if (!catalog) return [];
	if (locoId === "auto") return catalog.auto;
	const loco = catalog.locos.find((l) => l.id === locoId);
	return loco ? loco.commands : [];
}

function option(value, text, selected) {
	const o = document.createElement("option");
	o.value = value;
	o.textContent = text;
	o.selected = !!selected;
	return o;
}

function fill(select, options) {
	select.replaceChildren(...options);
}

/** Picks sensible defaults so a freshly dropped key is immediately usable. */
function normalise() {
	let changed = false;
	if (!settings.loco) {
		settings.loco = "auto";
		changed = true;
	}
	if (settings.loco === "raw") return changed;
	const entries = entriesFor(settings.loco);
	if (!entries.length) return changed;
	const current = entries.find((e) => e.id === settings.command);
	if (!current) {
		const inCategory = entries.filter((e) => e.category === settings.category);
		settings.command = (inCategory[0] || entries[0]).id;
		changed = true;
	}
	const cat = entries.find((e) => e.id === settings.command).category;
	if (settings.category !== cat) {
		settings.category = cat;
		changed = true;
	}
	return changed;
}

function render() {
	if (!catalog) return;
	if (normalise()) save();

	const status = catalog.status;
	const detected = status.loco ? catalog.locos.find((l) => l.id === status.loco.id) : null;

	// Loco list
	const locoOpts = [option("auto", detected ? `Auto (now: ${detected.name})` : "Auto (follows current loco)", settings.loco === "auto")];
	const group = document.createElement("optgroup");
	group.label = "Fixed loco";
	for (const l of catalog.locos) group.append(option(l.id, l.name, settings.loco === l.id));
	locoOpts.push(group, option("raw", "Raw topic (advanced)", settings.loco === "raw"));
	fill($("loco"), locoOpts);

	const raw = settings.loco === "raw";
	$("raw").hidden = !raw;
	$("categoryRow").hidden = raw;
	$("commandRow").hidden = raw;

	if (raw) {
		$("rawTopic").value = settings.rawTopic || "";
		$("rawMode").value = settings.rawMode || "momentary";
		$("rawPress").value = settings.rawPress ?? "";
		$("rawRelease").value = settings.rawRelease ?? "";
		updateRawLabels();
		renderRawInfo();
	} else {
		const entries = entriesFor(settings.loco);
		const cats = catalog.categories.filter((c) => entries.some((e) => e.category === c.id));
		fill($("category"), cats.map((c) => option(c.id, c.label, c.id === settings.category)));
		fill(
			$("command"),
			entries.filter((e) => e.category === settings.category).map((e) => option(e.id, e.label, e.id === settings.command)),
		);
		renderInfo(detected);
	}

	$("label").value = settings.label || "";
	renderStatus(status, detected);
}

function topicHtml(topics) {
	return topics.map((t) => `<code>${escapeHtml(t)}</code>`).join("<br>");
}

function missingTopics(cmd) {
	if (!catalog.topics) return [];
	const known = new Set(catalog.topics);
	return cmd.topics.filter((t) => t.startsWith("physics_input_") && !known.has(t));
}

function commandInfo(cmd, prefix) {
	let html = prefix || "";
	html += `<span class="badge ${cmd.verified}">${cmd.verified}</span>${VERIFIED_TEXT[cmd.verified]}`;
	if (cmd.note) html += `<br><span class="warn">Note:</span> ${escapeHtml(cmd.note)}`;
	html += `<br>${topicHtml(cmd.topics)}`;
	const missing = missingTopics(cmd);
	if (missing.length) html += `<br><span class="warn">Not in the game's topic list:</span> ${missing.map(escapeHtml).join(", ")}`;
	return html;
}

/** Mirrors resolveAuto() in the plugin: exact function, then fallbacks. */
function resolveAuto(loco, fnId) {
	const fn = catalog.auto.find((f) => f.id === fnId);
	for (const id of [fnId, ...(fn ? fn.fallbacks : [])]) {
		const cmd = loco.commands.find((c) => c.fn === id);
		if (cmd) return cmd;
	}
	return null;
}

function renderInfo(detected) {
	const info = $("info");
	if (settings.loco === "auto") {
		if (!detected) {
			const support = catalog.locos.filter((l) => resolveAuto(l, settings.command)).map((l) => l.name);
			info.innerHTML = `Uses whatever loco you're driving.<br>Available on: ${support.length ? support.map(escapeHtml).join(", ") : "none"}`;
			return;
		}
		const cmd = resolveAuto(detected, settings.command);
		info.innerHTML = cmd
			? commandInfo(cmd, `<span class="ok">${escapeHtml(detected.name)}:</span> ${escapeHtml(cmd.label)}<br>`)
			: `<span class="warn">Not available on ${escapeHtml(detected.name)}.</span>`;
		return;
	}
	const loco = catalog.locos.find((l) => l.id === settings.loco);
	const cmd = loco && loco.commands.find((c) => c.id === settings.command);
	info.innerHTML = cmd ? commandInfo(cmd) : "";
}

function renderRawInfo() {
	$("info").innerHTML =
		"Sends a raw 4-byte float, the only format SimRail accepts. Find topics with <code>tools/simrail_probe.py dump</code>.";
	$("infoRow").hidden = false;
}

function renderStatus(status, detected) {
	$("statusDot").classList.toggle("on", status.connected);
	$("statusText").textContent = !statusReceived
		? "waiting for plugin…"
		: status.connected
		? detected
			? `${detected.name} · ${status.topicCount} topics`
			: status.topicCount
				? "connected · unknown loco"
				: "connected · waiting for topic list"
		: `not connected (${status.host}:${status.port})`;
}

function updateRawLabels() {
	const mode = $("rawMode").value;
	$("rawPressLabel").textContent = mode === "momentary" ? "Press value" : mode === "toggle" ? "On value" : "Value";
	$("rawReleaseLabel").textContent = mode === "toggle" ? "Off value" : "Release value";
	$("rawReleaseRow").hidden = mode === "set";
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// ---------------------------------------------------------------------------------------------

$("loco").addEventListener("change", (e) => {
	settings.loco = e.target.value;
	// Keep the same function when switching between Auto and a fixed loco, if it exists there.
	if (settings.loco !== "raw") {
		const entries = entriesFor(settings.loco);
		const prev = settings.command;
		const prevFn = catalog.locos.flatMap((l) => l.commands).find((c) => c.id === prev)?.fn;
		const match =
			entries.find((x) => x.id === prev) ||
			entries.find((x) => x.fn && (x.fn === prev || x.fn === prevFn)) ||
			entries.find((x) => x.id === prevFn);
		settings.command = match ? match.id : undefined;
	}
	save();
	render();
});

$("category").addEventListener("change", (e) => {
	settings.category = e.target.value;
	const first = entriesFor(settings.loco).find((x) => x.category === settings.category);
	settings.command = first && first.id;
	save();
	render();
});

$("command").addEventListener("change", (e) => {
	settings.command = e.target.value;
	save();
	render();
});

$("label").addEventListener("input", (e) => {
	settings.label = e.target.value;
	save();
});

for (const id of ["rawTopic", "rawPress", "rawRelease"]) {
	$(id).addEventListener("input", (e) => {
		settings[id] = e.target.value.trim();
		save();
	});
}

$("rawMode").addEventListener("change", (e) => {
	settings.rawMode = e.target.value;
	updateRawLabels();
	save();
});

$("host").addEventListener("change", (e) => {
	globals.host = e.target.value.trim();
	saveGlobals();
});

$("port").addEventListener("change", (e) => {
	globals.port = Number(e.target.value) || undefined;
	saveGlobals();
});

$("refresh").addEventListener("click", () => toPlugin({ event: "refreshTopics" }));
