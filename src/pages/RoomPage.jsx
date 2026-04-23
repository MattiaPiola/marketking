import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRoom } from '../hooks/useRoom'

function PlayerRow({ player, isMe }) {
  return (
    <li className={`flex items-center gap-3 py-2 ${isMe ? 'font-semibold' : ''}`}>
      <span
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: player.color ?? '#6366f1' }}
      />
      <span className="text-sm text-gray-900">
        {player.nickname}
        {isMe && <span className="ml-2 text-xs text-indigo-500">(tu)</span>}
      </span>
    </li>
  )
}

export default function RoomPage() {
  const { id: roomId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { room, players, loading, error } = useRoom(roomId)

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
        <p className="text-red-600 mb-4">Stanza non trovata.</p>
        <Link to="/" className="text-indigo-600 hover:underline">← Home</Link>
      </div>
    )
  }

  const me = players.find(p => p.user_id === user?.id)
  const isActive = room.status === 'active'
  const isLobby = room.status === 'lobby'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{room.name}</h1>
        {me && (
          <p className="text-sm text-gray-500 mb-6">
            Giochi come <span className="font-medium" style={{ color: me.color }}>{me.nickname}</span>
          </p>
        )}

        {/* Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 text-center">
          {isLobby && (
            <>
              <div className="text-3xl mb-2">⏳</div>
              <p className="text-base font-semibold text-gray-800">In attesa dell'admin</p>
              <p className="text-sm text-gray-500 mt-1">La partita inizierà quando l'insegnante avvierà il turno.</p>
            </>
          )}
          {isActive && (
            <>
              <div className="text-3xl mb-2">▶️</div>
              <p className="text-base font-semibold text-green-700">Partita in corso – Turno {room.current_turn}</p>
              <p className="text-sm text-gray-500 mt-1">Il pannello decisioni sarà disponibile nella Sessione 4.</p>
            </>
          )}
          {room.status === 'paused' && (
            <>
              <div className="text-3xl mb-2">⏸</div>
              <p className="text-base font-semibold text-yellow-700">Partita in pausa</p>
              <p className="text-sm text-gray-500 mt-1">L'admin riprenderà a breve.</p>
            </>
          )}
          {room.status === 'completed' && (
            <>
              <div className="text-3xl mb-2">🏁</div>
              <p className="text-base font-semibold text-gray-800">Partita terminata</p>
            </>
          )}
        </div>

        {/* Player list */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Giocatori ({players.length} / 8)
          </h2>
          {players.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nessun giocatore ancora.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {players.map(p => (
                <PlayerRow key={p.player_id} player={p} isMe={p.user_id === user?.id} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
