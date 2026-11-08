-- touch_updated_at ran with the caller's search_path (Supabase advisor 0011,
-- function_search_path_mutable): a role that can create objects earlier on its path
-- could have a trigger call its own now(). The function only calls now(), which
-- lives in pg_catalog and is found with an empty path, so pinning the path changes
-- nothing it does. The API's migration 031 does the same for its own triggers.
alter function public.touch_updated_at() set search_path = '';
