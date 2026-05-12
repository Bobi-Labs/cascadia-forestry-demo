-- Clean up temporary diagnostic functions used during RLS debugging
DROP FUNCTION IF EXISTS public.tmp_list_policies();
DROP FUNCTION IF EXISTS public.tmp_show_functions();
