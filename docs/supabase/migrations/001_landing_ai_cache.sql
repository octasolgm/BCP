-- BCP: Landing AI cache & job audit tables
-- Applied automatically via: npm run db:migrate

-- Jobs audit log
CREATE TABLE IF NOT EXISTS landing_ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL CHECK (operation IN ('parse', 'extract_gov', 'extract_internal', 'compare')),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size_bytes BIGINT,
  document_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
  credit_usage NUMERIC(12, 4),
  duration_ms INTEGER,
  landing_job_id TEXT,
  model TEXT,
  error_message TEXT,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_ai_jobs_created ON landing_ai_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_ai_jobs_hash ON landing_ai_jobs (file_hash);

-- Parse cache (markdown by file hash)
CREATE TABLE IF NOT EXISTS landing_ai_parse_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  markdown TEXT NOT NULL,
  chunks_json JSONB,
  parse_model TEXT,
  credit_usage NUMERIC(12, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_ai_parse_hash ON landing_ai_parse_cache (file_hash);

-- Extract cache (points by file hash + schema)
CREATE TABLE IF NOT EXISTS landing_ai_extract_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash TEXT NOT NULL,
  schema_key TEXT NOT NULL CHECK (schema_key IN ('gov_requirement_points', 'internal_policy_points', 'compliance_comparison')),
  points_json JSONB NOT NULL,
  extract_model TEXT,
  credit_usage NUMERIC(12, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (file_hash, schema_key)
);

CREATE INDEX IF NOT EXISTS idx_landing_ai_extract_lookup
  ON landing_ai_extract_cache (file_hash, schema_key);

-- Updated_at trigger for parse cache
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landing_ai_parse_cache_updated ON landing_ai_parse_cache;
CREATE TRIGGER trg_landing_ai_parse_cache_updated
  BEFORE UPDATE ON landing_ai_parse_cache
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE landing_ai_jobs IS 'Audit log for Landing AI ADE API calls and credit usage';
COMMENT ON TABLE landing_ai_parse_cache IS 'Cached parse markdown to avoid repeat ADE parse credits';
COMMENT ON TABLE landing_ai_extract_cache IS 'Cached extract results by file hash and schema';
