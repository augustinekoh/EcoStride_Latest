-- Migration number: 0013    2026-08-28T00:00:00.000Z
ALTER TABLE copilot_sessions ADD COLUMN selected_report_ids TEXT;
