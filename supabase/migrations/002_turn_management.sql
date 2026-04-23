-- ============================================================
-- Migration: 002_turn_management
-- Adds turn timing support and service-role write policies
-- needed by the calculate-turn Edge Function.
-- ============================================================

-- ── rooms: timer support ──────────────────────────────────────────────────────
-- Stores the timestamp at which the current turn expires (NULL = no timer).
-- Set by the admin when starting a timed turn; checked by the Edge Function.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_ends_at TIMESTAMPTZ;

-- ── results: allow service role to UPDATE (recalculation) ─────────────────────
CREATE POLICY "results_update_service"
  ON results FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ── players: allow service role to UPDATE budget & status ─────────────────────
-- (The calculate-turn function updates budget_current after each turn.)
CREATE POLICY "players_update_service"
  ON players FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ── decisions: allow service role to UPDATE (lock after turn ends) ────────────
CREATE POLICY "decisions_update_service"
  ON decisions FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ── shocks: allow service role to UPDATE turns_remaining / is_active ──────────
CREATE POLICY "shocks_update_service"
  ON shocks FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
