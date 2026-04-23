import { useMemo } from 'react'
import { calculateTurnResults } from '../lib/engine'
import { useDecision } from '../hooks/useDecision'

// ── Helpers ───────────────────────────────────────────────────────────────────

function qualityTierLabel(quality) {
  if (quality <= 3) return 'Budget'
  if (quality <= 6) return 'Standard'
  if (quality <= 9) return 'Premium'
  return 'Esclusivo'
}

function marketingRateHint(marketing) {
  if (marketing <= 100) return '+0.5% cons. per €'
  if (marketing <= 300) return '+0.3% cons. per €'
  if (marketing <= 600) return '+0.15% cons. per €'
  return '+0.05% cons. per €'
}

function scaleHint(production) {
  if (production <= 50) return 'Nessuna economia di scala'
  if (production <= 150) return 'Piccola scala (×0.95 costi)'
  if (production <= 300) return 'Media scala (×0.90 costi)'
  return 'Grande scala (×0.85 costi)'
}

function fmt(n) {
  return `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Price-Quality Map ─────────────────────────────────────────────────────────

function PriceQualityMap({ price, quality, color }) {
  const W = 220
  const H = 150
  const PAD = 26

  const xScale = p => PAD + ((p - 5) / 45) * (W - PAD * 2)
  const yScale = q => PAD + ((10 - q) / 9) * (H - PAD * 2)

  const dotX = xScale(Math.min(50, Math.max(5, price)))
  const dotY = yScale(Math.min(10, Math.max(1, quality)))

  return (
    <svg width={W} height={H} className="w-full" aria-label="Mappa Prezzo-Qualità">
      {/* Zone fills */}
      <rect x={PAD} y={yScale(3.5)} width={W - PAD * 2} height={yScale(1) - yScale(3.5)} fill="#dcfce7" />
      <rect x={PAD} y={yScale(6.5)} width={W - PAD * 2} height={yScale(3.5) - yScale(6.5)} fill="#dbeafe" />
      <rect x={PAD} y={yScale(9.5)} width={W - PAD * 2} height={yScale(6.5) - yScale(9.5)} fill="#ede9fe" />
      <rect x={PAD} y={yScale(10)} width={W - PAD * 2} height={yScale(9.5) - yScale(10)} fill="#fdf4ff" />

      {/* Zone labels */}
      <text x={PAD + 3} y={(yScale(3.5) + yScale(1)) / 2 + 3} fontSize={8} fill="#16a34a">Budget</text>
      <text x={PAD + 3} y={(yScale(6.5) + yScale(3.5)) / 2 + 3} fontSize={8} fill="#1d4ed8">Standard</text>
      <text x={PAD + 3} y={(yScale(9.5) + yScale(6.5)) / 2 + 3} fontSize={8} fill="#7c3aed">Premium</text>
      <text x={PAD + 3} y={(yScale(10) + yScale(9.5)) / 2 + 3} fontSize={8} fill="#86198f">Esclusivo</text>

      {/* Axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#9ca3af" strokeWidth={1} />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#9ca3af" strokeWidth={1} />

      {/* Axis labels */}
      <text x={PAD + (W - PAD * 2) / 2} y={H - 4} fontSize={8} fill="#6b7280" textAnchor="middle">
        Prezzo €5 – €50
      </text>
      <text
        x={10}
        y={PAD + (H - PAD * 2) / 2}
        fontSize={8}
        fill="#6b7280"
        textAnchor="middle"
        transform={`rotate(-90, 10, ${PAD + (H - PAD * 2) / 2})`}
      >
        Qualità 1–10
      </text>

      {/* Player dot */}
      <circle cx={dotX} cy={dotY} r={7} fill={color ?? '#6366f1'} opacity={0.85} />
      <circle cx={dotX} cy={dotY} r={7} fill="none" stroke="white" strokeWidth={1.5} />
    </svg>
  )
}

// ── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ preview, complexityLevel }) {
  const dash = '–'

  let profitColor = 'text-gray-400'
  if (preview != null) {
    profitColor = preview.profit >= 0 ? 'text-green-700' : 'text-red-600'
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Domanda stimata</span>
        <span className="font-medium text-gray-900">
          {preview ? `${Math.round(preview.demand_generated)} pz` : dash}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Ricavi stimati</span>
        <span className="font-medium text-gray-900">{preview ? fmt(preview.revenues) : dash}</span>
      </div>
      <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Costi produzione</span>
          <span className="text-gray-600">{preview ? fmt(preview.production_costs) : dash}</span>
        </div>
        {complexityLevel >= 2 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Costi inventario</span>
            <span className="text-gray-600">{preview ? fmt(preview.inventory_costs) : dash}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Costi marketing</span>
          <span className="text-gray-600">{preview ? fmt(preview.marketing_costs) : dash}</span>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
        <span className="text-gray-700">Profitto netto</span>
        <span className={profitColor}>{preview ? fmt(preview.profit) : dash}</span>
      </div>

      {complexityLevel >= 2 && preview?.feedback_data && (
        <div className="mt-3 space-y-1.5 text-xs">
          {preview.feedback_data.scale_insight && (
            <p className="text-indigo-600 bg-indigo-50 rounded px-2 py-1">
              📦 {preview.feedback_data.scale_insight.note}
            </p>
          )}
          {preview.inventory_units > 0 && (
            <p className="text-amber-700 bg-amber-50 rounded px-2 py-1">
              🏭 Inventario stimato: {preview.inventory_units} pz invenduti
            </p>
          )}
          {preview.feedback_data.inventory_warning && (
            <p className="text-red-600 bg-red-50 rounded px-2 py-1">
              ⚠️ {preview.feedback_data.inventory_warning}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Decision Panel ────────────────────────────────────────────────────────────

/**
 * Full decision panel for the active turn.
 *
 * @param {object} props
 * @param {object} props.room    – room row from DB
 * @param {object} props.player  – player row from DB (the current user's player)
 */
export default function DecisionPanel({ room, player }) {
  const complexityLevel = room.complexity_level
  const { decision, setField, params, prevResult, confirmed, saving, confirmDecision } = useDecision({
    roomId: room.room_id,
    playerId: player.player_id,
    currentTurn: room.current_turn,
    complexityLevel,
  })

  const preview = useMemo(() => {
    if (!params) return null
    return calculateTurnResults(
      decision,
      params,
      prevResult,
      [], // shocks are applied server-side; not shown in client preview
      complexityLevel,
      player.player_id,
    )
  }, [decision, params, prevResult, complexityLevel, player.player_id])

  const tierLabel = qualityTierLabel(decision.quality)
  const disabled = confirmed

  return (
    <div className="space-y-5">
      {/* Confirmed banner */}
      {confirmed && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-sm">Decisione confermata</p>
            <p className="text-xs text-green-600 mt-0.5">
              Le tue scelte sono state inviate. Attendi che l'admin termini il turno.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── Inputs ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          <h3 className="text-sm font-semibold text-gray-700">
            Le tue decisioni – Turno {room.current_turn}
          </h3>

          {/* Quality */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Qualità</label>
              <span className="text-sm font-bold text-gray-900">
                {decision.quality}{' '}
                <span className="text-xs font-normal text-gray-400">({tierLabel})</span>
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={decision.quality}
              onChange={e => setField('quality', Number(e.target.value))}
              disabled={disabled}
              className="w-full accent-indigo-600 disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>1 – Budget</span>
              <span>10 – Esclusivo</span>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Prezzo</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">€</span>
              <input
                type="number"
                min={5}
                step={0.5}
                value={decision.price}
                onChange={e => setField('price', Math.max(5, Number(e.target.value)))}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:opacity-60"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Min €5</p>
          </div>

          {/* Marketing */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Marketing</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">€</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={decision.marketing}
                  onChange={e => setField('marketing', Math.max(0, Number(e.target.value)))}
                  disabled={disabled}
                  className="w-20 px-1 py-0.5 text-sm font-bold text-gray-900 border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-transparent disabled:border-transparent"
                />
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={Math.min(decision.marketing, 500)}
              onChange={e => setField('marketing', Number(e.target.value))}
              disabled={disabled}
              className="w-full accent-indigo-600 disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>€0</span>
              <span className="text-indigo-500">{marketingRateHint(decision.marketing)}</span>
              <span>€500+</span>
            </div>
          </div>

          {/* Production – L2+ only */}
          {complexityLevel >= 2 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Produzione</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={decision.production}
                    onChange={e => setField('production', Math.max(0, Number(e.target.value)))}
                    disabled={disabled}
                    className="w-20 px-1 py-0.5 text-sm font-bold text-gray-900 border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-transparent disabled:border-transparent"
                  />
                  <span className="text-sm text-gray-500">pz</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={10}
                value={Math.min(decision.production, 1000)}
                onChange={e => setField('production', Number(e.target.value))}
                disabled={disabled}
                className="w-full accent-indigo-600 disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0 pz</span>
                <span className="text-indigo-500">{scaleHint(decision.production)}</span>
                <span>1000+ pz</span>
              </div>
            </div>
          )}

          {/* Confirm button */}
          {!confirmed && (
            <>
              <button
                onClick={confirmDecision}
                disabled={saving}
                className="w-full mt-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
              >
                {saving ? 'Salvataggio…' : '✓ Conferma Decisione'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                {saving
                  ? 'Salvataggio automatico in corso…'
                  : 'Le modifiche vengono salvate automaticamente.'}
              </p>
            </>
          )}
        </div>

        {/* ── Preview + Map ── */}
        <div className="space-y-5">
          {/* Live preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Preview{' '}
              {!params && <span className="text-xs font-normal text-gray-400">(caricamento…)</span>}
            </h3>
            <LivePreview preview={preview} complexityLevel={complexityLevel} />
          </div>

          {/* Price-quality map */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Il tuo posizionamento</h3>
            <PriceQualityMap
              price={decision.price}
              quality={decision.quality}
              color={player.color}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
