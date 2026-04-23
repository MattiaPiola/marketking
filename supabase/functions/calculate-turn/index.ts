/**
 * calculate-turn  –  Supabase Edge Function
 *
 * Called by the admin after all (or enough) players have submitted decisions.
 * Runs the demand/profit engine for every player and writes results.
 *
 * POST body: { room_id: string, turn: number }
 *
 * Auth: caller must be the room's admin (JWT validated via user client).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calculateTurnResults } from '../_shared/engine.ts'
import type { Decision, Parameters, PreviousResult, ActiveShock } from '../_shared/engine.ts'

// ── Supabase clients ─────────────────────────────────────────────────────────

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Service-role client – bypasses RLS for writes
const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── CORS helpers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── 1. Parse & validate input ─────────────────────────────────────────────
  let body: { room_id?: string; turn?: number }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { room_id, turn } = body
  if (!room_id || typeof turn !== 'number' || turn < 1) {
    return jsonResponse({ error: 'room_id and turn (≥1) are required' }, 400)
  }

  // ── 2. Authenticate caller as room admin ──────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const userDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authErr } = await userDb.auth.getUser()
  if (authErr || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const { data: room, error: roomErr } = await adminDb
    .from('rooms')
    .select('room_id, admin_id, status, current_turn, num_turns, complexity_level, budget_initial')
    .eq('room_id', room_id)
    .single()

  if (roomErr || !room) {
    return jsonResponse({ error: 'Room not found' }, 404)
  }

  if (room.admin_id !== user.id) {
    return jsonResponse({ error: 'Forbidden: only the room admin can calculate turns' }, 403)
  }

  if (room.status !== 'active' && room.status !== 'paused') {
    return jsonResponse({ error: `Room status is '${room.status}', expected 'active'` }, 409)
  }

  if (room.current_turn !== turn) {
    return jsonResponse({
      error: `Room is on turn ${room.current_turn}, requested ${turn}`,
    }, 409)
  }

  // ── 3. Fetch decisions for this turn ──────────────────────────────────────
  const { data: decisions, error: decErr } = await adminDb
    .from('decisions')
    .select('decision_id, player_id, quality, price, marketing, production, products, confirmed_at')
    .eq('room_id', room_id)
    .eq('turn', turn)

  if (decErr) {
    return jsonResponse({ error: `Failed to fetch decisions: ${decErr.message}` }, 500)
  }

  if (!decisions || decisions.length === 0) {
    return jsonResponse({ error: 'No decisions found for this turn' }, 422)
  }

  // ── 4. Fetch game parameters for this room's complexity level ─────────────
  const { data: paramsRow, error: paramsErr } = await adminDb
    .from('parameters')
    .select('*')
    .eq('room_id', room_id)
    .eq('complexity_level', room.complexity_level)
    .single()

  if (paramsErr || !paramsRow) {
    return jsonResponse({ error: 'Parameters not found for this room/level' }, 500)
  }

  const params: Parameters = {
    elasticity_by_quality: paramsRow.elasticity_by_quality,
    costs_by_quality:      paramsRow.costs_by_quality,
    scale_factors:         paramsRow.scale_factors,
    reputation_config:     paramsRow.reputation_config,
    marketing_config:      paramsRow.marketing_config,
    inventory_config:      paramsRow.inventory_config,
    market_config:         paramsRow.market_config,
  }

  // ── 5. Fetch previous-turn results (for reputation & inventory carry-over) ─
  const prevTurn = turn - 1
  const playerIds = decisions.map((d) => d.player_id)

  let prevResultsMap: Record<string, PreviousResult> = {}
  if (prevTurn >= 1) {
    const { data: prevResults } = await adminDb
      .from('results')
      .select('player_id, reputation, inventory_units, cumulative_profit, position_data')
      .eq('room_id', room_id)
      .eq('turn', prevTurn)
      .in('player_id', playerIds)

    for (const r of prevResults ?? []) {
      prevResultsMap[r.player_id] = r as PreviousResult
    }
  }

  // ── 6. Fetch active shocks for this turn ──────────────────────────────────
  const { data: shocksRaw } = await adminDb
    .from('shocks')
    .select('shock_id, intensity_value, type, targeting, targeting_params, turns_remaining')
    .eq('room_id', room_id)
    .eq('is_active', true)
    .lte('turn', turn) // shock was scheduled for this turn or earlier, and is_active=true (turns_remaining > 0)

  const activeShocks: ActiveShock[] = (shocksRaw ?? []).map((s) => ({
    shock_id:         s.shock_id,
    intensity_value:  Number(s.intensity_value),
    type:             s.type,
    targeting:        s.targeting,
    targeting_params: s.targeting_params,
  }))

  // ── 7. Calculate results per player ───────────────────────────────────────
  const resultsToInsert: Array<Record<string, unknown>> = []

  for (const dec of decisions) {
    const decision: Decision = {
      quality:    Number(dec.quality),
      price:      Number(dec.price),
      marketing:  Number(dec.marketing),
      production: Number(dec.production),
      products:   (dec.products ?? []) as unknown[],
    }

    const prevResult: PreviousResult | null = prevResultsMap[dec.player_id] ?? null

    const result = calculateTurnResults(
      decision,
      params,
      prevResult,
      activeShocks,
      Number(room.complexity_level),
      dec.player_id,
    )

    resultsToInsert.push({
      player_id:         dec.player_id,
      room_id,
      turn,
      demand_generated:  result.demand_generated,
      revenues:          result.revenues,
      production_costs:  result.production_costs,
      inventory_costs:   result.inventory_costs,
      marketing_costs:   result.marketing_costs,
      profit:            result.profit,
      cumulative_profit: result.cumulative_profit,
      reputation:        result.reputation,
      inventory_units:   result.inventory_units,
      position_data:     result.position_data,
      feedback_data:     result.feedback_data,
    })
  }

  // ── 8. Upsert results ─────────────────────────────────────────────────────
  const { error: insertErr } = await adminDb
    .from('results')
    .upsert(resultsToInsert, { onConflict: 'player_id,turn' })

  if (insertErr) {
    return jsonResponse({ error: `Failed to insert results: ${insertErr.message}` }, 500)
  }

  // ── 9. Update player budgets (budget_current += profit) ───────────────────
  // Batch fetch all current budgets in one query, then update concurrently.
  const { data: currentPlayers } = await adminDb
    .from('players')
    .select('player_id, budget_current')
    .in('player_id', playerIds)

  const budgetMap: Record<string, number> = {}
  for (const p of currentPlayers ?? []) {
    budgetMap[p.player_id] = Number(p.budget_current)
  }

  await Promise.all(
    resultsToInsert.map((res) => {
      const currentBudget = budgetMap[res.player_id as string] ?? 0
      const newBudget = currentBudget + Number(res.profit)
      return adminDb
        .from('players')
        .update({ budget_current: newBudget })
        .eq('player_id', res.player_id as string)
    }),
  )

  // ── 10. Decrement active shocks' turns_remaining; deactivate expired ones ──
  // Partition shocks into expired (turns_remaining <= 1) and still-active,
  // then batch-update each group with a single query.
  const shocks = shocksRaw ?? []
  const expiredIds   = shocks.filter((s) => Number(s.turns_remaining) <= 1).map((s) => s.shock_id)
  const persistentShocks = shocks.filter((s) => Number(s.turns_remaining) > 1)

  const shockUpdates: Array<Promise<unknown>> = []

  if (expiredIds.length > 0) {
    shockUpdates.push(
      adminDb
        .from('shocks')
        .update({ is_active: false, turns_remaining: 0 })
        .in('shock_id', expiredIds),
    )
  }

  // Persistent shocks each have their own new turns_remaining value,
  // so we still run one UPDATE per distinct remaining value, but concurrently.
  for (const shock of persistentShocks) {
    shockUpdates.push(
      adminDb
        .from('shocks')
        .update({ turns_remaining: Number(shock.turns_remaining) - 1 })
        .eq('shock_id', shock.shock_id),
    )
  }

  await Promise.all(shockUpdates)

  // ── 11. Return summary ────────────────────────────────────────────────────
  return jsonResponse({
    ok: true,
    turn,
    room_id,
    players_calculated: resultsToInsert.length,
    results: resultsToInsert.map((r) => ({
      player_id:         r.player_id,
      demand_generated:  r.demand_generated,
      revenues:          r.revenues,
      profit:            r.profit,
      cumulative_profit: r.cumulative_profit,
    })),
  })
})
