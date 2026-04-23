import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Mercato Vivo</h1>
      <p className="text-gray-500 mb-10 text-center max-w-md">
        Gioco educativo di economia multiplayer. Gestisci la tua azienda di abbigliamento in competizione diretta.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/create"
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-center"
        >
          Crea Stanza (Admin)
        </Link>
        <Link
          to="/join"
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
        >
          Entra in una Stanza
        </Link>
      </div>
    </div>
  )
}
