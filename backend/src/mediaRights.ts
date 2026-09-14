export type RightsBasis = 'unknown' | 'public_domain' | 'open_license' | 'direct_license' | 'provider_license' | 'written_permission' | 'not_applicable';
export type TrademarkStatus = 'not_applicable' | 'review_required' | 'cleared' | 'rejected';

export function assertPublishableImageLicense(
  provider: string,
  licenseName: string | null | undefined,
  licenseUrl: string | null | undefined,
  allowShareAlike = false,
  sourceRightsStatus = 'unknown',
  assetLevelOpenLicense = false
): void {
  if (provider.toLowerCase().includes('thesportsdb')) {
    const normalized = licenseName?.toLowerCase() ?? '';
    const explicitCcBySa = normalized.includes('cc by-sa')
      && licenseUrl?.toLowerCase() === 'https://creativecommons.org/licenses/by-sa/4.0/'
      && allowShareAlike
      && assetLevelOpenLicense;
    if (explicitCcBySa) return;
    if (sourceRightsStatus !== 'approved') {
      throw new Error('Los activos de TheSportsDB requieren que la fuente thesportsdb-artwork tenga derechos aprobados explícitamente');
    }
    return;
  }
  if (!licenseName) throw new Error('Una imagen aprobada requiere una licencia');
  const normalized = licenseName.toLowerCase();
  const publicDomain = normalized.includes('public domain') || normalized === 'pd' || normalized.includes('cc0');
  if (provider.toLowerCase().includes('wikimedia-commons')) {
    const compatibleCcBy = normalized.includes('cc by')
      && !normalized.includes('cc by-sa')
      && !normalized.includes('-nc')
      && !normalized.includes(' nc')
      && !normalized.includes('-nd')
      && !normalized.includes(' nd');
    const compatibleCcBySa = normalized.includes('cc by-sa') && Boolean(licenseUrl) && allowShareAlike;
    if (!publicDomain && !compatibleCcBy && !compatibleCcBySa) {
      throw new Error('La licencia de Commons no es aprobable automáticamente: requiere revisión legal (se rechazan CC BY-SA, NC, ND y licencias ambiguas)');
    }
    return;
  }
  if (!publicDomain && !licenseUrl) throw new Error('Una imagen aprobada requiere URL de licencia');
}

function assertRightsEvidenceUrl(value: string | undefined): string {
  if (!value) throw new Error('La revisión legal requiere --rights-evidence-url');
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocolo no permitido');
  } catch {
    throw new Error('--rights-evidence-url debe ser una URL http(s) verificable');
  }
  return value;
}

export function parseUsageScope(value: string | undefined): string[] {
  if (!value) throw new Error('La revisión legal requiere --usage-scope, por ejemplo web,pwa,android,cdn');
  const allowed = new Set(['web', 'pwa', 'android', 'ios', 'cdn', 'local_storage']);
  const scope = value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (scope.length === 0 || scope.some((item) => !allowed.has(item))) {
    throw new Error('--usage-scope solo acepta web,pwa,android,ios,cdn,local_storage');
  }
  return [...new Set(scope)];
}

export function assertRightsApproval(input: {
  assetKind: 'portrait' | 'badge';
  entityType: 'player' | 'club' | 'national_team';
  provider: string;
  licenseName: string | null | undefined;
  licenseUrl: string | null | undefined;
  sourceRightsStatus: string;
  rightsBasis: string | undefined;
  commercialUse: boolean;
  attributionRequired: boolean;
  attributionText: string | undefined;
  trademarkStatus: string | undefined;
  rightsEvidenceUrl: string | undefined;
  usageScope: string | undefined;
  allowShareAlike: boolean;
  assetLevelOpenLicense?: boolean;
}): { rightsBasis: RightsBasis; trademarkStatus: TrademarkStatus; rightsEvidenceUrl: string; usageScope: string[] } {
  const allowedBases: RightsBasis[] = ['public_domain', 'open_license', 'direct_license', 'provider_license', 'written_permission', 'not_applicable'];
  if (!input.rightsBasis || !allowedBases.includes(input.rightsBasis as RightsBasis)) {
    throw new Error('--rights-basis debe ser public_domain, open_license, direct_license, provider_license, written_permission o not_applicable');
  }
  if (!input.commercialUse) throw new Error('La aprobación exige confirmar --commercial-use');
  const rightsEvidenceUrl = assertRightsEvidenceUrl(input.rightsEvidenceUrl);
  const usageScope = parseUsageScope(input.usageScope);
  const trademarkStatus = (input.trademarkStatus ?? (input.assetKind === 'portrait' ? 'not_applicable' : undefined)) as TrademarkStatus | undefined;
  if (!trademarkStatus || !['not_applicable', 'cleared'].includes(trademarkStatus)) {
    throw new Error('El activo necesita --trademark-status cleared o not_applicable');
  }
  if (input.assetKind === 'badge' && input.entityType === 'club' && trademarkStatus !== 'cleared') {
    throw new Error('Un escudo de club necesita autorización marcaria y --trademark-status cleared');
  }
  const provider = input.provider.toLowerCase();
  if (input.assetKind === 'badge' && input.entityType === 'club' && !['direct_license', 'provider_license', 'written_permission'].includes(input.rightsBasis)) {
    throw new Error('La licencia de archivo de un escudo no basta: hace falta direct_license, provider_license o written_permission');
  }
  if (provider.includes('thesportsdb')) {
    if (input.assetLevelOpenLicense) {
      if (input.rightsBasis !== 'open_license') {
        throw new Error('Un artwork CC BY-SA explícito de TheSportsDB requiere rights-basis=open_license');
      }
    } else if (input.sourceRightsStatus !== 'approved' || input.rightsBasis !== 'provider_license') {
      throw new Error('TheSportsDB requiere fuente aprobada y rights-basis=provider_license con alcance comercial confirmado');
    }
  }
  if ((provider.includes('api-football') || provider.includes('uefa-official') || provider.includes('france-football-official'))
    && !['direct_license', 'written_permission'].includes(input.rightsBasis)) {
    throw new Error(`${input.provider} no concede por sí solo derechos de publicación; registra una licencia directa o permiso escrito`);
  }
  const normalizedLicense = input.licenseName?.toLowerCase() ?? '';
  const publicDomain = normalizedLicense.includes('public domain') || normalizedLicense === 'pd' || normalizedLicense.includes('cc0');
  const requiresAttribution = normalizedLicense.includes('cc by') && !publicDomain;
  if ((requiresAttribution || input.attributionRequired) && !input.attributionText?.trim()) {
    throw new Error('La aprobación exige --attribution con el texto que se mostrará al usuario');
  }
  if (input.rightsBasis === 'public_domain' || input.rightsBasis === 'open_license') {
    assertPublishableImageLicense(input.provider, input.licenseName, input.licenseUrl, input.allowShareAlike, input.sourceRightsStatus, input.assetLevelOpenLicense);
  }
  return { rightsBasis: input.rightsBasis as RightsBasis, trademarkStatus, rightsEvidenceUrl, usageScope };
}
