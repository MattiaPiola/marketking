import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  return `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(players, allResults, numTurns) {
  const playerById = Object.fromEntries(players.map(p => [p.player_id, p]))
  const rows = []

  // Header
  const cols = [
    'Giocatore',
    'Colore',
    ...Array.from({ length: numTurns }, (_, i) => `T${i + 1} Domanda`),
    ...Array.from({ length: numTurns }, (_, i) => `T${i + 1} Ricavi`),
    ...Array.from({ length: numTurns }, (_, i) => `T${i + 1} Profitto`),
    'Profitto Totale',
  ]
  rows.push(cols)

  // Build per-player rows
  const grouped = {}
  allResults.forEach(r => {
    if (!grouped[r.player_id]) grouped[r.player_id] = {}
    grouped[r.player_id][r.turn] = r
  })

  // Sort by cumulative profit of last turn
  const sortedPlayerIds = Object.keys(grouped).sort((a, b) => {
    const aLast = grouped[a][Math.max(...Object.keys(grouped[a]).map(Number))]
    const bLast = grouped[b][Math.max(...Object.keys(grouped[b]).map(Number))]
    return Number(bLast?.cumulative_profit ?? 0) - Number(aLast?.cumulative_profit ?? 0)
  })

  sortedPlayerIds.forEach(pid => {
    const p = playerById[pid]
    const byTurn = grouped[pid]
    const lastTurn = Math.max(...Object.keys(byTurn).map(Number))
    const row = [
      p?.nickname ?? pid.slice(0, 8),
      p?.color ?? '',
      ...Array.from({ length: numTurns }, (_, i) => {
        const r = byTurn[i + 1]
        return r ? Math.round(Number(r.demand_generated)) : ''
      }),
      ...Array.from({ length: numTurns }, (_, i) => {
        const r = byTurn[i + 1]
        return r ? Number(r.revenues).toFixed(2) : ''
      }),
      ...Array.from({ length: numTurns }, (_, i) => {
        const r = byTurn[i + 1]
        return r ? Number(r.profit).toFixed(2) : ''
      }),
      Number(byTurn[lastTurn]?.cumulative_profit ?? 0).toFixed(2),
    ]
    rows.push(row)
  })

  const csv = rows
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'mercato-vivo-risultati.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── ProfitTrendTable ──────────────────────────────────────────────────────────

function ProfitTrendTable({ players, allResults, numTurns }) {
  const grouped = {}
  allResults.forEach(r => {
    if (!grouped[r.player_id]) grouped[r.player_id] = {}
    grouped[r.player_id][r.turn] = r
  })

  // Sort by final cumulative profit
  const sorted = [...players].sort((a, b) => {
    const aRes = grouped[a.player_id]
    const bRes = grouped[b.player_id]
    const aLast = aRes ? aRes[Math.max(...Object.keys(aRes).map(Number))] : null
    const bLast = bRes ? bRes[Math.max(...Object.keys(bRes).map(Number))] : null
    return Number(bLast?.cumulative_profit ?? 0) - Number(aLast?.cumulative_profit ?? 0)
  })

  const turns = Array.from({ length: numTurns }, (_, i) => i + 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium sticky left-0 bg-white pr-3">Giocatore</th>
            {turns.map(t => (
              <th key={t} className="text-right pb-2 font-medium px-2 whitespace-nowrap">T{t}</th>
            ))}
            <th className="text-right pb-2 font-medium px-2 whitespace-nowrap font-bold">Totale</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((p, idx) => {
            const byTurn = grouped[p.player_id] ?? {}
            const lastTurn = Object.keys(byTurn).length
              ? Math.max(...Object.keys(byTurn).map(Number))
              : 0
            const cumulative = Number(byTurn[lastTurn]?.cumulative_profit ?? 0)
            const medal = RANK_MEDALS[idx] ?? `#${idx + 1}`
            return (
              <tr key={p.player_id} className="hover:bg-gray-50">
                <td className="py-2 sticky left-0 bg-white pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{medal}</span>
                    <span
                      className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: p.color ?? '#6366f1' }}
                    />
                    <span className="font-medium text-gray-800">{p.nickname}</span>
                  </div>
                </td>
                {turns.map(t => {
                  const r = byTurn[t]
                  return (
                    <td
                      key={t}
                      className={`py-2 text-right px-2 ${
                        r
                          ? Number(r.profit) >= 0 ? 'text-green-700' : 'text-red-600'
                          : 'text-gray-300'
                      }`}
                    >
                      {r ? (Number(r.profit) >= 0 ? '+' : '') + Math.round(Number(r.profit)) : '–'}
                    </td>
                  )
                })}
                <td className={`py-2 text-right px-2 font-bold text-sm ${cumulative >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(cumulative)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── GameSummary ───────────────────────────────────────────────────────────────

/**
 * Full end-of-game summary panel. Shown in AdminPage when room.status === 'completed'.
 *
 * Props:
 *   room    – room row
 *   players – all players
 */
export default function GameSummary({ room, players }) {
  const [allResults, setAllResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!room?.room_id) return
    supabase
      .from('results')
      .select('*')
      .eq('room_id', room.room_id)
      .order('turn', { ascending: true })
      .then(({ data }) => {
        setAllResults(data ?? [])
        setLoading(false)
      })
  }, [room?.room_id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-400 text-sm">Caricamento riepilogo finale…</p>
      </div>
    )
  }

  // Build final leaderboard (last turn's cumulative)
  const finalByPlayer = {}
  allResults.forEach(r => {
    if (!finalByPlayer[r.player_id] || r.turn > finalByPlayer[r.player_id].turn) {
      finalByPlayer[r.player_id] = r
    }
  })
  const leaderboard = Object.values(finalByPlayer)
    .sort((a, b) => Number(b.cumulative_profit) - Number(a.cumulative_profit))

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="text-5xl mb-2">🏁</div>
        <h2 className="text-xl font-bold text-gray-900">Partita terminata!</h2>
        <p className="text-sm text-gray-500 mt-1">
          {room.num_turns} turni completati · {players.length} giocator{players.length === 1 ? 'e' : 'i'}
        </p>
      </div>

      {/* Final leaderboard */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">🏆 Classifica finale</h3>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nessun risultato disponibile.</p>
        ) : (
          <ul className="space-y-2">
            {leaderboard.map((r, idx) => {
              const p = players.find(pl => pl.player_id === r.player_id)
              const medal = RANK_MEDALS[idx] ?? `#${idx + 1}`
              return (
                <li
                  key={r.player_id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                    idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                    idx === 1 ? 'bg-gray-50 border border-gray-200' :
                    idx === 2 ? 'bg-orange-50 border border-orange-200' :
                    'bg-gray-50'
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{medal}</span>
                  {p && (
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color ?? '#6366f1' }}
                    />
                  )}
                  <span className="text-sm font-semibold text-gray-900 flex-1">
                    {p?.nickname ?? r.player_id.slice(0, 8)}
                  </span>
                  <span className={`text-base font-bold ${Number(r.cumulative_profit) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(r.cumulative_profit)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Turn-by-turn profit table */}
      {allResults.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 Profitto per turno</h3>
          <ProfitTrendTable players={players} allResults={allResults} numTurns={room.num_turns} />
        </div>
      )}

      {/* CSV export */}
      <button
        onClick={() => exportCSV(players, allResults, room.num_turns)}
        className="w-full px-4 py-2.5 border border-indigo-300 text-indigo-700 rounded-xl font-semibold hover:bg-indigo-50 transition-colors text-sm flex items-center justify-center gap-2"
      >
        ⬇️ Esporta CSV (tutti i risultati)
      </button>
    </div>
  )
}
