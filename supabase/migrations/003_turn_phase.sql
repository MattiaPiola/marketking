-- ============================================================
-- Migration: 003_turn_phase
-- Adds turn_phase column to rooms and relaxes constraint on
-- decisions to allow custom values beyond the original limits.
-- Also adds a service-role INSERT policy for results.
-- ============================================================

-- ── rooms: track phase within a turn ─────────────────────────────────────────
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_phase TEXT NOT NULL DEFAULT 'deciding'
  CHECK (turn_phase IN ('deciding', 'results'));

-- ── decisions: relax constraints to allow custom values ──────────────────────
ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_price_check;
ALTER TABLE decisions ADD CONSTRAINT decisions_price_check CHECK (price > 0);

ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_marketing_check;
ALTER TABLE decisions ADD CONSTRAINT decisions_marketing_check CHECK (marketing >= 0);

ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_production_check;
ALTER TABLE decisions ADD CONSTRAINT decisions_production_check CHECK (production >= 0);

-- ── results: allow service role to INSERT (Edge Function writes results) ──────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'results'
      AND policyname = 'results_insert_service'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "results_insert_service"
        ON results FOR INSERT
        TO service_role
        WITH CHECK (TRUE)
    $policy$;
  END IF;
END;
$$;
