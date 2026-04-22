import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-gray-500 mb-6">Pagina non trovata.</p>
      <Link to="/" className="text-indigo-600 hover:underline">
        Torna alla home
      </Link>
    </div>
  )
}
