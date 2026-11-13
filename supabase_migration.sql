-- =====================================================================================
-- GKB SHOPPING PORTAL — MULTI-CATEGORY INVENTORY & ORDERS MIGRATION
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
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

-- 4. Enable Order Cancellation in public.gkb_orders
-- Allow 'cancelled' in status check constraint:
ALTER TABLE public.gkb_orders 
  DROP CONSTRAINT IF EXISTS gkb_orders_status_check;

ALTER TABLE public.gkb_orders 
  ADD CONSTRAINT gkb_orders_status_check 
  CHECK (status in ('pending', 'processing', 'delivered', 'picked_up', 'cancelled'));

-- 5. Ensure admin email zumkel023@gmail.com is permanently authorized in Supabase RLS
INSERT INTO public.gkb_user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'zumkel023@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- 6. Upgrade is_gkb_admin() function so admin email is always recognized
CREATE OR REPLACE FUNCTION public.is_gkb_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gkb_user_roles as roles
    WHERE roles.user_id = (SELECT auth.uid())
      AND roles.role = 'admin'
  ) OR (
    (SELECT auth.jwt() ->> 'email') = 'zumkel023@gmail.com'
  );
$$;

-- 7. Grant status update permissions on gkb_orders to authenticated users
GRANT UPDATE (status, status_updated_at) ON TABLE public.gkb_orders TO authenticated;
