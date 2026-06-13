'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import Disclaimer from '@/components/Disclaimer';
import { useExercise } from '@/hooks/useExercise';
import { addExerciseSessions, deleteExerciseSession } from '@/lib/db';
import { ACCEPTED_FILE_EXTENSIONS, extractFile, UnsupportedFileError } from '@/lib/fileExtract';
import { apiHeaders, backgroundSync } from '@/lib/supabase';
import {
  EXERCISE_MODALITIES,
  type ExerciseSession,
  type Intensity,
  type ParsedExerciseSession,
  type ParseExerciseResponse,
  type UserProfile,
} from '@/lib/types';
import { cn, dateStr, fmt } from '@/lib/utils';

const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'vigorous', label: 'Vigorous' },
];

const INTENSITY_PILL: Record<Intensity, string> = {
  light: 'pill-green',
  moderate: 'pill-amber',
  vigorous: 'pill-red',
};

function emptySession(): ParsedExerciseSession {
  return {
    date: dateStr(),
    activity: '',
    modality: 'run',
    durationMinutes: 0,
    intensity: 'moderate',
    caloriesBurned: 0,
    confidence: 'medium',
  };
}

export default function LogExercise({ profile }: { profile: UserProfile }) {
  const { sessions: todays, refresh } = useExercise();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Analysing…');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedExerciseSession[] | null>(null);
  const [source, setSource] = useState<'text' | 'file'>('text');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPreview(null);
    setWarning(null);
    setError(null);
    setText('');
  };

  const callParse = async (
    payload: Record<string, unknown>,
    src: 'text' | 'file',
    label: string
  ) => {
    setError(null);
    setWarning(null);
    setBusy(true);
    setBusyLabel(label);
    try {
      const res = await fetch('/api/parse-exercise', {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({
          ...payload,
          today: dateStr(),
          weightKg: profile.weightKg,
          sex: profile.sex,
          age: profile.age,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not parse the workout.');
      const parsed = data as ParseExerciseResponse;
      if (!parsed.sessions || parsed.sessions.length === 0) {
        setError(
          parsed.warningMessage ??
            'No workouts could be identified — try adding more detail or a different file.'
        );
        return;
      }
      setSource(src);
      setWarning(parsed.warningMessage ?? null);
      setPreview(parsed.sessions);
    } catch (err) {
      console.error('[exercise] parse failed', { src, error: err });
      setError(err instanceof Error ? err.message : 'Could not parse the workout.');
    } finally {
      setBusy(false);
    }
  };

  const analyseText = () => {
    if (text.trim().length < 3) return;
    callParse({ text: text.trim() }, 'text', 'Analysing your workout…');
  };

  const handleFile = async (file: File) => {
    setError(null);
    setWarning(null);
    setBusy(true);
    setBusyLabel('Reading file…');
    try {
      const extracted = await extractFile(file);
      setBusyLabel('Importing workouts…');
      const payload: Record<string, unknown> = { sourceHint: file.name };
      if (extracted.document) payload.document = extracted.document;
      if (extracted.text) {
        if (extracted.text.trim().length === 0) {
          throw new Error('That file appears to be empty.');
        }
        payload.text = extracted.text;
      }
      await callParse(payload, 'file', 'Importing workouts…');
    } catch (err) {
      console.error('[exercise] file import failed', { name: file.name, error: err });
      setError(
        err instanceof UnsupportedFileError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not read that file.'
      );
      setBusy(false);
    }
  };

  const updateRow = (i: number, changes: Partial<ParsedExerciseSession>) => {
    setPreview((prev) => prev && prev.map((s, j) => (j === i ? { ...s, ...changes } : s)));
  };
  const removeRow = (i: number) => {
    setPreview((prev) => prev && prev.filter((_, j) => j !== i));
  };
  const addRow = () => setPreview((prev) => [...(prev ?? []), emptySession()]);

  const confirmSave = async () => {
    if (!preview || preview.length === 0) return;
    setSaving(true);
    try {
      const now = Date.now();
      const records: ExerciseSession[] = preview.map((s, i) => {
        const { confidence: _confidence, ...rest } = s;
        return {
          ...rest,
          activity: rest.activity.trim() || 'Workout',
          source,
          // Stagger createdAt so each row gets a unique cloud upsert key.
          createdAt: new Date(now + i).toISOString(),
          synced: 0,
        };
      });
      await addExerciseSessions(records);
      backgroundSync();
      reset();
      await refresh();
    } catch (err) {
      console.error('[exercise] save failed', err);
      setError('Could not save these sessions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeSaved = async (id?: number) => {
    if (id == null) return;
    await deleteExerciseSession(id);
    backgroundSync();
    await refresh();
  };

  // -------------------------------------------------------------------------
  // Preview / confirm screen
  // -------------------------------------------------------------------------
  if (preview) {
    return (
      <div className="animate-slide-up space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Review parsed sessions</h2>
          <button type="button" className="btn-ghost" onClick={reset}>
            Cancel
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Check these before saving — edit anything that looks off. Nothing is saved until you
          confirm.
        </p>

        {warning && (
          <div className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>{warning}</p>
          </div>
        )}

        <div className="space-y-3">
          {preview.map((s, i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={INTENSITY_PILL[s.intensity]}>{s.intensity}</span>
                <div className="flex items-center gap-2">
                  <span className="pill bg-slate-100 text-slate-500">{s.confidence} confidence</span>
                  <button
                    type="button"
                    aria-label="Remove session"
                    onClick={() => removeRow(i)}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Activity" className="col-span-2">
                  <input
                    className="input"
                    value={s.activity}
                    onChange={(e) => updateRow(i, { activity: e.target.value })}
                    placeholder="e.g. Easy run"
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    className="input"
                    value={s.date}
                    onChange={(e) => updateRow(i, { date: e.target.value })}
                  />
                </Field>
                <Field label="Type">
                  <select
                    className="input"
                    value={s.modality}
                    onChange={(e) =>
                      updateRow(i, { modality: e.target.value as ParsedExerciseSession['modality'] })
                    }
                  >
                    {EXERCISE_MODALITIES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Duration (min)">
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={s.durationMinutes || ''}
                    onChange={(e) => updateRow(i, { durationMinutes: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Distance (km)">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className="input"
                    value={s.distanceKm ?? ''}
                    onChange={(e) =>
                      updateRow(i, {
                        distanceKm: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Intensity">
                  <select
                    className="input"
                    value={s.intensity}
                    onChange={(e) => updateRow(i, { intensity: e.target.value as Intensity })}
                  >
                    {INTENSITIES.map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Calories (kcal)">
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={s.caloriesBurned || ''}
                    onChange={(e) => updateRow(i, { caloriesBurned: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="btn-secondary w-full" onClick={addRow}>
          <Plus size={16} /> Add a session
        </button>

        {error && (
          <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn-primary w-full py-3.5"
          onClick={confirmSave}
          disabled={saving || preview.length === 0}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Save {preview.length} {preview.length === 1 ? 'session' : 'sessions'}
        </button>
        <Disclaimer />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Input screen
  // -------------------------------------------------------------------------
  return (
    <div className="animate-fade-in space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            { value: 'text', label: 'Describe', icon: Type },
            { value: 'file', label: 'Upload file', icon: FileUp },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
              mode === value ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
            )}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {mode === 'text' ? (
        <div className="card space-y-3">
          <label className="label" htmlFor="workout-text">
            Describe your workout
          </label>
          <textarea
            id="workout-text"
            className="input min-h-[120px] resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. ran 5k in 28 min this morning, then 20 min easy bike"
          />
          <button
            type="button"
            className="btn-primary w-full py-3"
            onClick={analyseText}
            disabled={busy || text.trim().length < 3}
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" /> {busyLabel}
              </>
            ) : (
              <>
                <Sparkles size={18} /> Parse workout
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="card space-y-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-10 transition-colors hover:border-primary-300"
          >
            {busy ? (
              <>
                <Loader2 size={26} className="animate-spin text-primary-500" />
                <span className="text-sm font-medium text-slate-600">{busyLabel}</span>
              </>
            ) : (
              <>
                <FileUp size={26} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  Upload a past-workout file
                </span>
                <span className="text-xs text-slate-400">
                  Excel, CSV, Word (.docx), PDF or text · Strava / Garmin / Apple Health exports or
                  freeform logs
                </span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-slate-400">
            Scanned/visual PDFs are read by AI; spreadsheets and documents are parsed on your device.
            You&apos;ll preview and confirm everything before it&apos;s saved.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}

      {/* Today's logged sessions */}
      <section className="card">
        <h2 className="mb-3 font-semibold text-slate-900">Logged today</h2>
        {todays.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No exercise logged yet today.</p>
        ) : (
          <ul className="space-y-2">
            {todays.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{s.activity}</p>
                  <p className="text-xs text-slate-400">
                    {s.durationMinutes} min
                    {s.distanceKm ? ` · ${fmt(s.distanceKm)} km` : ''}
                    {s.pace ? ` · ${s.pace}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-slate-700">
                    {fmt(s.caloriesBurned)} kcal
                  </span>
                  <button
                    type="button"
                    aria-label="Delete session"
                    onClick={() => removeSaved(s.id)}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Disclaimer />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
