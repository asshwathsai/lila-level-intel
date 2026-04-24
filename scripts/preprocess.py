"""
preprocess.py — LILA BLACK telemetry data pipeline
Converts parquet player event files into browser-ready JSON for the Level Intel tool.

Usage:
    python scripts/preprocess.py

Expects:
    player_data/              at repo root (with February_10 ... February_14 + minimaps/)

Outputs:
    public/data/match_index.json     — 796 match metadata records
    public/data/heatmaps.json        — 64x64 heatmap grids per map per event type
    public/data/matches/*.json       — per-match event arrays for playback
    public/minimaps/                 — copies minimap images
"""

import pyarrow.parquet as pq
import pandas as pd
import numpy as np
import os
import json
import shutil

# ── Config ──────────────────────────────────────────────────────────────────

DATA_ROOT   = "player_data"
OUT_ROOT    = "public/data"
MINIMAP_SRC = os.path.join(DATA_ROOT, "minimaps")
MINIMAP_DST = "public/minimaps"
DAYS        = ["February_10", "February_11", "February_12", "February_13", "February_14"]

MAP_CONFIG = {
    "AmbroseValley": {"scale": 900,  "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581,  "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

IMG_SIZE    = 1024
HEATMAP_GRID = 64      # 64×64 grid cells for heatmaps
POSITION_SAMPLE = 3    # keep every Nth position event (path subsampling)

# ── Helpers ──────────────────────────────────────────────────────────────────

def world_to_pixel(x, z, map_id):
    """Convert world (x,z) to 1024-space pixel coordinates."""
    cfg = MAP_CONFIG[map_id]
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    px = round(float(u * IMG_SIZE), 1)
    py = round(float((1 - v) * IMG_SIZE), 1)
    return px, py


def make_heatmap_grid(df, map_id, grid_size=HEATMAP_GRID):
    """Aggregate events into a 2D grid. Returns list-of-lists (row-major)."""
    if len(df) == 0:
        return [[0] * grid_size for _ in range(grid_size)]

    cfg = MAP_CONFIG[map_id]
    u = (df["x"] - cfg["origin_x"]) / cfg["scale"]
    v = (df["z"] - cfg["origin_z"]) / cfg["scale"]
    gx = np.clip((u * grid_size).astype(int), 0, grid_size - 1)
    gy = np.clip((v * grid_size).astype(int), 0, grid_size - 1)

    grid = np.zeros((grid_size, grid_size), dtype=np.int32)
    np.add.at(grid, (gy.values, gx.values), 1)
    return grid.tolist()

# ── Load all parquet files ───────────────────────────────────────────────────

print("Loading parquet files...")
all_frames = []
file_count = 0

for day in DAYS:
    day_path = os.path.join(DATA_ROOT, day)
    if not os.path.exists(day_path):
        print(f"  Skipping missing folder: {day_path}")
        continue

    for fname in os.listdir(day_path):
        fpath = os.path.join(day_path, fname)
        try:
            df = pq.read_table(fpath).to_pandas()
            df["event"] = df["event"].apply(
                lambda x: x.decode("utf-8") if isinstance(x, bytes) else x
            )
            df["date"]   = day
            df["is_bot"] = ~df["user_id"].str.contains("-", na=False)
            df["ts_ms"]  = df["ts"].astype("int64")
            all_frames.append(
                df[["user_id", "match_id", "map_id", "x", "z", "ts_ms", "event", "date", "is_bot"]]
            )
            file_count += 1
        except Exception as e:
            pass  # skip corrupt / empty files

print(f"  Loaded {file_count} files")
full = pd.concat(all_frames, ignore_index=True)
print(f"  Total rows: {len(full):,}")

# ── Coordinate transform ─────────────────────────────────────────────────────

print("Applying coordinate transform...")
full["px"] = np.nan
full["py"] = np.nan

for map_id in MAP_CONFIG:
    mask = full["map_id"] == map_id
    sub  = full.loc[mask]
    coords = sub.apply(lambda r: world_to_pixel(r["x"], r["z"], map_id), axis=1)
    full.loc[mask, "px"] = coords.apply(lambda c: c[0])
    full.loc[mask, "py"] = coords.apply(lambda c: c[1])

# ── Timestamp normalisation ───────────────────────────────────────────────────

print("Normalising timestamps...")
match_min_ts = full.groupby("match_id")["ts_ms"].transform("min")
full["ts_rel"] = (full["ts_ms"] - match_min_ts).astype(int)

# ── Match index ──────────────────────────────────────────────────────────────

print("Building match index...")
match_index = (
    full.groupby("match_id")
    .agg(
        map_id      = ("map_id",  "first"),
        date        = ("date",    "first"),
        n_humans    = ("is_bot",  lambda x: int((~x).sum())),
        n_events    = ("event",   "count"),
        duration_ms = ("ts_rel",  "max"),
    )
    .reset_index()
)
match_index["n_events"]    = match_index["n_events"].astype(int)
match_index["duration_ms"] = match_index["duration_ms"].astype(int)

# ── Outputs ──────────────────────────────────────────────────────────────────

os.makedirs(OUT_ROOT, exist_ok=True)
os.makedirs(os.path.join(OUT_ROOT, "matches"), exist_ok=True)
os.makedirs(MINIMAP_DST, exist_ok=True)

# match_index.json
with open(os.path.join(OUT_ROOT, "match_index.json"), "w") as f:
    json.dump(match_index.to_dict(orient="records"), f, separators=(",", ":"))
print(f"  Saved match_index.json ({len(match_index)} matches)")

# Per-match JSON files
print("Saving per-match event files...")
match_count = 0
for match_id, group in full.groupby("match_id"):
    pos_mask    = group["event"].isin(["Position", "BotPosition"])
    non_pos     = group[~pos_mask]
    pos_sampled = group[pos_mask].iloc[::POSITION_SAMPLE]
    combined    = pd.concat([non_pos, pos_sampled]).sort_values("ts_rel")

    records = []
    for _, row in combined.iterrows():
        if pd.isna(row["px"]) or pd.isna(row["py"]):
            continue
        records.append({
            "uid": row["user_id"],
            "bot": bool(row["is_bot"]),
            "ev":  row["event"],
            "px":  row["px"],
            "py":  row["py"],
            "ts":  int(row["ts_rel"]),
        })

    safe_name = match_id.replace("/", "_").replace(".", "_")
    fpath = os.path.join(OUT_ROOT, "matches", f"{safe_name}.json")
    with open(fpath, "w") as f:
        json.dump(records, f, separators=(",", ":"))
    match_count += 1

print(f"  Saved {match_count} match files")

# Heatmaps
print("Building heatmaps...")
heatmap_data = {}
EVENT_GROUPS = {
    "traffic": ["Position", "BotPosition"],
    "kills":   ["Kill", "BotKill"],
    "deaths":  ["Killed", "BotKilled", "KilledByStorm"],
    "loot":    ["Loot"],
    "storm":   ["KilledByStorm"],
}

for map_id in MAP_CONFIG:
    map_df = full[full["map_id"] == map_id].copy()
    # Clip to valid pixel range
    map_df = map_df[
        (map_df["px"] >= 0) & (map_df["px"] <= IMG_SIZE) &
        (map_df["py"] >= 0) & (map_df["py"] <= IMG_SIZE)
    ]
    heatmap_data[map_id] = {}
    for layer_name, event_types in EVENT_GROUPS.items():
        layer_df = map_df[map_df["event"].isin(event_types)]
        heatmap_data[map_id][layer_name] = make_heatmap_grid(layer_df, map_id)

with open(os.path.join(OUT_ROOT, "heatmaps.json"), "w") as f:
    json.dump(heatmap_data, f, separators=(",", ":"))
print("  Saved heatmaps.json")

# Copy minimap images
if os.path.exists(MINIMAP_SRC):
    for fname in os.listdir(MINIMAP_SRC):
        shutil.copy2(os.path.join(MINIMAP_SRC, fname), os.path.join(MINIMAP_DST, fname))
    print(f"  Copied minimap images to {MINIMAP_DST}/")

print("\nDone. Run `npm run dev` to start the app.")
