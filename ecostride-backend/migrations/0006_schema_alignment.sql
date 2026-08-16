-- Migration 0006: Schema Alignment & Column Consistency Fixes

-- 1. Create user_read_mail table if not present
CREATE TABLE IF NOT EXISTS user_read_mail (
  user_id TEXT NOT NULL,
  mail_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, mail_id),
  FOREIGN KEY (mail_id) REFERENCES mail(id) ON DELETE CASCADE
);

-- 2. Create report_activity table if not present
CREATE TABLE IF NOT EXISTS report_activity (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (report_id) REFERENCES infrastructure_reports(id) ON DELETE CASCADE
);

-- 3. Add image_url to issue_messages
ALTER TABLE issue_messages ADD COLUMN image_url TEXT;

-- 4. Ensure indexes for chat and activity performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_guild_timestamp ON chat_messages(guild_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_issue_messages_created ON issue_messages(issue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_report_activity_report_created ON report_activity(report_id, created_at);
