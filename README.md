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
| EU07 / EP07 / EP08 | `eu07` | dump (radio, channels, cab and instrument lights, Cab A lamp presets, SHP/CA tested live on the EU07 and EP08) |
| EN76 / EN96 (Elf) | `elf_34we` | dump |
| ET22 | `et22` | dump |
| EN57 / EN71 (Kibel) | `en57` | dump |
| ED250 (Pendolino) | `ed250` | dump (radio, doors, horns, most lights, SHP/SIFA, SIFA test, ETCS ack tested live) |
| Dragon 2 | `e6act` | dump |
| Traxx (E186) | `traxx_e186` | dump |
| Traxx DE (BR285) | `traxx_e186` | wiki (no separate dump: the game reports the same topics as the E186) |
| Impuls 2 | `impuls` | dump |
| ČD 163 | `163` | dump |

The `physics_input_general/` and `physics_output_general/` topics are listed in every loco's dump, whether or not the
loco reacts to them. So for commands on general topics, `dump` only proves the name is right. Loco-specific topics
(`physics_input_<loco>/…`) are real evidence that the loco has the control.

To check another loco, start a session in it, publish anything to `request_topics` and save the JSON the game sends
back on `request_topics_response` (drop the leading `0x02` byte) as `test/fixtures/dumps/topics_dump_<loco>.json`.
Add it to `DUMPS` in `test/catalog.test.ts`, which checks
that every topic the catalog uses exists in the dump and that the loco is detected. Then raise those entries to
`dump` in `src/catalog/locos/<loco>.ts`.

## Known issues

- **Lamp keys don't move the switches in the cab** (EU07 / EP07 / EP08, and probably the ET22 and EN57, which use
  the same topics). The lamp presets (*3 white*, *2 red*, *all off*) and the single-lamp keys set the
  `headlight_individual_*` topics, which switch the lamps directly: any positive value is white, 0 is off, -1 is red
  (the top lamp has no red and goes dark). The lamp switches on the cab panel stay where they were, so the panel and
  the lamps can disagree. Moving a switch in the cab may set its lamp back to the switch position. The dumps show no
  topics for the switches themselves.
- **No state on lamp keys.** The game reports no output for the individual lamps, so a lamp key only shows what it
  sent last, not what the lamp really shows.
- **Headlight dimming doesn't work on the EP08.** `lights_power` had no effect with -1, 0 or 1, so the EU07 /
  EP07 / EP08 has no dimming key.
- **The ED250 radio can't be switched off**, so the ED250 has no radio on/off keys.
- **Holding SHP/CA acknowledge for more than 2 s starts the game's CA lamp test**, which lasts until the key is
  released. The plugin passes the key press through as it is, so this works from the deck too.

## How it works
- `src/mqtt/bus.ts`: one shared MQTT connection that reconnects forever, because the broker only runs inside a
  session. After connecting it publishes `request_topics`, then detects the loco from the
  `physics_input_<loco>/` prefix. Traxx and Traxx DE share a prefix and report the same topic names, so Auto picks
  the E186 and Traxx DE has to be selected by hand. The game can keep the broker running when you change scenario,
  so the plugin also asks again as soon as the game sends an output from another loco's topic group.
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
npm run live-test     # press every command of the current loco in a running game and report what changed
```

Plugin logs are in `com.simrailmqtt.streamdeck.sdPlugin/logs/`.

### Live test
`npm run live-test` needs a running session with the loco powered up and standing still. It detects the loco, presses
each command like the key would, and prints a verdict per command:

| Verdict | Meaning |
|---|---|
| `OK` | The command's feedback lamp or value changed |
| `SEEN` | The game changed something else meanwhile (not proof on its own) |
| `----` | Nothing changed. Check in the cab: horns and radio calls only show up as sound |

Toggles, positions and steps are put back afterwards. Results are saved to `dist/live-test-<loco>.json`.

| Option | Effect |
|---|---|
| `--only id1,id2` / `--category lights` | Test a subset |
| `--slow` | Announces each command, holds buttons 2 s and leaves states 4 s, for watching from the cab |
| `--ca-test` | Holds SHP/CA acknowledge 3.5 s. Over 2 s the game runs its CA lamp test until release, which checks the key's lamp. Without it, acknowledge is always a short tap |
| `--unsafe` | Also runs RADIOSTOP, the emergency brake and the safety-system disable/isolation switches |
| `--loco <id>` | Use this loco's catalog instead of the detected one |
