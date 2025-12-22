-- Migration: Implement Anki SM-2 Scheduler
-- Date: 2025-01-22
-- Description: Add fields and settings for full Anki-like SM-2 scheduling algorithm

-- ============================================================================
-- STEP 1: Update cards table
-- ============================================================================

-- Add 'relearning' state to cards
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_state_check;
ALTER TABLE cards ADD CONSTRAINT cards_state_check
  CHECK (state IN ('new', 'learning', 'review', 'relearning'));

-- Add learning_step_index to track position in learning/relearning steps
ALTER TABLE cards ADD COLUMN IF NOT EXISTS learning_step_index INTEGER NOT NULL DEFAULT 0;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_cards_state_due ON cards(state, due_at) WHERE NOT suspended;

-- ============================================================================
-- STEP 2: Extend reviews table with more detailed logging
-- ============================================================================

-- Add columns to reviews for detailed audit trail
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS elapsed_ms INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS previous_state TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS previous_interval INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS new_interval INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS new_due_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 3: Add scheduler settings to settings table
-- ============================================================================

-- Learning settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS learning_steps TEXT NOT NULL DEFAULT '1m 10m';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS relearning_steps TEXT NOT NULL DEFAULT '10m';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS graduating_interval_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS easy_interval_days INTEGER NOT NULL DEFAULT 4;

-- Ease factor settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS starting_ease DECIMAL(3,2) NOT NULL DEFAULT 2.50;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS easy_bonus DECIMAL(3,2) NOT NULL DEFAULT 1.30;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS hard_interval DECIMAL(3,2) NOT NULL DEFAULT 1.20;

-- Interval settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS interval_modifier DECIMAL(3,2) NOT NULL DEFAULT 1.00;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS new_interval_multiplier DECIMAL(3,2) NOT NULL DEFAULT 0.00;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS minimum_interval_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS maximum_interval_days INTEGER NOT NULL DEFAULT 36500;

-- ============================================================================
-- STEP 4: Update default settings for existing users
-- ============================================================================

-- Update existing settings rows with default Anki values
UPDATE settings SET
  learning_steps = '1m 10m',
  relearning_steps = '10m',
  graduating_interval_days = 1,
  easy_interval_days = 4,
  starting_ease = 2.50,
  easy_bonus = 1.30,
  hard_interval = 1.20,
  interval_modifier = 1.00,
  new_interval_multiplier = 0.00,
  minimum_interval_days = 1,
  maximum_interval_days = 36500
WHERE learning_steps IS NULL;

-- ============================================================================
-- STEP 5: Update create_default_settings function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings (
    user_id,
    new_cards_per_day,
    max_reviews_per_day,
    learning_mode,
    again_delay_minutes,
    review_order,
    learning_steps,
    relearning_steps,
    graduating_interval_days,
    easy_interval_days,
    starting_ease,
    easy_bonus,
    hard_interval,
    interval_modifier,
    new_interval_multiplier,
    minimum_interval_days,
    maximum_interval_days
  ) VALUES (
    NEW.id,
    20,
    9999,
    'normal',
    10,
    'mixed',
    '1m 10m',
    '10m',
    1,
    4,
    2.50,
    1.30,
    1.20,
    1.00,
    0.00,
    1,
    36500
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN cards.learning_step_index IS 'Current position in learning/relearning steps (0-indexed)';
COMMENT ON COLUMN cards.state IS 'SRS state: new=never studied, learning=in learning steps, review=graduated, relearning=lapsed';

COMMENT ON COLUMN reviews.elapsed_ms IS 'Time taken to answer card in milliseconds';
COMMENT ON COLUMN reviews.previous_state IS 'Card state before this review';
COMMENT ON COLUMN reviews.previous_interval IS 'Interval in days before this review';
COMMENT ON COLUMN reviews.new_interval IS 'Interval in days after this review';
COMMENT ON COLUMN reviews.new_due_at IS 'Due date after this review';

COMMENT ON COLUMN settings.learning_steps IS 'Learning steps (e.g., "1m 10m 1d") - space-separated';
COMMENT ON COLUMN settings.relearning_steps IS 'Relearning steps for lapsed cards (e.g., "10m")';
COMMENT ON COLUMN settings.graduating_interval_days IS 'Interval when graduating from learning (default: 1 day)';
COMMENT ON COLUMN settings.easy_interval_days IS 'Interval when pressing Easy on a new card (default: 4 days)';
COMMENT ON COLUMN settings.starting_ease IS 'Starting ease factor for new cards (default: 2.50 = 250%)';
COMMENT ON COLUMN settings.easy_bonus IS 'Multiplier for Easy button on review cards (default: 1.30)';
COMMENT ON COLUMN settings.hard_interval IS 'Multiplier for Hard button on review cards (default: 1.20)';
COMMENT ON COLUMN settings.interval_modifier IS 'Global interval modifier (default: 1.00 = 100%)';
COMMENT ON COLUMN settings.new_interval_multiplier IS 'Multiplier for Again on review cards (default: 0.00 = minimum interval)';
COMMENT ON COLUMN settings.minimum_interval_days IS 'Minimum interval for graduated cards (default: 1 day)';
COMMENT ON COLUMN settings.maximum_interval_days IS 'Maximum interval cap (default: 36500 = 100 years)';
