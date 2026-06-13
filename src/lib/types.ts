// ---------------------------------------------------------------------------
// Nutrients
// ---------------------------------------------------------------------------

export const MACRO_KEYS = [
  'calories',
  'protein',
  'fat',
  'saturatedFat',
  'carbs',
  'sugar',
  'fibre',
  'sodium',
] as const;

export const MICRO_KEYS = [
  'vitaminA',
  'vitaminB1',
  'vitaminB2',
  'vitaminB3',
  'vitaminB6',
  'folate',
  'vitaminB12',
  'vitaminC',
  'vitaminD',
  'vitaminE',
  'vitaminK',
  'calcium',
  'iron',
  'magnesium',
  'potassium',
  'zinc',
  'phosphorus',
] as const;

export const NUTRIENT_KEYS = [...MACRO_KEYS, ...MICRO_KEYS] as const;

export type MacroKey = (typeof MACRO_KEYS)[number];
export type MicroKey = (typeof MICRO_KEYS)[number];
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** A complete nutrient record — every tracked nutrient, always present. */
export type Nutrition = Record<NutrientKey, number>;

export interface NutrientMeta {
  label: string;
  unit: string;
  /** 'target' = aim to reach; 'limit' = aim to stay under. */
  kind: 'target' | 'limit';
}

export const NUTRIENT_META: Record<NutrientKey, NutrientMeta> = {
  calories: { label: 'Calories', unit: 'kcal', kind: 'target' },
  protein: { label: 'Protein', unit: 'g', kind: 'target' },
  fat: { label: 'Fat', unit: 'g', kind: 'target' },
  saturatedFat: { label: 'Saturated Fat', unit: 'g', kind: 'limit' },
  carbs: { label: 'Carbohydrates', unit: 'g', kind: 'target' },
  sugar: { label: 'Sugar', unit: 'g', kind: 'limit' },
  fibre: { label: 'Fibre', unit: 'g', kind: 'target' },
  sodium: { label: 'Sodium', unit: 'mg', kind: 'limit' },
  vitaminA: { label: 'Vitamin A', unit: 'mcg', kind: 'target' },
  vitaminB1: { label: 'Vitamin B1 (Thiamin)', unit: 'mg', kind: 'target' },
  vitaminB2: { label: 'Vitamin B2 (Riboflavin)', unit: 'mg', kind: 'target' },
  vitaminB3: { label: 'Vitamin B3 (Niacin)', unit: 'mg', kind: 'target' },
  vitaminB6: { label: 'Vitamin B6', unit: 'mg', kind: 'target' },
  folate: { label: 'Folate (B9)', unit: 'mcg', kind: 'target' },
  vitaminB12: { label: 'Vitamin B12', unit: 'mcg', kind: 'target' },
  vitaminC: { label: 'Vitamin C', unit: 'mg', kind: 'target' },
  vitaminD: { label: 'Vitamin D', unit: 'mcg', kind: 'target' },
  vitaminE: { label: 'Vitamin E', unit: 'mg', kind: 'target' },
  vitaminK: { label: 'Vitamin K', unit: 'mcg', kind: 'target' },
  calcium: { label: 'Calcium', unit: 'mg', kind: 'target' },
  iron: { label: 'Iron', unit: 'mg', kind: 'target' },
  magnesium: { label: 'Magnesium', unit: 'mg', kind: 'target' },
  potassium: { label: 'Potassium', unit: 'mg', kind: 'target' },
  zinc: { label: 'Zinc', unit: 'mg', kind: 'target' },
  phosphorus: { label: 'Phosphorus', unit: 'mg', kind: 'target' },
};

export function emptyNutrition(): Nutrition {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Nutrition;
}

export function addNutrition(a: Nutrition, b: Partial<Nutrition>): Nutrition {
  const out = { ...a };
  for (const k of NUTRIENT_KEYS) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return out;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female' | 'other';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extreme';

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise, desk job' },
  { value: 'light', label: 'Lightly active', description: 'Light exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderately active', description: 'Moderate exercise 3–5 days/week' },
  { value: 'very', label: 'Very active', description: 'Hard exercise 6–7 days/week' },
  { value: 'extreme', label: 'Extremely active', description: 'Physical job + hard daily training' },
];

export type FitnessGoal = 'lose' | 'gain' | 'maintain' | 'endurance';

export const FITNESS_GOALS: { value: FitnessGoal; label: string; description: string }[] = [
  { value: 'lose', label: 'Lose weight', description: 'Calorie deficit, higher protein' },
  { value: 'gain', label: 'Gain muscle', description: 'Calorie surplus, strength focus' },
  { value: 'maintain', label: 'Maintain', description: 'Stay at current weight' },
  { value: 'endurance', label: 'Improve endurance', description: 'Higher carbs for fuel' },
];

export type WorkoutPreference = 'home' | 'gym' | 'both';

export const DIETARY_RESTRICTIONS = [
  'vegan',
  'vegetarian',
  'halal',
  'kosher',
  'gluten-free',
  'dairy-free',
  'nut-free',
] as const;
export type DietaryRestriction = (typeof DIETARY_RESTRICTIONS)[number];

export const HEALTH_CONDITIONS = [
  'diabetes',
  'hypertension',
  'high cholesterol',
  'heart disease',
  'kidney disease',
] as const;
export type HealthCondition = (typeof HEALTH_CONDITIONS)[number];

export type AgeGroup = 'teen' | 'youngAdult' | 'adult' | 'senior';

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  teen: 'Teen (13–18)',
  youngAdult: 'Young adult (19–30)',
  adult: 'Adult (31–54)',
  senior: 'Senior (55+)',
};

export interface DailyTargets {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  /** Daily target/limit for every tracked nutrient. */
  nutrients: Nutrition;
}

export interface UserProfile {
  id?: number;
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  workoutPreference: WorkoutPreference;
  dietaryRestrictions: DietaryRestriction[];
  healthConditions: HealthCondition[];
  targets: DailyTargets;
  updatedAt: string; // ISO datetime
}

// ---------------------------------------------------------------------------
// Food logging
// ---------------------------------------------------------------------------

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Confidence = 'high' | 'medium' | 'low';

export interface FoodItem {
  name: string;
  quantity: string;
  confidence: Confidence;
  nutrition: Nutrition;
}

export interface FoodLog {
  id?: number;
  date: string; // YYYY-MM-DD (local)
  mealType: MealType;
  items: FoodItem[];
  totalNutrition: Nutrition;
  confidence: Confidence;
  warningMessage?: string;
  notes?: string;
  /** Normalized JPEG data URLs of the meal photos (max 5). */
  photos?: string[];
  createdAt: string; // ISO datetime
  synced: 0 | 1;
}

export interface DailySummary {
  id?: number;
  date: string; // YYYY-MM-DD (local)
  totalNutrition: Nutrition;
  mealsLogged: number;
  calorieTarget: number;
  updatedAt: string;
}

export interface WeeklyInsight {
  id?: number;
  weekStart: string; // YYYY-MM-DD
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendation: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API contracts
// ---------------------------------------------------------------------------

export interface AnalyseFoodRequest {
  text?: string;
  imageB64?: string;
  mimeType?: string;
}

export interface AnalyseFoodResponse {
  foodItems: FoodItem[];
  totalNutrition: Nutrition;
  confidence: Confidence;
  warningMessage?: string;
}

export interface InsightResponse {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

export type GapStatus = 'optimal' | 'deficient' | 'excess';

export interface NutrientGap {
  key: NutrientKey;
  label: string;
  unit: string;
  kind: 'target' | 'limit';
  consumed: number;
  target: number;
  percent: number; // consumed / target * 100
  status: GapStatus;
  statusLabel: string;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export type ExerciseType = 'cardio' | 'strength' | 'flexibility' | 'hiit' | 'recovery';
export type Intensity = 'light' | 'moderate' | 'vigorous';
export type Equipment = 'none' | 'minimal' | 'gym';

export type SvgKey =
  | 'walk'
  | 'run'
  | 'cycle'
  | 'swim'
  | 'jump-rope'
  | 'hiit'
  | 'squat'
  | 'push-up'
  | 'plank'
  | 'lunge'
  | 'row'
  | 'yoga'
  | 'stretch'
  | 'balance'
  | 'chair';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  type: ExerciseType;
  muscles: string[];
  intensity: Intensity;
  equipment: Equipment;
  durationMinutes: number;
  sets?: number;
  reps?: string;
  svgKey: SvgKey;
  ageGroups: AgeGroup[];
  modifications: Partial<Record<AgeGroup, string>>;
}

export type WorkoutTrigger =
  | 'surplus'
  | 'highSugar'
  | 'lowProtein'
  | 'deficit'
  | 'senior'
  | 'goal';

export interface WorkoutPlan {
  trigger: WorkoutTrigger;
  reason: string;
  rationale: string;
  intensity: Intensity;
  totalDurationMinutes: number;
  exercises: Exercise[];
  alternatives: Exercise[];
  ageGroupNote?: string;
  /**
   * When a race training plan is active, the prescribed session for today is
   * surfaced here so "Today's Workout" reflects the plan instead of (or
   * alongside) the nutrition-triggered suggestion. See lib/workout.ts.
   */
  planned?: PlannedSession;
}

// ---------------------------------------------------------------------------
// Exercise logging (Feature 1)
// ---------------------------------------------------------------------------

/** Broad activity category — used for icons, METs fallbacks and plan matching. */
export type ExerciseModality =
  | 'run'
  | 'bike'
  | 'swim'
  | 'walk'
  | 'row'
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'yoga'
  | 'other';

export const EXERCISE_MODALITIES: { value: ExerciseModality; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'bike', label: 'Cycle' },
  { value: 'swim', label: 'Swim' },
  { value: 'walk', label: 'Walk / hike' },
  { value: 'row', label: 'Row' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Other cardio' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'yoga', label: 'Yoga / mobility' },
  { value: 'other', label: 'Other' },
];

/** Where a logged session came from — drives provenance UI and de-duping. */
export type ExerciseSource = 'text' | 'file' | 'manual' | 'plan';

export interface ExerciseSession {
  id?: number;
  date: string; // YYYY-MM-DD (local)
  /** Human label, e.g. "Easy run", "Tempo intervals", "Upper body". */
  activity: string;
  modality: ExerciseModality;
  durationMinutes: number;
  distanceKm?: number;
  /** Free-form pace string as parsed/entered, e.g. "5:36 /km". */
  pace?: string;
  intensity: Intensity;
  /** Estimated energy expenditure for this session, kcal. */
  caloriesBurned: number;
  notes?: string;
  source: ExerciseSource;
  createdAt: string; // ISO datetime — also the cloud upsert key
  synced: 0 | 1;
}

/** A parsed-but-not-yet-saved session shown in the confirm/edit preview. */
export type ParsedExerciseSession = Omit<
  ExerciseSession,
  'id' | 'createdAt' | 'synced' | 'source'
> & {
  confidence: Confidence;
};

// ---------------------------------------------------------------------------
// Race goal & training plan (Feature 3)
// ---------------------------------------------------------------------------

export type RaceDistance = '5k' | '10k' | 'half' | 'marathon' | 'custom';

export const RACE_DISTANCES: { value: RaceDistance; label: string; km: number | null }[] = [
  { value: '5k', label: '5K', km: 5 },
  { value: '10k', label: '10K', km: 10 },
  { value: 'half', label: 'Half marathon', km: 21.097 },
  { value: 'marathon', label: 'Marathon', km: 42.195 },
  { value: 'custom', label: 'Custom distance', km: null },
];

export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';

export const TRAINING_EXPERIENCE: { value: TrainingExperience; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'New to training, or running < 6 months / < 15 km per week' },
  { value: 'intermediate', label: 'Intermediate', description: 'Run regularly, ~15–40 km per week, have raced before' },
  { value: 'advanced', label: 'Advanced', description: 'Experienced, 40+ km per week, structured training' },
];

export interface RaceGoal {
  id?: number;
  raceType: RaceDistance;
  /** Required when raceType === 'custom'. */
  customDistanceKm?: number;
  raceName?: string;
  /** Target finish time as HH:MM:SS (or MM:SS), free-form. */
  targetTime?: string;
  raceDate: string; // YYYY-MM-DD
  experience: TrainingExperience;
  /** Current typical training volume, km/week. */
  currentWeeklyKm?: number;
  /** Free text, e.g. "ran 10K in 55:00 last month". */
  recentPerformance?: string;
  createdAt: string; // ISO — cloud upsert key
  updatedAt: string;
  synced: 0 | 1;
}

export type SessionFocus =
  | 'easy'
  | 'tempo'
  | 'interval'
  | 'long'
  | 'rest'
  | 'cross'
  | 'recovery'
  | 'race';

export const SESSION_FOCUS_META: Record<SessionFocus, { label: string; tone: 'green' | 'amber' | 'red' | 'slate' }> = {
  easy: { label: 'Easy run', tone: 'green' },
  tempo: { label: 'Tempo', tone: 'amber' },
  interval: { label: 'Intervals', tone: 'red' },
  long: { label: 'Long run', tone: 'amber' },
  cross: { label: 'Cross-train', tone: 'slate' },
  recovery: { label: 'Recovery', tone: 'green' },
  rest: { label: 'Rest', tone: 'slate' },
  race: { label: 'Race', tone: 'red' },
};

export interface PlannedSession {
  date: string; // YYYY-MM-DD
  focus: SessionFocus;
  title: string;
  description: string;
  durationMinutes?: number;
  distanceKm?: number;
  intensity: Intensity;
}

export interface TrainingWeek {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD (Monday)
  /** base / build / peak / taper, etc. */
  phase: string;
  focus: string;
  totalKm?: number;
  isDeload?: boolean;
  sessions: PlannedSession[];
}

export interface TrainingPlan {
  id?: number;
  /** createdAt of the RaceGoal this plan was generated for. */
  raceGoalCreatedAt?: string;
  summary: string;
  weeks: TrainingWeek[];
  createdAt: string; // ISO — cloud upsert key
  updatedAt: string;
  synced: 0 | 1;
}

// ---------------------------------------------------------------------------
// Exercise eat-back (Feature 2)
// ---------------------------------------------------------------------------

/** Transparent breakdown of how exercise raises today's calorie target. */
export interface AdjustedCalorieTarget {
  /** Profile's stored calorie target before any adjustment. */
  base: number;
  /** Total kcal burned through logged exercise today. */
  exercise: number;
  /** kcal actually added back to the target (after guardrails). */
  eatBack: number;
  /** Final recommended intake for the day. */
  adjusted: number;
  bmr: number;
  /** Safe minimum intake (max of sex floor and BMR). */
  floor: number;
  /** True when the base target was below the safe floor and had to be raised. */
  capped: boolean;
  note?: string;
}

// ---------------------------------------------------------------------------
// API contracts — fitness
// ---------------------------------------------------------------------------

export interface ParseExerciseResponse {
  sessions: ParsedExerciseSession[];
  warningMessage?: string;
}

export interface CoachMessage {
  role: 'user' | 'coach';
  content: string;
}

export interface CoachResponse {
  reply: string;
}
