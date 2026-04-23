import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const COMPLEXITY_OPTIONS = [
  { value: 1, label: 'Livello 1 – Elasticità Pura', desc: 'Input: Prezzo, Qualità, Marketing' },
  { value: 2, label: 'Livello 2 – Equilibrio Naturale', desc: 'Aggiunge: Produzione, reputazione, economie di scala' },
  { value: 3, label: 'Livello 3 – Economia Complessa', desc: 'Aggiunge: Supply chain, promozioni tattiche' },
]

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Auth form ──────────────────────────────────────────────────────────────────

function AuthForm({ onSuccess }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      onSuccess?.()
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        {mode === 'signin' ? 'Accedi come Admin' : 'Crea account Admin'}
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Serve un account per creare e gestire le stanze.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="nome@esempio.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="min. 6 caratteri"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Attendere…' : mode === 'signin' ? 'Accedi' : 'Registrati'}
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-gray-500">
        {mode === 'signin' ? (
          <>
            Non hai un account?{' '}
            <button onClick={() => setMode('signup')} className="text-indigo-600 hover:underline font-medium">
              Registrati
            </button>
          </>
        ) : (
          <>
            Hai già un account?{' '}
            <button onClick={() => setMode('signin')} className="text-indigo-600 hover:underline font-medium">
              Accedi
            </button>
          </>
        )}
      </p>
    </div>
  )
}

// ── Room creation form ─────────────────────────────────────────────────────────

function CreateRoomForm({ user }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [numTurns, setNumTurns] = useState(6)
  const [budgetInitial, setBudgetInitial] = useState(5000)
  const [catalogMax, setCatalogMax] = useState(3)
  const [complexityLevel, setComplexityLevel] = useState(2)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const joinCode = generateJoinCode()

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        admin_id: user.id,
        name: name.trim(),
        num_turns: Number(numTurns),
        budget_initial: Number(budgetInitial),
        catalog_max: Number(catalogMax),
        complexity_level: Number(complexityLevel),
        join_code: joinCode,
        status: 'lobby',
      })
      .select('room_id')
      .single()

    setLoading(false)

    if (error) {
      // Retry with a new code if there's a unique conflict on join_code
      if (error.code === '23505') {
        setError('Codice join duplicato, riprova.')
      } else {
        setError(error.message)
      }
      return
    }

    navigate(`/admin/${data.room_id}`)
  }

  return (
    <div className="w-full max-w-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Crea una Stanza</h2>
      <p className="text-gray-500 text-sm mb-6">
        Configura la partita e condividi il codice con gli studenti.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Room name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome stanza</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Es. Economia 3A – Maggio 2025"
          />
        </div>

        {/* Number of turns */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numero di turni: <span className="text-indigo-600 font-semibold">{numTurns}</span>
          </label>
          <input
            type="range"
            min={2}
            max={10}
            value={numTurns}
            onChange={e => setNumTurns(e.target.value)}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>2</span><span>Default: 6</span><span>10</span>
          </div>
        </div>

        {/* Budget initial */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Budget iniziale per giocatore (€)</label>
          <input
            type="number"
            required
            min={500}
            max={10000}
            step={100}
            value={budgetInitial}
            onChange={e => setBudgetInitial(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Catalog max */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prodotti massimi per giocatore</label>
          <input
            type="number"
            required
            min={1}
            max={6}
            value={catalogMax}
            onChange={e => setCatalogMax(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Complexity level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Livello di complessità</label>
          <div className="space-y-2">
            {COMPLEXITY_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  complexityLevel === opt.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="complexity"
                  value={opt.value}
                  checked={complexityLevel === opt.value}
                  onChange={() => setComplexityLevel(opt.value)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creazione…' : 'Crea Stanza →'}
        </button>
      </form>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CreateRoomPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Caricamento…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg">
        <Link to="/" className="text-indigo-600 hover:underline text-sm mb-6 inline-block">
          ← Home
        </Link>

        {user ? <CreateRoomForm user={user} /> : <AuthForm />}
      </div>
    </div>
  )
}
