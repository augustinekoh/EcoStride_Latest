
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
  nationality TEXT,
  unlocked_badges TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_player_id ON users(player_id);

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
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(item_id) REFERENCES point_store(id)
);

CREATE TABLE IF NOT EXISTS mail (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sender TEXT NOT NULL,
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
  icon TEXT DEFAULT '🌍',
  nationality TEXT DEFAULT 'Global',
  require_approval INTEGER DEFAULT 0,
  admin_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  is_edited INTEGER DEFAULT 0,
  attachment_key TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_guilds_name ON guilds(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS user_chat_reads (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);
