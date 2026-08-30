ALTER TABLE infrastructure_reports ADD COLUMN ai_status TEXT DEFAULT 'pending';
UPDATE infrastructure_reports SET ai_status = 'completed' WHERE ai_summary IS NOT NULL;
