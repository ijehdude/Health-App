/**
 * Tiny localStorage-backed queue of cloud deletions that couldn't be sent yet
 * (offline / request failed). Lives in its own module so db.ts can enqueue
 * without importing the Supabase layer (avoids a circular import).
 */

const KEY = 'nutricoach:pending-cloud-deletes';

export function readDeleteQueue(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function queueCloudDelete(createdAt: string): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = readDeleteQueue();
    if (!queue.includes(createdAt)) {
      queue.push(createdAt);
      localStorage.setItem(KEY, JSON.stringify(queue));
    }
  } catch {
    // localStorage unavailable — the row will reappear on next pull, harmless
  }
}

export function clearDeleteQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify([]));
  } catch {
    // ignore
  }
}
