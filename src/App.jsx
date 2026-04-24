import { useState, useEffect, useRef } from 'react'
import MapCanvas from './MapCanvas'

const MAPS = ['AmbroseValley', 'GrandRift', 'Lockdown']
const DATES = ['February_10', 'February_11', 'February_12', 'February_13', 'February_14']
const ALL_EVENT_TYPES = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']

const EVENT_META = {
  Kill:          { label: 'PvP Kill',    color: '#ff3b5c', shape: '✕' },
  Killed:        { label: 'PvP Death',   color: '#ff7043', shape: '◆' },
  BotKill:       { label: 'Bot Kill',    color: '#ff8a65', shape: '✕' },
  BotKilled:     { label: 'Bot Death',   color: '#ffa726', shape: '◆' },
  KilledByStorm: { label: 'Storm Death', color: '#d500f9', shape: '⚡' },
  Loot:          { label: 'Loot',        color: '#00e676', shape: '■' },
}

const HEATMAPS = [
  { key: 'traffic', label: 'Player Traffic',  color: '#00e5ff' },
  { key: 'kills',   label: 'Kill Zones',      color: '#ff3b5c' },
  { key: 'deaths',  label: 'Death Zones',     color: '#ff6d00' },
  { key: 'loot',    label: 'Loot Hotspots',   color: '#00e676' },
  { key: 'storm',   label: 'Storm Deaths',    color: '#d500f9' },
]

const SPEEDS = [0.5, 1, 2, 4, 8]

function fmtTime(ms) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
}

function Hstat({ val, lbl }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
      <span style={{fontFamily:"'Space Mono',monospace",fontSize:14,color:'#00e5ff'}}>{val}</span>
      <span style={{fontSize:9,letterSpacing:1,color:'#4a6080',textTransform:'uppercase'}}>{lbl}</span>
    </div>
  )
}

function StatPill({ label, val, color }) {
  return (
    <div style={{display:'flex',gap:5,alignItems:'center'}}>
      <span style={{color:'#4a6080',fontSize:11}}>{label}:</span>
      <span style={{fontFamily:"'Space Mono',monospace",color,fontSize:12}}>{val}</span>
    </div>
  )
}

function LegItem({ color, label, line, shape }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#4a6080'}}>
      {line
        ? <div style={{width:16,height:2,borderRadius:1,background:color}}/>
        : <span style={{color,fontSize:shape?11:9}}>{shape||'●'}</span>
      }
      {label}
    </div>
  )
}

export default function App() {
  const [matchIndex, setMatchIndex] = useState([])
  const [heatmapData, setHeatmapData] = useState(null)
  const [appLoading, setAppLoading] = useState(true)

  const [filterMap, setFilterMap] = useState('AmbroseValley')
  const [filterDate, setFilterDate] = useState('All')
  const [selectedMatch, setSelectedMatch] = useState(null)

  const [matchData, setMatchData] = useState([])
  const [loadingMatch, setLoadingMatch] = useState(false)

  const [heatmapMode, setHeatmapMode] = useState(null)
  const [showHumans, setShowHumans] = useState(true)
  const [showBots, setShowBots] = useState(false)
  const [activeEvents, setActiveEvents] = useState([...ALL_EVENT_TYPES])

  const [currentTime, setCurrentTime] = useState(0)
  const [maxTime, setMaxTime] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [matchStats, setMatchStats] = useState(null)

  const playRef = useRef(null)
  const lastTickRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('/data/match_index.json').then(r=>r.json()),
      fetch('/data/heatmaps.json').then(r=>r.json()),
    ]).then(([idx, heat]) => {
      setMatchIndex(idx); setHeatmapData(heat); setAppLoading(false)
    })
  }, [])

  const filteredMatches = matchIndex
    .filter(m => m.map_id === filterMap && (filterDate === 'All' || m.date === filterDate))
    .sort((a,b) => b.n_events - a.n_events)

  useEffect(() => {
    if (!selectedMatch) { setMatchData([]); setMatchStats(null); return }
    setLoadingMatch(true); setPlaying(false); setCurrentTime(0)
    const fname = selectedMatch.match_id.replace(/\./g,'_').replace(/\//g,'_')
    fetch(`/data/matches/${fname}.json`).then(r=>r.json()).then(data => {
      setMatchData(data)
      const mx = data.reduce((m,e)=>Math.max(m,e.ts),0)
      setMaxTime(mx||1); setCurrentTime(mx)
      const humans = new Set(data.filter(e=>!e.bot).map(e=>e.uid))
      const bots = new Set(data.filter(e=>e.bot).map(e=>e.uid))
      setMatchStats({
        humans: humans.size, bots: bots.size,
        kills: data.filter(e=>e.ev==='Kill').length,
        botKills: data.filter(e=>e.ev==='BotKill').length,
        stormDeaths: data.filter(e=>e.ev==='KilledByStorm').length,
        lootCount: data.filter(e=>e.ev==='Loot').length,
        duration: mx
      })
      setLoadingMatch(false)
    }).catch(()=>setLoadingMatch(false))
  }, [selectedMatch])

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(playRef.current); return }
    const tick = (now) => {
      if (lastTickRef.current == null) lastTickRef.current = now
      const delta = now - lastTickRef.current; lastTickRef.current = now
      setCurrentTime(t => {
        const next = t + delta * speed
        if (next >= maxTime) { setPlaying(false); return maxTime }
        return next
      })
      playRef.current = requestAnimationFrame(tick)
    }
    lastTickRef.current = null; playRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(playRef.current)
  }, [playing, speed, maxTime])

  const togglePlay = () => {
    if (currentTime >= maxTime) setCurrentTime(0)
    setPlaying(p=>!p)
  }

  if (appLoading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16,background:'#080b0f'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,letterSpacing:4,color:'#00e5ff'}}>LILA BLACK — LEVEL INTEL</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,letterSpacing:3,color:'#4a6080'}}>LOADING TELEMETRY DATA...</div>
      <div style={{width:200,height:2,background:'#1e2d42',borderRadius:1,overflow:'hidden'}}>
        <div style={{height:'100%',background:'linear-gradient(90deg,#007a8c,#00e5ff)',animation:'lp 1s ease-in-out infinite'}}/>
      </div>
      <style>{`@keyframes lp{0%,100%{width:20%}50%{width:80%}}`}</style>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'#080b0f',fontFamily:"'Barlow',sans-serif",fontSize:13}}>

      {/* HEADER */}
      <div style={{display:'flex',alignItems:'center',gap:16,padding:'0 20px',height:48,background:'#0d1117',borderBottom:'1px solid #1e2d42',flexShrink:0,boxShadow:'inset 0 -1px 0 rgba(0,229,255,0.08)'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,letterSpacing:3,color:'#00e5ff',textShadow:'0 0 20px #007a8c44'}}>
          LILA BLACK <span style={{color:'#1e2d42',margin:'0 4px'}}>|</span> <span style={{color:'#8ca0b8',fontWeight:400}}>LEVEL INTEL</span>
        </div>
        <div style={{width:1,height:24,background:'#1e2d42'}}/>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:2,color:'#4a6080',textTransform:'uppercase'}}>Player Telemetry Visualizer</span>
        <div style={{marginLeft:'auto',display:'flex',gap:24}}>
          <Hstat val={matchIndex.length} lbl="Matches" />
          <Hstat val={245} lbl="Players" />
          <Hstat val="5 Days" lbl="Range" />
          <Hstat val="3" lbl="Maps" />
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* SIDEBAR */}
        <div style={{width:255,flexShrink:0,background:'#0d1117',borderRight:'1px solid #1e2d42',display:'flex',flexDirection:'column',overflow:'hidden'}}>

          <SideSection label="Map">
            <div style={{display:'flex',gap:4}}>
              {MAPS.map(m=>(
                <button key={m}
                  style={{flex:1,padding:'4px 0',borderRadius:3,border:`1px solid ${filterMap===m?'#00e5ff':'#1e2d42'}`,background:filterMap===m?'rgba(0,229,255,0.1)':'#141c26',color:filterMap===m?'#00e5ff':'#8ca0b8',fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:0.5,cursor:'pointer',transition:'all 0.15s'}}
                  onClick={()=>{setFilterMap(m);setSelectedMatch(null)}}>
                  {m==='AmbroseValley'?'Ambrose':m}
                </button>
              ))}
            </div>
          </SideSection>

          <SideSection label="Date">
            <select value={filterDate} onChange={e=>{setFilterDate(e.target.value);setSelectedMatch(null)}}
              style={{width:'100%',background:'#141c26',border:'1px solid #1e2d42',color:'#e8edf3',fontFamily:"'Space Mono',monospace",fontSize:10,padding:'5px 8px',borderRadius:3,outline:'none',cursor:'pointer',appearance:'none'}}>
              <option value="All">All Dates (Feb 10–14)</option>
              {DATES.map(d=><option key={d} value={d}>{d.replace('_',' ')}</option>)}
            </select>
          </SideSection>

          <SideSection label="Heatmap Overlay">
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              {HEATMAPS.map(h=>{
                const on = heatmapMode===h.key
                return (
                  <button key={h.key}
                    style={{padding:'5px 8px',borderRadius:3,border:`1px solid ${on?h.color:'#1e2d42'}`,background:on?h.color+'18':'#141c26',color:on?h.color:'#8ca0b8',fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,cursor:'pointer',transition:'all 0.15s',textAlign:'left',display:'flex',alignItems:'center',gap:6}}
                    onClick={()=>setHeatmapMode(p=>p===h.key?null:h.key)}>
                    <span style={{width:6,height:6,borderRadius:1,background:on?h.color:'#2a3f5a',flexShrink:0}}/>
                    {h.label}
                  </button>
                )
              })}
            </div>
          </SideSection>

          <SideSection label="Visibility">
            <div style={{display:'flex',gap:5,marginBottom:8}}>
              <TogBtn active={showHumans} color="#00e5ff" onClick={()=>setShowHumans(p=>!p)}>Humans</TogBtn>
              <TogBtn active={showBots} color="#4a8ab8" onClick={()=>setShowBots(p=>!p)}>Bots</TogBtn>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              {ALL_EVENT_TYPES.map(ev=>{
                const m2 = EVENT_META[ev]; const on = activeEvents.includes(ev)
                return (
                  <button key={ev}
                    style={{padding:'3px 8px',borderRadius:3,border:`1px solid ${on?m2.color:'#1e2d42'}`,background:on?m2.color+'18':'#141c26',color:on?m2.color:'#8ca0b8',fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,cursor:'pointer',transition:'all 0.15s',textAlign:'left',display:'flex',alignItems:'center',gap:6}}
                    onClick={()=>setActiveEvents(p=>p.includes(ev)?p.filter(e=>e!==ev):[...p,ev])}>
                    <span style={{fontSize:9}}>{m2.shape}</span>{m2.label}
                  </button>
                )
              })}
            </div>
          </SideSection>

          {/* Match list */}
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:2,color:'#4a6080',textTransform:'uppercase',padding:'10px 14px 4px',display:'flex',justifyContent:'space-between'}}>
            <span>Matches</span>
            <span style={{color:'#1e2d42'}}>{filteredMatches.length}</span>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'4px 12px 12px'}}>
            {filteredMatches.length===0 && <div style={{color:'#4a6080',fontSize:11,padding:'8px 2px'}}>No matches for this filter</div>}
            {filteredMatches.map(m=>{
              const active = selectedMatch?.match_id===m.match_id
              return (
                <div key={m.match_id}
                  style={{padding:'7px 8px',borderRadius:3,border:`1px solid ${active?'#00e5ff':'#1e2d42'}`,background:active?'rgba(0,229,255,0.06)':'#141c26',cursor:'pointer',transition:'all 0.15s',marginBottom:3}}
                  onClick={()=>setSelectedMatch(m)}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:active?'#00e5ff':'#8ca0b8',marginBottom:2}}>{m.match_id.slice(0,18)}…</div>
                  <div style={{fontSize:10,color:'#4a6080',display:'flex',gap:8}}>
                    <span>{m.date?.replace('February_','Feb ')}</span>
                    <span>👤 {m.n_humans}</span>
                    <span>{m.n_events} events</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* MAP AREA */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Map toolbar */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 16px',background:'#0d1117',borderBottom:'1px solid #1e2d42',flexShrink:0,flexWrap:'wrap',minHeight:40}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,color:'#e8edf3',textTransform:'uppercase'}}>{filterMap}</span>
            {selectedMatch && <span style={{fontSize:10,color:'#4a6080',fontFamily:"'Space Mono',monospace"}}>{selectedMatch.match_id.slice(0,12)}…</span>}
            {loadingMatch && <span style={{fontSize:11,color:'#00e5ff'}}>Loading…</span>}
            <div style={{marginLeft:'auto',display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
              <LegItem color="#00e5ff" label="Human" line />
              <LegItem color="#4a8ab8" label="Bot" line />
              <LegItem color="#ff3b5c" label="Kill" shape="✕" />
              <LegItem color="#ff7043" label="Death" shape="◆" />
              <LegItem color="#00e676" label="Loot" shape="■" />
              <LegItem color="#d500f9" label="Storm" shape="⚡" />
            </div>
          </div>

          {/* Canvas */}
          <div style={{flex:1,position:'relative',overflow:'hidden',background:'radial-gradient(ellipse at center,#0d1520 0%,#080b0f 100%)'}}>
            {!selectedMatch && !heatmapMode && (
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,zIndex:1,pointerEvents:'none'}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,letterSpacing:3,color:'#2a3f5a',textTransform:'uppercase'}}>Select a Match</div>
                <div style={{fontSize:12,color:'#2a3f5a'}}>or enable a heatmap overlay to explore {filterMap}</div>
              </div>
            )}
            <MapCanvas
              mapId={filterMap}
              matchData={matchData}
              currentTime={currentTime}
              maxTime={maxTime}
              heatmapMode={heatmapMode}
              heatmapData={heatmapData}
              showHumans={showHumans}
              showBots={showBots}
              activeEventTypes={activeEvents}
            />
          </div>

          {/* TIMELINE */}
          <div style={{background:'#0d1117',borderTop:'1px solid #1e2d42',padding:'10px 16px',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
              <button style={{width:32,height:32,borderRadius:3,border:'1px solid #2a3f5a',background:'#141c26',color:'#00e5ff',cursor:'pointer',fontSize:14,transition:'all 0.15s'}}
                onClick={togglePlay}>{playing?'⏸':'▶'}</button>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:'#00e5ff',minWidth:80}}>
                {fmtTime(currentTime)} / {fmtTime(maxTime)}
              </span>
              <div style={{display:'flex',gap:3}}>
                {SPEEDS.map(s=>(
                  <button key={s}
                    style={{padding:'3px 7px',borderRadius:2,border:`1px solid ${speed===s?'#007a8c':'#1e2d42'}`,background:'#141c26',color:speed===s?'#00e5ff':'#8ca0b8',fontFamily:"'Space Mono',monospace",fontSize:10,cursor:'pointer'}}
                    onClick={()=>setSpeed(s)}>{s}x</button>
                ))}
              </div>
              {matchStats && (
                <div style={{marginLeft:'auto',display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}}>
                  <StatPill label="Players" val={matchStats.humans} color="#00e5ff"/>
                  <StatPill label="PvP Kills" val={matchStats.kills} color="#ff3b5c"/>
                  <StatPill label="Bot Kills" val={matchStats.botKills} color="#ff8a65"/>
                  <StatPill label="Storm" val={matchStats.stormDeaths} color="#d500f9"/>
                  <StatPill label="Loot" val={matchStats.lootCount} color="#00e676"/>
                </div>
              )}
            </div>
            <input type="range" min={0} max={maxTime} value={currentTime}
              onChange={e=>{setPlaying(false);setCurrentTime(Number(e.target.value))}}
              style={{width:'100%',height:4,background:'#141c26',borderRadius:2,appearance:'none',outline:'none',cursor:'pointer',backgroundImage:'linear-gradient(#007a8c,#007a8c)',backgroundRepeat:'no-repeat',backgroundSize:`${maxTime>0?(currentTime/maxTime)*100:0}% 100%`}}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SideSection({ label, children }) {
  return (
    <div style={{padding:'10px 14px',borderBottom:'1px solid #1e2d42'}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:2,color:'#4a6080',textTransform:'uppercase',marginBottom:8}}>
        {label}
      </div>
      {children}
    </div>
  )
}

function TogBtn({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} style={{flex:1,padding:'4px 8px',borderRadius:3,border:`1px solid ${active?color:'#1e2d42'}`,background:active?color+'18':'#141c26',color:active?color:'#8ca0b8',fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,cursor:'pointer',transition:'all 0.15s'}}>
      {children}
    </button>
  )
}
