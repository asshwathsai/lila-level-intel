# INSIGHTS.md — What the Data Tells Us About LILA BLACK

Three insights discovered through the Level Intel tool, each backed by concrete numbers from the 5-day dataset (Feb 10–14, 2026 | 796 matches | 245 players | 89,104 events).

---

## Insight 1: Players Almost Never Kill Each Other — Bots Are Doing All the Work

### What caught my eye

When I activated the Kill Zones heatmap and toggled on PvP Kill markers, the map was nearly empty of red crosshairs. I expected a battle royale dataset to be full of player-vs-player combat. Instead, the kill events were almost entirely bot kills (orange). Something was very wrong — or very revealing.

### The evidence

| Event Type | Count | Per Match |
|---|---|---|
| PvP Kill (human kills human) | **3** | 0.004 |
| Bot Kill (human kills bot) | **2,415** | 3.0 |
| PvP : Bot kill ratio | — | **1 : 805** |

Across 796 matches over 5 days, with 245 unique human players, only **3 player-vs-player kills** occurred. Every meaningful combat interaction was player-versus-bot. The top 5 most active players — one with 49 matches played — have zero PvP kills.

The loot-to-kill timing sequence corroborates this: loot peaks at the 44% mark of a match, kills peak at 54%. The rhythm is **loot → fight bots → extract** — not loot → fight players.

### What this means for a level designer

The current maps are designed (or are being used) as **PvE extraction loops**, not PvP arenas. Combat encounter design — ambush corridors, sightlines, chokepoints, cover placement — is currently being evaluated only against bot behavior, not player intent.

**Actionable items:**
- Audit whether map geometry is creating player-avoidance behaviour (players routing around each other rather than through contested zones)
- Identify whether loot spawn placement is pulling players into **parallel routes** rather than **converging zones** — the high loot-kill spatial correlation (r = 0.81–0.87) suggests loot and kills co-locate, but the near-zero PvP rate means players aren't finding each other at those hotspots
- Consider adding map features that funnel player paths into shared corridors (bridges, single extract points, mandatory choke zones) to drive organic PvP

**Metrics affected:** PvP kill rate per match, player time-to-first-combat, match excitement score (if tracked), session retention for players who prefer PvP-style gameplay.

---

## Insight 2: GrandRift Is Being Ignored — and the Data Shows Why It Should Be Fixed

### What caught my eye

Switching between maps in the sidebar, I noticed the match list for GrandRift was dramatically shorter. When I pulled up the heatmap and traffic overlay, the map looked healthy — concentrated traffic in the center, decent loot density. But barely anyone was playing it.

### The evidence

| Map | Matches | Share | Unique Players | Loot/Match |
|---|---|---|---|---|
| AmbroseValley | 566 | **71.1%** | 217 | 17.6 |
| Lockdown | 171 | 21.5% | 79 | 12.0 |
| GrandRift | 59 | **7.4%** | 29 | 14.9 |

GrandRift has the **second-best loot density per match** (14.9 vs Lockdown's 12.0) and a **kill rate comparable to AmbroseValley** (3.3 vs 3.2 per match). By pure gameplay-loop metrics, it's a solid map. Yet it's being played at less than a tenth the rate of AmbroseValley.

Of the 29 players who did play GrandRift, 22 (76%) also played AmbroseValley — they're not a separate audience. GrandRift is getting incidental play from the same core playerbase, not dedicated fans.

### What this means for a level designer

This is a **discoverability and rotation problem**, not a quality problem. The map's engagement metrics when played are comparable to the lead map. The issue is that players are defaulting to AmbroseValley and never experiencing GrandRift — possibly because of how matchmaking surfaces it, or because experienced players steer toward the familiar map.

**Actionable items:**
- Instrument **map selection flow**: are players choosing AmbroseValley or is the matchmaker defaulting to it? If the latter, adjust weighting
- Run a GrandRift-only event or daily quest to force exposure — the loot and combat metrics suggest players who do play it have a comparable experience
- Audit **visual distinctiveness**: does GrandRift communicate a different enough fantasy from AmbroseValley to create a preference pull? Traffic heatmaps show GrandRift players cluster centrally (similar to AmbroseValley's top traffic cells near x=−4,z=230 and x=108,z=230) — it may feel too similar to motivate a switch

**Metrics affected:** map rotation diversity index, GrandRift DAU, repeat GrandRift sessions, new-player map exposure breadth.

---

## Insight 3: Half of AmbroseValley Is a Dead Zone — Players Are Stuck in One Corridor

### What caught my eye

When I enabled the Traffic heatmap on AmbroseValley, two or three cells lit up intensely — and the rest of the map was nearly dark. The asymmetry was stark: a map that looks large and open in the minimap is being used like a narrow hallway.

### The evidence

Using a 16×16 spatial grid across all 51,347 AmbroseValley position events:

- **49.6% of grid cells have zero recorded player traffic**
- **62.1% of cells have less than 5% of peak-cell traffic**
- The top 3 traffic hotspots concentrate near world coordinates: (-4, 230), (108, 230), (108, 5)
- These three cells account for a disproportionate share of all position events

The storm death data reinforces this: storm deaths occur at the **99th percentile** of match duration — players aren't dying to the storm because they strayed too far from the safe zone; they're dying because they ran out of time. The storm isn't pushing players into new areas; it's catching the stragglers of the existing route.

Lockdown shows the most storm deaths per match (0.10 vs 0.03 for AmbroseValley), suggesting its smaller size creates more genuine storm pressure and forces players off the beaten path.

### What this means for a level designer

AmbroseValley's **open area is not being used**. Players have found one efficient route (likely the path of least resistance from spawn to extract via the loot-rich corridor near x=100–108, z=5–230) and are repeating it every match. This creates:
- Predictable, easily botted play patterns
- Reduced replay value (same experience every run)
- Wasted level design investment in the unused 50% of the map

**Actionable items:**
- Place **high-value loot spawns in currently dead zones** to draw players off the main corridor — the loot-kill correlation of 0.81 confirms players fight where they loot, so moving loot will move the action
- Add **storm pressure earlier in the match** (the current median storm death at 99% means the storm is purely cosmetic for most of the match) — earlier zone pressure would force route diversity
- Consider adding **secondary extract points** in underused areas to create alternative viable paths and split player traffic

**Metrics affected:** map exploration coverage per session, average loot pickup spread (standard deviation of loot x/z coordinates), time-in-dead-zone, player route diversity score.

---

## Data Appendix

| Metric | Value |
|---|---|
| Dataset | Feb 10–14, 2026 |
| Total events | 89,104 |
| Total matches | 796 |
| Unique human players | 245 |
| Players with 1 match only | 106 (43.3%) |
| Players with 5+ matches | 43 (17.6%) |
| Max matches by single player | 49 |
| Loot-kill spatial correlation (all maps) | 0.81–0.87 |
| Median loot timing | 44% into match |
| Median kill timing | 54% into match |
| Storm death timing | 99%+ into match |
