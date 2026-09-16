import { createHash } from 'node:crypto';

export type EvidenceStatus = 'passed' | 'failed' | 'integration_pending' | 'not_run';

export type Block6RunMetadata = {
  runId: string;
  timestamp: string;
  runtimeMode: 'lab' | 'official';
  isolatedDatabase: {
    configured: boolean;
    distinctFromDatabaseUrl: boolean;
    databaseName: string | null;
    fingerprintSha256: string | null;
  };
};

export type Block6Evidence = {
  isolatedIntegration: { status: EvidenceStatus; detail: string };
  mobileAudit: { status: EvidenceStatus; p0: number; p1: number; detail: string };
  publicReadOnlyAudit: { status: EvidenceStatus; detail: string };
  officialPublication: { status: EvidenceStatus; detail: string };
  artifactHashes: Record<string, string>;
  run: Block6RunMetadata;
};

export type Block6ReleaseGate = {
  readyForRelease: boolean;
  blockingReasons: string[];
  evidence: Block6Evidence;
  evidenceSha256: string;
};

export function evaluateBlock6Release(evidence: Block6Evidence): Block6ReleaseGate {
  const blockingReasons: string[] = [];
  if (evidence.isolatedIntegration.status !== 'passed') blockingReasons.push(`isolated_integration:${evidence.isolatedIntegration.status}`);
  if (evidence.mobileAudit.status !== 'passed' || evidence.mobileAudit.p0 > 0 || evidence.mobileAudit.p1 > 0) blockingReasons.push(`mobile_audit:${evidence.mobileAudit.status}`);
  if (evidence.publicReadOnlyAudit.status !== 'passed') blockingReasons.push(`public_read_only_audit:${evidence.publicReadOnlyAudit.status}`);
  if (evidence.officialPublication.status !== 'passed') blockingReasons.push(`official_publication:${evidence.officialPublication.status}`);
  if (Object.keys(evidence.artifactHashes).length === 0) blockingReasons.push('artifact_hashes:not_registered');
  const normalizedReasons = [...new Set(blockingReasons)].sort();
  const withoutHash = { readyForRelease: normalizedReasons.length === 0, blockingReasons: normalizedReasons, evidence };
  return { ...withoutHash, evidenceSha256: createHash('sha256').update(JSON.stringify(withoutHash)).digest('hex') };
}
