-- ============================================================
-- Migration: 001_initial_schema
-- Mercato Vivo – full database schema + RLS policies
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROOMS
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
  room_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'lobby'
                       CHECK (status IN ('lobby', 'active', 'paused', 'completed')),
  current_turn       INT NOT NULL DEFAULT 0,
  num_turns          INT NOT NULL DEFAULT 6 CHECK (num_turns BETWEEN 2 AND 10),
  budget_initial     NUMERIC(10,2) NOT NULL DEFAULT 5000.00,
  complexity_level   INT NOT NULL DEFAULT 2 CHECK (complexity_level BETWEEN 1 AND 3),
  catalog_max        INT NOT NULL DEFAULT 3,
  join_code          TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  player_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id        UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname       TEXT NOT NULL,
  color          TEXT DEFAULT '#6366f1',
  budget_current NUMERIC(10,2) NOT NULL DEFAULT 5000.00,
  reputation     NUMERIC(5,4) NOT NULL DEFAULT 0.00 CHECK (reputation BETWEEN 0 AND 0.95),
  status         TEXT NOT NULL DEFAULT 'waiting'
                   CHECK (status IN ('waiting', 'deciding', 'confirmed', 'disconnected')),
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DECISIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS decisions (
  decision_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id    UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  room_id      UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  turn         INT NOT NULL,
  quality      INT NOT NULL DEFAULT 5 CHECK (quality BETWEEN 1 AND 10),
  price        NUMERIC(8,2) NOT NULL DEFAULT 20.00 CHECK (price BETWEEN 5 AND 50),
  marketing    NUMERIC(8,2) NOT NULL DEFAULT 0.00 CHECK (marketing BETWEEN 0 AND 500),
  production   INT NOT NULL DEFAULT 100 CHECK (production BETWEEN 0 AND 1000),
  -- products[] stores expanded catalog items as JSONB array
  -- each item: { product_type, quality, price, marketing, production }
  products     JSONB NOT NULL DEFAULT '[]'::JSONB,
  confirmed_at TIMESTAMPTZ,
  UNIQUE (player_id, turn)
);

-- ============================================================
-- RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS results (
  result_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id          UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  room_id            UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  turn               INT NOT NULL,
  demand_generated   NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenues           NUMERIC(10,2) NOT NULL DEFAULT 0,
  production_costs   NUMERIC(10,2) NOT NULL DEFAULT 0,
  inventory_costs    NUMERIC(10,2) NOT NULL DEFAULT 0,
  marketing_costs    NUMERIC(10,2) NOT NULL DEFAULT 0,
  profit             NUMERIC(10,2) NOT NULL DEFAULT 0,
  cumulative_profit  NUMERIC(10,2) NOT NULL DEFAULT 0,
  reputation         NUMERIC(5,4) NOT NULL DEFAULT 0,
  inventory_units    INT NOT NULL DEFAULT 0,
  -- position_data: { price, quality, reputation } for market map
  position_data      JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- feedback_data: level-specific insights
  feedback_data      JSONB NOT NULL DEFAULT '{}'::JSONB,
  calculated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, turn)
);

-- ============================================================
-- SHOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS shocks (
  shock_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id      UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  turn         INT NOT NULL,
  type         TEXT NOT NULL
                 CHECK (type IN ('seasonal','trend_shift','competitor','economic','supply_chain','viral')),
  intensity    TEXT NOT NULL DEFAULT 'moderate'
                 CHECK (intensity IN ('light','moderate','strong')),
  -- intensity_value: numeric multiplier, e.g. 0.1 = ±10%
  intensity_value NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  targeting    TEXT NOT NULL DEFAULT 'global'
                 CHECK (targeting IN ('global','segmental','selective')),
  -- targeting_params: { quality_tiers: [1,2,3] } or { player_ids: [...] }
  targeting_params JSONB NOT NULL DEFAULT '{}'::JSONB,
  duration     TEXT NOT NULL DEFAULT 'one_shot'
                 CHECK (duration IN ('one_shot','persistent','gradual')),
  turns_remaining INT NOT NULL DEFAULT 1,
  visibility   TEXT NOT NULL DEFAULT 'public'
                 CHECK (visibility IN ('public','silent')),
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PARAMETERS
-- ============================================================
CREATE TABLE IF NOT EXISTS parameters (
  param_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id            UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  complexity_level   INT NOT NULL CHECK (complexity_level BETWEEN 1 AND 3),
  -- elasticity_by_quality: { "q1_3": -1.8, "q4_6": -1.0, "q7_9": -0.4, "q10": -0.2 }
  elasticity_by_quality JSONB NOT NULL DEFAULT '{
    "q1_3": -1.8, "q4_6": -1.0, "q7_9": -0.4, "q10": -0.2
  }'::JSONB,
  -- costs_by_quality: { "q1_3": 3, "q4_6": 8, "q7_9": 15, "q10": 25 }
  costs_by_quality   JSONB NOT NULL DEFAULT '{
    "q1_3": 3, "q4_6": 8, "q7_9": 15, "q10": 25
  }'::JSONB,
  -- scale_factors: { "tier1": 1.0, "tier2": 0.95, "tier3": 0.90, "tier4": 0.85 }
  -- tier1: 0-50, tier2: 51-150, tier3: 151-300, tier4: 300+
  scale_factors      JSONB NOT NULL DEFAULT '{
    "tier1": 1.0, "tier2": 0.95, "tier3": 0.90, "tier4": 0.85
  }'::JSONB,
  -- reputation_config
  reputation_config  JSONB NOT NULL DEFAULT '{
    "growth_per_turn": 0.15,
    "cap": 0.95,
    "price_premium_factor": 0.15,
    "loss_on_quality_change": 1.0,
    "demand_penalty_on_reset": 0.20
  }'::JSONB,
  -- marketing_config: diminishing returns breakpoints
  marketing_config   JSONB NOT NULL DEFAULT '{
    "breakpoints": [0, 100, 300, 600],
    "rates": [0.005, 0.003, 0.0015, 0.0005]
  }'::JSONB,
  -- catalog_config
  catalog_config     JSONB NOT NULL DEFAULT '{
    "launch_cost": 800,
    "management_cost_per_turn": 50,
    "synergy_bonus": 0.08,
    "dilution_base": -0.04,
    "dilution_incoherent": -0.10,
    "unlock_turn": 3
  }'::JSONB,
  -- inventory_config
  inventory_config   JSONB NOT NULL DEFAULT '{
    "storage_cost_per_unit": 0.50,
    "overflow_threshold": 200,
    "overflow_demand_penalty": 0.05
  }'::JSONB,
  -- market_config: base consumers, segmentation
  market_config      JSONB NOT NULL DEFAULT '{
    "base_consumers": 800,
    "segments": {
      "price_hunters": 0.25,
      "value_seekers": 0.45,
      "quality_focused": 0.20,
      "trendsetters": 0.10
    }
  }'::JSONB,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, complexity_level)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_players_room_id    ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_decisions_player_id ON decisions(player_id);
CREATE INDEX IF NOT EXISTS idx_decisions_room_turn  ON decisions(room_id, turn);
CREATE INDEX IF NOT EXISTS idx_results_player_id   ON results(player_id);
CREATE INDEX IF NOT EXISTS idx_results_room_turn    ON results(room_id, turn);
CREATE INDEX IF NOT EXISTS idx_shocks_room_turn     ON shocks(room_id, turn);
CREATE INDEX IF NOT EXISTS idx_parameters_room_id  ON parameters(room_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE rooms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE players    ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shocks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;

-- ---------- ROOMS ----------
-- Anyone authenticated can read rooms (to join via code)
CREATE POLICY "rooms_select_authenticated"
  ON rooms FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only admin of the room can update it
CREATE POLICY "rooms_update_admin"
  ON rooms FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid());

-- Any authenticated user can create a room (they become admin)
CREATE POLICY "rooms_insert_authenticated"
  ON rooms FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());

-- Admin can delete their room
CREATE POLICY "rooms_delete_admin"
  ON rooms FOR DELETE
  TO authenticated
  USING (admin_id = auth.uid());

-- ---------- PLAYERS ----------
-- Players in a room can see all other players in that room
CREATE POLICY "players_select_room_members"
  ON players FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
      UNION
      SELECT room_id FROM rooms   WHERE admin_id = auth.uid()
    )
  );

-- A user can insert themselves as a player
CREATE POLICY "players_insert_self"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- A player can update their own record; admin can update any player in their room
CREATE POLICY "players_update_self_or_admin"
  ON players FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR room_id IN (SELECT room_id FROM rooms WHERE admin_id = auth.uid())
  );

-- Allow anonymous users to insert themselves (student join flow)
CREATE POLICY "players_insert_anon"
  ON players FOR INSERT
  TO anon
  WITH CHECK (TRUE);

CREATE POLICY "players_select_anon"
  ON players FOR SELECT
  TO anon
  USING (TRUE);

-- ---------- DECISIONS ----------
-- A player can see only their own decisions; admin can see all in their room
CREATE POLICY "decisions_select_own_or_admin"
  ON decisions FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT player_id FROM players WHERE user_id = auth.uid())
    OR room_id IN (SELECT room_id FROM rooms WHERE admin_id = auth.uid())
  );

-- A player can insert/update their own decisions
CREATE POLICY "decisions_insert_own"
  ON decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id IN (SELECT player_id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "decisions_update_own"
  ON decisions FOR UPDATE
  TO authenticated
  USING (
    player_id IN (SELECT player_id FROM players WHERE user_id = auth.uid())
  );

-- ---------- RESULTS ----------
-- All room members can see all results (post-turn reveal)
CREATE POLICY "results_select_room_members"
  ON results FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
      UNION
      SELECT room_id FROM rooms   WHERE admin_id = auth.uid()
    )
  );

-- Only service role (edge functions) inserts results; expose via policy for anon reads
CREATE POLICY "results_insert_service"
  ON results FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- ---------- SHOCKS ----------
-- All room members can see non-silent shocks; admin sees all
CREATE POLICY "shocks_select_room_members"
  ON shocks FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
      UNION
      SELECT room_id FROM rooms   WHERE admin_id = auth.uid()
    )
    AND (
      visibility = 'public'
      OR room_id IN (SELECT room_id FROM rooms WHERE admin_id = auth.uid())
    )
  );

-- Only admin can create/update/delete shocks
CREATE POLICY "shocks_manage_admin"
  ON shocks FOR ALL
  TO authenticated
  USING (room_id IN (SELECT room_id FROM rooms WHERE admin_id = auth.uid()))
  WITH CHECK (room_id IN (SELECT room_id FROM rooms WHERE admin_id = auth.uid()));

-- ---------- PARAMETERS ----------
-- Room members can read parameters; only admin can write
CREATE POLICY "parameters_select_room_members"
  ON parameters FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
      UNION
      SELECT room_id FROM rooms   WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY "parameters_manage_admin"
  ON parameters FOR ALL
  TO authenticated
  USING (room_id IN (SELECT room_id FROM rooms WHERE admin_id = auth.uid()))
  WITH CHECK (room_id IN (SELECT room_id FROM rooms WHERE admin_id = auth.uid()));

-- ============================================================
-- DEFAULT PARAMETERS FUNCTION
-- Inserts all 3 complexity level parameter rows for a new room
-- ============================================================
CREATE OR REPLACE FUNCTION insert_default_parameters(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO parameters (room_id, complexity_level)
  VALUES
    (p_room_id, 1),
    (p_room_id, 2),
    (p_room_id, 3)
  ON CONFLICT (room_id, complexity_level) DO NOTHING;
END;
$$;

-- Trigger: auto-insert default parameters when a room is created
CREATE OR REPLACE FUNCTION trigger_insert_default_parameters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM insert_default_parameters(NEW.room_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER rooms_after_insert_parameters
  AFTER INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_insert_default_parameters();
