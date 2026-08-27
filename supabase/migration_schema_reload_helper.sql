-- Lets the app ask PostgREST to rebuild its schema cache.
-- Fixes intermittent "Could not find the table ... in the schema cache"
-- errors, where an API instance is still serving a schema from before a
-- migration ran. Safe: it only sends a reload notification, touches no data.
CREATE OR REPLACE FUNCTION reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

-- Service role only (the app's server-side client); never exposed to browsers
REVOKE ALL ON FUNCTION reload_schema_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION reload_schema_cache() FROM anon;
REVOKE ALL ON FUNCTION reload_schema_cache() FROM authenticated;
GRANT EXECUTE ON FUNCTION reload_schema_cache() TO service_role;

-- Apply immediately for the current stale caches
NOTIFY pgrst, 'reload schema';
