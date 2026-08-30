
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT,
  guild_id TEXT,
  role TEXT DEFAULT 'user',
  coins INTEGER DEFAULT 0,
  total_distance_km REAL DEFAULT 0,
  total_trees_planted INTEGER DEFAULT 0,
  player_id TEXT,
  created_at INTEGER,
  verified_email INTEGER DEFAULT 0,
  banned_until INTEGER,
  muted_until INTEGER,
  avatar TEXT,
  bio TEXT,
  country TEXT,
  state TEXT,
  city TEXT,
  position TEXT,
  unlocked_badges TEXT,
  read_mails TEXT,
  showcased_badges TEXT,
  session_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_player_id ON users(player_id);
CREATE INDEX IF NOT EXISTS idx_users_jurisdiction ON users(country, state, city);

CREATE TABLE IF NOT EXISTS activity_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  distance REAL NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trees (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  guild_id TEXT,
  planted_at INTEGER NOT NULL,
  FOREIGN KEY(author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS point_store (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  category TEXT,
  name TEXT NOT NULL,
  desc TEXT,
  price INTEGER NOT NULL,
  stock INTEGER DEFAULT -1,
  icon TEXT,
  status TEXT DEFAULT 'active',
  link TEXT
);

CREATE TABLE IF NOT EXISTS global_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signposts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  message TEXT,
  emoji TEXT,
  category TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  likes INTEGER DEFAULT 0,
  liked_by TEXT DEFAULT '[]',
  images TEXT DEFAULT '[]',
  FOREIGN KEY(author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  merchant_id TEXT,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  purchased_at INTEGER NOT NULL,
  redeemed_at INTEGER,
  expires_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(item_id) REFERENCES point_store(id)
);

CREATE TABLE IF NOT EXISTS mail (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_id TEXT,
  recipient_name TEXT,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT,
  expires_for_new_users INTEGER NOT NULL,
  action_type TEXT,
  action_data TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  menu_link TEXT,
  location TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS demo_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  status TEXT NOT NULL,
  requested_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS store_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'ðŸŒ',
  nationality TEXT DEFAULT 'Global',
  require_approval INTEGER DEFAULT 0,
  admin_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guilds_name ON guilds(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  is_edited INTEGER DEFAULT 0,
  attachment_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_guild_timestamp ON chat_messages(guild_id, timestamp);

CREATE TABLE IF NOT EXISTS friends (
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  status TEXT DEFAULT 'accepted',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(friend_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_deleted_mail (
  user_id TEXT NOT NULL,
  mail_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, mail_id),
  FOREIGN KEY(mail_id) REFERENCES mail(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_read_mail (
  user_id TEXT NOT NULL,
  mail_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, mail_id),
  FOREIGN KEY(mail_id) REFERENCES mail(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_chat_reads (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS infrastructure_reports (
  id                  TEXT PRIMARY KEY,
  author_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  lng                 REAL NOT NULL,
  lat                 REAL NOT NULL,
  photos              TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved')),
  severity            TEXT DEFAULT 'Minor' CHECK (severity IN ('Minor', 'Major', 'Critical')),
  authority_id        TEXT,
  authority_response  TEXT,
  ai_refined_description TEXT,
  ai_recommendation   TEXT,
  ai_confidence_score REAL,
  ai_processed_at     INTEGER,
  specific_location   TEXT,
  country             TEXT,
  state               TEXT,
  city                TEXT,
  takedown_status     TEXT,
  takedown_reason     TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  resolved_at         INTEGER,
  deleted_at          INTEGER,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON infrastructure_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON infrastructure_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_lat_lng ON infrastructure_reports(lat, lng);
CREATE INDEX IF NOT EXISTS idx_reports_authority_id ON infrastructure_reports(authority_id);
CREATE INDEX IF NOT EXISTS idx_reports_jurisdiction ON infrastructure_reports(country, state, city);

CREATE TABLE IF NOT EXISTS authority_tasks (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT,
  importance          TEXT DEFAULT 'Medium' CHECK (importance IN ('Low', 'Medium', 'High')),
  scheduled_at        INTEGER NOT NULL,
  completed           INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_by          TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  deleted_at          INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON authority_tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON authority_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON authority_tasks(deleted_at);

CREATE TABLE IF NOT EXISTS issue_messages (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL,
  sender_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  image_url   TEXT,
  FOREIGN KEY (issue_id) REFERENCES infrastructure_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_issue_messages_issue_id ON issue_messages(issue_id);

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
CREATE INDEX IF NOT EXISTS idx_report_activity_report_created ON report_activity(report_id, created_at);

CREATE TABLE IF NOT EXISTS authority_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0 CHECK (used IN (0, 1)),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  country TEXT,
  state TEXT,
  city TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_invitations_token ON authority_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_authority_invitations_email ON authority_invitations(email);


CREATE TABLE IF NOT EXISTS city_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  start_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL,
  entry_fee INTEGER DEFAULT 0,
  promo_image TEXT,
  event_type TEXT NOT NULL,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS city_event_badges (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT NOT NULL,
  tier_level INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  FOREIGN KEY(event_id) REFERENCES city_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS city_event_participants (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  starting_score INTEGER DEFAULT 0,
  badges_awarded TEXT DEFAULT '[]',
  FOREIGN KEY(event_id) REFERENCES city_events(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS city_event_submissions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  proof_url TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(event_id) REFERENCES city_events(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

CREATE INDEX IF NOT EXISTS idx_merchants_owner_id ON merchants(owner_id);
CREATE INDEX IF NOT EXISTS idx_purchases_merchant_id ON purchases(merchant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_point_store_merchant_id ON point_store(merchant_id);

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

CREATE TABLE IF NOT EXISTS copilot_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'model')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES copilot_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_session ON copilot_messages(session_id, timestamp ASC);

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
