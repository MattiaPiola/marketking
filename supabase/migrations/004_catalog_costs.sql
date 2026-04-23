-- ============================================================
-- Migration: 004_catalog_costs
-- Adds catalog_costs column to results for Session 8
-- (management + launch costs from expandable catalog)
-- ============================================================

ALTER TABLE results ADD COLUMN IF NOT EXISTS catalog_costs NUMERIC(10,2) NOT NULL DEFAULT 0;
