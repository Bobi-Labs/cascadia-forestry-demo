-- Fix: updated trigger with safer company_id and permissions handling

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  v_company_id uuid;
  v_permissions jsonb;
BEGIN
  -- Safely cast company_id (may be empty string or absent)
  BEGIN
    v_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_company_id := NULL;
  END;

  -- Safely extract permissions (default to empty object)
  IF NEW.raw_user_meta_data ? 'permissions'
     AND jsonb_typeof(NEW.raw_user_meta_data->'permissions') = 'object'
  THEN
    v_permissions := (NEW.raw_user_meta_data->'permissions')::jsonb;
  ELSE
    v_permissions := '{}'::jsonb;
  END IF;

  INSERT INTO public.users (id, email, name, role, company_id, language_pref, permissions)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'crew'),
    v_company_id,
    COALESCE((NEW.raw_user_meta_data->>'language_pref')::language_pref, 'en'),
    v_permissions
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
