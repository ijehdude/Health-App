import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db, getProfile, recomputeDailySummary } from './db';
import { clearDeleteQueue, readDeleteQueue } from './syncQueue';
import type { FoodLog, UserProfile } from './types';

let client: SupabaseClient | null = null;

/** Returns a Supabase client, or null when cloud sync is not configured. */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Current session's access token, for authenticating API route calls. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ---------------------------------------------------------------------------
// Sync engine — Dexie stays the local source of truth; the cloud mirrors it.
// Pull merges remote rows we don't have; push uploads anything marked
// synced: 0, so a failed request just leaves the log queued for next time.
// ---------------------------------------------------------------------------

const SYNCED_EVENT = 'nutricoach:synced';
const LAST_SYNC_KEY = 'nutricoach:last-synced';

/** Subscribe to "local data changed after a cloud pull" (returns unsubscribe). */
export function onSynced(callback: () => void): () => void {
  window.addEventListener(SYNCED_EVENT, callback);
  return () => window.removeEventListener(SYNCED_EVENT, callback);
}

/** ISO timestamp of the last successful sync on this device, if any. */
export function getLastSyncedAt(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  /** Consistency check: meals in the cloud vs on this device after syncing. */
  cloudMeals: number;
  localMeals: number;
  at: string; // ISO timestamp
}

export async function fullSync(): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sign in before syncing.');

  // One-time: re-push meals whose cloud rows still embed photos, so they get
  // rewritten with storage paths and the database rows shrink.
  if (typeof window !== 'undefined') {
    const flagKey = `nutricoach:photos-to-storage:${userId}`;
    if (!localStorage.getItem(flagKey)) {
      await db.foodLogs.filter((l) => (l.photos?.length ?? 0) > 0).modify({ synced: 0 });
      localStorage.setItem(flagKey, '1');
    }
  }

  await processPendingDeletes(supabase, userId);
  const pulled = await pullFromCloud(supabase, userId);
  const pushed = await pushToCloud(supabase, userId);

  const { count, error: countErr } = await supabase
    .from('food_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countErr) throw new Error(`Could not verify cloud meal count: ${countErr.message}`);
  const cloudMeals = count ?? 0;
  const localMeals = await db.foodLogs.count();

  const at = new Date().toISOString();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_SYNC_KEY, at);
    } catch {
      // ignore
    }
    if (pulled > 0) window.dispatchEvent(new CustomEvent(SYNCED_EVENT));
  }
  return { pushed, pulled, cloudMeals, localMeals, at };
}

/** Fire-and-forget sync; failures are logged and retried on the next trigger. */
export function backgroundSync(): void {
  fullSync().catch((err) =>
    console.warn('[sync] Background sync failed — will retry when online:', err)
  );
}

/**
 * One-time migration on first login: marks every locally stored log as
 * unsynced so the full history is pushed into the user's cloud account,
 * then records completion per user id.
 */
export async function runFirstLoginMigration(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = `nutricoach:migrated:${userId}`;
  if (localStorage.getItem(key)) {
    backgroundSync();
    return;
  }
  if ((await db.foodLogs.count()) > 0) {
    await db.foodLogs.toCollection().modify({ synced: 0 });
  }
  await fullSync();
  localStorage.setItem(key, '1');
}

// ---------------------------------------------------------------------------
// Photo storage — photos live in the meal-photos bucket (one folder per user),
// not in the database row, keeping rows small and sync pulls cheap.
// ---------------------------------------------------------------------------

const PHOTO_BUCKET = 'meal-photos';
const MAX_PHOTOS_PER_MEAL = 5;

function photoPath(userId: string, createdAt: string, index: number): string {
  return `${userId}/${createdAt.replace(/[:.]/g, '-')}-${index}.jpg`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read downloaded photo.'));
    reader.readAsDataURL(blob);
  });
}

async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  log: FoodLog
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < (log.photos?.length ?? 0); i++) {
    const path = photoPath(userId, log.createdAt, i);
    const blob = await dataUrlToBlob(log.photos![i]);
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) {
      throw new Error(
        `Photo upload failed — is the "${PHOTO_BUCKET}" storage bucket set up (see SETUP.md)? ${error.message}`
      );
    }
    paths.push(path);
  }
  return paths;
}

/** Best-effort: missing photos shouldn't block pulling the meal itself. */
async function downloadPhotos(
  supabase: SupabaseClient,
  paths: string[]
): Promise<string[] | undefined> {
  const out: string[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
    if (error || !data) {
      console.warn('[sync] Could not download meal photo', path, error?.message);
      break;
    }
    out.push(await blobToDataUrl(data));
  }
  return out.length > 0 ? out : undefined;
}

// ---------------------------------------------------------------------------

async function processPendingDeletes(supabase: SupabaseClient, userId: string): Promise<void> {
  const queue = readDeleteQueue();
  if (queue.length === 0) return;
  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('user_id', userId)
    .in('created_at', queue);
  if (error) throw new Error(`Could not delete cloud logs: ${error.message}`);

  // Best-effort cleanup of any photos those meals had in storage.
  const photoPaths = queue.flatMap((createdAt) =>
    Array.from({ length: MAX_PHOTOS_PER_MEAL }, (_, i) => photoPath(userId, createdAt, i))
  );
  const { error: storageErr } = await supabase.storage.from(PHOTO_BUCKET).remove(photoPaths);
  if (storageErr) console.warn('[sync] Photo cleanup skipped:', storageErr.message);

  clearDeleteQueue();
}

async function pullFromCloud(supabase: SupabaseClient, userId: string): Promise<number> {
  let changed = 0;

  const { data: rows, error } = await supabase
    .from('food_logs')
    .select('data')
    .eq('user_id', userId);
  if (error) throw new Error(`Could not read cloud logs: ${error.message}`);

  const existing = new Set((await db.foodLogs.toArray()).map((l) => l.createdAt));
  const pendingDeletes = new Set(readDeleteQueue());
  const touchedDates = new Set<string>();

  for (const row of rows ?? []) {
    const log = row.data as (FoodLog & { photoPaths?: string[] }) | null;
    if (!log?.createdAt || existing.has(log.createdAt) || pendingDeletes.has(log.createdAt)) {
      continue;
    }
    const { id: _id, photoPaths, photos: embedded, ...rest } = log;
    // Legacy rows embedded photos directly; new rows reference storage paths.
    const photos =
      embedded ??
      ((photoPaths?.length ?? 0) > 0 ? await downloadPhotos(supabase, photoPaths!) : undefined);
    await db.foodLogs.add({ ...rest, ...(photos ? { photos } : {}), synced: 1 });
    touchedDates.add(log.date);
    changed++;
  }
  for (const date of touchedDates) await recomputeDailySummary(date);

  // Profile: newest updatedAt wins between devices.
  const localProfile = await getProfile();
  const { data: profRow, error: profErr } = await supabase
    .from('profiles')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profErr && profRow?.data) {
    const cloudProfile = profRow.data as UserProfile;
    if (!localProfile || cloudProfile.updatedAt > localProfile.updatedAt) {
      const { id: _pid, ...rest } = cloudProfile;
      await db.profiles.clear();
      await db.profiles.add(rest as UserProfile);
      changed++;
    }
  }

  return changed;
}

async function pushToCloud(supabase: SupabaseClient, userId: string): Promise<number> {
  const profile = await getProfile();
  if (profile) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, data: profile }, { onConflict: 'user_id' });
    if (error) throw new Error(`Profile sync failed: ${error.message}`);
  }

  const pending = await db.foodLogs.where('synced').equals(0).toArray();
  if (pending.length > 0) {
    const rows = [];
    for (const l of pending) {
      // Photos go to the storage bucket; the row only carries their paths.
      const photoPaths =
        (l.photos?.length ?? 0) > 0 ? await uploadPhotos(supabase, userId, l) : undefined;
      const { photos: _photos, id: _id, ...rest } = l;
      rows.push({
        user_id: userId,
        date: l.date,
        meal_type: l.mealType,
        created_at: l.createdAt,
        data: { ...rest, synced: 1, ...(photoPaths ? { photoPaths } : {}) },
      });
    }
    const { error } = await supabase
      .from('food_logs')
      .upsert(rows, { onConflict: 'user_id,created_at' });
    if (error) throw new Error(`Food log sync failed: ${error.message}`);
    await Promise.all(pending.map((l) => db.foodLogs.update(l.id!, { synced: 1 })));
  }

  const summaries = await db.dailySummaries.toArray();
  if (summaries.length > 0) {
    const { error } = await supabase.from('daily_summaries').upsert(
      summaries.map((s) => ({ user_id: userId, date: s.date, data: { ...s, id: undefined } })),
      { onConflict: 'user_id,date' }
    );
    if (error) throw new Error(`Summary sync failed: ${error.message}`);
  }

  return pending.length;
}
