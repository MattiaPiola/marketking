/**
 * Mercato Vivo – Core demand & profit engine (browser / Vite build).
 *
 * Mirrors supabase/functions/_shared/engine.ts (same logic, plain ES module JS).
 * Used by the live-preview decision panel (Session 4) and any client-side
 * estimate that needs to replicate server-side calculations.
 *
 * Pure functions – no network, no side effects, fully deterministic.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Reference (neutral) price per quality tier.
 * At this price the demand formula returns the raw tier base demand (before modifiers).
 */
const REFERENCE_PRICES = {
  q1_3: 10,
  q4_6: 20,
  q7_9: 32,
  q10:  42,
}

/**
 * Fraction of the total market (base_consumers) each quality tier attracts.
 * Derived from GDD customer-segment split:
 *   25 % price-hunters → Q1–3 | 45 % value-seekers → Q4–6
 *   20 % quality-focused → Q7–9 | 10 % trendsetters → Q10
 */
const QUALITY_MARKET_SHARES = {
  q1_3: 0.25,
  q4_6: 0.45,
  q7_9: 0.20,
  q10:  0.10,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getQualityTier(quality) {
  if (quality <= 3) return 'q1_3'
  if (quality <= 6) return 'q4_6'
  if (quality <= 9) return 'q7_9'
  return 'q10'
}

/**
 * Marketing awareness with diminishing returns (GDD §Marketing).
 * Returns a value in [0, 1] representing brand visibility boost.
 * Demand is multiplied by (1 + awareness).
 *
 * @param {number} marketing – euros spent on marketing
 * @param {{ breakpoints: number[], rates: number[] }} cfg
 * @returns {number}
 */
export function calcAwareness(marketing, cfg) {
  const { breakpoints, rates } = cfg
  let awareness = 0
  let remaining = marketing

  for (let i = 0; i < rates.length; i++) {
    if (remaining <= 0) break
    const segmentTop  = i < breakpoints.length - 1 ? breakpoints[i + 1] : Infinity
    const segmentSize = segmentTop - breakpoints[i]
    const spent       = Math.min(remaining, segmentSize)
    awareness        += spent * rates[i]
    remaining        -= spent
  }

  return Math.min(awareness, 1.0) // cap at 100 % awareness
}

/**
 * Production scale factor (cost multiplier) based on total units produced.
 * GDD tiers: 0–50 × 1.0 | 51–150 × 0.95 | 151–300 × 0.90 | 300+ × 0.85
 *
 * @param {number} production
 * @param {{ tier1: number, tier2: number, tier3: number, tier4: number }} sf
 * @returns {number}
 */
export function getScaleFactor(production, sf) {
  if (production <= 50)  return sf.tier1
  if (production <= 150) return sf.tier2
  if (production <= 300) return sf.tier3
  return sf.tier4
}

/**
 * Aggregate shock demand multiplier for one player's decision.
 * intensity_value is signed: +0.20 = +20 % demand, -0.20 = -20 %.
 *
 * @param {Array}  shocks
 * @param {{ quality: number }} decision
 * @param {string} playerId
 * @returns {number}
 */
function calcShockMultiplier(shocks, decision, playerId) {
  const tier        = getQualityTier(decision.quality)
  const tierNumber  = tier === 'q1_3' ? 1 : tier === 'q4_6' ? 2 : tier === 'q7_9' ? 3 : 4
  let multiplier    = 1.0

  for (const shock of shocks) {
    const { targeting, targeting_params, intensity_value } = shock

    if (targeting === 'global') {
      multiplier *= 1 + intensity_value
    } else if (targeting === 'segmental' && targeting_params?.quality_tiers) {
      if (targeting_params.quality_tiers.includes(tierNumber)) {
        multiplier *= 1 + intensity_value
      }
    } else if (targeting === 'selective' && targeting_params?.player_ids) {
      if (targeting_params.player_ids.includes(playerId)) {
        multiplier *= 1 + intensity_value
      }
    }
  }

  return Math.max(0, multiplier)
}

function buildMiniSuggestion(decision, calc) {
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

function buildFeedbackData(decision, calc, complexityLevel) {
  const base = {
    tier:             calc.tier,
    units_sold:       calc.unitsSold,
    inventory_units:  calc.inventoryUnits,
    revenues:         calc.revenues,
    production_costs: calc.productionCosts,
    inventory_costs:  calc.inventoryCosts,
    marketing_costs:  calc.marketingCosts,
    profit:           calc.profit,
    positioning: { price: decision.price, quality: decision.quality },
  }

  if (complexityLevel >= 2) {
    const priceChangePct  = Math.round(calc.priceDeltaPct * 1000) / 10
    const demandChangePct = Math.round(calc.priceDeltaPct * calc.elasticity * 1000) / 10
    base.elasticity_insight = {
      elasticity: calc.elasticity,
      price_vs_reference_pct: priceChangePct,
      demand_change_pct: demandChangePct,
      explanation:
        `Con qualità ${decision.quality} (elasticità ${calc.elasticity}): ` +
        `prezzo ${priceChangePct >= 0 ? '+' : ''}${priceChangePct}% vs riferimento → ` +
        `domanda ${demandChangePct >= 0 ? '+' : ''}${demandChangePct}%`,
    }
    base.scale_insight = {
      scale_factor: calc.scaleFactor,
      production:   decision.production,
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
      base.inventory_warning =
        `Inventario precedente ${calc.prevInventory} pezzi supera soglia: ` +
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
      wom_effect:
        `Word-of-mouth Q${decision.quality}: ${calc.womBoost >= 0 ? '+' : ''}${Math.round(calc.womBoost * 100)}% domanda organica.`,
      shock_applied: calc.shockMult !== 1.0
        ? `Shock attivo: ×${calc.shockMult.toFixed(2)} sulla domanda.`
        : 'Nessun shock attivo.',
    }
  }

  return base
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Calculate one player's complete turn results.
 *
 * @param {object} decision        – { quality, price, marketing, production, products }
 * @param {object} params          – game parameters (from `parameters` table row)
 * @param {object|null} prevResult – previous turn's result row (null on turn 1)
 * @param {Array}  activeShocks    – active shocks for this turn
 * @param {number} complexityLevel – 1 | 2 | 3
 * @param {string} playerId        – used for selective shock targeting
 * @returns {object} TurnResult
 */
export function calculateTurnResults(decision, params, prevResult, activeShocks, complexityLevel, playerId) {
  const tier          = getQualityTier(decision.quality)
  const baseConsumers = params.market_config.base_consumers
  const marketShare   = QUALITY_MARKET_SHARES[tier]
  const referencePrice = REFERENCE_PRICES[tier]
  const elasticity    = params.elasticity_by_quality[tier]

  // ── 1. Price elasticity effect ────────────────────────────────────────────
  const priceDeltaPct = (decision.price - referencePrice) / referencePrice
  const baseDemand    = baseConsumers * marketShare * (1 + priceDeltaPct * elasticity)
  let demand          = Math.max(0, baseDemand)

  // ── 2. Marketing awareness boost ─────────────────────────────────────────
  const awareness = calcAwareness(decision.marketing, params.marketing_config)
  demand *= (1 + awareness)

  // ── 3. Reputation boost (L2+) ────────────────────────────────────────────
  const prevReputation = prevResult?.reputation ?? 0
  let reputationBoost  = 0
  if (complexityLevel >= 2) {
    reputationBoost = prevReputation * params.reputation_config.price_premium_factor
    demand *= (1 + reputationBoost)
  }

  // ── 4. Demand penalty from previous quality change (L2+) ─────────────────
  let demandPenaltyApplied = false
  if (complexityLevel >= 2 && prevResult?.position_data?.quality_changed === true) {
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

  // ── 6. Word-of-mouth ±5 % ────────────────────────────────────────────────
  const womRating = decision.quality / 2
  const womBoost  = ((womRating - 2.5) / 2.5) * 0.05
  demand *= (1 + womBoost)

  // ── 7. Shock multiplier ───────────────────────────────────────────────────
  const shockMult = calcShockMultiplier(activeShocks ?? [], decision, playerId ?? '')
  demand *= shockMult

  demand = Math.max(0, demand)

  // ── 8. Production cap (L2+) & inventory ──────────────────────────────────
  const production = complexityLevel >= 2 ? decision.production : 10_000
  let unitsSold  = Math.min(Math.floor(demand), production)
  let inventoryUnits = Math.max(0, production - unitsSold)

  // ── 9. Costs ─────────────────────────────────────────────────────────────
  const baseCost        = params.costs_by_quality[tier]
  const scaleFactor     = complexityLevel >= 2
    ? getScaleFactor(production, params.scale_factors)
    : 1.0
  let productionCosts = unitsSold * baseCost * scaleFactor
  let inventoryCosts  = complexityLevel >= 2
    ? inventoryUnits * params.inventory_config.storage_cost_per_unit
    : 0
  let marketingCosts  = decision.marketing

  // ── 10. Revenue & profit ──────────────────────────────────────────────────
  let revenues     = unitsSold * decision.price
  let catalogCosts = 0

  // ── 10.5 Multi-product calculation (L2+) ────────────────────────────────
  const extraProducts = (complexityLevel >= 2 && Array.isArray(decision.products))
    ? decision.products
    : []

  if (extraProducts.length > 0) {
    const allQualities = [decision.quality, ...extraProducts.map(p => Number(p.quality))]
    const qMax = Math.max(...allQualities)
    const qMin = Math.min(...allQualities)
    const coherent = (qMax - qMin) <= 2

    const catalogConfig = params.catalog_config ?? {}
    const synergyBonus       = coherent ? (catalogConfig.synergy_bonus ?? 0.08) : 0
    const dilutionBase       = coherent ? 0 : (catalogConfig.dilution_base ?? -0.04)
    const dilutionIncoherent = coherent ? 0 : (catalogConfig.dilution_incoherent ?? -0.10)

    // Apply dilution to primary product if incoherent
    if (!coherent) {
      const primaryAdjust = 1 + dilutionBase
      const adjUnitsSold  = Math.min(Math.floor(demand * primaryAdjust), production)
      const adjInventory  = Math.max(0, production - adjUnitsSold)
      revenues        = adjUnitsSold * decision.price
      productionCosts = adjUnitsSold * baseCost * scaleFactor
      inventoryCosts  = complexityLevel >= 2
        ? adjInventory * params.inventory_config.storage_cost_per_unit : 0
      unitsSold      = adjUnitsSold
      inventoryUnits = adjInventory
    }

    for (const prod of extraProducts) {
      const pQuality    = Number(prod.quality)
      const pPrice      = Number(prod.price)
      const pMarketing  = Number(prod.marketing ?? 0)
      const pProduction = Number(prod.production ?? 0)

      const pTier        = getQualityTier(pQuality)
      const pRefPrice    = REFERENCE_PRICES[pTier]
      const pElasticity  = params.elasticity_by_quality[pTier]
      const pMarketShare = QUALITY_MARKET_SHARES[pTier]
      const pBaseCost    = params.costs_by_quality[pTier]

      const pPriceDeltaPct = (pPrice - pRefPrice) / pRefPrice
      let pDemand = Math.max(0, baseConsumers * pMarketShare * (1 + pPriceDeltaPct * pElasticity))

      const pAwareness = calcAwareness(pMarketing, params.marketing_config)
      pDemand *= (1 + pAwareness)

      const pWomBoost = ((pQuality / 2 - 2.5) / 2.5) * 0.05
      pDemand *= (1 + pWomBoost)

      const pShockMult = calcShockMultiplier(activeShocks ?? [], { ...decision, quality: pQuality }, playerId ?? '')
      pDemand *= pShockMult

      pDemand *= (1 + synergyBonus + dilutionIncoherent)
      pDemand = Math.max(0, pDemand)

      const pUnitsSold   = Math.min(Math.floor(pDemand), pProduction)
      const pInventory   = Math.max(0, pProduction - pUnitsSold)
      const pScaleFactor = getScaleFactor(pProduction, params.scale_factors)

      revenues        += pUnitsSold * pPrice
      productionCosts += pUnitsSold * pBaseCost * pScaleFactor
      inventoryCosts  += pInventory * params.inventory_config.storage_cost_per_unit
      marketingCosts  += pMarketing
      unitsSold       += pUnitsSold
      inventoryUnits  += pInventory
    }

    // Management cost: €50/extra-product/turn
    catalogCosts += extraProducts.length * (catalogConfig.management_cost_per_turn ?? 50)

    // Launch cost: €800 per newly introduced product type
    const prevProducts = prevResult?.position_data?.products ?? []
    for (const prod of extraProducts) {
      const pType = prod.product_type ?? ''
      if (pType && !prevProducts.includes(pType)) {
        catalogCosts += (catalogConfig.launch_cost ?? 800)
      }
    }
  }

  const totalCosts       = productionCosts + inventoryCosts + marketingCosts + catalogCosts
  const profit           = revenues - totalCosts
  const prevCumulative   = prevResult?.cumulative_profit ?? 0
  const cumulativeProfit = prevCumulative + profit

  // ── 11. Reputation update ─────────────────────────────────────────────────
  const prevQuality    = prevResult?.position_data?.quality ?? null
  const qualityChanged = prevQuality !== null && decision.quality !== prevQuality
  let newReputation
  if (prevQuality === null) {
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
  const launchedProducts = extraProducts.map(p => p.product_type ?? '').filter(Boolean)

  const positionData = {
    price:           decision.price,
    quality:         decision.quality,
    reputation:      newReputation,
    quality_changed: qualityChanged,
    products:        launchedProducts,
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
    demand_generated:  r2(unitsSold),
    revenues:          r2(revenues),
    production_costs:  r2(productionCosts),
    inventory_costs:   r2(inventoryCosts),
    marketing_costs:   r2(marketingCosts),
    catalog_costs:     r2(catalogCosts),
    profit:            r2(profit),
    cumulative_profit: r2(cumulativeProfit),
    reputation:        r4(newReputation),
    inventory_units:   inventoryUnits,
    position_data:     positionData,
    feedback_data:     feedbackData,
  }
}

function r2(n) { return Math.round(n * 100) / 100 }
function r4(n) { return Math.round(n * 10_000) / 10_000 }
