-- Migration: 0010_merchant_canonical_indexes.sql
-- Description: Add indexes for merchant lookups and safely migrate unambiguous legacy owner_id references to canonical merchants.id

-- 1. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_merchants_owner_id ON merchants(owner_id);
CREATE INDEX IF NOT EXISTS idx_purchases_merchant_id ON purchases(merchant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_point_store_merchant_id ON point_store(merchant_id);

-- 2. Safe unambiguous migration for point_store
-- ONLY migrate legacy records where the owner_id corresponds to EXACTLY ONE merchant (COUNT = 1)
-- Ambiguous records (owners with > 1 merchant) are left untouched for explicit manual resolution.
UPDATE point_store 
SET merchant_id = (
  SELECT m.id FROM merchants m 
  WHERE m.owner_id = point_store.merchant_id 
  GROUP BY m.owner_id 
  HAVING COUNT(m.id) = 1
)
WHERE merchant_id IN (
  SELECT owner_id FROM merchants 
  GROUP BY owner_id 
  HAVING COUNT(id) = 1
)
AND merchant_id NOT IN (SELECT id FROM merchants);

-- 3. Safe unambiguous migration for purchases
-- ONLY migrate legacy records where the owner_id corresponds to EXACTLY ONE merchant (COUNT = 1)
-- Ambiguous records (owners with > 1 merchant) are left untouched for explicit manual resolution.
UPDATE purchases 
SET merchant_id = (
  SELECT m.id FROM merchants m 
  WHERE m.owner_id = purchases.merchant_id 
  GROUP BY m.owner_id 
  HAVING COUNT(m.id) = 1
)
WHERE merchant_id IN (
  SELECT owner_id FROM merchants 
  GROUP BY owner_id 
  HAVING COUNT(id) = 1
)
AND merchant_id NOT IN (SELECT id FROM merchants);
