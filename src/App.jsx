import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabaseMisconfigured } from './lib/supabase'
import HomePage from './pages/HomePage'
import CreateRoomPage from './pages/CreateRoomPage'
import JoinPage from './pages/JoinPage'
import RoomPage from './pages/RoomPage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage'

function MissingConfigScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="text-4xl mb-4">⚙️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Configurazione mancante</h1>
      <p className="text-gray-500 max-w-md mb-4">
        Le variabili d'ambiente Supabase non sono state impostate.
        Copia <code className="font-mono bg-gray-100 px-1 rounded">.env.example</code> in{' '}
        <code className="font-mono bg-gray-100 px-1 rounded">.env.local</code> e compila i valori del tuo progetto.
      </p>
      <pre className="text-left text-sm bg-gray-100 rounded-lg p-4 text-gray-700 max-w-sm w-full">
        {`VITE_SUPABASE_URL=https://…supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ…`}
      </pre>
    </div>
  )
}

function App() {
  if (supabaseMisconfigured) {
    return <MissingConfigScreen />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateRoomPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/room/:id" element={<RoomPage />} />
        <Route path="/admin/:id" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

