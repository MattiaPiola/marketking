import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PRESET_COLORS = [
  { label: 'Indaco',   value: '#6366f1' },
  { label: 'Rosso',    value: '#ef4444' },
  { label: 'Verde',    value: '#22c55e' },
  { label: 'Giallo',   value: '#eab308' },
  { label: 'Arancio',  value: '#f97316' },
  { label: 'Rosa',     value: '#ec4899' },
  { label: 'Ciano',    value: '#06b6d4' },
  { label: 'Viola',    value: '#a855f7' },
]

export default function JoinPage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0].value)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // 1. Sign in anonymously (or reuse existing anonymous session)
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const userId = authData.user?.id

    // 2. Look up room by join code
    const code = joinCode.trim().toUpperCase()
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('room_id, status, budget_initial')
      .eq('join_code', code)
      .single()

    if (roomError || !room) {
      setError('Codice non valido. Controlla e riprova.')
      setLoading(false)
      return
    }

    if (room.status === 'completed') {
      setError('Questa partita è già terminata.')
      setLoading(false)
      return
    }

    // 3. Check if this user already has a player record in this room
    const { data: existing } = await supabase
      .from('players')
      .select('player_id')
      .eq('room_id', room.room_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      // Rejoin – go straight to the room
      navigate(`/room/${room.room_id}`)
      return
    }

    // 4. Insert player
    const { error: insertError } = await supabase.from('players').insert({
      room_id: room.room_id,
      user_id: userId,
      nickname: nickname.trim(),
      color,
      budget_current: room.budget_initial,
      status: 'waiting',
    })

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    navigate(`/room/${room.room_id}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-indigo-600 hover:underline text-sm mb-6 inline-block">
          ← Home
        </Link>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Entra in una Stanza</h2>
        <p className="text-gray-500 text-sm mb-6">
          Inserisci il codice fornito dall'insegnante.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Join code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Codice stanza</label>
            <input
              type="text"
              required
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="XXXXXX"
            />
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
            <input
              type="text"
              required
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={30}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Il tuo nome o team"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Colore team (opzionale)</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c.value ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrata in corso…' : 'Entra nella Stanza →'}
          </button>
        </form>
      </div>
    </div>
  )
}
