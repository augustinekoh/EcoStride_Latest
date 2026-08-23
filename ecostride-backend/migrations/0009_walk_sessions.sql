-- Create walk_sessions table for Walk Mode tracking
CREATE TABLE walk_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  distance_km REAL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  coins_awarded INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_walk_sessions_user_id ON walk_sessions(user_id);
CREATE INDEX idx_walk_sessions_status ON walk_sessions(status);
