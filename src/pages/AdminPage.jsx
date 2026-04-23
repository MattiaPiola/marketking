import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useRoom } from '../hooks/useRoom'

function PlayerRow({ player }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: player.color ?? '#6366f1' }}
      />
      <span className="text-sm font-medium text-gray-900">{player.nickname}</span>
      <span className="ml-auto text-xs text-gray-400 capitalize">{player.status}</span>
    </li>
  )
}

export default function AdminPage() {
  const { id: roomId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { room, players, loading, error } = useRoom(roomId)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)
  const [copied, setCopied] = useState(false)

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

  async function handleStartGame() {
    setStartError(null)
    setStarting(true)

    const { error } = await supabase
      .from('rooms')
      .update({ status: 'active', current_turn: 1 })
      .eq('room_id', roomId)

    setStarting(false)

    if (error) {
      setStartError(error.message)
    }
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

  const isLobby = room.status === 'lobby'
  const isActive = room.status === 'active'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link to="/" className="text-indigo-600 hover:underline text-sm">← Home</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{room.name}</h1>
          <p className="text-sm text-gray-500">
            Admin panel · {room.num_turns} turni · Budget €{Number(room.budget_initial).toLocaleString('it-IT')} · Livello {room.complexity_level}
          </p>
        </div>

        {/* Status badge */}
        <div className="mb-6">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            isLobby  ? 'bg-yellow-100 text-yellow-800' :
            isActive ? 'bg-green-100 text-green-800' :
                       'bg-gray-100 text-gray-600'
          }`}>
            {isLobby ? '⏳ Lobby – in attesa dei giocatori' :
             isActive ? '▶ Partita in corso' :
             room.status}
          </span>
        </div>

        {/* Join code */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
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
            Condividi questo codice con gli studenti su <strong>mercatovivo.netlify.app</strong>
          </p>
        </div>

        {/* Player list */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Giocatori connessi ({players.length})
            </h2>
          </div>

          {players.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nessun giocatore ancora – condividi il codice!</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {players.map(p => (
                <PlayerRow key={p.player_id} player={p} />
              ))}
            </ul>
          )}
        </div>

        {/* Start button */}
        {isLobby && (
          <>
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

        {isActive && (
          <div className="text-center py-4">
            <p className="text-green-700 font-semibold">Partita avviata – Turno {room.current_turn}</p>
            <p className="text-sm text-gray-500 mt-1">Il pannello di gestione turni sarà disponibile nella Sessione 5.</p>
          </div>
        )}
      </div>
    </div>
  )
}
