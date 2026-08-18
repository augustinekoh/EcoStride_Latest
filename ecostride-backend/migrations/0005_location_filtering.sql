-- Migration 0005: Location Filtering & Jurisdiction Architecture

-- 1. Safely migrate existing genuine country names from nationality (excluding 'Global Citizen', empty, or NULL)
UPDATE users 
SET country = nationality 
WHERE nationality IS NOT NULL 
  AND nationality != '' 
  AND nationality != 'Global Citizen'
  AND (country IS NULL OR country = '');

-- 2. Add location columns to infrastructure_reports
ALTER TABLE infrastructure_reports ADD COLUMN country TEXT;
ALTER TABLE infrastructure_reports ADD COLUMN state TEXT;
ALTER TABLE infrastructure_reports ADD COLUMN city TEXT;

-- 3. Create jurisdiction indexes
CREATE INDEX IF NOT EXISTS idx_reports_jurisdiction ON infrastructure_reports(country, state, city);
CREATE INDEX IF NOT EXISTS idx_users_jurisdiction ON users(country, state, city);
