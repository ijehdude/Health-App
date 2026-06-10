'use client';

import { useEffect, useState } from 'react';
import { Check, Cloud, Download, Loader2, LogOut, Trash2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import {
  BasicsFields,
  EMPTY_FORM,
  GoalsFields,
  HealthDietFields,
  WorkoutPrefFields,
  formFromProfile,
  profileFromForm,
  validateBasics,
  type ProfileFormState,
} from '@/components/ProfileFields';
import { useProfile } from '@/hooks/useProfile';
import { deleteAllData, exportAllData, saveProfile } from '@/lib/db';
import { getSupabase, isSupabaseConfigured, syncToCloud } from '@/lib/supabase';
import { dateStr, fmt } from '@/lib/utils';

export default function SettingsPage() {
  const { profile, loading, refresh } = useProfile();
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm(formFromProfile(profile));
  }, [profile]);

  const set = (update: Partial<ProfileFormState>) => {
    setForm((f) => ({ ...f, ...update }));
    setError(null);
    setSaved(false);
  };

  const save = async () => {
    const err = validateBasics(form);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    try {
      await saveProfile(profileFromForm(form, profile?.id));
      await refresh();
      setSaved(true);
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutricoach-export-${dateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wipe = async () => {
    const sure = window.confirm(
      'Delete ALL NutriCoach data on this device? This cannot be undone. Consider exporting first.'
    );
    if (!sure) return;
    await deleteAllData();
    window.location.href = '/onboarding';
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  const targets = profile?.targets;

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-400">Profile, targets and data.</p>
      </header>

      <section className="card space-y-5">
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <BasicsFields form={form} set={set} />
        <HealthDietFields form={form} set={set} />
        <GoalsFields form={form} set={set} />
        <div>
          <p className="label">Workout preference</p>
          <WorkoutPrefFields form={form} set={set} />
        </div>

        {error && (
          <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
            {error}
          </p>
        )}

        <button type="button" className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
          {saved ? 'Saved — targets recalculated' : 'Save changes'}
        </button>
      </section>

      {/* Read-only targets */}
      {targets && (
        <section className="card">
          <h2 className="mb-3 font-semibold text-slate-900">Your daily targets</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'BMR', value: `${fmt(targets.bmr)} kcal` },
              { label: 'TDEE', value: `${fmt(targets.tdee)} kcal` },
              { label: 'Calorie target', value: `${fmt(targets.calorieTarget)} kcal` },
              { label: 'Protein', value: `${fmt(targets.nutrients.protein)} g` },
              { label: 'Carbohydrates', value: `${fmt(targets.nutrients.carbs)} g` },
              { label: 'Fat', value: `${fmt(targets.nutrients.fat)} g` },
              { label: 'Fibre', value: `${fmt(targets.nutrients.fibre)} g` },
              { label: 'Sugar limit', value: `${fmt(targets.nutrients.sugar)} g` },
              { label: 'Sodium limit', value: `${fmt(targets.nutrients.sodium)} mg` },
            ].map((t) => (
              <div key={t.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs text-slate-400">{t.label}</p>
                <p className="text-sm font-bold tabular-nums text-slate-800">{t.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Recalculated automatically whenever you save profile changes.
          </p>
        </section>
      )}

      <CloudSyncCard />

      {/* Data management */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-900">Your data</h2>
        <button type="button" className="btn-secondary w-full" onClick={exportData}>
          <Download size={16} /> Export all data as JSON
        </button>
        <button type="button" className="btn-danger w-full" onClick={wipe}>
          <Trash2 size={16} /> Delete all data
        </button>
        <p className="text-xs text-slate-400">
          All data lives in your browser (IndexedDB) unless you enable cloud sync.
        </p>
      </section>
    </div>
  );
}

function CloudSyncCard() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <section className="card">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Cloud size={18} /> Cloud sync
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Optional. Add Supabase credentials to <code className="rounded bg-slate-100 px-1">.env.local</code>{' '}
          (see SETUP.md) to back up your data and sync across devices.
        </p>
      </section>
    );
  }

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await fn(), isError: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong.', isError: true });
    } finally {
      setBusy(false);
    }
  };

  const supabase = getSupabase()!;

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <Cloud size={18} /> Cloud sync
      </h2>

      {session ? (
        <>
          <p className="text-sm text-slate-500">
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { logs } = await syncToCloud();
                  return `Synced ${logs} food logs to the cloud.`;
                })
              }
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />} Sync now
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await supabase.auth.signOut();
                  return 'Signed out.';
                })
              }
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={busy || !email || !password}
              onClick={() =>
                run(async () => {
                  const { error } = await supabase.auth.signInWithPassword({ email, password });
                  if (error) throw new Error(error.message);
                  return 'Signed in.';
                })
              }
            >
              Sign in
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              disabled={busy || !email || !password}
              onClick={() =>
                run(async () => {
                  const { error } = await supabase.auth.signUp({ email, password });
                  if (error) throw new Error(error.message);
                  return 'Account created — check your email to confirm.';
                })
              }
            >
              Sign up
            </button>
          </div>
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: `${window.location.origin}/settings` },
                });
                if (error) throw new Error(error.message);
                return 'Redirecting to Google…';
              })
            }
          >
            Continue with Google
          </button>
        </>
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
    </section>
  );
}
