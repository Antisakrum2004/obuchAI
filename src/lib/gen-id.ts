/**
 * Shared ID generator for the application.
 * Generates unique IDs with an optional prefix.
 */
export function genId(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
