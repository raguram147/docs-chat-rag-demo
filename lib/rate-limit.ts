/**
 * Small in-memory sliding-window limiter to protect the public demo's API budget.
 * On serverless hosts each instance keeps its own window, so treat it as best-effort
 * and swap in Redis or the host's own rate limiting for a production deployment.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_TRACKED_CLIENTS = 5_000;

const seen = new Map<string, number[]>();

export function allowRequest(clientId: string, now = Date.now()): boolean {
  const recent = (seen.get(clientId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    seen.set(clientId, recent);
    return false;
  }
  recent.push(now);
  seen.set(clientId, recent);

  if (seen.size > MAX_TRACKED_CLIENTS) {
    for (const [id, times] of seen) {
      if (times.every((t) => now - t >= WINDOW_MS)) seen.delete(id);
    }
  }
  return true;
}
