-- Migration number: 0014 
ALTER TABLE copilot_sessions ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'));
