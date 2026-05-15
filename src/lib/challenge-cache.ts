/**
 * Global challenge data cache for instant page loads.
 *
 * When the user hovers/touches a challenge card in the list,
 * we prefetch the full challenge data into this cache.
 * When the challenge detail page mounts, it reads from cache
 * INSTANTLY — no shimmer, no loading state.
 */

export interface CachedChallengeData {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  category: string;
  xpReward: number;
  content: string;
  options: string | null;
  correctAnswer: string;
  explanation: string | null;
  hints: string | null;
  validationType: string;
  validationConfig: string | null;
  isSolved?: boolean;
  cooldownUntil?: string | null;
  order?: number;
}

const cache = new Map<string, CachedChallengeData>();

/** Prefetch challenge data into cache (call on hover/touch in list page) */
export function prefetchChallenge(id: string) {
  if (cache.has(id)) return; // already cached
  fetch(`/api/challenges/${id}`)
    .then((r) => {
      if (!r.ok) throw new Error("not ok");
      return r.json();
    })
    .then((data: CachedChallengeData) => {
      cache.set(id, data);
    })
    .catch(() => {
      // silently fail — the detail page will fetch normally
    });
}

/** Get cached challenge data (returns null if not in cache) */
export function getCachedChallenge(id: string): CachedChallengeData | null {
  return cache.get(id) ?? null;
}

/** Store challenge data in cache (call after API fetch in detail page) */
export function setCachedChallenge(id: string, data: CachedChallengeData) {
  cache.set(id, data);
}

/** Clear a specific cache entry (useful after solving) */
export function invalidateChallenge(id: string) {
  cache.delete(id);
}
