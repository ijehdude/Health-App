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
}
