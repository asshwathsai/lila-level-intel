# LILA BLACK — Level Intel

A browser-based player telemetry visualization tool for LILA BLACK's Level Design team. Turns 5 days of raw parquet gameplay data into an interactive map explorer.

**Live URL:** https://lila-level-intel.vercel.app

---

## What It Does

| Feature | Details |
|---|---|
| **Minimap rendering** | All 3 maps with correct world→pixel coordinate mapping |
| **Player paths** | Humans color-coded; bots in muted blue — toggle independently |
| **Event markers** | Kill (✕), Death (◆), Storm (⚡), Loot (■) — distinct colors + shapes |
| **Heatmap overlays** | Traffic, Kill Zones, Death Zones, Loot Hotspots, Storm Deaths |
| **Filtering** | By map, by date (Feb 10–14), by match |
| **Timeline playback** | Scrub or auto-play. Speed: 0.5×, 1×, 2×, 4×, 8× |
| **Match stats** | Live: players, kills, bot kills, storm deaths, loot count |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite |
| Rendering | HTML Canvas (3 stacked layers) |
| Data pipeline | Python 3 + PyArrow + Pandas |
| Hosting | Vercel (static, no backend) |

---

## Setup

### Prerequisites: Node.js 18+, Python 3.9+

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/lila-level-intel
cd lila-level-intel

# 2. Preprocess data (place player_data/ at repo root first)
pip install pyarrow pandas numpy
python scripts/preprocess.py

# 3. Install & run
npm install
npm run dev
# → http://localhost:5173

# 4. Build
npm run build
```

## Deploy to Vercel

```bash
npx vercel --prod
```

No environment variables needed.

---

## Repo Structure

```
├── public/data/          # Preprocessed JSON (match index, heatmaps, per-match events)
├── public/minimaps/      # Map images
├── src/App.jsx           # Main app, filters, timeline
├── src/MapCanvas.jsx     # 3-layer canvas renderer
├── scripts/preprocess.py # Parquet → JSON pipeline
├── ARCHITECTURE.md
└── INSIGHTS.md
```

> Raw parquet files are not committed. Run `preprocess.py` to regenerate `/public/data/`.
