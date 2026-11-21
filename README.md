# SimRail MQTT: Stream Deck plugin

Stream Deck keys for SimRail's radio, doors, horns, lights and safety systems, sent over the game's built-in MQTT
broker. Each key's settings let you pick commands from lists grouped by loco, so you never type a raw topic.
Keys also show live state: the SHP/CA key lights up when the alerter asks for acknowledgment, radio keys show the
channel, and toggles follow the lamp in the cab.

Requires Stream Deck 7.1 or newer.

## Using it
1. In SimRail, enable MQTT (Options → Controls → External input) and restart the session.
2. Drag **SimRail MQTT → SimRail command** onto a key.
3. In the key settings:
   - **Loco**:
     - **Auto** follows the loco you're driving. The plugin detects it from the game's topic list, so one
       profile works in every loco.
     - A fixed loco shows that loco's own command list.
     - **Raw topic** lets you send any topic and value yourself.
   - **Category**: Radio, Doors, Horn, Lights, Safety systems.
   - **Command**: for example *Horn – high tone*, *Doors – open left*, *Radio – channel 3*, *SHP / CA acknowledge*.
   - **Key text** (optional) replaces the label drawn on the key. Use `|` for a second line.
4. Under **Connection**, set the SimRail PC address (default `127.0.0.1`, the same PC) and the port (1883). This
   setting is shared by all keys.

Key states:

| Look | Meaning |
|---|---|
| Coloured key | The lamp or state is on, or a momentary key is held |
| Grey dot, top right | No game session, so the broker is down |
| Red dashed frame, "n/a" | The current loco doesn't have this command, or the game's topic list lacks the topic |

Under each command, the settings panel shows the topics it uses and how reliable the command is:

| Badge | Meaning |
|---|---|
| `live` | Tested in a running game |
| `dump` | The topic exists in a real topic dump. Values come from the wiki |
| `wiki` | Taken from the SimRail wiki only. Not checked yet |

## Locos

| Loco | Topic group | Status |
|---|---|---|
| EU07 / EP07 / EP08 | `eu07` | dump (cab light tested live) |
| EN76 / EN96 (Elf) | `elf_34we` | dump |
| ET22, EN57, ED250, Dragon 2, Traxx, Traxx DE, Impuls 2, ČD 163 | per wiki | wiki |

To check another loco, start a session in it, publish anything to `request_topics` and save the JSON the game sends
back on `request_topics_response` (drop the leading `0x02` byte) as `test/fixtures/dumps/topics_dump_<loco>.json`.
Add it to `DUMPS` in `test/catalog.test.ts`, which checks
that every topic the catalog uses exists in the dump and that the loco is detected. Then raise those entries to
`dump` in `src/catalog/locos/<loco>.ts`.

## How it works
- `src/mqtt/bus.ts`: one shared MQTT connection that reconnects forever, because the broker only runs inside a
  session. After connecting it publishes `request_topics`, then detects the loco from the
  `physics_input_<loco>/` prefix. Traxx and Traxx DE share a prefix and report the same topic names, so Auto picks
  the E186 and Traxx DE has to be selected by hand.
- `src/mqtt/codec.ts`: publishes raw 4-byte little-endian floats, the only format the game accepts. Decodes the
  game's `0x01`/`0x02` prefixed payloads and the broker's echo of raw floats.
- `src/catalog/`: one file per loco. Every entry has a behaviour:

  | Behaviour | What a key press does |
  |---|---|
  | `momentary` | Sends a value on press and another on release |
  | `toggle` | Switches between two values |
  | `set` | Sends a fixed value |
  | `step` | Moves up or down within limits |
  | `cycle` | Steps through a list of values |

  Entries can also have a feedback source: `lamp`, `equals` or `value`. `functions.ts` lists the loco-independent
  functions offered in Auto mode, with fallbacks such as "high horn" falling back to "low horn" on single-tone
  locos.
- `src/engine.ts`: pure key logic, unit tested.
- `src/render.ts`: draws the 144×144 key image as SVG.
- `com.simrailmqtt.streamdeck.sdPlugin/ui/`: the settings panel. Plain JavaScript over Stream Deck's
  property-inspector WebSocket. The plugin sends it the catalog.

## Development
Install Node.js 24+, then run these from the repo root:

```
npm install
npm test              # unit tests, catalog-vs-dump checks, mock-broker integration test
npm run build         # bundles to com.simrailmqtt.streamdeck.sdPlugin/bin/plugin.js
npm run validate      # Elgato manifest validation
npm run link          # installs into Stream Deck as a link (restart Stream Deck the first time)
npm run watch         # rebuild and restart the plugin on every change
npm run pack          # dist/com.simrailmqtt.streamdeck.streamDeckPlugin (double-click to install)
npm run preview:build # dist/preview/gallery.html (every key image) and catalog.json
```

Plugin logs are in `com.simrailmqtt.streamdeck.sdPlugin/logs/`.
