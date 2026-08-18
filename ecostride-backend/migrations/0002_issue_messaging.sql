-- Migration: Issue messaging and extending reports table

ALTER TABLE infrastructure_reports ADD COLUMN authority_id TEXT;
ALTER TABLE infrastructure_reports ADD COLUMN deleted_at INTEGER;

CREATE INDEX idx_reports_lat_lng ON infrastructure_reports(lat, lng);
CREATE INDEX idx_reports_authority_id ON infrastructure_reports(authority_id);

CREATE TABLE IF NOT EXISTS issue_messages (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL,
  sender_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (issue_id) REFERENCES infrastructure_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_issue_messages_issue_id ON issue_messages(issue_id);
