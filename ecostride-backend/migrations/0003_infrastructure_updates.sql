-- Add specific_location and resolved_at to infrastructure_reports
ALTER TABLE infrastructure_reports ADD COLUMN specific_location TEXT;
ALTER TABLE infrastructure_reports ADD COLUMN resolved_at INTEGER;
