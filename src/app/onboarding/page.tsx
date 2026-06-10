'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import {
  BasicsFields,
  EMPTY_FORM,
  GoalsFields,
  HealthDietFields,
  WorkoutPrefFields,
  profileFromForm,
  validateBasics,
  type ProfileFormState,
} from '@/components/ProfileFields';
import { saveProfile } from '@/lib/db';
import { cn } from '@/lib/utils';

const STEPS = ['Profile', 'Health & Diet', 'Goals', 'Workout Preference'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (update: Partial<ProfileFormState>) => {
    setForm((f) => ({ ...f, ...update }));
    setError(null);
  };

  const next = () => {
    if (step === 0) {
      const err = validateBasics(form);
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = async () => {
    const err = validateBasics(form);
    if (err) {
      setError(err);
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      await saveProfile(profileFromForm(form));
      router.replace('/');
    } catch {
      setError('Could not save your profile. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg animate-slide-up py-4">
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-2xl font-black text-white">
          N
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to NutriCoach</h1>
        <p className="text-sm text-slate-400">
          A few details so we can personalise your nutrition and fitness targets.
        </p>
      </header>

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                i < step
                  ? 'bg-primary-600 text-white'
                  : i === step
                    ? 'bg-primary-50 text-primary-600 ring-2 ring-primary-600'
                    : 'bg-slate-100 text-slate-400'
              )}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className="h-0.5 w-6 rounded bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold text-slate-900">
          Step {step + 1} · {STEPS[step]}
        </h2>

        {step === 0 && <BasicsFields form={form} set={set} />}
        {step === 1 && <HealthDietFields form={form} set={set} />}
        {step === 2 && <GoalsFields form={form} set={set} />}
        {step === 3 && <WorkoutPrefFields form={form} set={set} />}

        {error && (
          <p className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
          >
            <ArrowLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary" onClick={next}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={finish} disabled={saving}>
              {saving ? 'Saving…' : 'Finish'} <Check size={16} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        All data stays on this device unless you enable cloud sync in Settings.
      </p>
    </div>
  );
}
