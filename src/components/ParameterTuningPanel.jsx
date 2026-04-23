import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── ParameterTuningPanel ──────────────────────────────────────────────────────
/**
 * Allows the admin to tweak the economic parameters for the current complexity
 * level between turns. Changes are persisted to the `parameters` table.
 *
 * Props:
 *   roomId          – UUID of the room
 *   complexityLevel – current complexity level (1, 2, or 3)
 */
export default function ParameterTuningPanel({ roomId, complexityLevel }) {
  const [params, setParams] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // Local editable copies
  const [elasticity, setElasticity] = useState({ q1_3: -1.8, q4_6: -1.0, q7_9: -0.4, q10: -0.2 })
  const [costs, setCosts]           = useState({ q1_3: 3, q4_6: 8, q7_9: 15, q10: 25 })
  const [scale, setScale]           = useState({ tier1: 1.0, tier2: 0.95, tier3: 0.90, tier4: 0.85 })

  useEffect(() => {
    if (!roomId || !complexityLevel) return
    supabase
      .from('parameters')
      .select('*')
      .eq('room_id', roomId)
      .eq('complexity_level', complexityLevel)
      .single()
      .then(({ data, error: err }) => {
        setLoading(false)
        if (err || !data) return
        setParams(data)
        setElasticity(data.elasticity_by_quality ?? { q1_3: -1.8, q4_6: -1.0, q7_9: -0.4, q10: -0.2 })
        setCosts(data.costs_by_quality ?? { q1_3: 3, q4_6: 8, q7_9: 15, q10: 25 })
        setScale(data.scale_factors ?? { tier1: 1.0, tier2: 0.95, tier3: 0.90, tier4: 0.85 })
      })
  }, [roomId, complexityLevel])

  async function handleSave() {
    if (!params) return
    setError(null)
    setSaving(true)
    const { error: err } = await supabase
      .from('parameters')
      .update({
        elasticity_by_quality: elasticity,
        costs_by_quality: costs,
        scale_factors: scale,
        updated_at: new Date().toISOString(),
      })
      .eq('param_id', params.param_id)
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400 italic">Caricamento parametri…</p>
  }

  return (
    <div className="space-y-5">
      {/* Elasticity */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Elasticità della domanda</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'q1_3', label: 'Q1–3 Budget' },
            { key: 'q4_6', label: 'Q4–6 Standard' },
            { key: 'q7_9', label: 'Q7–9 Premium' },
            { key: 'q10',  label: 'Q10 Esclusivo' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
              <input
                type="number"
                step="0.1"
                min="-3"
                max="0"
                value={elasticity[key]}
                onChange={e => setElasticity(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Cost per quality */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Costo base per qualità (€/pz)</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'q1_3', label: 'Q1–3 Budget' },
            { key: 'q4_6', label: 'Q4–6 Standard' },
            { key: 'q7_9', label: 'Q7–9 Premium' },
            { key: 'q10',  label: 'Q10 Esclusivo' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={costs[key]}
                onChange={e => setCosts(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scale factors */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Economie di scala (moltiplicatori costo)</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'tier1', label: '0–50 pz (no scala)' },
            { key: 'tier2', label: '51–150 pz' },
            { key: 'tier3', label: '151–300 pz' },
            { key: 'tier4', label: '300+ pz' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="1.2"
                value={scale[key]}
                onChange={e => setScale(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
      >
        {saving ? 'Salvataggio…' : saved ? '✓ Salvato' : '💾 Salva parametri'}
      </button>
    </div>
  )
}
