import streamDeck from "@elgato/streamdeck";

import { SimRailCommand } from "./actions/command";
import { type BusConfig, SimRailBus } from "./mqtt/bus";

const bus = new SimRailBus();

bus.on("status", (s) => streamDeck.logger.info(`broker ${s.host}:${s.port} connected=${s.connected} loco=${s.loco?.id ?? "-"} topics=${s.topicCount}`));

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new SimRailCommand(bus));

// Broker address lives in the plugin's global settings (edited from any key's property inspector).
streamDeck.settings.onDidReceiveGlobalSettings<Partial<BusConfig>>((ev) => bus.configure(ev.settings));

await streamDeck.connect();
bus.configure(await streamDeck.settings.getGlobalSettings<Partial<BusConfig>>());
