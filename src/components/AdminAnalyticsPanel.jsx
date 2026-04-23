// ── AdminAnalyticsPanel ───────────────────────────────────────────────────────
/**
 * Displays per-player strategy recognition, profit trends and market insights.
 *
 * Props:
 *   players        – all players in the room
 *   results        – results for the *current* turn (array)
 *   allResults     – results for ALL turns (array) – used for trend analysis
 *   decisions      – decisions for the current turn (array)
 *   currentTurn    – number
 */

function fmt(n) {
  return `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function strategyLabel(quality) {
  if (!quality) return '–'
  if (quality <= 3) return '🟢 Budget'
  if (quality <= 6) return '🔵 Standard'
  if (quality <= 9) return '🟣 Premium'
  return '💎 Esclusivo'
}

function profitTrend(allResults, playerId) {
  const byTurn = allResults
    .filter(r => r.player_id === playerId)
    .sort((a, b) => a.turn - b.turn)
  return byTurn.map(r => Number(r.profit))
}

// Simple inline sparkline SVG (up to 10 points)
function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null
  const W = 60
  const H = 20
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  })
  return (
    <svg width={W} height={H} className="inline-block align-middle">
      <polyline points={points.join(' ')} fill="none" stroke={color ?? '#6366f1'} strokeWidth={1.5} />
    </svg>
  )
}

function marketInsights(players, decisions, allResults, currentTurn) {
  const insights = []

  // Strategy clustering: count players per tier
  const tierCounts = { q1_3: [], q4_6: [], q7_9: [], q10: [] }
  decisions.forEach(d => {
    const q = d.quality
    const tier = q <= 3 ? 'q1_3' : q <= 6 ? 'q4_6' : q <= 9 ? 'q7_9' : 'q10'
    const p = players.find(pl => pl.player_id === d.player_id)
    if (p) tierCounts[tier].push(p.nickname)
  })

  const TIER_LABELS = { q1_3: 'Budget', q4_6: 'Standard', q7_9: 'Premium', q10: 'Esclusivo' }
  Object.entries(tierCounts).forEach(([tier, names]) => {
    if (names.length >= 2) {
      insights.push({
        type: 'warning',
        text: `⚠️ Price war potenziale: ${names.join(', ')} sono in fascia ${TIER_LABELS[tier]} – alta concorrenza diretta.`,
      })
    }
  })

  // Players with big profit drop from previous turn
  if (currentTurn >= 2) {
    const currentResults = allResults.filter(r => r.turn === currentTurn)
    const prevResults    = allResults.filter(r => r.turn === currentTurn - 1)
    currentResults.forEach(curr => {
      const prev = prevResults.find(r => r.player_id === curr.player_id)
      if (!prev) return
      const drop = Number(prev.profit) - Number(curr.profit)
      if (drop > 0 && Number(prev.profit) > 0 && drop / Number(prev.profit) > 0.4) {
        const p = players.find(pl => pl.player_id === curr.player_id)
        insights.push({
          type: 'alert',
          text: `🔴 ${p?.nickname ?? 'Giocatore'} ha perso il ${Math.round((drop / Number(prev.profit)) * 100)}% del profitto rispetto al turno precedente.`,
        })
      }
    })
  }

  // Overall market spread
  if (Object.values(tierCounts).filter(v => v.length > 0).length >= 3) {
    insights.push({
      type: 'info',
      text: '🏪 Oligopolio emergente: il mercato si sta auto-segmentando in più nicchie.',
    })
  }

  if (insights.length === 0) {
    insights.push({ type: 'info', text: 'ℹ️ Il mercato è in equilibrio. Nessuna anomalia rilevata.' })
  }

  return insights
}

export default function AdminAnalyticsPanel({ players, results, allResults, decisions, currentTurn }) {
  const byPlayer = Object.fromEntries(results.map(r => [r.player_id, r]))
  const decByPlayer = Object.fromEntries(decisions.map(d => [d.player_id, d]))

  const insights = marketInsights(players, decisions, allResults, currentTurn)

  return (
    <div className="space-y-5">
      {/* Per-player strategy & profit */}
      {players.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-3">Analisi per giocatore</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Giocatore</th>
                  <th className="text-left pb-2 font-medium">Strategia</th>
                  <th className="text-right pb-2 font-medium">Profitto turno</th>
                  <th className="text-right pb-2 font-medium">Cumulativo</th>
                  <th className="text-right pb-2 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {players.map(p => {
                  const res = byPlayer[p.player_id]
                  const dec = decByPlayer[p.player_id]
                  const trend = profitTrend(allResults, p.player_id)
                  return (
                    <tr key={p.player_id} className="hover:bg-gray-50">
                      <td className="py-2 flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: p.color ?? '#6366f1' }}
                        />
                        <span className="font-medium text-gray-800">{p.nickname}</span>
                      </td>
                      <td className="py-2 text-gray-600">{strategyLabel(dec?.quality)}</td>
                      <td className={`py-2 text-right font-semibold ${
                        res ? (Number(res.profit) >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-300'
                      }`}>
                        {res ? fmt(res.profit) : '–'}
                      </td>
                      <td className="py-2 text-right text-gray-700 font-bold">
                        {res ? fmt(res.cumulative_profit) : '–'}
                      </td>
                      <td className="py-2 text-right">
                        <Sparkline values={trend} color={p.color ?? '#6366f1'} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Market insights */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Dinamiche di mercato</p>
        <ul className="space-y-2">
          {insights.map((ins, i) => (
            <li
              key={i}
              className={`text-xs rounded px-3 py-2 ${
                ins.type === 'alert'   ? 'bg-red-50 text-red-700' :
                ins.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                'bg-blue-50 text-blue-700'
              }`}
            >
              {ins.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
