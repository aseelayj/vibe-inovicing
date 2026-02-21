const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Sanitize a headerColor value to prevent CSS injection.
 * Returns the color if valid hex, otherwise the fallback.
 */
export function sanitizeHeaderColor(
  color: string | null | undefined,
  fallback: string,
): string {
  return color && HEX_COLOR_RE.test(color) ? color : fallback;
}

/**
 * Replace {{variable}} placeholders in a template string.
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => variables[key] ?? '',
  );
}

/**
 * Wrap all <a href="..."> links in HTML for click tracking.
 * Replaces the href with a tracking redirect URL.
 */
export function wrapLinksForTracking(
  html: string,
  emailLogId: number,
  baseUrl: string,
): string {
  return html.replace(
    /(<a\s[^>]*href=")([^"]+)("[^>]*>)/gi,
    (_, before, url, after) => {
      // Don't wrap mailto: links or already-tracked links
      if (url.startsWith('mailto:') || url.includes('/api/tracking/')) {
        return `${before}${url}${after}`;
      }
      const trackUrl = `${baseUrl}/api/tracking/click/${emailLogId}`
        + `?url=${encodeURIComponent(url)}`;
      return `${before}${trackUrl}${after}`;
    },
  );
}
