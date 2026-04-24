# WALKTHROUGH.md — How to Use LILA BLACK Level Intel

A complete user guide for the Level Design team. No technical knowledge needed.

## Opening the Tool
Go to the deployed URL in any browser: https://lila-level-intel.vercel.app

## Layout
The screen has 4 zones: Header (top) / Sidebar (left) / Map Canvas (center) / Timeline (bottom)

## Step 1 — Pick a Map
Click one of three buttons in sidebar: Ambrose / GrandRift / Lockdown
Start with AmbroseValley — most matches (566 of 796)

## Step 2 — Filter by Date
Use the dropdown below map buttons. Leave on All Dates or pick Feb 10-14.
Feb 10 has the richest data.

## Step 3 — Select a Match
Click any match from the list. Higher event count = richer match.
Paths and markers appear on the map immediately.

## Step 4 — Reading the Map
Bright colored lines = Human players (each player gets unique color)
Muted blue lines = Bots
Kill = red X, Death = orange diamond, Storm = purple lightning, Loot = green square

## Step 5 — Timeline Playback
Press play button (bottom left) to watch match unfold in real time.
Drag slider to jump to any moment.
Speed: 0.5x / 1x / 2x / 4x / 8x

## Step 6 — Visibility Toggles
Humans button = show/hide human player paths
Bots button = show/hide bot paths
Turn Bots ON to compare AI routes vs human routes

## Step 7 — Event Toggles
Toggle each event type on/off: Kill / Death / Loot / Storm
To study loot patterns: turn ON Loot only, turn OFF everything else
To study combat: turn ON Kill and Death, turn OFF Loot

## Step 8 — Heatmaps
5 overlays built from ALL 796 matches across 5 days:
- Player Traffic (cyan) = where players move most
- Kill Zones (red) = where kills happen most
- Death Zones (orange) = where players die most  
- Loot Hotspots (green) = where loot is picked up most
- Storm Deaths (purple) = where storm catches players
Click any heatmap button to enable. Click again to turn off.
Works without selecting a match.

## Recommended Workflows

Workflow 1 - Where do players go?
1. Select a map
2. Enable Player Traffic heatmap
3. Dark areas = ignored level design

Workflow 2 - Where do fights happen?
1. Enable Kill Zones heatmap
2. Load a match, press play
3. Watch fights happen over the aggregate hotspot background

Workflow 3 - Is loot driving combat?
1. Enable Loot Hotspots heatmap, note bright areas
2. Switch to Kill Zones, compare locations
3. They should overlap - loot pulls players, combat follows

Workflow 4 - Watch a full match
1. Pick top match from list
2. Drag slider all the way left
3. Set speed to 2x, press play

Workflow 5 - Bots vs Humans
1. Load any match
2. Turn OFF Humans, turn ON Bots
3. Watch bot routes, then switch to humans only and compare
