-- Drop the auth trigger that's causing createUser() to fail with 500 errors.
-- We'll insert public.users rows manually in the seed script instead.
-- The trigger can be re-enabled later once the root cause is identified.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Keep the function around for later use, just detach the trigger
