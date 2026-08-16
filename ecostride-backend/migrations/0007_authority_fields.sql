-- Migration 0007: Authority & Report Column Fixes

-- 1. Add severity column to infrastructure_reports
ALTER TABLE infrastructure_reports ADD COLUMN severity TEXT DEFAULT 'Minor';

-- 2. Add importance column to authority_tasks
ALTER TABLE authority_tasks ADD COLUMN importance TEXT DEFAULT 'Medium';

-- 3. Add verified_email column to users
ALTER TABLE users ADD COLUMN verified_email INTEGER DEFAULT 0;
