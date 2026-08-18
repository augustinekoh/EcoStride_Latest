-- Add position column to users
ALTER TABLE users ADD COLUMN position TEXT;

-- Create authority_invitations table
CREATE TABLE IF NOT EXISTS authority_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0 CHECK (used IN (0, 1)),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_invitations_token ON authority_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_authority_invitations_email ON authority_invitations(email);
