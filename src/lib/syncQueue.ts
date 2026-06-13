/**
 * Tiny localStorage-backed queues of cloud deletions that couldn't be sent yet
 * (offline / request failed). Lives in its own module so db.ts can enqueue
 * without importing the Supabase layer (avoids a circular import).
 *
 * Each record type gets its own bucket, keyed by the record's `createdAt`
 * (the cloud upsert key). The food-log functions are kept as named wrappers
 * for backwards compatibility with existing call sites and stored data.
 */

type DeleteBucket = 'food-logs' | 'exercise-sessions' | 'race-goals' | 'training-plans';

const KEY_PREFIX = 'nutricoach:pending-cloud-deletes';

function bucketKey(bucket: DeleteBucket): string {
  // The original food-logs queue used the bare prefix — preserve that key so
  // any deletes queued before this change are still flushed.
  return bucket === 'food-logs' ? KEY_PREFIX : `${KEY_PREFIX}:${bucket}`;
}

export function readDeleteBucket(bucket: DeleteBucket): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(bucketKey(bucket));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function queueDelete(bucket: DeleteBucket, createdAt: string): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = readDeleteBucket(bucket);
    if (!queue.includes(createdAt)) {
      queue.push(createdAt);
      localStorage.setItem(bucketKey(bucket), JSON.stringify(queue));
    }
  } catch {
    // localStorage unavailable — the row will reappear on next pull, harmless
  }
}

export function clearDeleteBucket(bucket: DeleteBucket): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(bucketKey(bucket), JSON.stringify([]));
  } catch {
    // ignore
  }
}

// --- Backwards-compatible food-log helpers ---------------------------------

export const readDeleteQueue = () => readDeleteBucket('food-logs');
export const queueCloudDelete = (createdAt: string) => queueDelete('food-logs', createdAt);
export const clearDeleteQueue = () => clearDeleteBucket('food-logs');
