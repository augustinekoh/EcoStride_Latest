-- Migration number: 0011 	 2026-08-26T00:00:00.000Z

CREATE TABLE IF NOT EXISTS ghg_reports (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  total_members INTEGER NOT NULL,
  active_members INTEGER NOT NULL,
  total_distance_km REAL NOT NULL,
  total_carbon_saved_kg REAL NOT NULL,
  report_markdown TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ghg_reports_guild ON ghg_reports(guild_id, created_at);
