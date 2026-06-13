'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Flag,
  Loader2,
  Pencil,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import Disclaimer from '@/components/Disclaimer';
import { useExercise } from '@/hooks/useExercise';
import { useRacePlan } from '@/hooks/useRacePlan';
import {
  deleteRaceGoal,
  deleteTrainingPlan,
  getExerciseSessionsByDateRange,
  saveRaceGoal,
  saveTrainingPlan,
} from '@/lib/db';
import { apiHeaders, backgroundSync } from '@/lib/supabase';
import {
  RACE_DISTANCES,
  SESSION_FOCUS_META,
  TRAINING_EXPERIENCE,
  type PlannedSession,
  type RaceDistance,
  type RaceGoal,
  type TrainingExperience,
  type TrainingPlan,
  type TrainingWeek,
  type UserProfile,
} from '@/lib/types';
import { addDays, cn, dateStr, fmt } from '@/lib/utils';

function mondayOf(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const sinceMonday = (d.getDay() + 6) % 7;
  return addDays(date, -sinceMonday);
}

function weeksBetween(start: string, end: string): number {
  const ms = new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime();
  return Math.max(1, Math.ceil(ms / (7 * 86_400_000)));
}

function distanceLabel(goal: RaceGoal): string {
  if (goal.raceType === 'custom') return `${fmt(goal.customDistanceKm ?? 0)} km`;
  return RACE_DISTANCES.find((d) => d.value === goal.raceType)?.label ?? goal.raceType;
}

export default function RacePlan({ profile }: { profile: UserProfile }) {
  const { goal, plan, loading, refresh } = useRacePlan();
  const { refresh: refreshExercise } = useExercise();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-[30vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={28} />
      </div>
    );
  }

  if (!goal && !creating) {
    return <RaceEmptyState onStart={() => setCreating(true)} />;
  }

  if (editing || creating) {
    return (
      <GoalForm
        existing={editing ? goal : null}
        onCancel={() => {
          setEditing(false);
          setCreating(false);
        }}
        onSaved={async () => {
          setEditing(false);
          setCreating(false);
          await refresh();
        }}
      />
    );
  }

  if (!goal) return null;

  const raceInPast = goal.raceDate < dateStr();

  const generatePlan = async () => {
    setError(null);
    setGenerating(true);
    try {
      const weekStart = mondayOf(dateStr());
      const weeksAvailable = weeksBetween(weekStart, goal.raceDate);
      // Recent training context helps tailor starting volume.
      const recent = await getExerciseSessionsByDateRange(addDays(dateStr(), -28), dateStr());
      const res = await fetch('/api/training-plan', {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({
          today: dateStr(),
          weekStart,
          weeksAvailable,
          raceGoal: {
            raceType: goal.raceType,
            customDistanceKm: goal.customDistanceKm,
            raceName: goal.raceName,
            targetTime: goal.targetTime,
            raceDate: goal.raceDate,
            experience: goal.experience,
            currentWeeklyKm:
              goal.currentWeeklyKm ??
              (recent.reduce((s, x) => s + (x.distanceKm ?? 0), 0) / 4 || undefined),
            recentPerformance: goal.recentPerformance,
          },
          profile: {
            age: profile.age,
            sex: profile.sex,
            weightKg: profile.weightKg,
            goal: profile.goal,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not generate a plan.');
      const now = new Date().toISOString();
      await saveTrainingPlan({
        raceGoalCreatedAt: goal.createdAt,
        summary: data.summary,
        weeks: data.weeks as TrainingWeek[],
        createdAt: now,
        updatedAt: now,
        synced: 0,
      });
      backgroundSync();
      await refresh();
      await refreshExercise();
    } catch (err) {
      console.error('[race] plan generation failed', err);
      setError(err instanceof Error ? err.message : 'Could not generate a plan.');
    } finally {
      setGenerating(false);
    }
  };

  const removeGoal = async () => {
    await deleteRaceGoal();
    await deleteTrainingPlan();
    backgroundSync();
    await refresh();
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Goal summary */}
      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flag className="text-primary-600" size={20} />
            <h2 className="text-lg font-bold text-slate-900">
              {goal.raceName || `${distanceLabel(goal)} goal`}
            </h2>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label="Edit goal"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={() => setEditing(true)}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              aria-label="Delete goal"
              className="rounded-lg p-2 text-slate-300 hover:bg-danger-50 hover:text-danger-600"
              onClick={removeGoal}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Distance" value={distanceLabel(goal)} />
          <Stat label="Race date" value={goal.raceDate} />
          {goal.targetTime && <Stat label="Target time" value={goal.targetTime} />}
          <Stat
            label="Experience"
            value={TRAINING_EXPERIENCE.find((e) => e.value === goal.experience)?.label ?? goal.experience}
          />
          {goal.currentWeeklyKm ? (
            <Stat label="Current volume" value={`${fmt(goal.currentWeeklyKm)} km/wk`} />
          ) : null}
          {!raceInPast && (
            <Stat label="Weeks to go" value={`${weeksBetween(dateStr(), goal.raceDate)}`} />
          )}
        </div>
        {goal.recentPerformance && (
          <p className="text-sm text-slate-500">Recent form: {goal.recentPerformance}</p>
        )}
      </section>

      {raceInPast && (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          This race date is in the past. Edit your goal to set a future date and generate a fresh
          plan.
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}

      {/* Plan */}
      {!plan ? (
        <section className="card space-y-3 text-center">
          <Target className="mx-auto text-primary-500" size={28} />
          <p className="text-sm text-slate-500">
            Generate a personalised, periodised training plan from today to race day — easy runs,
            tempo, intervals, long runs and built-in rest and deload weeks.
          </p>
          <button
            type="button"
            className="btn-primary mx-auto"
            onClick={generatePlan}
            disabled={generating || raceInPast}
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Building your plan…
              </>
            ) : (
              <>
                <Sparkles size={18} /> Generate training plan
              </>
            )}
          </button>
        </section>
      ) : (
        <PlanView
          plan={plan}
          onRegenerate={generatePlan}
          regenerating={generating}
          disabled={raceInPast}
        />
      )}

      <Disclaimer />
    </div>
  );
}

function RaceEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="animate-fade-in space-y-5">
      <section className="card flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
          <Flag className="text-primary-600" size={26} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Set a race goal</h2>
        <p className="max-w-xs text-sm text-slate-500">
          Tell the coach what you&apos;re training for — a 5K, 10K, half or marathon — and get a
          safe, personalised week-by-week plan that adapts as you log sessions.
        </p>
        <button type="button" className="btn-primary mt-1" onClick={onStart}>
          <Flag size={18} /> Set your race goal
        </button>
      </section>
      <Disclaimer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan view
// ---------------------------------------------------------------------------

const INTENSITY_PILL: Record<'light' | 'moderate' | 'vigorous', string> = {
  light: 'pill-green',
  moderate: 'pill-amber',
  vigorous: 'pill-red',
};

const FOCUS_TEXT: Record<'green' | 'amber' | 'red' | 'slate', string> = {
  green: 'text-success-700',
  amber: 'text-warning-700',
  red: 'text-danger-600',
  slate: 'text-slate-500',
};

function SessionRow({ s, isToday = false }: { s: PlannedSession; isToday?: boolean }) {
  const meta = SESSION_FOCUS_META[s.focus];
  const isRest = s.focus === 'rest' || s.focus === 'recovery';
  const d = new Date(s.date + 'T12:00:00');

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5',
        isRest ? 'border border-dashed border-slate-200 bg-slate-50/60' : 'bg-slate-50',
        isToday && 'ring-2 ring-primary-400'
      )}
    >
      {/* Date block */}
      <div className="w-10 shrink-0 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {d.toLocaleDateString(undefined, { weekday: 'short' })}
        </p>
        <p className={cn('text-sm font-bold', isRest ? 'text-slate-400' : 'text-slate-700')}>
          {d.getDate()}
        </p>
      </div>

      {/* Type + title */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-[11px] font-semibold uppercase tracking-wide', FOCUS_TEXT[meta.tone])}>
            {meta.label}
          </span>
          {isToday && <span className="pill bg-primary-600 text-white">Today</span>}
        </div>
        <p
          className={cn(
            'truncate text-sm font-medium',
            isRest ? 'text-slate-500' : 'text-slate-800'
          )}
        >
          {s.title}
        </p>
        {s.description && !isRest && (
          <p className="truncate text-xs text-slate-400">{s.description}</p>
        )}
      </div>

      {/* Intensity pill (carries its own text label; rest days read "Rest") */}
      {isRest ? (
        <span className="pill shrink-0 bg-slate-200 text-slate-500">Rest</span>
      ) : (
        <span className={cn(INTENSITY_PILL[s.intensity], 'shrink-0')}>{s.intensity}</span>
      )}
    </div>
  );
}

function PlanView({
  plan,
  onRegenerate,
  regenerating,
  disabled,
}: {
  plan: TrainingPlan;
  onRegenerate: () => void;
  regenerating: boolean;
  disabled: boolean;
}) {
  const today = dateStr();
  const [openWeek, setOpenWeek] = useState<number | null>(() => {
    const current = plan.weeks.find((w) => w.sessions.some((s) => s.date >= today));
    return current?.weekNumber ?? plan.weeks[0]?.weekNumber ?? null;
  });

  // Next 1–2 prescribed sessions from today onward (the day-to-day focus).
  const upcoming = useMemo(() => {
    return plan.weeks
      .flatMap((w) => w.sessions)
      .filter((s) => s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 2);
  }, [plan, today]);

  return (
    <div className="space-y-5">
      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-900">Your plan</h2>
        <p className="text-sm leading-relaxed text-slate-600">{plan.summary}</p>
      </section>

      {upcoming.length > 0 && (
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <CalendarDays size={18} className="text-primary-600" /> Next up
          </h2>
          <div className="space-y-2">
            {upcoming.map((s, i) => (
              <SessionRow key={`${s.date}-${i}`} s={s} isToday={s.date === today} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-900">Full schedule</h2>
        {plan.weeks.map((w) => {
          const isOpen = openWeek === w.weekNumber;
          return (
            <div key={w.weekNumber} className="card p-0 overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 p-4 text-left"
                onClick={() => setOpenWeek(isOpen ? null : w.weekNumber)}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    Week {w.weekNumber}
                    <span className="ml-2 font-normal capitalize text-slate-400">{w.phase}</span>
                    {w.isDeload && (
                      <span className="ml-2 pill bg-success-50 text-success-700">deload</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {w.focus}
                    {w.totalKm ? ` · ~${fmt(w.totalKm)} km` : ''}
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={cn('shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
                />
              </button>
              {isOpen && (
                <div className="animate-slide-up space-y-2 border-t border-slate-100 px-4 py-4">
                  {w.sessions.map((s, i) => (
                    <SessionRow key={`${s.date}-${i}`} s={s} isToday={s.date === today} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <button
        type="button"
        className="btn-secondary w-full"
        onClick={onRegenerate}
        disabled={regenerating || disabled}
      >
        {regenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        Regenerate plan
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal setup form
// ---------------------------------------------------------------------------

function GoalForm({
  existing,
  onCancel,
  onSaved,
}: {
  existing: RaceGoal | null;
  onCancel?: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [raceType, setRaceType] = useState<RaceDistance>(existing?.raceType ?? '10k');
  const [customKm, setCustomKm] = useState(existing?.customDistanceKm?.toString() ?? '');
  const [raceName, setRaceName] = useState(existing?.raceName ?? '');
  const [targetTime, setTargetTime] = useState(existing?.targetTime ?? '');
  const [raceDate, setRaceDate] = useState(existing?.raceDate ?? '');
  const [experience, setExperience] = useState<TrainingExperience>(
    existing?.experience ?? 'beginner'
  );
  const [weeklyKm, setWeeklyKm] = useState(existing?.currentWeeklyKm?.toString() ?? '');
  const [recent, setRecent] = useState(existing?.recentPerformance ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    raceDate &&
    raceDate >= dateStr() &&
    (raceType !== 'custom' || Number(customKm) > 0);

  const submit = async () => {
    if (!valid) {
      setError('Choose a future race date (and a distance for custom races).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await saveRaceGoal({
        raceType,
        customDistanceKm: raceType === 'custom' ? Number(customKm) : undefined,
        raceName: raceName.trim() || undefined,
        targetTime: targetTime.trim() || undefined,
        raceDate,
        experience,
        currentWeeklyKm: weeklyKm ? Number(weeklyKm) : undefined,
        recentPerformance: recent.trim() || undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        synced: 0,
      });
      backgroundSync();
      await onSaved();
    } catch (err) {
      console.error('[race] save goal failed', err);
      setError('Could not save your goal. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {existing ? 'Edit race goal' : 'Set your race goal'}
        </h2>
        <p className="text-sm text-slate-400">
          Tell the coach what you&apos;re training for so it can build a safe, tailored plan.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Race distance</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RACE_DISTANCES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setRaceType(d.value)}
                className={cn(
                  'rounded-xl border py-2.5 text-xs font-semibold transition-colors',
                  raceType === d.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {raceType === 'custom' && (
          <div>
            <label className="label" htmlFor="custom-km">
              Custom distance (km)
            </label>
            <input
              id="custom-km"
              type="number"
              min={0}
              step="0.1"
              className="input"
              value={customKm}
              onChange={(e) => setCustomKm(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="race-name">
            Event name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="race-name"
            className="input"
            value={raceName}
            onChange={(e) => setRaceName(e.target.value)}
            placeholder="e.g. City Half Marathon"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="race-date">
              Race date
            </label>
            <input
              id="race-date"
              type="date"
              min={dateStr()}
              className="input"
              value={raceDate}
              onChange={(e) => setRaceDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="target-time">
              Target time <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="target-time"
              className="input"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              placeholder="e.g. sub-50 / 1:45:00"
            />
          </div>
        </div>

        <div>
          <label className="label">Experience level</label>
          <div className="space-y-2">
            {TRAINING_EXPERIENCE.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => setExperience(e.value)}
                className={cn(
                  'flex w-full flex-col rounded-xl border px-4 py-2.5 text-left transition-colors',
                  experience === e.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                )}
              >
                <span className="text-sm font-semibold text-slate-800">{e.label}</span>
                <span className="text-xs text-slate-400">{e.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="weekly-km">
            Current weekly distance (km) <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="weekly-km"
            type="number"
            min={0}
            className="input"
            value={weeklyKm}
            onChange={(e) => setWeeklyKm(e.target.value)}
            placeholder="e.g. 20"
          />
        </div>

        <div>
          <label className="label" htmlFor="recent-perf">
            Recent times / fitness <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="recent-perf"
            className="input min-h-[64px] resize-y"
            value={recent}
            onChange={(e) => setRecent(e.target.value)}
            placeholder="e.g. ran 10K in 55:00 last month, comfortable with 5K"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn-primary flex-1" onClick={submit} disabled={saving}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Flag size={18} />}
          {existing ? 'Save goal' : 'Save goal'}
        </button>
      </div>
      <Disclaimer />
    </div>
  );
}
