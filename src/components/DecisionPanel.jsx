import { useMemo } from 'react'
import { calculateTurnResults } from '../lib/engine'
import { useDecision } from '../hooks/useDecision'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: 'tshirt',  label: 'T-shirt' },
  { value: 'felpa',   label: 'Felpa' },
  { value: 'jeans',   label: 'Jeans' },
  { value: 'sneaker', label: 'Sneaker' },
]

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
        {complexityLevel >= 2 && preview?.catalog_costs > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Costi catalogo</span>
            <span className="text-gray-600">{fmt(preview.catalog_costs)}</span>
          </div>
        )}
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

// ── Extra Product Input Card ──────────────────────────────────────────────────

function ExtraProductCard({ product, index, disabled, onSetField, onRemove, isLaunched }) {
  const tierLabel = qualityTierLabel(Number(product.quality))
  const typeLabel = PRODUCT_TYPES.find(t => t.value === product.product_type)?.label ?? product.product_type

  return (
    <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-indigo-800">{typeLabel}</span>
          {isLaunched && (
            <span className="ml-2 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
              Attivo
            </span>
          )}
          {!isLaunched && (
            <span className="ml-2 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              Lancio: €800
            </span>
          )}
        </div>
        {!disabled && !isLaunched && (
          <button
            onClick={() => onRemove(index)}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
            title="Rimuovi prodotto"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quality */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Qualità</span>
          <span className="text-xs font-bold text-gray-800">
            {product.quality} <span className="font-normal text-gray-400">({tierLabel})</span>
          </span>
        </div>
        <input
          type="range" min={1} max={10} step={1}
          value={product.quality}
          onChange={e => onSetField(index, 'quality', Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-indigo-500 disabled:opacity-50"
        />
      </div>

      {/* Price */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600 w-20">Prezzo</span>
        <span className="text-xs text-gray-500">€</span>
        <input
          type="number" min={5} step={0.5}
          value={product.price}
          onChange={e => onSetField(index, 'price', Math.max(5, Number(e.target.value)))}
          disabled={disabled}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:opacity-60"
        />
      </div>

      {/* Marketing */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600 w-20">Marketing</span>
        <span className="text-xs text-gray-500">€</span>
        <input
          type="number" min={0} step={10}
          value={product.marketing}
          onChange={e => onSetField(index, 'marketing', Math.max(0, Number(e.target.value)))}
          disabled={disabled}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:opacity-60"
        />
      </div>

      {/* Production */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600 w-20">Produzione</span>
        <input
          type="number" min={0} step={10}
          value={product.production}
          onChange={e => onSetField(index, 'production', Math.max(0, Number(e.target.value)))}
          disabled={disabled}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:opacity-60"
        />
        <span className="text-xs text-gray-400">pz</span>
      </div>
    </div>
  )
}

// ── Catalog Section ───────────────────────────────────────────────────────────

function CatalogSection({
  products, prevLaunchedTypes, disabled, onAdd, onSetField, onRemove,
  catalogMax, currentTurn, unlockTurn, budget,
}) {
  const launchCost = 800
  const canAddMore = products.length < catalogMax - 1
  const turnUnlocked = currentTurn >= unlockTurn
  const canAfford = budget >= launchCost
  const newTypeLaunched = products.some(p => !prevLaunchedTypes.includes(p.product_type))
  const canAdd = canAddMore && turnUnlocked && (canAfford || newTypeLaunched === false) && !disabled

  // Types already in the catalog (including those being added this turn)
  const usedTypes = products.map(p => p.product_type)
  const availableTypes = PRODUCT_TYPES.filter(t => !usedTypes.includes(t.value))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Catalogo espanso
          <span className="ml-2 text-xs font-normal text-gray-400">
            ({products.length + 1}/{catalogMax} prodotti)
          </span>
        </h3>
        {!turnUnlocked && (
          <span className="text-xs text-gray-400">Disponibile dal turno {unlockTurn}</span>
        )}
      </div>

      {products.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nessun prodotto aggiuntivo. Il tuo catalogo ha 1 prodotto.</p>
      )}

      {products.map((prod, idx) => (
        <ExtraProductCard
          key={idx}
          product={prod}
          index={idx}
          disabled={disabled}
          onSetField={onSetField}
          onRemove={onRemove}
          isLaunched={prevLaunchedTypes.includes(prod.product_type)}
        />
      ))}

      {turnUnlocked && canAddMore && !disabled && (
        <div>
          {availableTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableTypes.map(t => (
                <button
                  key={t.value}
                  onClick={() => onAdd(t.value)}
                  disabled={!canAfford && !prevLaunchedTypes.includes(t.value)}
                  title={!canAfford ? `Budget insufficiente (€${launchCost} richiesti)` : `Aggiungi ${t.label} (€${launchCost} lancio + €50/turno)`}
                  className="px-3 py-1.5 text-xs border border-dashed border-indigo-400 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  + {t.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Tutti i tipi di prodotto sono già nel catalogo.</p>
          )}
          <p className="text-xs text-gray-400 mt-1.5">
            Lancio: €{launchCost.toLocaleString('it-IT')} una tantum · Gestione: €50/turno per prodotto aggiuntivo
          </p>
        </div>
      )}

      {turnUnlocked && !canAddMore && (
        <p className="text-xs text-gray-400 italic">Catalogo al massimo ({catalogMax} prodotti).</p>
      )}

      {!canAdd && turnUnlocked && canAddMore && !disabled && !canAfford && (
        <p className="text-xs text-red-500">Budget insufficiente per lanciare un nuovo prodotto (€{launchCost} richiesti).</p>
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
  const { decision, setField, addProduct, setProductField, removeProduct, params, prevResult, confirmed, saving, confirmDecision } = useDecision({
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

  // Catalog eligibility
  const catalogConfig = params?.catalog_config ?? {}
  const unlockTurn = catalogConfig.unlock_turn ?? 3
  const catalogMax = room.catalog_max ?? 3
  const prevLaunchedTypes = prevResult?.position_data?.products ?? []
  const showCatalog = complexityLevel >= 2 && room.current_turn >= unlockTurn

  return (
    <div className="space-y-5">
      {/* Confirmed banner */}
      {confirmed && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-sm">Decisione confermata</p>
            <p className="text-xs text-green-600 mt-0.5">
              Le tue scelte sono state inviate. Attendi che l&apos;admin termini il turno.
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
            {/* Slider clamped to 0–500; number input above allows custom values beyond 500 */}
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
            {decision.marketing > 500 && (
              <p className="text-xs text-amber-600 mt-0.5">
                ✏️ Valore personalizzato oltre il range slider (€{decision.marketing})
              </p>
            )}
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
              {/* Slider clamped to 0–1000; number input above allows custom values beyond 1000 */}
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
              {decision.production > 1000 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  ✏️ Valore personalizzato oltre il range slider ({decision.production} pz)
                </p>
              )}
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

      {/* ── Catalog expansion (L2+, turn >= unlock_turn) ── */}
      {showCatalog && (
        <CatalogSection
          products={decision.products ?? []}
          prevLaunchedTypes={prevLaunchedTypes}
          disabled={disabled}
          onAdd={addProduct}
          onSetField={setProductField}
          onRemove={removeProduct}
          catalogMax={catalogMax}
          currentTurn={room.current_turn}
          unlockTurn={unlockTurn}
          budget={Number(player.budget_current)}
        />
      )}
    </div>
  )
}
