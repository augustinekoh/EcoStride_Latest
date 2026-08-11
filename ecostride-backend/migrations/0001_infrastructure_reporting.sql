-- Migration: infrastructure reporting tables (reports + authority tasks)
-- Apply with:
--   wrangler d1 migrations apply <DB_NAME> --local
--   wrangler d1 migrations apply <DB_NAME> --remote

CREATE TABLE infrastructure_reports (
  id                  TEXT PRIMARY KEY,
  author_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  lng                 REAL NOT NULL,
  lat                 REAL NOT NULL,
  photos              TEXT,             -- JSON array, up to 3 R2 image URLs
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in-progress', 'resolved')),
  authority_response  TEXT,
  created_at          INTEGER NOT NULL, -- unix ms
  updated_at          INTEGER NOT NULL, -- unix ms
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_reports_status ON infrastructure_reports(status);
CREATE INDEX idx_reports_created_at ON infrastructure_reports(created_at);

CREATE TABLE authority_tasks (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT,
  scheduled_at        INTEGER NOT NULL, -- unix ms
  completed           INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_by          TEXT NOT NULL,
  created_at          INTEGER NOT NULL, -- unix ms
  updated_at          INTEGER NOT NULL, -- unix ms
  deleted_at          INTEGER,          -- unix ms (NULL if not deleted)
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_tasks_scheduled_at ON authority_tasks(scheduled_at);
CREATE INDEX idx_tasks_completed ON authority_tasks(completed);
CREATE INDEX idx_tasks_deleted_at ON authority_tasks(deleted_at);
