'use client';

import {
  ACTIVITY_LEVELS,
  DIETARY_RESTRICTIONS,
  FITNESS_GOALS,
  HEALTH_CONDITIONS,
  type ActivityLevel,
  type DietaryRestriction,
  type FitnessGoal,
  type HealthCondition,
  type Sex,
  type UserProfile,
  type WorkoutPreference,
} from '@/lib/types';
import { bmiCategory, calcBMI, calcTargets } from '@/lib/nutrition';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Form state (numbers kept as strings for friendly input handling)
// ---------------------------------------------------------------------------

export interface ProfileFormState {
  name: string;
  age: string;
  sex: Sex;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  workoutPreference: WorkoutPreference;
  dietaryRestrictions: DietaryRestriction[];
  healthConditions: HealthCondition[];
}

export const EMPTY_FORM: ProfileFormState = {
  name: '',
  age: '',
  sex: 'male',
  heightCm: '',
  weightKg: '',
  activityLevel: 'moderate',
  goal: 'maintain',
  workoutPreference: 'both',
  dietaryRestrictions: [],
  healthConditions: [],
};

export function formFromProfile(p: UserProfile): ProfileFormState {
  return {
    name: p.name,
    age: String(p.age),
    sex: p.sex,
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg),
    activityLevel: p.activityLevel,
    goal: p.goal,
    workoutPreference: p.workoutPreference,
    dietaryRestrictions: p.dietaryRestrictions,
    healthConditions: p.healthConditions,
  };
}

export function validateBasics(form: ProfileFormState): string | null {
  const age = Number(form.age);
  const height = Number(form.heightCm);
  const weight = Number(form.weightKg);
  if (!form.name.trim()) return 'Please enter your name.';
  if (!age || age < 13 || age > 110) return 'Please enter an age between 13 and 110.';
  if (!height || height < 100 || height > 250) return 'Please enter a height between 100 and 250 cm.';
  if (!weight || weight < 30 || weight > 300) return 'Please enter a weight between 30 and 300 kg.';
  return null;
}

/** Builds a complete profile (with freshly calculated targets) from the form. */
export function profileFromForm(form: ProfileFormState, existingId?: number): UserProfile {
  const age = Number(form.age);
  const heightCm = Number(form.heightCm);
  const weightKg = Number(form.weightKg);
  return {
    ...(existingId != null ? { id: existingId } : {}),
    name: form.name.trim(),
    age,
    sex: form.sex,
    heightCm,
    weightKg,
    activityLevel: form.activityLevel,
    goal: form.goal,
    workoutPreference: form.workoutPreference,
    dietaryRestrictions: form.dietaryRestrictions,
    healthConditions: form.healthConditions,
    targets: calcTargets({
      age,
      sex: form.sex,
      heightCm,
      weightKg,
      activityLevel: form.activityLevel,
      goal: form.goal,
      healthConditions: form.healthConditions,
    }),
    updatedAt: new Date().toISOString(),
  };
}

type Setter = (update: Partial<ProfileFormState>) => void;

// ---------------------------------------------------------------------------
// Field groups
// ---------------------------------------------------------------------------

export function BmiPreview({ form }: { form: ProfileFormState }) {
  const bmi = calcBMI(Number(form.heightCm), Number(form.weightKg));
  if (!bmi) return null;
  const cat = bmiCategory(bmi);
  const tone = {
    success: 'bg-success-50 text-success-700 border-success-200',
    warning: 'bg-warning-50 text-warning-700 border-warning-200',
    danger: 'bg-danger-50 text-danger-700 border-danger-200',
  }[cat.tone];
  return (
    <div className={cn('animate-fade-in flex items-center justify-between rounded-xl border px-4 py-3 text-sm', tone)}>
      <span className="font-medium">
        BMI: <strong>{bmi.toFixed(1)}</strong>
      </span>
      <span className="font-semibold">{cat.label}</span>
    </div>
  );
}

export function BasicsFields({ form, set }: { form: ProfileFormState; set: Setter }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="pf-name">Name</label>
        <input
          id="pf-name"
          className="input"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Your name"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="pf-age">Age</label>
          <input
            id="pf-age"
            className="input"
            type="number"
            inputMode="numeric"
            min={13}
            max={110}
            value={form.age}
            onChange={(e) => set({ age: e.target.value })}
            placeholder="e.g. 28"
          />
        </div>
        <div>
          <label className="label" htmlFor="pf-sex">Sex</label>
          <select
            id="pf-sex"
            className="input"
            value={form.sex}
            onChange={(e) => set({ sex: e.target.value as Sex })}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="pf-height">Height (cm)</label>
          <input
            id="pf-height"
            className="input"
            type="number"
            inputMode="decimal"
            value={form.heightCm}
            onChange={(e) => set({ heightCm: e.target.value })}
            placeholder="e.g. 175"
          />
        </div>
        <div>
          <label className="label" htmlFor="pf-weight">Weight (kg)</label>
          <input
            id="pf-weight"
            className="input"
            type="number"
            inputMode="decimal"
            value={form.weightKg}
            onChange={(e) => set({ weightKg: e.target.value })}
            placeholder="e.g. 70"
          />
        </div>
      </div>
      <BmiPreview form={form} />
    </div>
  );
}

function CheckboxGrid<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left text-sm font-medium capitalize transition-colors',
              checked
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function HealthDietFields({ form, set }: { form: ProfileFormState; set: Setter }) {
  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Dietary restrictions <span className="font-normal text-slate-400">(select all that apply)</span></p>
        <CheckboxGrid
          options={DIETARY_RESTRICTIONS}
          selected={form.dietaryRestrictions}
          onToggle={(v) => set({ dietaryRestrictions: toggle(form.dietaryRestrictions, v as DietaryRestriction) })}
        />
      </div>
      <div>
        <p className="label">Health conditions <span className="font-normal text-slate-400">(select all that apply)</span></p>
        <CheckboxGrid
          options={HEALTH_CONDITIONS}
          selected={form.healthConditions}
          onToggle={(v) => set({ healthConditions: toggle(form.healthConditions, v as HealthCondition) })}
        />
        <p className="mt-2 text-xs text-slate-400">
          Used to adjust your sugar, sodium and saturated-fat limits. Not medical advice.
        </p>
      </div>
    </div>
  );
}

function RadioCards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; description: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-left transition-colors',
            value === opt.value
              ? 'border-primary-500 bg-primary-50'
              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
          )}
        >
          <span className={cn('block text-sm font-semibold', value === opt.value ? 'text-primary-700' : 'text-slate-700')}>
            {opt.label}
          </span>
          <span className="block text-xs text-slate-400">{opt.description}</span>
        </button>
      ))}
    </div>
  );
}

export function GoalsFields({ form, set }: { form: ProfileFormState; set: Setter }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="label">Activity level</p>
        <RadioCards
          options={ACTIVITY_LEVELS}
          value={form.activityLevel}
          onChange={(v) => set({ activityLevel: v })}
        />
      </div>
      <div>
        <p className="label">Fitness goal</p>
        <RadioCards options={FITNESS_GOALS} value={form.goal} onChange={(v) => set({ goal: v })} />
      </div>
    </div>
  );
}

export function WorkoutPrefFields({ form, set }: { form: ProfileFormState; set: Setter }) {
  return (
    <RadioCards
      options={[
        { value: 'home' as const, label: 'Home only', description: 'Bodyweight and minimal-equipment workouts' },
        { value: 'gym' as const, label: 'Gym', description: 'Access to machines and free weights' },
        { value: 'both' as const, label: 'Both', description: 'Mix of home and gym sessions' },
      ]}
      value={form.workoutPreference}
      onChange={(v) => set({ workoutPreference: v })}
    />
  );
}
