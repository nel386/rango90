import type { PoolClient } from 'pg';
import { resolveCanonicalEntityId } from './entityIdentity.js';

export type LinkedEntityType = 'player' | 'club' | 'national_team';

export async function ensureExternalEntityLink(
  client: PoolClient,
  sourceKey: string,
  entityType: LinkedEntityType,
  externalId: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const resolvedEntityId = await resolveCanonicalEntityId(client, entityId);
  const external = await client.query<{ entity_id: string }>(
    `SELECT entity_id FROM entity_external_ids
     WHERE source_key = $1 AND entity_type = $2 AND external_id = $3`,
    [sourceKey, entityType, externalId]
  );
  if (external.rows[0]) {
    const resolvedExistingEntityId = await resolveCanonicalEntityId(client, external.rows[0].entity_id);
    if (resolvedExistingEntityId !== resolvedEntityId) {
      throw new Error(`El identificador externo ${sourceKey}/${entityType}/${externalId} ya está vinculado a ${external.rows[0].entity_id}`);
    }
  }

  // A canonical entity may legitimately have several provider records under
  // the same source (for example, historical records that were later merged
  // or separate competition-specific records). Migration 020 deliberately
  // removed the old one-provider-id-per-entity constraint. The invariant we
  // must enforce here is only that one provider identifier cannot point to two
  // different entities; rejecting a second identifier for the same entity
  // makes otherwise valid imports depend on row order.
  await client.query(
    `INSERT INTO entity_external_ids (source_key, entity_type, external_id, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_key, entity_type, external_id) DO UPDATE
       SET metadata = entity_external_ids.metadata || EXCLUDED.metadata,
           updated_at = NOW()`,
    [sourceKey, entityType, externalId, resolvedEntityId, JSON.stringify(metadata)]
  );
}
