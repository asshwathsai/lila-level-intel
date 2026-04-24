import { useEffect, useRef, useCallback } from 'react'

const MAP_CONFIG = {
  AmbroseValley: { scale: 900, origin_x: -370, origin_z: -473, img: '/minimaps/AmbroseValley_Minimap.png' },
  GrandRift:     { scale: 581, origin_x: -290, origin_z: -290, img: '/minimaps/GrandRift_Minimap.png' },
  Lockdown:      { scale: 1000, origin_x: -500, origin_z: -500, img: '/minimaps/Lockdown_Minimap.jpg' },
}

const EVENT_COLORS = {
  Kill:          '#ff3b5c',
  Killed:        '#ff7043',
  BotKill:       '#ff8a65',
  BotKilled:     '#ffa726',
  KilledByStorm: '#d500f9',
  Loot:          '#00e676',
}

const HEATMAP_COLORS = {
  traffic: [0, 229, 255],
  kills:   [255, 59, 92],
  deaths:  [255, 109, 0],
  loot:    [0, 230, 118],
  storm:   [213, 0, 249],
}

const IMG_SIZE = 1024

// Assign consistent colors to players
const PLAYER_PALETTE = [
  '#00e5ff','#ff3b5c','#00e676','#ffd600','#d500f9',
  '#ff6d00','#76ff03','#40c4ff','#ff4081','#ea80fc',
  '#64ffda','#ffab40','#b388ff','#69f0ae','#ff6e40',
]
const BOT_COLOR = 'rgba(100,150,200,0.4)'
const BOT_COLOR_SOLID = '#4a8ab8'

export default function MapCanvas({ mapId, matchData, currentTime, maxTime, heatmapMode, heatmapData, showHumans, showBots, showEvents, activeEventTypes }) {
  const bgCanvasRef = useRef(null)   // minimap image
  const heatCanvasRef = useRef(null) // heatmap
  const eventCanvasRef = useRef(null) // events + paths
  const containerRef = useRef(null)
  const imgCacheRef = useRef({})
  const playerColorsRef = useRef({})
  const sizeRef = useRef({ w: 0, h: 0, scale: 1, offX: 0, offY: 0 })

  // Compute canvas layout (letterboxed)
  const computeLayout = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { clientWidth: W, clientHeight: H } = el
    const scale = Math.min(W / IMG_SIZE, H / IMG_SIZE)
    const w = IMG_SIZE * scale
    const h = IMG_SIZE * scale
    const offX = (W - w) / 2
    const offY = (H - h) / 2
    sizeRef.current = { w, h, scale, offX, offY, W, H }
    ;[bgCanvasRef, heatCanvasRef, eventCanvasRef].forEach(r => {
      if (r.current) { r.current.width = W; r.current.height = H }
    })
  }, [])

  // Draw minimap background
  const drawBackground = useCallback(() => {
    const canvas = bgCanvasRef.current
    if (!canvas || !mapId) return
    const ctx = canvas.getContext('2d')
    const { w, h, offX, offY, W, H } = sizeRef.current
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#080b0f'
    ctx.fillRect(0, 0, W, H)

    const cfg = MAP_CONFIG[mapId]
    if (!cfg) return

    const loadAndDraw = (src) => {
      if (imgCacheRef.current[src]) {
        ctx.drawImage(imgCacheRef.current[src], offX, offY, w, h)
        // Dark overlay for readability
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(offX, offY, w, h)
        return
      }
      const img = new Image()
      img.onload = () => {
        imgCacheRef.current[src] = img
        ctx.drawImage(img, offX, offY, w, h)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(offX, offY, w, h)
      }
      img.src = src
    }
    loadAndDraw(cfg.img)
  }, [mapId])

  // Draw heatmap overlay
  const drawHeatmap = useCallback(() => {
    const canvas = heatCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { w, h, offX, offY, W, H, scale } = sizeRef.current
    ctx.clearRect(0, 0, W, H)

    if (!heatmapMode || !heatmapData || !mapId || !heatmapData[mapId]) return

    const grid = heatmapData[mapId][heatmapMode]
    if (!grid) return

    const GRID = grid.length
    const cellSize = (IMG_SIZE / GRID) * scale

    // Find max for normalization
    let maxVal = 0
    for (let gy = 0; gy < GRID; gy++)
      for (let gx = 0; gx < GRID; gx++)
        if (grid[gy][gx] > maxVal) maxVal = grid[gy][gx]

    if (maxVal === 0) return
    const [r, g, b] = HEATMAP_COLORS[heatmapMode] || [255, 255, 255]

    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const val = grid[gy][gx]
        if (val === 0) continue
        const t = Math.pow(val / maxVal, 0.4) // gamma for visibility
        const px = offX + gx * cellSize
        const py = offY + gy * cellSize

        ctx.fillStyle = `rgba(${r},${g},${b},${t * 0.75})`
        ctx.fillRect(px, py, cellSize + 0.5, cellSize + 0.5)
      }
    }
  }, [heatmapMode, heatmapData, mapId])

  // Draw events and player paths
  const drawEvents = useCallback(() => {
    const canvas = eventCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { w, h, offX, offY, W, H, scale } = sizeRef.current
    ctx.clearRect(0, 0, W, H)

    if (!matchData || matchData.length === 0) return

    // Filter by current time
    const visible = matchData.filter(e => e.ts <= currentTime)

    // Assign player colors
    const playerColors = playerColorsRef.current
    let colorIdx = 0
    visible.forEach(e => {
      if (!e.bot && !playerColors[e.uid]) {
        playerColors[e.uid] = PLAYER_PALETTE[colorIdx % PLAYER_PALETTE.length]
        colorIdx++
      }
    })

    const toCanvas = (px, py) => ({
      cx: offX + px * scale,
      cy: offY + py * scale,
    })

    // Draw paths per player
    const playerPositions = {}
    visible.forEach(e => {
      if (!e.px || !e.py) return
      if (e.ev === 'Position' || e.ev === 'BotPosition') {
        const key = e.uid
        if (!playerPositions[key]) playerPositions[key] = []
        playerPositions[key].push({ px: e.px, py: e.py, bot: e.bot })
      }
    })

    // Draw paths
    Object.entries(playerPositions).forEach(([uid, pts]) => {
      if (pts.length < 2) return
      const isBot = pts[0].bot
      if (isBot && !showBots) return
      if (!isBot && !showHumans) return

      const color = isBot ? BOT_COLOR : (playerColors[uid] || '#00e5ff')
      ctx.beginPath()
      const start = toCanvas(pts[0].px, pts[0].py)
      ctx.moveTo(start.cx, start.cy)
      for (let i = 1; i < pts.length; i++) {
        const p = toCanvas(pts[i].px, pts[i].py)
        ctx.lineTo(p.cx, p.cy)
      }
      ctx.strokeStyle = color
      ctx.lineWidth = isBot ? 1 : 1.5
      ctx.globalAlpha = isBot ? 0.35 : 0.7
      ctx.stroke()
      ctx.globalAlpha = 1

      // Draw head dot at last position
      if (pts.length > 0) {
        const last = toCanvas(pts[pts.length - 1].px, pts[pts.length - 1].py)
        ctx.beginPath()
        ctx.arc(last.cx, last.cy, isBot ? 2.5 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isBot ? BOT_COLOR_SOLID : color
        ctx.globalAlpha = isBot ? 0.6 : 1
        ctx.fill()
        ctx.globalAlpha = 1
      }
    })

    // Draw discrete events
    const discreteEvents = visible.filter(e =>
      !['Position', 'BotPosition'].includes(e.ev) && e.px && e.py
    )

    discreteEvents.forEach(e => {
      if (!activeEventTypes.includes(e.ev)) return
      const { cx, cy } = toCanvas(e.px, e.py)
      const color = EVENT_COLORS[e.ev] || '#ffffff'

      ctx.save()
      switch (e.ev) {
        case 'Kill':
        case 'BotKill': {
          // Crosshair / X marker
          const s = e.ev === 'Kill' ? 7 : 5
          ctx.strokeStyle = color
          ctx.lineWidth = e.ev === 'Kill' ? 2 : 1.5
          ctx.shadowColor = color; ctx.shadowBlur = 8
          ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke()
          break
        }
        case 'Killed':
        case 'BotKilled': {
          // Skull / diamond
          const s = e.ev === 'Killed' ? 6 : 4
          ctx.strokeStyle = color; ctx.lineWidth = 1.5
          ctx.shadowColor = color; ctx.shadowBlur = 6
          ctx.beginPath()
          ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy)
          ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy)
          ctx.closePath(); ctx.stroke()
          break
        }
        case 'KilledByStorm': {
          // Lightning bolt (circle with Z)
          ctx.strokeStyle = color; ctx.fillStyle = color + '33'
          ctx.shadowColor = color; ctx.shadowBlur = 12
          ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2)
          ctx.fill(); ctx.stroke()
          ctx.fillStyle = color; ctx.font = 'bold 7px Space Mono'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('⚡', cx, cy)
          break
        }
        case 'Loot': {
          // Small square
          ctx.fillStyle = color + '55'; ctx.strokeStyle = color; ctx.lineWidth = 1
          ctx.shadowColor = color; ctx.shadowBlur = 4
          ctx.fillRect(cx - 3, cy - 3, 6, 6)
          ctx.strokeRect(cx - 3, cy - 3, 6, 6)
          break
        }
        default: {
          ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2)
          ctx.fillStyle = color; ctx.fill()
        }
      }
      ctx.restore()
    })
  }, [matchData, currentTime, showHumans, showBots, activeEventTypes])

  // Initialize
  useEffect(() => {
    computeLayout()
    drawBackground()
    const ro = new ResizeObserver(() => {
      computeLayout()
      drawBackground()
      drawHeatmap()
      drawEvents()
    })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { drawBackground() }, [mapId, drawBackground])
  useEffect(() => { drawHeatmap() }, [heatmapMode, heatmapData, mapId, drawHeatmap])
  useEffect(() => { drawEvents() }, [matchData, currentTime, showHumans, showBots, activeEventTypes, drawEvents])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={bgCanvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={heatCanvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={eventCanvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  )
}
