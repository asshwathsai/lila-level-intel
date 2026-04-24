# ARCHITECTURE.md

## What I Built and Why

**Stack: React + Vite + HTML Canvas → static deploy on Vercel**

I chose this stack because the core challenge is rendering — 89,000 events, minimap images, heatmaps, and real-time playback — not data serving. A static frontend with preprocessed JSON files means zero backend, zero cold starts, instant Vercel deployment, and a shareable URL that works forever without any infra maintenance. For a tool used by a small team of Level Designers (not millions of concurrent users), this is the right trade.

I chose raw HTML Canvas (three stacked layers) over WebGL or deck.gl because the dataset after preprocessing fits comfortably in memory and the rendering complexity doesn't justify the abstraction overhead. Canvas gives pixel-perfect control over exactly how paths, heatmaps, and event markers look.

---

## Data Flow

```
Parquet files (1,243 files, ~8MB)
        │
        ▼
preprocess.py (Python + PyArrow + Pandas)
  • Read all files, decode event bytes, classify humans vs bots
  • Apply world → pixel coordinate transform
  • Normalize timestamps per match (ts_rel = ts - match_min_ts)
  • Output 1: match_index.json  (796 match metadata records, 138KB)
  • Output 2: matches/*.json    (796 per-match event files, 4.1MB total)
  • Output 3: heatmaps.json     (64×64 grid per map per event type, 125KB)
        │
        ▼
/public/data/ (static files served with the React app)
        │
        ▼
React App (browser)
  • Loads match_index.json + heatmaps.json on mount
  • Loads individual match JSON on selection
  • Renders via MapCanvas.jsx (3-layer HTML Canvas)
  • Timeline scrubber filters events by ts_rel ≤ currentTime
```

**Why per-match JSON files?** The alternative — one giant JSON — would be ~4MB to load upfront. Loading per-match on demand keeps initial load fast (<300KB) and each match file is at most 36KB.

---

## Coordinate Mapping

This is the critical transformation. The README provides the formula; getting it right required understanding two non-obvious things.

**The formula (from README):**
```
u = (world_x - origin_x) / scale
v = (world_z - origin_z) / scale
pixel_x = u × 1024
pixel_y = (1 - v) × 1024     ← Y is flipped: image origin is top-left
```

**Non-obvious detail 1 — which axis is which:** In the 3D game world, `x` and `z` are the horizontal plane (floor); `y` is elevation. For a top-down minimap, we use `x` and `z` and ignore `y` entirely. The README states this but it's easy to miss.

**Non-obvious detail 2 — Y-axis flip:** Standard image coordinates have Y increasing downward (top-left origin). Game world coordinates have Z increasing upward. The `(1 - v)` term flips the axis. Getting this wrong mirrors the map vertically — events appear on the wrong side of the minimap.

**Verification:** The README gives a worked example: world (-301.45, -355.55) on AmbroseValley (scale=900, origin=(-370,-473)) should map to pixel (78, 890). My output: (78, 890). ✓

**Canvas scaling:** The minimap is rendered into a letterboxed canvas (maintains 1:1 aspect ratio). A `scale` factor maps from 1024 pixel-space to actual canvas pixels, applied to all event coordinates at render time. This means the preprocessing stores raw 1024-space coordinates and the canvas handles display scaling via a single multiplier.

---

## Major Tradeoffs

| Decision | Option Chosen | Option Rejected | Why |
|---|---|---|---|
| Data format | Static JSON files | Live API / database | No backend needed; dataset is small enough; Vercel hosting is free and instant |
| Rendering | HTML Canvas | SVG / deck.gl / Three.js | Canvas is faster for thousands of points; simpler to control layering and alpha blending |
| Heatmap resolution | 64×64 grid | Per-pixel density | 64×64 gives clear visual signal without becoming a memory/render bottleneck; finer grids on a 1024px canvas offer diminishing returns |
| Position subsampling | Every 3rd position event | All position events | Reduces per-match JSON by ~66% with no visible path degradation; position events are 85%+ of rows |
| Timestamp handling | Relative ms per match | Absolute unix ms | Relative ts_rel enables cross-match comparison and consistent playback regardless of when the match occurred |
| Bot detection | UUID vs numeric user_id | ML classification | The README explicitly defines this rule; simple, reliable, zero false positives |

---

## Assumptions Made

- **Timestamps are milliseconds.** The parquet schema says `datetime64[ms]` and values like `1770739543` decode to `1970-01-21 11:52:19` — consistent with ms from Unix epoch. Playback uses `ts_rel` (relative ms within match), so absolute time interpretation doesn't affect correctness.

- **Position sampling interval is ~5ms.** Diffs between consecutive Position events cluster around 5 units. Whether this represents 5ms or 500ms of real game time doesn't matter for playback — we use relative ordering and a user-controlled speed multiplier.

- **February 14 is a partial day** (per README). I include it in the dataset but note it in the date filter — no data is excluded.

- **Bot detection is filename-based first, data-based second.** I use `user_id.contains('-')` to identify UUID (human) vs numeric (bot) IDs, consistent with the README definition.

- **Minimap images are 1024×1024.** The README states this; I verified the images are square. The coordinate math assumes this.

---

## Three Things I Learned About the Game

See `INSIGHTS.md` for full analysis. In brief:

1. **PvP is essentially absent** — only 3 human-vs-human kills across 796 matches and 245 players. The game is functioning as a PvE extraction loop.
2. **GrandRift is underplayed despite healthy gameplay metrics** — 7.4% match share vs 71% for AmbroseValley, but comparable loot and kill rates when played. A discoverability/rotation issue, not a quality issue.
3. **Half of AmbroseValley has zero player traffic** — 49.6% of the map is a dead zone. Players are running the same corridor every match, which limits replayability and wastes level design investment.
