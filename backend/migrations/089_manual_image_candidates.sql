-- BLOQUE 22: propuestas manuales de imágenes; no son activos aprobados.

CREATE TABLE IF NOT EXISTS media_image_candidates (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  category_slug TEXT NOT NULL,
  asset_kind TEXT NOT NULL DEFAULT 'portrait' CHECK (asset_kind IN ('portrait', 'badge')),
  proposed_url TEXT NOT NULL,
  author TEXT NOT NULL,
  license_name TEXT NOT NULL,
  license_url TEXT,
  attribution_text TEXT NOT NULL,
  review_date DATE NOT NULL,
  resource_sha256 TEXT NOT NULL CHECK (resource_sha256 ~ '^[0-9a-fA-F]{64}$'),
  identity_evidence_url TEXT NOT NULL,
  rights_evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'validated', 'rejected', 'duplicate')),
  observations TEXT NOT NULL DEFAULT '',
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  batch_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, proposed_url)
);

CREATE INDEX IF NOT EXISTS media_image_candidates_entity_idx
  ON media_image_candidates(entity_id, category_slug, status);

COMMENT ON TABLE media_image_candidates IS 'Enlaces manuales pendientes; nunca sustituyen image_assets ni conceden derechos automáticamente.';
