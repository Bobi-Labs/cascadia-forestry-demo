-- Allow authenticated users to read their own row from public.users.
-- This is required for the auth profile fetch in AuthContext.
-- Without this, the profile query returns nothing and the app shows
-- an infinite loading spinner.

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users_read_own"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all user profiles (needed for user management)
CREATE POLICY "admins_read_all_users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Users can update their own profile (language_pref, etc.)
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can insert new user profiles (via create-user API)
CREATE POLICY "admins_insert_users"
  ON public.users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Admins can update any user profile
CREATE POLICY "admins_update_all_users"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
