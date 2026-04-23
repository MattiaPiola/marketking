/**
 * Mercato Vivo – Core demand & profit engine.
 *
 * Pure deterministic functions. No RNG. No I/O.
 * Used by the `calculate-turn` Edge Function and mirrored as
 * `src/lib/engine.js` for browser-side live preview.
 *
 * All monetary values in €. Demand in integer consumer units.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Decision {
  quality: number    // 1–10
  price: number      // 5–50
  marketing: number  // 0–500
  production: number // 0–1000 (ignored/unlimited in L1)
  products: unknown[] // expanded catalog (L3, not used in L1/L2)
}

export interface Parameters {
  elasticity_by_quality: { q1_3: number; q4_6: number; q7_9: number; q10: number }
  costs_by_quality:      { q1_3: number; q4_6: number; q7_9: number; q10: number }
  scale_factors:         { tier1: number; tier2: number; tier3: number; tier4: number }
  reputation_config: {
    growth_per_turn: number
    cap: number
    price_premium_factor: number
    demand_penalty_on_reset: number
  }
  marketing_config: {
    breakpoints: number[]
    rates: number[]
  }
  inventory_config: {
    storage_cost_per_unit: number
    overflow_threshold: number
    overflow_demand_penalty: number
  }
  market_config: {
    base_consumers: number
    segments: {
      price_hunters: number
      value_seekers: number
      quality_focused: number
      trendsetters: number
    }
  }
}

export interface PreviousResult {
  reputation: number
  inventory_units: number
  cumulative_profit: number
  position_data: {
    price: number
    quality: number
    reputation: number
    quality_changed?: boolean
  }
}

export interface ActiveShock {
  shock_id: string
  intensity_value: number // signed: positive = demand boost, negative = demand cut
  type: string
  targeting: string
  targeting_params: {
    quality_tiers?: number[]
    player_ids?: string[]
  }
}

export interface TurnResult {
  demand_generated: number
  revenues: number
  production_costs: number
  inventory_costs: number
  marketing_costs: number
  profit: number
  cumulative_profit: number
  reputation: number
  inventory_units: number
  position_data: Record<string, unknown>
  feedback_data: Record<string, unknown>
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Reference (neutral) price per quality tier.
 * At this price the demand formula returns the raw tier base demand (before modifiers).
 */
const REFERENCE_PRICES: Record<string, number> = {
  q1_3: 10,
  q4_6: 20,
  q7_9: 32,
  q10:  42,
}

/**
 * Fraction of the total market (base_consumers) each quality tier attracts.
 * Derived from the GDD customer-segment split:
 *   25 % price-hunters → Q1–3 tier
 *   45 % value-seekers → Q4–6 tier
 *   20 % quality-focused → Q7–9 tier
 *   10 % trendsetters → Q10 tier
 */
const QUALITY_MARKET_SHARES: Record<string, number> = {
  q1_3: 0.25,
  q4_6: 0.45,
  q7_9: 0.20,
  q10:  0.10,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getQualityTier(quality: number): string {
  if (quality <= 3) return 'q1_3'
  if (quality <= 6) return 'q4_6'
  if (quality <= 9) return 'q7_9'
  return 'q10'
}

/**
 * Marketing awareness with diminishing returns.
 * Returns a fraction in [0, 1] representing brand visibility boost.
 * Demand is multiplied by (1 + awareness).
 */
function calcMarketingAwareness(
  marketing: number,
  cfg: Parameters['marketing_config'],
): number {
  const { breakpoints, rates } = cfg
  let awareness = 0
  let remaining = marketing

  for (let i = 0; i < rates.length; i++) {
    if (remaining <= 0) break
    const segmentTop = i < breakpoints.length - 1 ? breakpoints[i + 1] : Infinity
    const segmentSize = segmentTop - breakpoints[i]
    const spent = Math.min(remaining, segmentSize)
    awareness += spent * rates[i]
    remaining -= spent
  }

  return Math.min(awareness, 1.0) // cap at 100 % awareness
}

/**
 * Production scale factor (cost multiplier) based on total units produced.
 * GDD tiers: 0–50 × 1.0 | 51–150 × 0.95 | 151–300 × 0.90 | 300+ × 0.85
 */
function getScaleFactor(production: number, sf: Parameters['scale_factors']): number {
  if (production <= 50)  return sf.tier1
  if (production <= 150) return sf.tier2
  if (production <= 300) return sf.tier3
  return sf.tier4
}

/**
 * Aggregate shock demand multiplier for one player's decision.
 * intensity_value is a signed multiplier: +0.20 = +20 % demand, -0.20 = -20 %.
 */
function calcShockMultiplier(
  shocks: ActiveShock[],
  decision: Decision,
  playerId: string,
): number {
  const tier = getQualityTier(decision.quality)
  const tierNumber = tier === 'q1_3' ? 1 : tier === 'q4_6' ? 2 : tier === 'q7_9' ? 3 : 4

  let multiplier = 1.0

  for (const shock of shocks) {
    const { targeting, targeting_params, intensity_value } = shock

    if (targeting === 'global') {
      multiplier *= 1 + intensity_value
      continue
    }

    if (targeting === 'segmental' && targeting_params.quality_tiers) {
      if (targeting_params.quality_tiers.includes(tierNumber)) {
        multiplier *= 1 + intensity_value
      }
      continue
    }

    if (targeting === 'selective' && targeting_params.player_ids) {
      if (targeting_params.player_ids.includes(playerId)) {
        multiplier *= 1 + intensity_value
      }
    }
  }

  return Math.max(0, multiplier)
}

/**
 * Build per-level educational feedback payload.
 * Stored as JSONB and rendered in Session 6.
 */
function buildFeedbackData(
  decision: Decision,
  calc: {
    tier: string
    baseDemand: number
    priceDeltaPct: number
    elasticity: number
    awareness: number
    reputationBoost: number
    womBoost: number
    shockMult: number
    unitsSold: number
    inventoryUnits: number
    scaleFactor: number
    revenues: number
    productionCosts: number
    inventoryCosts: number
    marketingCosts: number
    profit: number
    newReputation: number
    qualityChanged: boolean
    prevInventory: number
    overflowApplied: boolean
    overflowPenaltyPct: number
    demandPenaltyApplied: boolean
    demandPenaltyPct: number
  },
  complexityLevel: number,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    tier: calc.tier,
    units_sold: calc.unitsSold,
    inventory_units: calc.inventoryUnits,
    revenues: calc.revenues,
    production_costs: calc.productionCosts,
    inventory_costs: calc.inventoryCosts,
    marketing_costs: calc.marketingCosts,
    profit: calc.profit,
    positioning: {
      price: decision.price,
      quality: decision.quality,
    },
  }

  if (complexityLevel >= 2) {
    const priceChangePct = Math.round(calc.priceDeltaPct * 1000) / 10
    const demandChangePct = Math.round(calc.priceDeltaPct * calc.elasticity * 1000) / 10
    base.elasticity_insight = {
      elasticity: calc.elasticity,
      price_vs_reference_pct: priceChangePct,
      demand_change_pct: demandChangePct,
      explanation: `Con qualità ${decision.quality} (elasticità ${calc.elasticity}): ` +
        `prezzo ${priceChangePct >= 0 ? '+' : ''}${priceChangePct}% vs riferimento → ` +
        `domanda ${demandChangePct >= 0 ? '+' : ''}${demandChangePct}%`,
    }
    base.scale_insight = {
      scale_factor: calc.scaleFactor,
      production: decision.production,
      note: calc.scaleFactor < 1.0
        ? `Economie di scala attive (×${calc.scaleFactor}): produzione ${decision.production} pezzi riduce costi.`
        : 'Nessuna economia di scala attiva (produzione ≤ 50 pezzi).',
    }
    base.reputation_insight = {
      new_reputation: calc.newReputation,
      quality_changed: calc.qualityChanged,
      note: calc.qualityChanged
        ? 'Cambio qualità: reputazione azzerata. I clienti fedeli potrebbero ridursi.'
        : calc.newReputation > 0
        ? `Reputazione cresciuta a ${Math.round(calc.newReputation * 100)}%.`
        : 'Reputazione ancora a 0% – mantieni la qualità per costruirla.',
    }
    if (calc.overflowApplied) {
      base.inventory_warning = `Inventario precedente ${calc.prevInventory} pezzi supera soglia: ` +
        `domanda ridotta del ${Math.round(calc.overflowPenaltyPct * 100)}%.`
    }
    if (calc.demandPenaltyApplied) {
      base.demand_penalty_note =
        `Penalità domanda applicata per cambio qualità al turno precedente (-${Math.round(calc.demandPenaltyPct * 100)}%).`
    }
    base.mini_suggestion = buildMiniSuggestion(decision, calc)
  }

  if (complexityLevel >= 3) {
    base.advanced_insight = {
      marketing_roi: decision.marketing > 0
        ? `€${decision.marketing} marketing → ${Math.round(calc.awareness * 100)}% consapevolezza (+${Math.round(calc.awareness * 100)}% domanda).`
        : 'Nessuna spesa marketing.',
      wom_effect: `Word-of-mouth Q${decision.quality}: ${calc.womBoost >= 0 ? '+' : ''}${Math.round(calc.womBoost * 100)}% domanda organica.`,
      shock_applied: calc.shockMult !== 1.0
        ? `Shock attivo: ×${calc.shockMult.toFixed(2)} sulla domanda.`
        : 'Nessun shock attivo.',
    }
  }

  return base
}

function buildMiniSuggestion(
  decision: Decision,
  calc: { tier: string; newReputation: number; inventoryUnits: number; scaleFactor: number },
): string {
  if (calc.newReputation >= 0.5) {
    return `La tua reputazione è ${Math.round(calc.newReputation * 100)}% – è un asset prezioso. Considera di mantenere qualità stabile.`
  }
  if (calc.inventoryUnits > 150) {
    return `Hai ${calc.inventoryUnits} pezzi invenduti – riduci la produzione al prossimo turno per ridurre i costi.`
  }
  if (calc.scaleFactor >= 1.0 && decision.production < 50) {
    return 'Produzione bassa: nessun vantaggio di scala. Se la domanda lo supporta, prova a produrre di più.'
  }
  if (calc.tier === 'q1_3' && decision.price > 12) {
    return 'Nel segmento budget, i clienti sono molto sensibili al prezzo. Un prezzo più basso può aumentare molto la domanda.'
  }
  return 'Analizza il tuo posizionamento sulla mappa prezzo-qualità rispetto ai competitor.'
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Calculate one player's complete turn results.
 *
 * @param decision       – player's submitted decisions for this turn
 * @param params         – game parameters for the room's complexity level
 * @param prevResult     – player's result from the previous turn (null on turn 1)
 * @param activeShocks   – shocks active for this turn
 * @param complexityLevel – 1 | 2 | 3
 * @param playerId       – used for selective shock targeting
 */
export function calculateTurnResults(
  decision: Decision,
  params: Parameters,
  prevResult: PreviousResult | null,
  activeShocks: ActiveShock[],
  complexityLevel: number,
  playerId: string,
): TurnResult {
  const tier = getQualityTier(decision.quality)
  const baseConsumers = params.market_config.base_consumers
  const marketShare = QUALITY_MARKET_SHARES[tier]
  const referencePrice = REFERENCE_PRICES[tier]
  const elasticity = (params.elasticity_by_quality as Record<string, number>)[tier]

  // ── 1. Price elasticity effect ────────────────────────────────────────────
  const priceDeltaPct = (decision.price - referencePrice) / referencePrice
  const baseDemand = baseConsumers * marketShare * (1 + priceDeltaPct * elasticity)

  let demand = Math.max(0, baseDemand)

  // ── 2. Marketing awareness boost ─────────────────────────────────────────
  const awareness = calcMarketingAwareness(decision.marketing, params.marketing_config)
  demand *= (1 + awareness)

  // ── 3. Reputation boost (L2+) ────────────────────────────────────────────
  const prevReputation = prevResult?.reputation ?? 0
  let reputationBoost = 0
  if (complexityLevel >= 2) {
    reputationBoost = prevReputation * params.reputation_config.price_premium_factor
    demand *= (1 + reputationBoost)
  }

  // ── 4. Demand penalty from previous quality change (L2+) ─────────────────
  let demandPenaltyApplied = false
  if (
    complexityLevel >= 2 &&
    prevResult?.position_data?.quality_changed === true
  ) {
    demand *= (1 - params.reputation_config.demand_penalty_on_reset)
    demandPenaltyApplied = true
  }

  // ── 5. Inventory overflow penalty (L2+) ──────────────────────────────────
  const prevInventory = prevResult?.inventory_units ?? 0
  let overflowApplied = false
  if (complexityLevel >= 2 && prevInventory > params.inventory_config.overflow_threshold) {
    demand *= (1 - params.inventory_config.overflow_demand_penalty)
    overflowApplied = true
  }

  // ── 6. Word-of-mouth ±5 % ─────────────────────────────────────────────────
  // Rating = quality / 2 (0.5–5). Centre at 2.5. ±5 % span.
  const womRating = decision.quality / 2
  const womBoost = ((womRating - 2.5) / 2.5) * 0.05
  demand *= (1 + womBoost)

  // ── 7. Shock multiplier ───────────────────────────────────────────────────
  const shockMult = calcShockMultiplier(activeShocks, decision, playerId)
  demand *= shockMult

  demand = Math.max(0, demand)

  // ── 8. Production cap (L2+) & inventory units ────────────────────────────
  //   L1: no production limit (set large enough to never cap)
  const production = complexityLevel >= 2 ? decision.production : 10_000
  const unitsSold = Math.min(Math.floor(demand), production)
  const inventoryUnits = Math.max(0, production - unitsSold)

  // ── 9. Costs ─────────────────────────────────────────────────────────────
  const baseCost = (params.costs_by_quality as Record<string, number>)[tier]
  const scaleFactor = complexityLevel >= 2
    ? getScaleFactor(production, params.scale_factors)
    : 1.0

  // GDD: production_costs = min(demand, production) × base_cost × scale_factor
  const productionCosts  = unitsSold * baseCost * scaleFactor
  const inventoryCosts   = complexityLevel >= 2
    ? inventoryUnits * params.inventory_config.storage_cost_per_unit
    : 0
  const marketingCosts   = decision.marketing

  // ── 10. Revenue & profit ──────────────────────────────────────────────────
  const revenues         = unitsSold * decision.price
  const totalCosts       = productionCosts + inventoryCosts + marketingCosts
  const profit           = revenues - totalCosts
  const prevCumulative   = prevResult?.cumulative_profit ?? 0
  const cumulativeProfit = prevCumulative + profit

  // ── 11. Reputation update ─────────────────────────────────────────────────
  const prevQuality = prevResult?.position_data?.quality ?? null
  const qualityChanged = prevQuality !== null && decision.quality !== prevQuality
  let newReputation: number
  if (prevQuality === null) {
    // First turn
    newReputation = 0
  } else if (qualityChanged) {
    newReputation = 0
  } else {
    newReputation = Math.min(
      prevReputation + params.reputation_config.growth_per_turn,
      params.reputation_config.cap,
    )
  }

  // ── 12. Assemble output ───────────────────────────────────────────────────
  const positionData = {
    price: decision.price,
    quality: decision.quality,
    reputation: newReputation,
    quality_changed: qualityChanged,
  }

  const feedbackData = buildFeedbackData(
    decision,
    {
      tier, baseDemand, priceDeltaPct, elasticity,
      awareness, reputationBoost, womBoost, shockMult,
      unitsSold, inventoryUnits, scaleFactor,
      revenues, productionCosts, inventoryCosts, marketingCosts,
      profit, newReputation, qualityChanged, prevInventory,
      overflowApplied,
      overflowPenaltyPct: params.inventory_config.overflow_demand_penalty,
      demandPenaltyApplied,
      demandPenaltyPct: params.reputation_config.demand_penalty_on_reset,
    },
    complexityLevel,
  )

  return {
    demand_generated:  round2(unitsSold),
    revenues:          round2(revenues),
    production_costs:  round2(productionCosts),
    inventory_costs:   round2(inventoryCosts),
    marketing_costs:   round2(marketingCosts),
    profit:            round2(profit),
    cumulative_profit: round2(cumulativeProfit),
    reputation:        round4(newReputation),
    inventory_units:   inventoryUnits,
    position_data:     positionData,
    feedback_data:     feedbackData,
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/**
 * Exposed for live-preview: compute marketing awareness only.
 * Used by the decision panel to show the diminishing-returns curve.
 */
export function calcAwareness(
  marketing: number,
  cfg: Parameters['marketing_config'],
): number {
  return calcMarketingAwareness(marketing, cfg)
}
