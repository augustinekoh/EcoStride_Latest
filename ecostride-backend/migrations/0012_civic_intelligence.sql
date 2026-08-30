-- Migration number: 0012 	 2026-08-27T00:00:00.000Z

-- Add AI fields to infrastructure_reports
ALTER TABLE infrastructure_reports ADD COLUMN ai_refined_description TEXT;
ALTER TABLE infrastructure_reports ADD COLUMN ai_recommendation TEXT;
ALTER TABLE infrastructure_reports ADD COLUMN ai_confidence_score REAL;
ALTER TABLE infrastructure_reports ADD COLUMN ai_processed_at INTEGER;

-- Create copilot_sessions table
CREATE TABLE IF NOT EXISTS copilot_sessions (
  id TEXT PRIMARY KEY,
  authority_id TEXT NOT NULL,
  last_interaction_id TEXT,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (authority_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_authority ON copilot_sessions(authority_id);
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_updated ON copilot_sessions(updated_at DESC);

-- Create copilot_messages table
CREATE TABLE IF NOT EXISTS copilot_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'model')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES copilot_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_session ON copilot_messages(session_id, timestamp ASC);

-- Create copilot_socket_tickets table
CREATE TABLE IF NOT EXISTS copilot_socket_tickets (
  id TEXT PRIMARY KEY,
  authority_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  FOREIGN KEY (authority_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id) REFERENCES copilot_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_copilot_socket_tickets_session ON copilot_socket_tickets(session_id);
