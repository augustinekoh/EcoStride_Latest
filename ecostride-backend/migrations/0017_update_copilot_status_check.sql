-- Migration number: 0017
-- Disable foreign key constraints temporarily
PRAGMA foreign_keys=OFF;

-- Create a new table with the updated CHECK constraint
CREATE TABLE copilot_sessions_new (
  id TEXT PRIMARY KEY,
  authority_id TEXT NOT NULL,
  last_interaction_id TEXT,
  title TEXT NOT NULL,
  selected_report_ids TEXT,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'investigating', 'active', 'completed', 'archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (authority_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Copy data from the old table
INSERT INTO copilot_sessions_new (id, authority_id, last_interaction_id, title, selected_report_ids, status, created_at, updated_at)
SELECT id, authority_id, last_interaction_id, title, selected_report_ids, status, created_at, updated_at FROM copilot_sessions;

-- Drop the old table
DROP TABLE copilot_sessions;

-- Rename the new table to the original name
ALTER TABLE copilot_sessions_new RENAME TO copilot_sessions;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_authority ON copilot_sessions(authority_id);
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_updated ON copilot_sessions(updated_at DESC);

-- Re-enable foreign key constraints
PRAGMA foreign_keys=ON;
