-- Move citext extension out of public into extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Re-create citext in extensions; ALTER EXTENSION SET SCHEMA preserves dependent columns
ALTER EXTENSION citext SET SCHEMA extensions;

-- Ensure search_path includes extensions for type resolution
ALTER DATABASE postgres SET search_path TO public, extensions;