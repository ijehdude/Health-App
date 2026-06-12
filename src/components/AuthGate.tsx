'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import {
  backgroundSync,
  getSupabase,
  isSupabaseConfigured,
  runFirstLoginMigration,
} from '@/lib/supabase';

const AuthContext = createContext<{ user: User | null }>({ user: null });

/** Signed-in user, or null when cloud sync is not configured. */
export const useAuth = () => useContext(AuthContext);

type GateState = 'loading' | 'signedOut' | 'recovery' | 'signedIn';

/**
 * Gates the whole app behind Supabase auth. When Supabase env vars are not
 * set, the app runs in local-only mode with no gate (graceful degradation).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [state, setState] = useState<GateState>(configured ? 'loading' : 'signedIn');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase()!;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setState((s) => (s === 'recovery' ? s : data.session ? 'signedIn' : 'signedOut'));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setUser(session?.user ?? null);
        setState('recovery');
        return;
      }
      setUser(session?.user ?? null);
      setState((s) => (s === 'recovery' && session ? s : session ? 'signedIn' : 'signedOut'));
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  // After login: one-time local→cloud migration, then keep syncing.
  useEffect(() => {
    if (state !== 'signedIn' || !user) return;
    runFirstLoginMigration(user.id).catch((err) =>
      console.warn('[sync] First-login migration failed — will retry on next sync:', err)
    );
    const onOnline = () => backgroundSync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [state, user]);

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }
  if (state === 'signedOut') return <AuthScreen />;
  if (state === 'recovery') return <RecoveryScreen onDone={() => setState('signedIn')} />;

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Sign in / sign up / forgot password
// ---------------------------------------------------------------------------

type AuthMode = 'signin' | 'signup' | 'reset';

function AuthScreen() {
  const supabase = getSupabase()!;
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setMessage(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        // onAuthStateChange flips the gate — nothing else to do.
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (!data.session) {
          setMessage({
            text: 'Account created — check your email for a confirmation link, then sign in.',
            isError: false,
          });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw new Error(error.message);
        setMessage({
          text: 'Password reset email sent — open the link, and you’ll be asked to set a new password.',
          isError: false,
        });
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Something went wrong — please try again.',
        isError: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<AuthMode, { heading: string; cta: string }> = {
    signin: { heading: 'Welcome back', cta: 'Sign in' },
    signup: { heading: 'Create your account', cta: 'Sign up' },
    reset: { heading: 'Reset your password', cta: 'Send reset email' },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-2xl font-black text-white">
            N
          </div>
          <h1 className="text-2xl font-bold text-slate-900">NutriCoach</h1>
          <p className="text-sm text-slate-400">Your meals, synced to your account.</p>
        </div>

        <form className="card space-y-4" onSubmit={submit}>
          <h2 className="font-semibold text-slate-900">{titles[mode].heading}</h2>
          <div>
            <label className="label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {mode !== 'reset' && (
            <div>
              <label className="label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="input"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          )}

          {message && (
            <p
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                message.isError ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-700'
              }`}
            >
              {message.text}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy || !email}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {titles[mode].cta}
          </button>

          <div className="space-y-1 text-center text-sm">
            {mode === 'signin' && (
              <>
                <p className="text-slate-500">
                  New here?{' '}
                  <button type="button" className="font-semibold text-primary-600" onClick={() => switchMode('signup')}>
                    Create an account
                  </button>
                </p>
                <button type="button" className="text-xs text-slate-400 underline" onClick={() => switchMode('reset')}>
                  Forgot your password?
                </button>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-slate-500">
                Already have an account?{' '}
                <button type="button" className="font-semibold text-primary-600" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <button type="button" className="font-semibold text-primary-600" onClick={() => switchMode('signin')}>
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set a new password (arrived via reset-email link)
// ---------------------------------------------------------------------------

function RecoveryScreen({ onDone }: { onDone: () => void }) {
  const supabase = getSupabase()!;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onDone();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form className="card w-full max-w-sm animate-slide-up space-y-4" onSubmit={submit}>
        <h2 className="font-semibold text-slate-900">Set a new password</h2>
        <input
          className="input"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 6 characters)"
        />
        {error && (
          <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">{error}</p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy || password.length < 6}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          Save new password
        </button>
      </form>
    </div>
  );
}
