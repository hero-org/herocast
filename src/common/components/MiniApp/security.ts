/**
 * Security utilities for MiniApp hosting
 *
 * These functions help prevent XSS attacks when rendering untrusted
 * content from third-party mini apps.
 */

/**
 * Validates that a URL is a safe HTTPS URL
 * Prevents javascript:, data:, and other dangerous protocols
 */
export function isValidHttpsUrl(url: string | undefined | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Only allow https in production, http allowed for localhost dev
    const isHttps = parsed.protocol === 'https:';
    const isLocalDev =
      parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    return isHttps || isLocalDev;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL for use in img src or similar attributes
 * Returns undefined if URL is not safe
 */
export function sanitizeImageUrl(url: string | undefined | null): string | undefined {
  if (!isValidHttpsUrl(url)) {
    return undefined;
  }
  return url!;
}

/**
 * Sanitizes a URL for use as iframe src
 * More strict validation than image URLs
 */
export function sanitizeIframeSrc(url: string | undefined | null): string | undefined {
  if (!isValidHttpsUrl(url)) {
    return undefined;
  }

  // Additional checks for iframe sources
  const parsed = new URL(url!);

  // Block file:// and other protocols that might slip through
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return undefined;
  }

  return url!;
}

/**
 * Escapes HTML entities to prevent XSS in text content
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';

  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Validates and sanitizes a CSS color value
 * Only allows hex colors and named colors, not url() or other values
 */
export function sanitizeColor(color: string | undefined | null): string | undefined {
  if (!color) return undefined;

  // Allow hex colors
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
    return color;
  }

  // Allow rgb/rgba with only numbers
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) {
    return color;
  }

  // Allow common named colors (subset for safety)
  const safeColorNames = [
    'white',
    'black',
    'red',
    'green',
    'blue',
    'yellow',
    'purple',
    'orange',
    'gray',
    'grey',
    'transparent',
  ];
  if (safeColorNames.includes(color.toLowerCase())) {
    return color;
  }

  // Reject everything else (including url(), expression(), etc.)
  return undefined;
}

/**
 * Sanitizes a complete manifest object
 */
export function sanitizeManifest<
  T extends {
    name?: string;
    iconUrl?: string;
    splashImageUrl?: string;
    splashBackgroundColor?: string;
    homeUrl?: string;
  },
>(manifest: T | undefined | null): T | undefined {
  if (!manifest) return undefined;

  return {
    ...manifest,
    name: manifest.name ? escapeHtml(manifest.name) : undefined,
    iconUrl: sanitizeImageUrl(manifest.iconUrl),
    splashImageUrl: sanitizeImageUrl(manifest.splashImageUrl),
    splashBackgroundColor: sanitizeColor(manifest.splashBackgroundColor),
    homeUrl: sanitizeIframeSrc(manifest.homeUrl),
  } as T;
}

/**
 * Extracts and validates the origin from a URL
 */
export function getValidatedOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Generates a list of allowed origins for a URL to handle common redirects
 * Returns both www and non-www variants to handle server redirects
 */
export function getAllowedOrigins(url: string): string[] {
  const baseOrigin = getValidatedOrigin(url);
  if (!baseOrigin) return [];

  const origins = [baseOrigin];

  try {
    const parsed = new URL(baseOrigin);

    if (parsed.hostname.startsWith('www.')) {
      // If origin has www, also allow without www
      const hostnameWithoutWww = parsed.hostname.replace(/^www\./, '');
      const originWithoutWww = `${parsed.protocol}//${hostnameWithoutWww}${parsed.port ? ':' + parsed.port : ''}`;
      origins.push(originWithoutWww);
    } else {
      // If origin doesn't have www, also allow with www
      const hostnameWithWww = `www.${parsed.hostname}`;
      const originWithWww = `${parsed.protocol}//${hostnameWithWww}${parsed.port ? ':' + parsed.port : ''}`;
      origins.push(originWithWww);
    }
  } catch (e) {
    console.warn('Failed to generate www variant for origin:', e);
  }

  return origins;
}
