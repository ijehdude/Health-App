import { EXERCISES } from '@/data/exercises';
import { ageGroupOf } from './nutrition';
import { SESSION_FOCUS_META } from './types';
import type {
  AgeGroup,
  Exercise,
  ExerciseType,
  Intensity,
  Nutrition,
  PlannedSession,
  TrainingPlan,
  UserProfile,
  WorkoutPlan,
  WorkoutTrigger,
} from './types';

/** Finds the session a training plan prescribes for a given local date, if any. */
export function plannedSessionForDate(
  plan: TrainingPlan | null | undefined,
  date: string
): PlannedSession | undefined {
  if (!plan) return undefined;
  for (const week of plan.weeks) {
    const match = week.sessions.find((s) => s.date === date);
    if (match) return match;
  }
  return undefined;
}

const INTENSITY_RANK: Record<Intensity, number> = { light: 0, moderate: 1, vigorous: 2 };

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface PlanSpec {
  trigger: WorkoutTrigger;
  reason: string;
  rationale: string;
  intensity: Intensity;
  types: ExerciseType[];
  count: number;
}

function specFor(profile: UserProfile, total: Nutrition): PlanSpec {
  const targets = profile.targets.nutrients;
  const pct = (key: keyof Nutrition) =>
    targets[key] > 0 ? (total[key] / targets[key]) * 100 : 0;

  const ageGroup = ageGroupOf(profile.age);
  const hasLogs = total.calories > 0;

  if (ageGroup === 'senior') {
    return {
      trigger: 'senior',
      reason: 'Age-appropriate plan (55+)',
      rationale:
        'At 55+, low-impact movement is the priority: it preserves muscle, protects joints and bones, and improves balance — all while still supporting your nutrition goals. This plan keeps intensity light and every exercise has a supported variation.',
      intensity: 'light',
      types: ['strength', 'flexibility', 'cardio', 'recovery'],
      count: 4,
    };
  }

  if (hasLogs && pct('calories') > 125) {
    return {
      trigger: 'surplus',
      reason: `Calorie surplus — ${Math.round(pct('calories'))}% of today's target`,
      rationale:
        'You have eaten well past your calorie target today, so this session leans into high-intensity intervals plus strength work. HIIT maximises energy expenditure in a short window, and the strength block helps direct the surplus toward muscle rather than fat storage.',
      intensity: 'vigorous',
      types: ['hiit', 'strength'],
      count: 4,
    };
  }

  if (hasLogs && pct('sugar') > 150) {
    return {
      trigger: 'highSugar',
      reason: `Sugar at ${Math.round(pct('sugar'))}% of your daily limit`,
      rationale:
        'Sugar intake is well over today\'s limit. Moderate, steady aerobic exercise is the most effective way to help your muscles draw down circulating blood glucose, blunting the spike and improving insulin sensitivity over time.',
      intensity: 'moderate',
      types: ['cardio'],
      count: 3,
    };
  }

  if (hasLogs && pct('protein') < 60) {
    return {
      trigger: 'lowProtein',
      reason: `Protein only ${Math.round(pct('protein'))}% of target`,
      rationale:
        'Protein intake is low today, which puts muscle tissue at risk during harder training. This moderate strength session provides the stimulus to retain muscle — pair it with a protein-rich next meal (the workout raises muscle protein synthesis for hours afterwards).',
      intensity: 'moderate',
      types: ['strength'],
      count: 4,
    };
  }

  if (hasLogs && pct('calories') < 70) {
    return {
      trigger: 'deficit',
      reason: `Large calorie deficit — only ${Math.round(pct('calories'))}% of target eaten`,
      rationale:
        'You are running a sizeable calorie deficit today, so hard training would add stress without fuel to support it. Light flexibility and recovery work keeps you moving, aids circulation and protects your training quality for tomorrow.',
      intensity: 'light',
      types: ['flexibility', 'recovery'],
      count: 3,
    };
  }

  // Default: goal-aligned
  const goalSpecs: Record<UserProfile['goal'], Omit<PlanSpec, 'trigger' | 'reason'>> = {
    lose: {
      rationale:
        'Your nutrition is on track today, so this session aligns with your weight-loss goal: cardio-led training to widen the calorie deficit, with a strength element to preserve lean muscle while you lose fat.',
      intensity: 'moderate',
      types: ['cardio', 'strength'],
      count: 4,
    },
    gain: {
      rationale:
        'Your nutrition is on track today, so this session aligns with your muscle-gain goal: a strength-focused block providing the mechanical tension your muscles need to grow, fuelled by the calories and protein you are eating.',
      intensity: 'moderate',
      types: ['strength'],
      count: 4,
    },
    maintain: {
      rationale:
        'Your nutrition is on track today, so this is a balanced maintenance session — a mix of cardio, strength and mobility to keep every system ticking over.',
      intensity: 'moderate',
      types: ['cardio', 'strength', 'flexibility'],
      count: 4,
    },
    endurance: {
      rationale:
        'Your nutrition is on track today, so this session aligns with your endurance goal: sustained aerobic work to build cardiovascular capacity, plus core strength to hold form when fatigue sets in.',
      intensity: 'moderate',
      types: ['cardio', 'strength'],
      count: 4,
    },
  };

  return { trigger: 'goal', reason: 'Goal-aligned training day', ...goalSpecs[profile.goal] };
}

/**
 * Derives the supporting-exercise spec when a training-plan session governs the
 * day. Runs/intervals get light complementary mobility + core; rest/recovery
 * days get gentle flexibility work so "Today's Workout" never contradicts the
 * plan by pushing a hard session on a prescribed rest day.
 */
function specForPlanned(profile: UserProfile, planned: PlannedSession): PlanSpec {
  const meta = SESSION_FOCUS_META[planned.focus];
  const isRest = planned.focus === 'rest' || planned.focus === 'recovery';
  return {
    trigger: 'goal',
    reason: `Training plan: ${meta.label}`,
    rationale: isRest
      ? `Your training plan has you ${planned.focus === 'rest' ? 'resting' : 'recovering'} today — recovery is where adaptation happens. Below are optional gentle mobility moves; otherwise let your body absorb the work.`
      : `Today's run comes from your race training plan: ${planned.title}. ${planned.description} The moves below are optional complements — keep them easy so they don't compromise the session.`,
    intensity: isRest ? 'light' : planned.intensity,
    types: isRest ? ['flexibility', 'recovery'] : ['flexibility', 'strength'],
    count: isRest ? 3 : 2,
  };
}

function eligiblePool(profile: UserProfile, maxIntensity: Intensity): Exercise[] {
  const ageGroup: AgeGroup = ageGroupOf(profile.age);
  return EXERCISES.filter((e) => {
    if (!e.ageGroups.includes(ageGroup)) return false;
    if (profile.workoutPreference === 'home' && e.equipment === 'gym') return false;
    if (INTENSITY_RANK[e.intensity] > INTENSITY_RANK[maxIntensity]) return false;
    return true;
  });
}

export function generateWorkoutPlan(
  profile: UserProfile,
  totalToday: Nutrition,
  planned?: PlannedSession
): WorkoutPlan {
  // When a race training plan prescribes a session today, it takes priority:
  // the headline reflects the plan, and the supporting exercises become
  // complementary mobility/strength (or recovery on rest days).
  const spec = planned ? specForPlanned(profile, planned) : specFor(profile, totalToday);
  const pool = eligiblePool(profile, spec.intensity);

  const preferred = shuffle(pool.filter((e) => spec.types.includes(e.type)));
  const fallback = shuffle(pool.filter((e) => !spec.types.includes(e.type)));
  const ordered = [...preferred, ...fallback];

  const exercises = ordered.slice(0, spec.count);
  const alternatives = ordered.slice(spec.count, spec.count + 3);

  const ageGroup = ageGroupOf(profile.age);
  let ageGroupNote: string | undefined;
  if (ageGroup === 'senior') {
    ageGroupNote =
      'Senior-friendly plan: every exercise below includes a supported, low-impact modification. Stop if you feel pain, dizziness or shortness of breath.';
  } else if (ageGroup === 'teen') {
    ageGroupNote =
      'Teen guidance: focus on technique over load or speed — strength gains come from good form, and growth plates need respect.';
  }

  return {
    trigger: spec.trigger,
    reason: spec.reason,
    rationale: spec.rationale,
    intensity: spec.intensity,
    totalDurationMinutes: exercises.reduce((s, e) => s + e.durationMinutes, 0),
    exercises,
    alternatives,
    ageGroupNote,
    planned,
  };
}
