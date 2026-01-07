-- Adds access_level to support read-only finance access
ALTER TABLE user_module_access
ADD COLUMN IF NOT EXISTS access_level text
  CHECK (access_level IN ('read-write','read-only','no-access'))
  DEFAULT 'read-write';

UPDATE user_module_access
SET access_level = CASE WHEN has_access THEN 'read-write' ELSE 'no-access' END
WHERE access_level IS NULL;

-- Optional: refresh PostgREST schema cache (if you have the pgrst channel enabled)
-- SELECT pg_notify('pgrst', 'reload schema');

-- Payment reference fields for finance entries
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS bank_reference text;
ALTER TABLE income ADD COLUMN IF NOT EXISTS bank_reference text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_reference text;

-- Evidence attachment URLs for finance entries
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS evidence_url text;
ALTER TABLE income ADD COLUMN IF NOT EXISTS evidence_url text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS evidence_url text;

