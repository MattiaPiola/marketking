-- ============================================================
-- Migration: 005_add_admin_id_to_rooms
-- Ensures the admin_id column exists on the rooms table.
-- This migration is idempotent: it is safe to run even if
-- admin_id was already created by migration 001.
-- Triggers a PostgREST schema-cache reload so the column
-- becomes visible immediately without a manual restart.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'rooms'
      AND  column_name  = 'admin_id'
  ) THEN
    ALTER TABLE rooms
      ADD COLUMN admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Reload PostgREST schema cache so the column is recognised
-- without requiring a manual service restart.
NOTIFY pgrst, 'reload schema';
