import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  return `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']

const SHOCK_TYPE_LABELS = {
  seasonal:      '📅 Stagionale',
  trend_shift:   '📈 Cambio tendenza',
  competitor:    '🏭 Mossa competitor',
  economic:      '💰 Evento economico',
  supply_chain:  '🚚 Supply chain',
  viral:         '🔥 Virale',
}

// ── Price-Quality Map (multi-player) ─────────────────────────────────────────

function MultiPriceQualityMap({ players, decisions }) {
  const W = 280
  const H = 180
  const PAD = 30

  // Prices beyond €50 are clamped to the right edge of the chart; the axis label
  // shows "€5–€50+" to indicate the visual range is not exhaustive.
  const xScale = p => PAD + ((Math.min(Math.max(p, 5), 50) - 5) / 45) * (W - PAD * 2)
  const yScale = q => PAD + ((10 - Math.min(Math.max(q, 1), 10)) / 9) * (H - PAD * 2)

  const decByPlayer = Object.fromEntries(decisions.map(d => [d.player_id, d]))

  return (
    <div>
      <svg width={W} height={H} className="w-full" aria-label="Mappa posizionamento giocatori">
        {/* Zone fills */}
        <rect x={PAD} y={yScale(3.5)} width={W - PAD * 2} height={yScale(1) - yScale(3.5)} fill="#dcfce7" />
        <rect x={PAD} y={yScale(6.5)} width={W - PAD * 2} height={yScale(3.5) - yScale(6.5)} fill="#dbeafe" />
        <rect x={PAD} y={yScale(9.5)} width={W - PAD * 2} height={yScale(6.5) - yScale(9.5)} fill="#ede9fe" />
        <rect x={PAD} y={yScale(10)} width={W - PAD * 2} height={yScale(9.5) - yScale(10)} fill="#fdf4ff" />

        {/* Zone labels */}
        <text x={PAD + 3} y={(yScale(3.5) + yScale(1)) / 2 + 3} fontSize={8} fill="#16a34a">Budget</text>
        <text x={PAD + 3} y={(yScale(6.5) + yScale(3.5)) / 2 + 3} fontSize={8} fill="#1d4ed8">Standard</text>
        <text x={PAD + 3} y={(yScale(9.5) + yScale(6.5)) / 2 + 3} fontSize={8} fill="#7c3aed">Premium</text>
        <text x={PAD + 3} y={(yScale(10) + yScale(9.5)) / 2 + 3} fontSize={8} fill="#86198f">Esclusivo</text>

        {/* Axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#9ca3af" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#9ca3af" strokeWidth={1} />

        {/* Axis labels */}
        <text x={PAD + (W - PAD * 2) / 2} y={H - 6} fontSize={8} fill="#6b7280" textAnchor="middle">
          Prezzo (€5–€50+)
        </text>
        <text
          x={10}
          y={PAD + (H - PAD * 2) / 2}
          fontSize={8}
          fill="#6b7280"
          textAnchor="middle"
          transform={`rotate(-90, 10, ${PAD + (H - PAD * 2) / 2})`}
        >
          Qualità 1–10
        </text>

        {/* Player dots */}
        {players.map(p => {
          const dec = decByPlayer[p.player_id]
          if (!dec) return null
          const cx = xScale(dec.price)
          const cy = yScale(dec.quality)
          return (
            <g key={p.player_id}>
              <circle cx={cx} cy={cy} r={8} fill={p.color ?? '#6366f1'} opacity={0.85} />
              <circle cx={cx} cy={cy} r={8} fill="none" stroke="white" strokeWidth={1.5} />
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {players.map(p => (
          <div key={p.player_id} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
              style={{ backgroundColor: p.color ?? '#6366f1' }}
            />
            <span className="text-xs text-gray-600">{p.nickname}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ResultsPanel ──────────────────────────────────────────────────────────────

/**
 * Shown in RoomPage when turn_phase === 'results'.
 *
 * @param {object} props
 * @param {object} props.room        – room row from DB
 * @param {object} props.player      – the current user's player row
 * @param {Array}  props.allPlayers  – all players in the room
 */
export default function ResultsPanel({ room, player, allPlayers }) {
  const complexityLevel = room.complexity_level
  const [results, setResults] = useState([])
  const [decisions, setDecisions] = useState([])
  const [shocks, setShocks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!room?.room_id || !room?.current_turn) return

    let cancelled = false
    Promise.all([
      supabase
        .from('results')
        .select('*')
        .eq('room_id', room.room_id)
        .eq('turn', room.current_turn),
      supabase
        .from('decisions')
        .select('*')
        .eq('room_id', room.room_id)
        .eq('turn', room.current_turn),
      supabase
        .from('shocks')
        .select('*')
        .eq('room_id', room.room_id)
        .eq('is_active', false)
        .lte('turn', room.current_turn)
        .gte('turn', room.current_turn),
    ]).then(([resRes, decRes, shockRes]) => {
      if (cancelled) return
      setResults(resRes.data ?? [])
      setDecisions(decRes.data ?? [])
      // Show only public shocks that were active this turn
      setShocks((shockRes.data ?? []).filter(s => s.visibility === 'public'))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [room?.room_id, room?.current_turn])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-400">Caricamento risultati…</p>
      </div>
    )
  }

  const myResult = results.find(r => r.player_id === player?.player_id)
  const sortedResults = [...results].sort((a, b) => b.cumulative_profit - a.cumulative_profit)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📊</span>
        <h2 className="text-xl font-bold text-gray-900">
          Turno {room.current_turn} – Risultati
        </h2>
      </div>

      {/* ── Public shocks that affected this turn ────────────────────────── */}
      {shocks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">⚡ Shock di mercato questo turno</p>
          {shocks.map(s => (
            <div key={s.shock_id} className="text-sm text-amber-700">
              <span className="font-medium">{SHOCK_TYPE_LABELS[s.type] ?? s.type}</span>
              {s.description && <span className="ml-2 text-amber-600">{s.description}</span>}
              <span className={`ml-2 font-semibold ${Number(s.intensity_value) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                ({Number(s.intensity_value) >= 0 ? '+' : ''}{Math.round(Number(s.intensity_value) * 100)}% domanda)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── My results card ─────────────────────────────────────────────── */}
      {myResult ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            I tuoi risultati – Turno {room.current_turn}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Domanda generata</span>
              <span className="font-medium text-gray-900">{Math.round(myResult.demand_generated)} pz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ricavi</span>
              <span className="font-medium text-gray-900">{fmt(myResult.revenues)}</span>
            </div>
            <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Costi produzione</span>
                <span className="text-gray-600">{fmt(myResult.production_costs)}</span>
              </div>
              {complexityLevel >= 2 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Costi inventario</span>
                  <span className="text-gray-600">{fmt(myResult.inventory_costs ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Costi marketing</span>
                <span className="text-gray-600">{fmt(myResult.marketing_costs)}</span>
              </div>
              {complexityLevel >= 2 && (myResult.catalog_costs ?? 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Costi catalogo</span>
                  <span className="text-gray-600">{fmt(myResult.catalog_costs)}</span>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
              <span className="text-gray-700">Profitto netto</span>
              <span className={myResult.profit >= 0 ? 'text-green-700' : 'text-red-600'}>
                {fmt(myResult.profit)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Profitto cumulativo</span>
              <span className="font-semibold text-gray-900">{fmt(myResult.cumulative_profit)}</span>
            </div>
          </div>

          {/* Complexity level 2+ insights */}
          {complexityLevel >= 2 && myResult.feedback_data && (
            <div className="mt-4 space-y-2 text-xs">
              {myResult.feedback_data.elasticity_insight?.explanation && (
                <p className="text-blue-700 bg-blue-50 rounded px-2 py-1.5">
                  📈 {myResult.feedback_data.elasticity_insight.explanation}
                </p>
              )}
              {myResult.feedback_data.scale_insight?.note && (
                <p className="text-indigo-700 bg-indigo-50 rounded px-2 py-1.5">
                  📦 {myResult.feedback_data.scale_insight.note}
                </p>
              )}
              {myResult.feedback_data.reputation_insight?.note && (
                <p className="text-purple-700 bg-purple-50 rounded px-2 py-1.5">
                  ⭐ {myResult.feedback_data.reputation_insight.note}
                </p>
              )}
              {myResult.feedback_data.mini_suggestion && (
                <p className="text-green-700 bg-green-50 rounded px-2 py-1.5 font-medium">
                  💡 {myResult.feedback_data.mini_suggestion}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center text-sm text-gray-400 italic">
          I tuoi risultati non sono ancora disponibili.
        </div>
      )}

      {/* ── Leaderboard card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Classifica</h3>
        {sortedResults.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nessun risultato disponibile.</p>
        ) : (
          <ul className="space-y-2">
            {sortedResults.map((r, idx) => {
              const p = allPlayers.find(pl => pl.player_id === r.player_id)
              const isMe = r.player_id === player?.player_id
              const medal = RANK_MEDALS[idx] ?? `#${idx + 1}`
              return (
                <li
                  key={r.player_id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isMe ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'}`}
                >
                  <span className="text-xl w-7 text-center">{medal}</span>
                  {p && (
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color ?? '#6366f1' }}
                    />
                  )}
                  <span className={`text-sm flex-1 ${isMe ? 'font-bold text-indigo-900' : 'font-medium text-gray-800'}`}>
                    {p?.nickname ?? r.player_id.slice(0, 8)}
                    {isMe && <span className="ml-2 text-xs font-normal text-indigo-500">(tu)</span>}
                  </span>
                  <span className={`text-sm font-bold ${r.cumulative_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(r.cumulative_profit)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Market map card ───────────────────────────────────────────────── */}
      {decisions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Mappa del mercato</h3>
          <MultiPriceQualityMap players={allPlayers} decisions={decisions} />
        </div>
      )}

      {/* Waiting banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
        <p className="text-sm text-indigo-700 font-medium">
          ⏳ In attesa che l&apos;admin avvii il prossimo turno…
        </p>
      </div>
    </div>
  )
}
