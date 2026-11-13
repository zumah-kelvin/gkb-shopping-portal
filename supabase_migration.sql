-- =====================================================================================
-- GKB SHOPPING PORTAL — MULTI-CATEGORY INVENTORY MIGRATION
-- Run this in your Supabase SQL Editor if you want native category columns
-- =====================================================================================

-- 1. Add optional category column (default 'laptops')
ALTER TABLE public.gkb_inventory_items 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'laptops';

-- 2. Drop restrictive check constraints on RAM and Storage so mobile phones & gadgets
--    can have flexible capacities (e.g. 64GB storage, N/A for mice/stands, 10,000mAh for power banks)
ALTER TABLE public.gkb_inventory_items 
  DROP CONSTRAINT IF EXISTS gkb_inventory_items_ram_check;

ALTER TABLE public.gkb_inventory_items 
  DROP CONSTRAINT IF EXISTS gkb_inventory_items_storage_check;

-- 3. Make RAM and Storage optional for non-computing gadgets (e.g. laptop stands)
ALTER TABLE public.gkb_inventory_items 
  ALTER COLUMN ram DROP NOT NULL;

ALTER TABLE public.gkb_inventory_items 
  ALTER COLUMN storage DROP NOT NULL;
