# Trivia1v1 — 7 Arena 3D Models (Full Build Spec)

You are a senior 3D artist and technical artist agent. Your job is to create **7
themed 3D arena models** for **Trivia1v1**, a mobile-first, Clash-Royale-style
trivia game. The app has a 3D arena browser (Three.js r128, WebGL): the player
sees their current arena in 3D and swipes/scrolls between all 7. Right now the
app renders simple procedural placeholder scenes; **your models replace them
entirely**. Work end-to-end and self-contained, and verify your own output
before you finish. Do not ask for clarification on anything this document
already specifies — the answer is in here.

---

## 1 · Why this matters (context)

The arena viewer opens behind the "arena card" button on the home screen. It is
the game's showpiece screen, styled after Clash Royale's arena selection: a
full-bleed 3D arena, with the next/previous arenas sliding in as you scroll.
Each arena must **read instantly at a glance** — name, theme, mood — from a
camera that sits slightly above and in front of it.

The app's art direction is **dark, warm, and low-key**: warm near-black
backgrounds (`#0e0d0b`), layered dark surfaces, warm off-white text, and one
accent color per arena. **No neon, no glow gradients, no plastic-shine.** The
models must feel like they belong on that screen.

## 2 · Deliverables

Create exactly **7 GLB files** (glTF 2.0 binary, single self-contained file
each, textures embedded) at these exact paths:

| File | Arena | Unlocks at |
|---|---|---|
| `assets/arenas/models/arena-1.glb` | Training Grounds | 0 trophies |
| `assets/arenas/models/arena-2.glb` | Science Lab | 120 |
| `assets/arenas/models/arena-3.glb` | Football Stadium | 260 |
| `assets/arenas/models/arena-4.glb` | History Museum | 400 |
| `assets/arenas/models/arena-5.glb` | Math Arena | 540 |
| `assets/arenas/models/arena-6.glb` | Grand Colosseum | 680 |
| `assets/arenas/models/arena-7.glb` | Hall of Legends | 840 |

Later arenas should look progressively grander — arena 1 is humble, arena 7 is
the summit.

## 3 · Shared base layout (all 7 arenas use this skeleton)

Every arena is a raised circular platform that reads as a floating island:

- **Platform** — radius ≈ 2.1 (diameter ≈ 4.2), slightly bevelled edge, flat
  top at y ≈ 0.55, base at y = 0.
- **Rim ring** — a thin ring hugging the platform edge, emissive in the
  arena's accent color (subtle glow, the "identity" of the arena).
- **Center pedestal** — radius ≈ 0.55, height ≈ 1.0, holding a **golden
  trophy** on top (bowl + stem + base; gold `#e9b64f`).
- **Two towers** — left and right at the **front** (+Z side), like Clash
  Royale crown towers.
- **Two flag poles** — at the **back** (−Z side), each with a flag in the
  arena's accent color.
- **Ground disc** — a wide disc under the platform (radius ≈ 4.3) so the
  arena reads as an island floating in the dark.

**Coordinates:** model root at origin (0,0,0) = center of the platform base on
the ground plane. Up = +Y. **Front = +Z** (the camera looks from +Z toward
−Z, slightly above). Everything centered on X/Z.

## 4 · Reference palette (match these hexes in the materials)

| Arena | Accent | Deep tone | Notes |
|---|---|---|---|
| 1 Training Grounds | `#94a3b8` slate | `#475569` steel | wood `#8a6b4a`, tan `#cfa974` |
| 2 Science Lab | `#34d399` emerald | `#0d9488` teal | glass `#7fe3c4` |
| 3 Football Stadium | `#4ade80` green | `#15803d` deep green | white lines `#f3efe8` |
| 4 History Museum | `#fbbf24` amber | `#b45309` bronze | marble `#e8e2d6` |
| 5 Math Arena | `#a78bfa` violet | `#6d28d9` deep purple | — |
| 6 Grand Colosseum | `#f87171` red | `#b91c1c` deep red | sand `#c8a061` |
| 7 Hall of Legends | `#facc15` gold | `#a16207` amber | sparkle `#fff3c4` |

## 5 · Per-arena spec

### Arena 1 — Training Grounds (0 trophies)
Humble practice yard. Wooden **training dummies** (post + round head), a
couple of **torches** with small flames, rope or low fence hints, worn wood
and stone. Low, sturdy, unglamorous — but clean and readable.

### Arena 2 — Science Lab (120)
Glowing laboratory. Oversized **flasks and beakers** with softly glowing
liquid, **test-tube racks**, a few **floating orbs or bubbles**, subtle
mist/haze. Surfaces glossy but tasteful (roughness 0.2–0.4 on glass, nothing
mirror-shiny). Emerald/teal glow is the star.

### Arena 3 — Football Stadium (260)
Night-match energy. Grass pitch on the platform top with **white field
lines**, **two goal posts** at the back, **corner flags**, hints of **stands
or benches** along the sides, floodlight-style glow accents in the green
palette.

### Arena 4 — History Museum (400)
Marble + bronze grandeur. **Marble columns** (with capitals) around the
platform, a **statue** on a pedestal, **amphorae / ancient artifacts**,
worn/cracked stone details. Dusty and grand, amber-lit.

### Arena 5 — Math Arena (540)
Precision and order. **Floating geometric solids** — cube, icosahedron,
octahedron, torus knot — hovering just above small pedestals, with subtle
glowing violet lines/edges. Clean, symmetrical, slightly surreal.

### Arena 6 — Grand Colosseum (680)
Roman colosseum. A **ring of stone columns / arches** around the platform,
**sand floor**, **torches** on the columns with flames, dramatic and
imposing. Deep red + sand.

### Arena 7 — Hall of Legends (840)
The summit — opulent throne room. **Golden pillars**, a **grander, taller
trophy** on an elevated pedestal, **floating golden rings**, **light beams**
over the trophy, **sparkle particles**. Unmistakably the final arena.

## 6 · Technical requirements

- **Format:** glTF 2.0 **binary (.glb)**, one file per arena, **all textures
  embedded** — no external `.bin`, `.png`, or `.ktx2`.
- **Three.js r128 compatibility:** standard PBR (baseColor, roughness,
  metalness, emissive). **No Draco compression**, no required KHR extensions
  beyond what r128's GLTFLoader supports out of the box.
- **No cameras, no lights** in the file — the app lights the scene (ACES tone
  mapping).
- **No animations** needed — the app adds its own idle motion to the whole
  model. Static rigs are correct; do not add clips.
- **Units:** any consistent unit. The app **auto-scales the model's bounding
  box to a 4.2-wide footprint** and floors it at y = 0, so exact scale is not
  critical — but authoring the platform at diameter ≈ 4.2 gives the best
  1:1 result.
- **Budget (mobile-first):** ≤ 50k triangles per arena (aim 20–35k), ≤ 12
  materials, texture atlas ≤ 2048×2048 (1024 preferred), file ≤ ~4 MB each
  (target under 3 MB). Runs on phones inside a WebGL canvas next to other
  arenas — keep it lean.
- **Normals:** outward-facing; bake/merge where cheap. No z-fighting between
  coplanar surfaces.

## 7 · Art direction rules

- Dark surfaces dominate; the **accent color pops** on rims, flags, props,
  and emissives. Keep materials dark and warm, not pastel.
- **Emissive only for accents**: rim ring, flames, glowing liquids, trophy,
  sparkles. Keep emissive intensity moderate (≈0.2–1.2) — the app uses ACES
  tone mapping and will blow out anything extreme.
- Stylized **low-poly / mid-poly** with clean silhouettes. Readable from the
  viewer camera (slightly above, ~40° FOV, distance ≈ 5.6 units).
- **No characters, players, avatars, or HUD elements** — the game overlays
  those. Arenas are environments only.

## 8 · Boundaries (what you must NOT do)

- Create **only** the 7 GLB files (plus whatever working files you need to
  produce them). **Do not modify or create any app code, HTML, CSS, JS, or
  other files in the repo.**
- No copyrighted, ripped, or downloaded assets — build everything from
  scratch.
- No Draco, no external dependencies, no multi-file glTF.
- No animations, cameras, or lights exported into the GLB.
- Keep each arena a single `.glb` at the exact path in §2.

## 9 · Self-verification (run this before finishing)

1. Open each GLB in a glTF viewer (e.g., the Khronos glTF Sample Viewer) —
   confirm it loads with **zero errors**.
2. Confirm orientation: front towers/flags face **+Z**; model is upright (+Y
   up), centered on origin.
3. Spot-check material baseColors against the palette table in §4.
4. Confirm the footprint: bounding box width ≈ 4.2 at authoring scale.
5. Confirm triangle count ≤ 50k and material count ≤ 12 per arena.
6. Confirm the GLB is fully self-contained (no external assets referenced).
7. Confirm no lights/cameras/animations are exported.
8. Write a short honest report: for each arena, the file path, triangle
   count, texture resolution, and any deviations from this spec.

## 10 · Definition of done

All 7 files exist at the exact paths in §2, pass every item in §9, and the
report is attached. If anything cannot be met exactly, say so plainly in the
report rather than silently deviating.
