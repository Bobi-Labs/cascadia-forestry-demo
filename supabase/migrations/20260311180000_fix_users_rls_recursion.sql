-- Fix infinite recursion in users table RLS policies.
-- The admin policies referenced public.users in their USING clause,
-- which triggered another RLS check → infinite loop.
-- Fix: use a SECURITY DEFINER function to check admin status without RLS.

-- Step 1: Create a helper function that bypasses RLS to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = check_user_id AND role = 'admin'
  );
$$;

-- Step 2: Drop the recursive policies
DROP POLICY IF EXISTS "admins_read_all_users" ON public.users;
DROP POLICY IF EXISTS "admins_insert_users" ON public.users;
DROP POLICY IF EXISTS "admins_update_all_users" ON public.users;

-- Step 3: Recreate with the helper function (no recursion)
CREATE POLICY "admins_read_all_users"
  ON public.users
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admins_insert_users"
  ON public.users
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins_update_all_users"
  ON public.users
  FOR UPDATE
  USING (public.is_admin(auth.uid()));
