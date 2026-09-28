type JsonRecord = Record<string, unknown>;

export type Block45StatusPreflight = {
  valid: boolean;
  reason: 'passed' | 'http_status_not_200' | 'provider_errors' | 'malformed_results' | 'status_response_missing' | 'daily_quota_missing';
  resultsValue: number | null;
  dailyRemaining: number | null;
  dailyLimit: number | null;
};

const object = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const hasProviderErrors = (errors: unknown): boolean => {
  if (errors === undefined || errors === null || errors === false || errors === '') return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors as JsonRecord).length > 0;
  return true;
};

/** `/status` returns an account object, not a paginated list. Its documented sample omits `results`; validate the field when supplied. */
export function validateBlock45StatusPreflight(input: {
  httpStatus: number;
  errors: unknown;
  results: unknown;
  response: unknown;
}): Block45StatusPreflight {
  const resultsValue = input.results === undefined || input.results === null
    ? null
    : typeof input.results === 'number' && Number.isInteger(input.results) && input.results >= 0
      ? input.results
      : Number.NaN;
  const statusResponse = object(input.response);
  const requests = object(statusResponse.requests);
  const current = typeof requests.current === 'number' ? requests.current : Number.NaN;
  const limit = typeof requests.limit_day === 'number' ? requests.limit_day : Number.NaN;
  const quotaValid = Number.isInteger(current) && current >= 0 && Number.isInteger(limit) && limit > 0 && current <= limit;
  let reason: Block45StatusPreflight['reason'] = 'passed';
  if (input.httpStatus !== 200) reason = 'http_status_not_200';
  else if (hasProviderErrors(input.errors)) reason = 'provider_errors';
  else if (Number.isNaN(resultsValue) || (resultsValue !== null && resultsValue !== 1)) reason = 'malformed_results';
  else if (Object.keys(statusResponse).length === 0) reason = 'status_response_missing';
  else if (!quotaValid) reason = 'daily_quota_missing';
  return {
    valid: reason === 'passed', reason,
    resultsValue: Number.isNaN(resultsValue) ? null : resultsValue,
    dailyRemaining: quotaValid ? limit - current : null,
    dailyLimit: quotaValid ? limit : null
  };
}
