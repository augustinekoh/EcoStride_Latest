-- Migration number: 0008 	 2026-08-22T00:00:00.000Z

CREATE TABLE IF NOT EXISTS user_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_token ON user_devices(fcm_token);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id TEXT PRIMARY KEY,
  push_enabled INTEGER DEFAULT 1,
  mailbox_enabled INTEGER DEFAULT 1,
  social_enabled INTEGER DEFAULT 1,
  news_enabled INTEGER DEFAULT 0,
  daily_reminder_enabled INTEGER DEFAULT 1,
  new_follower_enabled INTEGER DEFAULT 1,
  last_notified_at INTEGER DEFAULT 0,
  pending_notifications_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE mail ADD COLUMN notification_type TEXT;
ALTER TABLE mail ADD COLUMN notification_priority TEXT DEFAULT 'normal';
ALTER TABLE mail ADD COLUMN notification_sent INTEGER DEFAULT 0;
