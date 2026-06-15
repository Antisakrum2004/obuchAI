/**
 * Avatar URL utilities.
 *
 * Avatars are stored in Selectel S3 and served through /api/avatars/ proxy.
 * This module handles URL format conversion between:
 *   - New format: /api/avatars/avatars/{userId}.webp  (goes through proxy)
 *   - Legacy format: https://s3.ru-7.storage.selcloud.ru/{bucket}/avatars/{userId}.webp  (direct S3)
 *
 * The proxy is needed because Selectel does NOT support public-read via S3 API.
 */

const S3_HOST = "s3.ru-7.storage.selcloud.ru";
const AVATAR_PROXY_PREFIX = "/api/avatars/";

/**
 * Convert any avatar URL to the proxy format.
 * This ensures both new and legacy URLs work through the /api/avatars/ proxy.
 *
 * Examples:
 *   /api/avatars/avatars/user123.webp → /api/avatars/avatars/user123.webp  (already proxy)
 *   https://s3.ru-7.storage.selcloud.ru/avatarsmyobuch/avatars/user123.webp → /api/avatars/avatars/user123.webp
 *   https://s3.ru-7.storage.selcloud.ru/ati-lab/avatars/user123.webp → /api/avatars/avatars/user123.webp
 *   null → null
 */
export function toProxyAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already in proxy format
  if (url.startsWith(AVATAR_PROXY_PREFIX)) return url;

  // Legacy S3 URL — extract the key after the bucket name
  try {
    const parsed = new URL(url);

    // Only convert S3 URLs from our storage
    if (parsed.host !== S3_HOST) return url;

    // Path-style: /{bucket}/avatars/{userId}.webp → /api/avatars/avatars/{userId}.webp
    const parts = parsed.pathname.split("/").filter(Boolean);
    // parts = ["avatarsmyobuch", "avatars", "userId.webp"]
    // or    = ["ati-lab", "avatars", "userId.webp"]
    if (parts.length >= 3 && parts[1] === "avatars") {
      // Skip the bucket name, keep everything after it
      const key = parts.slice(1).join("/");
      return `${AVATAR_PROXY_PREFIX}${key}`;
    }

    // Fallback: skip first segment (bucket name)
    if (parts.length >= 2) {
      const key = parts.slice(1).join("/");
      return `${AVATAR_PROXY_PREFIX}${key}`;
    }

    return url;
  } catch {
    // Not a URL — return as-is
    return url;
  }
}
