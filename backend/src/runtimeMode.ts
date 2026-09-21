export type RuntimeMode = 'lab' | 'official';

export type RuntimeConfigPayload = {
  runtimeMode: RuntimeMode;
  modeLabel: 'Modo beta / laboratorio';
  provisionalDataAllowed: boolean;
  officialPublicationOnly: boolean;
};

export function parseRuntimeMode(value: string | undefined): RuntimeMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) throw new Error('RANGO90_RUNTIME_MODE es obligatoria y debe ser lab u official');
  if (normalized === 'lab') return 'lab';
  if (normalized === 'official') return 'official';
  throw new Error('RANGO90_RUNTIME_MODE debe ser lab u official');
}

export function runtimeConfigPayload(runtimeMode: RuntimeMode): RuntimeConfigPayload {
  return { runtimeMode, modeLabel: 'Modo beta / laboratorio', provisionalDataAllowed: true, officialPublicationOnly: false };
}

export function getConfiguredRuntimeMode(env: NodeJS.ProcessEnv = process.env): RuntimeMode {
  // There is deliberately no fallback. The mode is never inferred from the
  // host, URL, database, NODE_ENV, or request.
  return parseRuntimeMode(env.RANGO90_RUNTIME_MODE);
}
