import { getAppUrl } from '@/lib/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getFirstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(',')[0]?.trim() || null;
}

/**
 * Builds the set of origins that are considered valid for CSRF checks.
 * Includes the configured app URL and the request's own Host header,
 * so self-hosted users who access the app via a hostname/port that
 * differs from NEXTAUTH_URL are not blocked on state-changing requests.
 */
function getAllowedOrigins(request: Request): Set<string> {
  const allowed = new Set<string>();

  // Always trust the configured app URL
  const appUrl = getAppUrl();
  allowed.add(new URL(appUrl).origin);

  const proto =
    getFirstForwardedValue(request.headers.get('x-forwarded-proto')) ||
    (new URL(request.url).protocol === 'https:' ? 'https' : 'http');

  // Also trust the externally forwarded host (preferred) or the Host header
  // the request was sent to.
  // Browsers enforce that Origin and Host match for same-origin requests,
  // so accepting the forwarded/host value covers cases where the user
  // accesses the app via a different hostname/port than what NEXTAUTH_URL
  // is set to (common in Docker, LAN, and reverse-proxy setups).
  const forwardedHost = getFirstForwardedValue(request.headers.get('x-forwarded-host'));
  const host = forwardedHost || request.headers.get('host');
  if (host) {
    allowed.add(`${proto}://${host}`);
  }

  return allowed;
}

/**
 * Validates that the request originates from the same origin as the application.
 * Checks the Origin and Referer headers against allowed origins to prevent
 * cross-site request forgery on state-changing (non-GET/HEAD/OPTIONS) requests.
 */
export function validateOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) {
    return true;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If neither header is present, allow the request.
  // Trade-off: some browsers omit Origin on same-origin POST, and non-browser
  // clients (cURL, server-to-server) never send it. Blocking these would break
  // legitimate use. The risk is low because an attacker would need to craft a
  // request that strips both Origin and Referer, which modern browsers prevent
  // for cross-origin form submissions.
  if (!origin && !referer) {
    return true;
  }

  const allowed = getAllowedOrigins(request);

  if (origin) {
    return allowed.has(origin);
  }

  try {
    return allowed.has(new URL(referer!).origin);
  } catch {
    return false;
  }
}
