/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with cleanup of expired entries.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Map of key -> RateLimitEntry
const limitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limitStore.entries()) {
    if (now > entry.resetAt) {
      limitStore.delete(key);
    }
  }
}, 60_000);

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Maximum number of requests within the window (default: 10) */
  maxRequests?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is within rate limits.
 * @param key - Unique identifier (e.g., IP address or user ID)
 * @param options - Rate limit configuration
 * @returns Result with allowed status and remaining quota
 */
export function checkRateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const { windowMs = 60_000, maxRequests = 10 } = options;
  const now = Date.now();

  const entry = limitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    limitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Existing window
  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  const allowed = entry.count <= maxRequests;

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Get a rate limit key from a request (uses IP address or forwarded header).
 */
export function getRateLimitKey(request: Request, suffix?: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}

/**
 * Rate limit presets for common use cases.
 */
export const RATE_LIMITS = {
  /** Login attempts: 5 per minute per IP */
  login: { windowMs: 60_000, maxRequests: 5 },
  /** Challenge submission: 10 per minute per user */
  submit: { windowMs: 60_000, maxRequests: 10 },
  /** Marathon validation: 20 per minute per user */
  marathon: { windowMs: 60_000, maxRequests: 20 },
  /** Admin operations: 5 per minute per IP */
  admin: { windowMs: 60_000, maxRequests: 5 },
  /** AI endpoints: 5 per minute per user */
  ai: { windowMs: 60_000, maxRequests: 5 },
  /** General API: 30 per minute per IP */
  general: { windowMs: 60_000, maxRequests: 30 },
} as const;
