-- 021_pantry_builder_governance.sql
-- Autonomous Pantry Builder governance.
--
-- Forward-only additions:
--   - import run ledger
--   - candidate ledger
--   - accepted alias table
--   - rejected alias table
--   - provenance columns on products
--
-- Existing parser-facing products rows remain compatible. Imported rows
-- still satisfy products.fulfillment_source via the existing 'manual'
-- value; true provenance lives in the additive columns below.

CREATE TABLE IF NOT EXISTS pantry_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('dry_run', 'apply')),
  source_kind text NOT NULL,
  source_release text,
  profile_version integer,
  target_count integer,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'failed', 'aborted')),
  candidate_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pantry_import_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pantry_import_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid REFERENCES pantry_import_runs(id) ON DELETE SET NULL,
  candidate_key text NOT NULL,
  target_query text,
  normalized_name text NOT NULL,
  display_name text NOT NULL,
  source_kind text NOT NULL,
  source_dataset text,
  external_id text,
  source_release text,
  category text,
  proposed_product jsonb NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  rejected_aliases text[] NOT NULL DEFAULT '{}',
  unit_alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_score numeric NOT NULL DEFAULT 0,
  decision text NOT NULL CHECK (
    decision IN (
      'auto_approved',
      'review_required',
      'rejected',
      'applied',
      'skipped',
      'failed'
    )
  ),
  reasons text[] NOT NULL DEFAULT '{}',
  applied_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pantry_import_candidates ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS pantry_import_candidates_key_idx
  ON pantry_import_candidates(candidate_key);

CREATE INDEX IF NOT EXISTS pantry_import_candidates_run_idx
  ON pantry_import_candidates(import_run_id);

CREATE INDEX IF NOT EXISTS pantry_import_candidates_decision_idx
  ON pantry_import_candidates(decision);

CREATE TABLE IF NOT EXISTS food_identity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('product', 'saved_meal', 'recipe')),
  target_id uuid,
  target_source_ref text NOT NULL,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  alias_type text NOT NULL DEFAULT 'generated',
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  source text NOT NULL DEFAULT 'pantry_builder',
  import_run_id uuid REFERENCES pantry_import_runs(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_identity_aliases ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS food_identity_aliases_unique_active_idx
  ON food_identity_aliases(target_source_ref, normalized_alias)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS food_identity_aliases_lookup_idx
  ON food_identity_aliases(normalized_alias)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS food_identity_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase text NOT NULL,
  normalized_phrase text NOT NULL,
  rejected_source_ref text NOT NULL,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'pantry_builder',
  import_run_id uuid REFERENCES pantry_import_runs(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_identity_rejections ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS food_identity_rejections_unique_active_idx
  ON food_identity_rejections(normalized_phrase, rejected_source_ref)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS food_identity_rejections_lookup_idx
  ON food_identity_rejections(normalized_phrase)
  WHERE active = true;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS provenance_source_kind text,
  ADD COLUMN IF NOT EXISTS provenance_dataset text,
  ADD COLUMN IF NOT EXISTS provenance_external_id text,
  ADD COLUMN IF NOT EXISTS provenance_release text,
  ADD COLUMN IF NOT EXISTS provenance_import_run_id uuid REFERENCES pantry_import_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_confidence text CHECK (import_confidence IS NULL OR import_confidence IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS canonical_category text;

CREATE UNIQUE INDEX IF NOT EXISTS products_provenance_external_idx
  ON products(provenance_source_kind, provenance_external_id)
  WHERE provenance_source_kind IS NOT NULL AND provenance_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_canonical_category_idx
  ON products(canonical_category)
  WHERE canonical_category IS NOT NULL;
