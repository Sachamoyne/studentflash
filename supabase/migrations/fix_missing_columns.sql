-- Add missing columns to decks table
ALTER TABLE decks
ADD COLUMN IF NOT EXISTS parent_deck_id UUID REFERENCES decks(id) ON DELETE CASCADE;

-- Add missing column to cards table
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS learning_step_index INTEGER NOT NULL DEFAULT 0;

-- Update state constraint to include 'relearning'
ALTER TABLE cards
DROP CONSTRAINT IF EXISTS cards_state_check;

ALTER TABLE cards
ADD CONSTRAINT cards_state_check
CHECK (state IN ('new', 'learning', 'review', 'relearning'));

-- Add missing columns to reviews table for detailed tracking
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS elapsed_ms INTEGER,
ADD COLUMN IF NOT EXISTS previous_state TEXT,
ADD COLUMN IF NOT EXISTS previous_interval INTEGER,
ADD COLUMN IF NOT EXISTS new_interval INTEGER,
ADD COLUMN IF NOT EXISTS new_due_at TIMESTAMPTZ;

-- Create index on parent_deck_id for performance
CREATE INDEX IF NOT EXISTS idx_decks_parent_deck_id ON decks(parent_deck_id);
