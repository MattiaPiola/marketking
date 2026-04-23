import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRoom } from '../hooks/useRoom'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  return `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCountdown(seconds) {
  if (seconds <= 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerStatusBadge({ status }) {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
        ✅ Confermato
      </span>
    )
  }
  if (status === 'deciding') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
        <span className="animate-spin inline-block w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full" />
        Sta decidendo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      In attesa
    </span>
  )
}

function DecisionValues({ dec }) {
  if (!dec) return null
  return (
    <span className="text-xs text-gray-500 ml-2">
      Q{dec.quality} · €{dec.price} · mkt€{dec.marketing}
      {dec.production != null ? ` · ${dec.production}pz` : ''}
    </span>
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { id: roomId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { room, players, loading, error } = useRoom(roomId)

  // Lobby state
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Active-turn state
  const [endingTurn, setEndingTurn] = useState(false)
  const [endTurnError, setEndTurnError] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [results, setResults] = useState([])
  const [countdown, setCountdown] = useState(null)

  // Ref to avoid stale closure in the auto-end timer
  const roomRef = useRef(room)
  roomRef.current = room

  // Track whether we've already auto-triggered end turn
  const autoEndFiredRef = useRef(false)

  // ── Fetch decisions for monitoring ───────────────────────────────────────
  useEffect(() => {
    if (!room || room.status !== 'active') return
    supabase
      .from('decisions')
      .select('*')
      .eq('room_id', roomId)
      .eq('turn', room.current_turn)
      .then(({ data }) => setDecisions(data ?? []))
  }, [roomId, room?.current_turn, room?.status, room?.turn_phase])

  // ── Fetch results for results phase ──────────────────────────────────────
  useEffect(() => {
    if (!room || room.turn_phase !== 'results') return
    supabase
      .from('results')
      .select('*')
      .eq('room_id', roomId)
      .eq('turn', room.current_turn)
      .then(({ data }) => setResults(data ?? []))
  }, [roomId, room?.current_turn, room?.turn_phase])

  // ── Countdown timer ───────────────────────────────────────────────────────
  const handleEndTurn = useCallback(async () => {
    if (endingTurn) return
    setEndingTurn(true)
    setEndTurnError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-turn`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ room_id: roomId, turn: roomRef.current.current_turn }),
        }
      )
      if (!resp.ok) {
        const msg = await resp.text()
        setEndTurnError(`Errore calcolo turno: ${msg}`)
        setEndingTurn(false)
        return
      }
      await supabase
        .from('rooms')
        .update({ turn_phase: 'results' })
        .eq('room_id', roomId)
    } catch (err) {
      setEndTurnError(err.message)
    }
    setEndingTurn(false)
  }, [endingTurn, roomId])

  useEffect(() => {
    if (!room?.turn_ends_at || room.status !== 'active' || room.turn_phase !== 'deciding') {
      setCountdown(null)
      return
    }
    autoEndFiredRef.current = false

    const tick = () => {
      const diff = Math.floor((new Date(roomRef.current.turn_ends_at) - Date.now()) / 1000)
      setCountdown(Math.max(0, diff))
      if (diff <= 0 && !autoEndFiredRef.current && roomRef.current.turn_phase === 'deciding') {
        autoEndFiredRef.current = true
        handleEndTurn()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [room?.turn_ends_at, room?.status, room?.turn_phase, handleEndTurn])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleStartGame() {
    setStartError(null)
    setStarting(true)
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'active', current_turn: 1, turn_phase: 'deciding' })
      .eq('room_id', roomId)
    setStarting(false)
    if (error) setStartError(error.message)
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(room.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: do nothing
    }
  }

  async function handlePauseTurn() {
    await supabase.from('rooms').update({ status: 'paused' }).eq('room_id', roomId)
  }

  async function handleResumeTurn() {
    await supabase.from('rooms').update({ status: 'active' }).eq('room_id', roomId)
  }

  async function handleExtendTimer() {
    if (!room.turn_ends_at) return
    const newEnd = new Date(new Date(room.turn_ends_at).getTime() + 2 * 60 * 1000)
    await supabase.from('rooms').update({ turn_ends_at: newEnd.toISOString() }).eq('room_id', roomId)
  }

  async function handleNextTurn() {
    const nextTurn = room.current_turn + 1
    await supabase.from('players').update({ status: 'waiting' }).eq('room_id', roomId)
    await supabase.from('rooms').update({
      current_turn: nextTurn,
      turn_phase: 'deciding',
      turn_ends_at: null,
    }).eq('room_id', roomId)
  }

  async function handleEndGame() {
    await supabase.from('rooms').update({ status: 'completed' }).eq('room_id', roomId)
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Caricamento…</p>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <p className="text-red-600 mb-4">Stanza non trovata o accesso negato.</p>
        <Link to="/" className="text-indigo-600 hover:underline">← Home</Link>
      </div>
    )
  }

  if (!user || user.id !== room.admin_id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <p className="text-red-600 mb-4">Non sei l'admin di questa stanza.</p>
        <Link to="/" className="text-indigo-600 hover:underline">← Home</Link>
      </div>
    )
  }

  const isLobby = room.status === 'lobby'
  const isActive = room.status === 'active'
  const isPaused = room.status === 'paused'
  const isCompleted = room.status === 'completed'
  const isDeciding = room.turn_phase === 'deciding'
  const isResults = room.turn_phase === 'results'

  // Map decisions by player_id for quick lookup
  const decByPlayer = Object.fromEntries(decisions.map(d => [d.player_id, d]))
  // Map results by player_id
  const resByPlayer = Object.fromEntries(results.map(r => [r.player_id, r]))
  // Sorted results for leaderboard
  const sortedResults = [...results].sort((a, b) => b.cumulative_profit - a.cumulative_profit)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="mb-4">
          <Link to="/" className="text-indigo-600 hover:underline text-sm">← Home</Link>
          <div className="flex items-start justify-between mt-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{room.name}</h1>
              <p className="text-sm text-gray-500">
                Admin · {room.num_turns} turni · Budget €{Number(room.budget_initial).toLocaleString('it-IT')} · Livello {room.complexity_level}
              </p>
            </div>
            {(isActive || isPaused) && (
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">
                  Turno {room.current_turn} / {room.num_turns}
                </p>
                {countdown !== null && (
                  <p className={`text-2xl font-mono font-bold tabular-nums ${countdown <= 30 ? 'text-red-600' : 'text-indigo-600'}`}>
                    ⏱ {fmtCountdown(countdown)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-5">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            isLobby     ? 'bg-yellow-100 text-yellow-800' :
            isActive    ? 'bg-green-100 text-green-800' :
            isPaused    ? 'bg-orange-100 text-orange-800' :
            isCompleted ? 'bg-gray-200 text-gray-600' :
                          'bg-gray-100 text-gray-600'
          }`}>
            {isLobby     ? '⏳ Lobby – in attesa dei giocatori' :
             isActive    ? (isDeciding ? '▶ Decisioni in corso' : '📊 Risultati turno') :
             isPaused    ? '⏸ Partita in pausa' :
             isCompleted ? '🏁 Partita terminata' :
             room.status}
          </span>
        </div>

        {/* ── LOBBY VIEW ─────────────────────────────────────────────────── */}
        {(isLobby || isPaused || isCompleted || (isActive && isDeciding) || (isActive && isResults)) && (
          <>
            {/* Join code – always visible */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <p className="text-sm text-gray-500 mb-2">Codice per entrare</p>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-mono font-bold tracking-widest text-indigo-600">
                  {room.join_code}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copied ? '✓ Copiato' : 'Copia'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Condividi con gli studenti su{' '}
                <strong>{import.meta.env.VITE_APP_URL ?? 'mercatovivo.netlify.app'}</strong>
              </p>
            </div>
          </>
        )}

        {/* ── TURN CONTROLS (active or paused) ────────────────────────────── */}
        {(isActive || isPaused) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Controlli turno</h2>

            {endTurnError && (
              <p className="text-red-600 text-sm mb-3">{endTurnError}</p>
            )}

            {isPaused && (
              <button
                onClick={handleResumeTurn}
                className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
              >
                ▶ Riprendi Turno
              </button>
            )}

            {isActive && isDeciding && (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePauseTurn}
                  className="flex-1 min-w-[120px] px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-sm"
                >
                  ⏸ Pausa Turno
                </button>
                {room.turn_ends_at && (
                  <button
                    onClick={handleExtendTimer}
                    className="flex-1 min-w-[120px] px-4 py-2.5 border border-indigo-300 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-50 transition-colors text-sm"
                  >
                    ⏱ +2 min
                  </button>
                )}
                <button
                  onClick={handleEndTurn}
                  disabled={endingTurn}
                  className="flex-1 min-w-[120px] px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {endingTurn ? 'Calcolo…' : '🔚 Termina Turno'}
                </button>
              </div>
            )}

            {isActive && isResults && (
              <div className="flex gap-3">
                {room.current_turn < room.num_turns ? (
                  <button
                    onClick={handleNextTurn}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
                  >
                    ▶ Prossimo Turno
                  </button>
                ) : (
                  <button
                    onClick={handleEndGame}
                    className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-colors text-sm"
                  >
                    🏁 Termina Partita
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PLAYER MONITORING (deciding phase) ──────────────────────────── */}
        {isActive && isDeciding && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Monitoraggio giocatori
            </h2>
            {players.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nessun giocatore.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {players.map(p => {
                  const dec = decByPlayer[p.player_id]
                  return (
                    <li key={p.player_id} className="py-2.5 flex flex-wrap items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color ?? '#6366f1' }}
                      />
                      <span className="text-sm font-medium text-gray-900 flex-1 min-w-[80px]">
                        {p.nickname}
                      </span>
                      <PlayerStatusBadge status={p.status} />
                      {(p.status === 'deciding' || p.status === 'confirmed') && (
                        <DecisionValues dec={dec} />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── RESULTS SUMMARY (results phase) ─────────────────────────────── */}
        {isActive && isResults && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Risultati – Turno {room.current_turn}
            </h2>
            {sortedResults.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Risultati non ancora disponibili.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Giocatore</th>
                      <th className="text-right pb-2 font-medium">Domanda</th>
                      <th className="text-right pb-2 font-medium">Ricavi</th>
                      <th className="text-right pb-2 font-medium">Profitto</th>
                      <th className="text-right pb-2 font-medium">Cum.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedResults.map((r, idx) => {
                      const p = players.find(pl => pl.player_id === r.player_id)
                      const medal = RANK_MEDALS[idx] ?? `#${idx + 1}`
                      return (
                        <tr key={r.result_id} className="hover:bg-gray-50">
                          <td className="py-2 flex items-center gap-2">
                            <span className="text-base">{medal}</span>
                            {p && (
                              <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: p.color ?? '#6366f1' }}
                              />
                            )}
                            <span className="font-medium text-gray-900">
                              {p?.nickname ?? r.player_id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="py-2 text-right text-gray-700">
                            {Math.round(r.demand_generated)} pz
                          </td>
                          <td className="py-2 text-right text-gray-700">{fmt(r.revenues)}</td>
                          <td className={`py-2 text-right font-semibold ${r.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {fmt(r.profit)}
                          </td>
                          <td className="py-2 text-right text-gray-900 font-bold">
                            {fmt(r.cumulative_profit)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── LOBBY PLAYER LIST & START ────────────────────────────────────── */}
        {isLobby && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Giocatori connessi ({players.length})
              </h2>
              {players.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessun giocatore ancora – condividi il codice!</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {players.map(p => (
                    <li key={p.player_id} className="flex items-center gap-3 py-2">
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color ?? '#6366f1' }}
                      />
                      <span className="text-sm font-medium text-gray-900">{p.nickname}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {startError && <p className="text-red-600 text-sm mb-3">{startError}</p>}
            <button
              onClick={handleStartGame}
              disabled={starting || players.length === 0}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors text-base"
            >
              {starting ? 'Avvio…' : `▶ Avvia Partita (${players.length} giocator${players.length === 1 ? 'e' : 'i'})`}
            </button>
            {players.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-2">Aspetta almeno 1 giocatore per avviare.</p>
            )}
          </>
        )}

        {/* Completed state */}
        {isCompleted && (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🏁</div>
            <p className="text-lg font-bold text-gray-800">Partita terminata!</p>
            <p className="text-sm text-gray-500 mt-1">Tutti i turni sono stati completati.</p>
          </div>
        )}

      </div>
    </div>
  )
}
