"""Dream Lantern v2 shot list -> shots.json (read by the core and the module preview).
Edit SHOTS below and run:  python assets/dream-lantern/build_shots.py [plan-table.md]
Every start time is snapped to the nearest 178-BPM beat in timing.json ("fast"); the script fails
if a start sits more than 25 ms off a beat, so a typo cannot slip a cut off the grid.
Row: (start s, "module.setup[:variant]" or "split:a.b|c.d", transition-in, layer, symbol, camera / action)
Layers: 2D, 3D, mix (painted 2D layers with 3D moving through them), split.
Transitions: cut, flash, black (cut through black), fade (up from black), washi, ink, cord, leak (light leak),
match (hard cut, the shot shares its anchor with the last one), dissolve.  Modules "title" and "black" are the core's."""
import json, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
TM = json.load(open(os.path.join(HERE, "timing.json"), encoding="utf-8"))
FAST = TM["fast"]

SHOTS = [
    # ---- intro 0-24.46: midnight navy, slate cloud, amber sunrise on the rim. Long, calm shots.
    (0.0, "title", "fade", "2D", "lantern", "Black. An ink flame lights on the 1.875 s hit; 夢灯籠 brushed one glyph per bar."),
    (7.519, "sky.nightfly", "fade", "mix", "comet", "Low glide over a night cloud sea toward an amber rim; painted star field behind; 2D meteor streaks on the 7.5 and 12.8 s accents."),
    (13.166, "lanterns.rise", "dissolve", "mix", "lantern", "One paper lantern rises through painted cloud layers; camera tilts up with it; stars brighten each bar."),
    (18.813, "sky.cometsplit:approach", "cut", "mix", "comet", "The comet appears high and lengthens; the frame tightens on its head; the 23.73 s accent cuts to black."),
    (23.754, "black", "cut", "2D", "-", "Near-silence. Black, one faint thread glint."),
    # ---- verse 1 24.46-40.51: electric cyan and navy, then honey daylight and the red cord.
    (24.46, "sky.cometsplit", "flash", "mix", "comet", "Verse hit: the comet splits into two tails over a cyan cloud sea; the framing widens."),
    (27.251, "split:city.rooftop|lake.lanterns", "washi", "split", "two skies", "Two skies: city roofs left, the lantern lake right; one comet crosses the torn seam."),
    (30.043, "shadows.wall", "black", "2D", "shadows", "Two shadows back to back on a paper wall lit cyan by the comet."),
    (31.439, "city.rooftop:low", "cut", "3D", "comet", "Low wide of aerials and a red beacon blinking on each downbeat under the comet."),
    (32.834, "shadows.wall:apart", "black", "2D", "shadows+cord", "The shadows drift apart sideways; the red cord between them stretches thin."),
    (35.626, "rooms.shoji", "flash", "mix", "dawn", "White flash into honey morning: shoji glow, the edge of a futon, the cord on the pillow, dust in the light."),
    (37.021, "rooms.clock", "cut", "mix", "handless clock", "A clock without hands on a bedside shelf; its numerals drift off like petals on the beat."),
    (38.417, "pages.palm", "cut", "2D", "name on palm", "An open palm with 結 brushed in ink; the strokes fade one by one."),
    # ---- pre-chorus 40.16-52.03: blush and periwinkle, blue shadow, amber desk.
    (40.162, "cord.sky:release", "black", "mix", "cord", "Cord cue: the scarlet cord pulls free and whips out on the 40.18 / 40.36 pair against a blush sky."),
    (41.208, "cord.sky:loop", "match", "mix", "cord", "Match on the cord: it loops across a periwinkle sky; the camera rides along it."),
    (43.302, "rooms.desk", "cut", "mix", "memory", "Low angle across a desk: books, an open notebook, blue shadow; an amber sun band sweeps on the bar."),
    (44.698, "rooms.fusuma", "cut", "mix", "doors", "Three layers of sliding doors shut toward camera, one per beat: waking up."),
    (46.791, "rooms.clock:close", "cut", "mix", "handless clock", "Close on the handless clock; numerals fall, one stays."),
    (48.187, "pages.notebook", "cut", "2D", "memory", "Overhead: notebook pages flip on the beat while ink handwriting writes itself."),
    (49.583, "split:rooms.desk:warm|rooms.desk:cool", "match", "split", "two skies", "The same desk twice, mirrored: warm morning left, cool evening right."),
    (50.978, "pages.notebook:fill", "cut", "2D", "memory", "The pages fill faster and faster, ink bleeding to the edge into the lift."),
    # ---- hook 52.03-63.16: black and ivory match cuts, saturated blue sky, white and lilac title.
    (52.025, "lanterns.pair:0", "cut", "mix", "lantern x2", "Locked frame, two lanterns on black. Burst: the washi pattern changes on every beat (plain ivory)."),
    (52.374, "lanterns.pair:1", "match", "mix", "lantern x2", "Indigo summer stripes. Full-band lift."),
    (52.711, "lanterns.pair:2", "match", "mix", "lantern x2", "Autumn maple on rust."),
    (53.048, "lanterns.pair:3", "match", "mix", "lantern x2", "Rain: dark paper, falling streaks."),
    (53.385, "lanterns.pair:4", "flash", "mix", "lantern x2", "Grey-white flash: the two swap sides."),
    (53.722, "lanterns.pair:5", "match", "mix", "lantern x2", "Blue hemp-leaf festival pattern."),
    (54.059, "lanterns.pair:6", "match", "mix", "lantern x2", "Snowflakes on red."),
    (54.396, "lanterns.pair:7", "match", "mix", "lantern x2", "Black paper, white stars, snow falling."),
    (54.734, "lanterns.pair:alone", "flash", "mix", "lantern", "White flash: one lantern alone in pale pink and cream; the other is gone."),
    (55.745, "sky.bluesky", "black", "mix", "distance", "Low wide: saturated blue sky, towering cumulus, two small lanterns far apart at the frame edges."),
    (57.767, "title:white", "flash", "2D", "lantern", "夢灯籠 resolves out of white with pink and lavender light flecks; holds four bars."),
    # ---- verse 2 63.16-84.73: steel blue and train burgundy, then mist teal and warm shoji light.
    (63.161, "rail.interior", "cut", "3D", "distance", "Lead returns: low aisle of a commuter car, burgundy seats, sun bars sweeping on each beat."),
    (64.509, "rail.window", "cut", "mix", "distance", "Window seat: painted blue and green hills scroll; a lantern's reflection floats in the glass."),
    (65.857, "rail.passing", "cut", "3D", "trains passing", "Two trains pass; windows strobe on the fast beat; a lantern in one window, a red cord in the other."),
    (67.205, "rail.interior:low", "cut", "3D", "distance", "Lower, closer along the seats."),
    (67.88, "rail.window:tunnel", "cut", "mix", "distance", "Green hills, then a tunnel swallows the light on the 68.55 downbeat."),
    (69.228, "rail.tracks", "cut", "3D", "distance", "Vanishing-point tracks in green sunlight."),
    (69.902, "rail.tracks:gate", "cut", "3D", "distance", "Close on a crossing: lamps alternate on the beat."),
    (70.576, "shadows.bridge", "cut", "2D", "shadows", "Two cut-paper shadows cross a footbridge against a blue-orange dusk, not looking."),
    (71.25, "pages.paper:note", "cut", "2D", "memory", "A paper note; its words drain off the page."),
    (71.587, "rooms.desk:night", "cut", "mix", "memory", "Amber-lit table at night, a cup steaming."),
    (72.262, "pages.paper:map", "cut", "2D", "mirror lake", "A folded map opens to an ink-drawn round lake."),
    (72.936, "rail.window:reflection", "cut", "mix", "lantern", "Tight, sepia: the lantern reflection over passing poles."),
    (73.947, "lake.mist", "cut", "mix", "mirror lake", "Mist-covered lake, cool blue-grey wide, painted leaves in the foreground."),
    (75.295, "lake.mist:tree", "dissolve", "mix", "mirror lake", "Dissolve to a lone tree on an island in turquoise mist."),
    (76.644, "lake.mist:drift", "cut", "mix", "lantern", "A single lantern drifts toward the tree across the still water."),
    (77.992, "pages.chalk", "cut", "2D", "memory", "Burst. Chalk strokes on green slate, smeared out on the beat."),
    (78.666, "rail.tracks:dusk", "cut", "3D", "distance", "Orange-lit path along a fence."),
    (79.003, "sky.meteor", "cut", "3D", "comet", "A narrow orange meteor drops into a still field of indigo cloud."),
    (79.34, "rooms.shoji:wide", "cut", "mix", "dawn", "Wide tatami room before a luminous shoji, pale."),
    (80.014, "cord.marudai:bobbins", "cut", "3D", "cord", "Close on bobbins and coiled cords."),
    (80.689, "cord.marudai", "cut", "3D", "cord", "The braiding stand: bobbins cross on every beat as the cord grows."),
    (82.037, "cord.marudai:top", "cut", "3D", "cord", "Overhead: the braid spirals down the stand."),
    (83.385, "cord.knot:tie", "cut", "mix", "cord", "The finished cord ties itself into a bow on a lantern's handle."),
    # ---- turnaround 84.73-90.13: navy steel, forest green, vermilion gate, warm flare.
    (84.734, "rooms.mirror", "flash", "mix", "mirror", "Bright transient: a hand mirror on the tatami; dawn inside the mirror, night in the room."),
    (85.408, "city.elevated", "cut", "3D", "distance", "Upward along a curving elevated road, cyan and amber light trails."),
    (87.43, "lake.torii", "cut", "mix", "gate", "Low wide on a vermilion torii among cedars; the sun warms and flares (2D leak)."),
    # ---- final chorus 90.13-114.40: lavender and scarlet, gold and pink dusk, orange fire, blue-black crater.
    (90.127, "city.lookout", "flash", "mix", "distance", "Climax: a railing over a bright city, blue sky, cumulus; the camera surges past the rail."),
    (93.498, "cord.drift", "cut", "mix", "cord", "Red and blue strands drift in lavender-white space, mint flecks."),
    (93.835, "cord.drift:tumble", "match", "mix", "cord", "Falling through the cord lines; 2D speed lines."),
    (94.846, "cord.drift:indigo", "cut", "mix", "cord+lantern", "A red loop passes a small suspended lantern in a slow indigo float."),
    (95.52, "sky.meteor:teal", "cut", "3D", "comet", "A blue-white meteor cuts diagonally across a tracking teal sky."),
    (96.194, "cord.marudai:pastel", "cut", "3D", "cord", "Extreme close: strands passing, pastel peach light."),
    (96.531, "cord.marudai:indigo", "cut", "3D", "cord", "A pale thread passes through dark indigo strands."),
    (97.205, "cord.bell", "cut", "mix", "bell rope", "A braided bell rope swings; the bell rings on the 98.22 downbeat (gold 2D ring)."),
    (98.217, "rooms.shoji:gold", "cut", "mix", "dawn", "Warm wooden interior gone gold."),
    (98.891, "cord.marudai:raking", "cut", "3D", "cord", "Raking angle along taut amber threads."),
    (99.565, "lake.crater:rim", "cut", "3D", "mirror lake", "Shallow aerial glide over the crater rim at a blue-violet horizon."),
    (100.239, "split:sky.twilight:dawn|sky.twilight:dusk", "leak", "split", "twilight", "Katawaredoki: two halves of one sky, dawn gold left and dusk pink right; a pink light pillar on the seam."),
    (101.587, "sky.twilight", "cut", "mix", "twilight", "One sky, gold and pink cloud; the pillar between two shadows."),
    (102.599, "shadows.ridge", "cut", "2D", "shadows", "Ridge silhouette: two cut-paper figures cross apart, divided by the pillar."),
    (103.273, "shadows.whip", "cut", "2D", "shadows", "Whip pan: wind ribbons and speed lines in purple and orange."),
    (103.947, "shadows.whip:reverse", "cut", "2D", "shadows", "Reverse whip."),
    (104.621, "sky.impact", "flash", "mix", "comet", "Fence and pylons in silhouette; the comet fragment's orange fire blooms against deep navy."),
    (105.97, "lake.crater:night", "cut", "3D", "mirror lake", "Pull out over a round blue lake at night, ringed by tiny lights."),
    (107.992, "lake.mirror", "dissolve", "3D", "lantern", "Dissolve: the mirror-still lake, one lantern and its reflection; push toward the reflection."),
    (109.34, "pages.sketches", "cut", "2D", "memory", "Burst. Sunlight sweeps pale sketches pinned to a wall; they fade blank."),
    (109.677, "pages.chalk:write", "cut", "2D", "memory", "Chalk writes, half a word."),
    (110.014, "rooms.shoji:flare", "cut", "mix", "dawn", "Low angle, a sun flare through the shoji panes."),
    (110.352, "rooms.fusuma:wide", "cut", "mix", "doors", "The doors close on the room."),
    (110.689, "lanterns.hero:overhead", "cut", "mix", "lantern", "Straight down: a lantern hangs over a tiny shadow on gold."),
    (111.026, "shadows.crowd", "cut", "2D", "shadows+cord", "A lavender crowd of grey cut-paper figures; one shadow trails a red cord."),
    (111.7, "lake.crater:day", "cut", "3D", "mirror lake", "Aerial sweep over a sunlit green crater basin."),
    (113.048, "pages.paper:book", "cut", "2D", "memory", "A page turns to a blue lake panorama."),
    # ---- outro 114.40-126.78: cyan sky, pale cream, leaf green, amber, rust-red rails. Waking, daylight.
    (114.396, "city.aerial", "flash", "3D", "dawn", "Hard re-entry: city aerial tilting up into cyan sky, lens flare."),
    (115.745, "stairs.street", "cut", "mix", "dawn", "Shallow focus: leaves in front, a blurred street, sparkles."),
    (117.093, "stairs.lane", "cut", "mix", "distance", "A narrow sunny lane; a yellow bicycle rolls away."),
    (118.441, "stairs.wide", "flash", "mix", "stairs", "White flash: a distant stair, long static wide; a shadow at the top, one at the bottom."),
    (121.138, "stairs.flight:climb", "cut", "mix", "stairs", "Side angle along red rails: one shadow climbs, one descends."),
    (122.823, "stairs.flight:pass", "flash", "mix", "stairs+cord", "Flash-match reverse: the shadows pass; a red cord tied to the rail flutters."),
    (123.835, "cord.knot:rail", "cut", "mix", "cord", "Close on the knot on the rail, blue sky and white cloud."),
    (125.183, "stairs.landing", "cut", "mix", "dawn", "End hit: wide landing over sunlit streets; 夢灯籠 end title; fade on the decay."),
]

SECTIONS = [(s["name"], s["t0"], s["t1"]) for s in TM["sections"]]
PAL = {"intro": "#07172B #254777 #617390 #F7B578", "verse1": "#091324 #34638D #65C6F7 #E4A06F #B72D37",
       "prechorus": "#F4DEEC #AFC6ED #C47C4B #642321 #26344D", "chorus1": "#0E0C18 #F7E9EA #4489CB #F9F6FB #D6B5E5",
       "verse2": "#314353 #796A62 #8CABB6 #A59278 #AF3C32", "build": "#152437 #385C77 #266344 #AD5334 #F8CE90",
       "chorus2": "#6C6792 #DCB094 #922743 #F18B36 #0A2034", "outro": "#66A8EB #EDF2ED #68855B #CF8742 #90482F"}


def snap(t):
    if t <= 0:
        return 0.0
    b = min(FAST, key=lambda x: abs(x - t))
    if abs(b - t) > .025:
        sys.exit(f"{t}: {abs(b - t) * 1000:.0f} ms off the beat grid (nearest {b})")
    return b


def part(spec):
    head, _, var = spec.partition(":")
    m, _, key = head.partition(".")
    return {"mod": m, "key": key or m, **({"var": var} if var else {})}


out = []
for i, (t, spec, tin, layer, sym, note) in enumerate(SHOTS):
    t = snap(t)
    # a cut up to one beat ahead of a section (the reference anticipates its hits) belongs to that section
    sec = next(n for n, a, b in SECTIONS if a - .36 <= t < b - .36)
    s = {"i": i, "t": t, "sec": sec, "tin": tin, "layer": layer, "sym": sym, "note": note}
    if spec.startswith("split:"):
        l, r = spec[6:].split("|")
        s.update(mod="split", L=part(l), R=part(r))
    else:
        s.update(part(spec))
    out.append(s)
for a, b in zip(out, out[1:]):
    assert b["t"] > a["t"], (a, b)
    a["t1"] = b["t"]
out[-1]["t1"] = TM["duration"]

mods = sorted(({x["mod"] for x in out} | {y["mod"] for x in out if x["mod"] == "split" for y in (x["L"], x["R"])}) - {"split", "title", "black"})
json.dump({"note": "Generated by build_shots.py. Times are on the 178 BPM grid of timing.json.", "modules": mods, "shots": out},
          open(os.path.join(HERE, "shots.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"{len(out)} shots, {len(out) - 1} cuts, modules: {', '.join(mods)}")

if len(sys.argv) > 1:
    name = lambda x: x["mod"] + "." + x["key"] + (":" + x["var"] if "var" in x else "") if x["mod"] not in ("title", "black") else x["mod"] + (":" + x["var"] if "var" in x else "")
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        cur = None
        for s in out:
            if s["sec"] != cur:
                cur = s["sec"]
                n = sum(1 for x in out if x["sec"] == cur)
                f.write(f"\n#### {cur} ({n} shots) · palette {PAL.get(cur, '')}\n\n| # | start s | len | in | layer | setup | symbol | camera / action |\n|---|---|---|---|---|---|---|---|\n")
            setup = name(s) if s["mod"] != "split" else name(s["L"]) + " ‖ " + name(s["R"])
            f.write(f"| {s['i'] + 1} | {s['t']:.3f} | {s['t1'] - s['t']:.2f} | {s['tin']} | {s['layer']} | `{setup}` | {s['sym']} | {s['note']} |\n")
