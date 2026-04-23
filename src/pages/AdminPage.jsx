import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRoom } from '../hooks/useRoom'
import ParameterTuningPanel from '../components/ParameterTuningPanel'
import AdminAnalyticsPanel from '../components/AdminAnalyticsPanel'
import GameSummary from '../components/GameSummary'

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

const COMPLEXITY_LABELS = {
  1: 'L1 – Elasticità Pura',
  2: 'L2 – Equilibrio Naturale',
  3: 'L3 – Economia Complessa',
}

const SHOCK_TYPES = [
  { value: 'seasonal',     label: '📅 Stagionale' },
  { value: 'trend_shift',  label: '📈 Cambio tendenza' },
  { value: 'competitor',   label: '🏭 Mossa competitor' },
  { value: 'economic',     label: '💰 Evento economico' },
  { value: 'supply_chain', label: '🚚 Supply chain' },
  { value: 'viral',        label: '🔥 Virale' },
]

const TARGETING_TYPES = [
  { value: 'global',    label: 'Globale (tutti)' },
  { value: 'segmental', label: 'Segmentale (fasce qualità)' },
  { value: 'selective', label: 'Selettivo (giocatori specifici)' },
]

const QUALITY_TIERS = [
  { value: 1, label: 'Q1–3 Budget' },
  { value: 2, label: 'Q4–6 Standard' },
  { value: 3, label: 'Q7–9 Premium' },
  { value: 4, label: 'Q10 Esclusivo' },
]

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
      {dec.production != null ? ` · ${dec.production} pz` : ''}
    </span>
  )
}

// ── ShockForm ─────────────────────────────────────────────────────────────────

function ShockForm({ roomId, players, currentTurn, onCreated }) {
  const [type, setType] = useState('seasonal')
  const [intensity, setIntensity] = useState(0.20)
  const [targeting, setTargeting] = useState('global')
  const [qualityTiers, setQualityTiers] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [duration, setDuration] = useState(1)
  const [visibility, setVisibility] = useState('public')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggleTier(val) {
    setQualityTiers(prev =>
      prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]
    )
  }

  function togglePlayer(id) {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const targeting_params = {}
    if (targeting === 'segmental') targeting_params.quality_tiers = qualityTiers
    if (targeting === 'selective') targeting_params.player_ids = selectedPlayers

    const { error: err } = await supabase.from('shocks').insert({
      room_id: roomId,
      turn: currentTurn,
      type,
      intensity_value: intensity,
      targeting,
      targeting_params,
      turns_remaining: duration,
      is_active: true,
      visibility,
      description: description.trim() || null,
    })

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onCreated?.()
      setDescription('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {SHOCK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Durata (turni)</label>
          <input
            type="number" min={1} max={5}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Intensity */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs font-medium text-gray-600">Intensità</label>
          <span className={`text-xs font-bold ${intensity >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {intensity >= 0 ? '+' : ''}{Math.round(intensity * 100)}% domanda
          </span>
        </div>
        <input
          type="range" min={-0.50} max={0.50} step={0.05}
          value={intensity}
          onChange={e => setIntensity(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>–50%</span><span>0</span><span>+50%</span>
        </div>
      </div>

      {/* Targeting */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Targeting</label>
        <select
          value={targeting}
          onChange={e => setTargeting(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {TARGETING_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {targeting === 'segmental' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Fasce qualità colpite</label>
          <div className="flex flex-wrap gap-2">
            {QUALITY_TIERS.map(t => (
              <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qualityTiers.includes(t.value)}
                  onChange={() => toggleTier(t.value)}
                  className="accent-indigo-600"
                />
                <span className="text-xs text-gray-700">{t.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {targeting === 'selective' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Giocatori colpiti</label>
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <label key={p.player_id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(p.player_id)}
                  onChange={() => togglePlayer(p.player_id)}
                  className="accent-indigo-600"
                />
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: p.color ?? '#6366f1' }}
                />
                <span className="text-xs text-gray-700">{p.nickname}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Visibility */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Visibilità</label>
          <select
            value={visibility}
            onChange={e => setVisibility(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="public">Pubblico (visibile ai giocatori)</option>
            <option value="hidden">Nascosto</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione (opz.)</label>
          <input
            type="text"
            maxLength={120}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Es: Ondata di caldo estiva…"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm"
      >
        {saving ? 'Creazione…' : '⚡ Crea Shock'}
      </button>
    </form>
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
  const [allResults, setAllResults] = useState([])
  const [countdown, setCountdown] = useState(null)

  // Shock panel state
  const [shocks, setShocks] = useState([])
  const [showShockForm, setShowShockForm] = useState(false)

  // Analytics / parameter panel toggles
  const [showParamPanel, setShowParamPanel] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Use a ref that is updated inside effects only (avoids render-time mutation)
  const roomRef = useRef(room)

  // ── Sync roomRef inside an effect, not during render ───────────────────────
  useEffect(() => {
    roomRef.current = room
  })

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
  }, [roomId, room?.current_turn, room?.status, room?.turn_phase, room])

  // ── Fetch results for results phase ──────────────────────────────────────
  useEffect(() => {
    if (!room || room.turn_phase !== 'results') return
    supabase
      .from('results')
      .select('*')
      .eq('room_id', roomId)
      .eq('turn', room.current_turn)
      .then(({ data }) => setResults(data ?? []))
  }, [roomId, room?.current_turn, room?.turn_phase, room])

  // ── Fetch active shocks ───────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return
    supabase
      .from('shocks')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .then(({ data }) => setShocks(data ?? []))
  }, [roomId, room?.current_turn])

  // ── Fetch all results (all turns) for analytics & completed summary ───────
  useEffect(() => {
    if (!roomId) return
    supabase
      .from('results')
      .select('*')
      .eq('room_id', roomId)
      .order('turn', { ascending: true })
      .then(({ data }) => setAllResults(data ?? []))
  }, [roomId, room?.current_turn, room?.turn_phase, room?.status])

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
    const currentRoom = roomRef.current
    if (!currentRoom?.turn_ends_at || currentRoom.status !== 'active' || currentRoom.turn_phase !== 'deciding') {
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
    const { error: startErr } = await supabase
      .from('rooms')
      .update({ status: 'active', current_turn: 1, turn_phase: 'deciding' })
      .eq('room_id', roomId)
    setStarting(false)
    if (startErr) setStartError(startErr.message)
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

  async function handleComplexityChange(newLevel) {
    await supabase.from('rooms').update({ complexity_level: Number(newLevel) }).eq('room_id', roomId)
  }

  async function handleDeactivateShock(shockId) {
    await supabase.from('shocks').update({ is_active: false, turns_remaining: 0 }).eq('shock_id', shockId)
    setShocks(prev => prev.filter(s => s.shock_id !== shockId))
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
        <p className="text-red-600 mb-4">Non sei l&apos;admin di questa stanza.</p>
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

        {/* ── SHOCK MANAGEMENT (active deciding phase) ────────────────────── */}
        {(isActive && isDeciding) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">⚡ Shock di mercato</h2>
              <button
                onClick={() => setShowShockForm(f => !f)}
                className="px-3 py-1 text-xs border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors font-medium"
              >
                {showShockForm ? 'Chiudi' : '+ Nuovo shock'}
              </button>
            </div>

            {/* Active shocks list */}
            {shocks.length > 0 ? (
              <ul className="divide-y divide-gray-100 mb-4">
                {shocks.map(s => (
                  <li key={s.shock_id} className="py-2.5 flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${Number(s.intensity_value) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {Number(s.intensity_value) >= 0 ? '+' : ''}{Math.round(Number(s.intensity_value) * 100)}%
                    </span>
                    <span className="text-xs font-medium text-gray-700">
                      {SHOCK_TYPES.find(t => t.value === s.type)?.label ?? s.type}
                    </span>
                    {s.description && (
                      <span className="text-xs text-gray-500 italic flex-1">{s.description}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {s.turns_remaining} turno/i rimasti · {s.visibility === 'public' ? '👁 pubblico' : '🔒 nascosto'}
                    </span>
                    <button
                      onClick={() => handleDeactivateShock(s.shock_id)}
                      className="text-xs text-red-400 hover:text-red-600 ml-auto"
                      title="Disattiva shock"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              !showShockForm && (
                <p className="text-sm text-gray-400 italic mb-4">Nessuno shock attivo in questo turno.</p>
              )
            )}

            {/* Create form */}
            {showShockForm && (
              <div className="border-t border-gray-100 pt-4 mt-2">
                <ShockForm
                  roomId={roomId}
                  players={players}
                  currentTurn={room.current_turn}
                  onCreated={() => {
                    setShowShockForm(false)
                    supabase
                      .from('shocks')
                      .select('*')
                      .eq('room_id', roomId)
                      .eq('is_active', true)
                      .then(({ data }) => setShocks(data ?? []))
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── COMPLEXITY LEVEL SWITCHER (results phase between turns) ─────── */}
        {isActive && isResults && room.current_turn < room.num_turns && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🎓 Livello di complessità</h2>
            <p className="text-xs text-gray-500 mb-3">
              Puoi cambiare il livello prima del prossimo turno man mano che gli studenti apprendono i concetti.
            </p>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => handleComplexityChange(lvl)}
                  className={`flex-1 min-w-[80px] px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    room.complexity_level === lvl
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {COMPLEXITY_LABELS[lvl]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PARAMETER TUNING (results phase between turns) ──────────────── */}
        {isActive && isResults && room.current_turn < room.num_turns && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">⚙️ Parametri economici</h2>
              <button
                onClick={() => setShowParamPanel(v => !v)}
                className="px-3 py-1 text-xs border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
              >
                {showParamPanel ? 'Chiudi' : 'Modifica'}
              </button>
            </div>
            {showParamPanel && (
              <ParameterTuningPanel roomId={roomId} complexityLevel={room.complexity_level} />
            )}
            {!showParamPanel && (
              <p className="text-xs text-gray-400 italic">
                Ritocca elasticità, costi e scale factors prima del prossimo turno.
              </p>
            )}
          </div>
        )}

        {/* ── ADMIN ANALYTICS (results phase) ─────────────────────────────── */}
        {isActive && isResults && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">📊 Analisi & Dinamiche</h2>
              <button
                onClick={() => setShowAnalytics(v => !v)}
                className="px-3 py-1 text-xs border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                {showAnalytics ? 'Chiudi' : 'Mostra'}
              </button>
            </div>
            {showAnalytics && (
              <AdminAnalyticsPanel
                players={players}
                results={results}
                allResults={allResults}
                decisions={decisions}
                currentTurn={room.current_turn}
              />
            )}
            {!showAnalytics && (
              <p className="text-xs text-gray-400 italic">
                Strategie per giocatore, trend di profitto e dinamiche di mercato.
              </p>
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

        {/* ── COMPLETED STATE – full game summary ──────────────────────────── */}
        {isCompleted && (
          <GameSummary room={room} players={players} />
        )}

      </div>
    </div>
  )
}
