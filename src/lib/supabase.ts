import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from './db';

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

/** Pushes the local Dexie database to Supabase for the signed-in user. */
export async function syncToCloud(): Promise<{ logs: number }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Cloud sync is not configured.');

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sign in before syncing.');

  const profile = await db.profiles.toCollection().first();
  if (profile) {
    const { error } = await supabase.from('profiles').upsert(
      { user_id: userId, data: profile },
      { onConflict: 'user_id' }
    );
    if (error) throw new Error(`Profile sync failed: ${error.message}`);
  }

  const logs = await db.foodLogs.toArray();
  if (logs.length > 0) {
    const { error } = await supabase.from('food_logs').upsert(
      logs.map((l) => ({
        user_id: userId,
        date: l.date,
        meal_type: l.mealType,
        created_at: l.createdAt,
        data: l,
      })),
      { onConflict: 'user_id,created_at' }
    );
    if (error) throw new Error(`Food log sync failed: ${error.message}`);
    await db.foodLogs.toCollection().modify({ synced: 1 });
  }

  const summaries = await db.dailySummaries.toArray();
  if (summaries.length > 0) {
    const { error } = await supabase.from('daily_summaries').upsert(
      summaries.map((s) => ({ user_id: userId, date: s.date, data: s })),
      { onConflict: 'user_id,date' }
    );
    if (error) throw new Error(`Summary sync failed: ${error.message}`);
  }

  return { logs: logs.length };
}
