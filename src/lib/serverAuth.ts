import { createClient } from '@supabase/supabase-js';

type SessionCheck = { ok: true } | { ok: false; status: number; message: string };

/**
 * Validates the Supabase session token sent by the client (Authorization:
 * Bearer <access_token>). Uses only the public anon key — Supabase's auth
 * server verifies the JWT, no service_role key needed.
 *
 * When Supabase env vars are absent the app runs in local-only mode with no
 * accounts, so AI routes stay open (there is nobody to authenticate).
 */
export async function validateSession(req: Request): Promise<SessionCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: true };

  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return { ok: false, status: 401, message: 'Sign in to use AI features.' };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, message: 'Your session has expired — please sign in again.' };
  }
  return { ok: true };
}
