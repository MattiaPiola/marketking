import { useParams } from 'react-router-dom'

export default function RoomPage() {
  const { id: roomId } = useParams()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Stanza: {roomId}</h1>
      <p className="text-gray-500">Pannello giocatore — da implementare nella Sessione 4</p>
    </div>
  )
}
