import {
  type ActivityLevel,
  type AgeGroup,
  type DailyTargets,
  type DietaryRestriction,
  type FitnessGoal,
  type HealthCondition,
  type MicroKey,
  type Nutrition,
  type NutrientGap,
  type NutrientKey,
  type Sex,
  type UserProfile,
  NUTRIENT_KEYS,
  NUTRIENT_META,
  emptyNutrition,
} from './types';

// ---------------------------------------------------------------------------
// Body metrics
// ---------------------------------------------------------------------------

export function calcBMI(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(bmi: number): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (bmi <= 0) return { label: '—', tone: 'warning' };
  if (bmi < 18.5) return { label: 'Underweight', tone: 'warning' };
  if (bmi < 25) return { label: 'Healthy', tone: 'success' };
  if (bmi < 30) return { label: 'Overweight', tone: 'warning' };
  return { label: 'Obese', tone: 'danger' };
}

/** Mifflin–St Jeor. 'other' sex uses the midpoint of the male/female constants. */
export function calcBMR(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extreme: 1.9,
};

const GOAL_CALORIE_ADJUSTMENT: Record<FitnessGoal, number> = {
  lose: -500,
  gain: 300,
  maintain: 0,
  endurance: 100,
};

/** Macro splits as fraction of calories: protein / carbs / fat. */
const MACRO_SPLITS: Record<FitnessGoal, { protein: number; carbs: number; fat: number }> = {
  lose: { protein: 0.35, carbs: 0.35, fat: 0.3 },
  gain: { protein: 0.3, carbs: 0.45, fat: 0.25 },
  maintain: { protein: 0.25, carbs: 0.45, fat: 0.3 },
  endurance: { protein: 0.2, carbs: 0.55, fat: 0.25 },
};

export function ageGroupOf(age: number): AgeGroup {
  if (age <= 18) return 'teen';
  if (age <= 30) return 'youngAdult';
  if (age <= 54) return 'adult';
  return 'senior';
}

// ---------------------------------------------------------------------------
// Micronutrient RDAs (WHO/NIH reference values) by age group and sex
// ---------------------------------------------------------------------------

type MicroTable = Record<MicroKey, number>;

const MICRO_RDA: Record<AgeGroup, { male: MicroTable; female: MicroTable }> = {
  teen: {
    male: {
      vitaminA: 900, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3,
      folate: 400, vitaminB12: 2.4, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 75,
      calcium: 1300, iron: 11, magnesium: 410, potassium: 3000, zinc: 11, phosphorus: 1250,
    },
    female: {
      vitaminA: 700, vitaminB1: 1.0, vitaminB2: 1.0, vitaminB3: 14, vitaminB6: 1.2,
      folate: 400, vitaminB12: 2.4, vitaminC: 65, vitaminD: 15, vitaminE: 15, vitaminK: 75,
      calcium: 1300, iron: 15, magnesium: 360, potassium: 2300, zinc: 9, phosphorus: 1250,
    },
  },
  youngAdult: {
    male: {
      vitaminA: 900, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3,
      folate: 400, vitaminB12: 2.4, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120,
      calcium: 1000, iron: 8, magnesium: 400, potassium: 3400, zinc: 11, phosphorus: 700,
    },
    female: {
      vitaminA: 700, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.3,
      folate: 400, vitaminB12: 2.4, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90,
      calcium: 1000, iron: 18, magnesium: 310, potassium: 2600, zinc: 8, phosphorus: 700,
    },
  },
  adult: {
    male: {
      vitaminA: 900, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3,
      folate: 400, vitaminB12: 2.4, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120,
      calcium: 1000, iron: 8, magnesium: 420, potassium: 3400, zinc: 11, phosphorus: 700,
    },
    female: {
      vitaminA: 700, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.3,
      folate: 400, vitaminB12: 2.4, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90,
      calcium: 1000, iron: 18, magnesium: 320, potassium: 2600, zinc: 8, phosphorus: 700,
    },
  },
  senior: {
    male: {
      vitaminA: 900, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.7,
      folate: 400, vitaminB12: 2.4, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120,
      calcium: 1200, iron: 8, magnesium: 420, potassium: 3400, zinc: 11, phosphorus: 700,
    },
    female: {
      vitaminA: 700, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.5,
      folate: 400, vitaminB12: 2.4, vitaminC: 75, vitaminD: 20, vitaminE: 15, vitaminK: 90,
      calcium: 1200, iron: 8, magnesium: 320, potassium: 2600, zinc: 8, phosphorus: 700,
    },
  },
};

function microRDAs(age: number, sex: Sex): MicroTable {
  const group = MICRO_RDA[ageGroupOf(age)];
  if (sex === 'male') return group.male;
  if (sex === 'female') return group.female;
  const avg = {} as MicroTable;
  for (const k of Object.keys(group.male) as MicroKey[]) {
    avg[k] = Math.round(((group.male[k] + group.female[k]) / 2) * 10) / 10;
  }
  return avg;
}

// ---------------------------------------------------------------------------
// Daily targets
// ---------------------------------------------------------------------------

export interface TargetInput {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  healthConditions: HealthCondition[];
}

export function calcTargets(input: TargetInput): DailyTargets {
  const bmr = Math.round(calcBMR(input.sex, input.age, input.heightCm, input.weightKg));
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activityLevel]);
  const calorieTarget = Math.max(1200, tdee + GOAL_CALORIE_ADJUSTMENT[input.goal]);

  const split = MACRO_SPLITS[input.goal];
  const diabetes = input.healthConditions.includes('diabetes');
  const hypertension = input.healthConditions.includes('hypertension');
  const cholesterol =
    input.healthConditions.includes('high cholesterol') ||
    input.healthConditions.includes('heart disease');

  const nutrients: Nutrition = {
    ...emptyNutrition(),
    calories: calorieTarget,
    protein: Math.round((calorieTarget * split.protein) / 4),
    carbs: Math.round((calorieTarget * split.carbs) / 4),
    fat: Math.round((calorieTarget * split.fat) / 9),
    // ≤10% of calories from saturated fat (7% with cholesterol/heart conditions)
    saturatedFat: Math.round((calorieTarget * (cholesterol ? 0.07 : 0.1)) / 9),
    // WHO free-sugar limit: 10% of calories (5% with diabetes)
    sugar: Math.round((calorieTarget * (diabetes ? 0.05 : 0.1)) / 4),
    // 14 g fibre per 1000 kcal
    fibre: Math.round((calorieTarget / 1000) * 14),
    sodium: hypertension ? 1500 : 2300,
    ...microRDAs(input.age, input.sex),
  };

  return { bmr, tdee, calorieTarget, nutrients };
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

export function analyzeGaps(consumed: Nutrition, targets: Nutrition): NutrientGap[] {
  return NUTRIENT_KEYS.map((key) => {
    const meta = NUTRIENT_META[key];
    const target = targets[key] ?? 0;
    const value = consumed[key] ?? 0;
    const percent = target > 0 ? (value / target) * 100 : 0;

    let status: NutrientGap['status'];
    let statusLabel: string;
    if (meta.kind === 'limit') {
      if (percent <= 100) { status = 'optimal'; statusLabel = 'Within limit'; }
      else if (percent <= 120) { status = 'deficient'; statusLabel = 'Near limit'; }
      else { status = 'excess'; statusLabel = 'Over limit'; }
    } else {
      if (percent < 80) { status = 'deficient'; statusLabel = 'Low'; }
      else if (percent <= 120) { status = 'optimal'; statusLabel = 'On track'; }
      else { status = 'excess'; statusLabel = 'High'; }
    }

    return {
      key,
      label: meta.label,
      unit: meta.unit,
      kind: meta.kind,
      consumed: value,
      target,
      percent,
      status,
      statusLabel,
    };
  });
}

// ---------------------------------------------------------------------------
// Food recommendations
// ---------------------------------------------------------------------------

interface FoodSource {
  food: string;
  avoid: DietaryRestriction[];
}

const MEAT: DietaryRestriction[] = ['vegan', 'vegetarian'];
const FISH: DietaryRestriction[] = ['vegan', 'vegetarian'];
const DAIRY: DietaryRestriction[] = ['vegan', 'dairy-free'];
const EGG: DietaryRestriction[] = ['vegan'];
const NUTS: DietaryRestriction[] = ['nut-free'];
const WHEAT: DietaryRestriction[] = ['gluten-free'];
const PORK: DietaryRestriction[] = ['vegan', 'vegetarian', 'halal', 'kosher'];
const SHELLFISH: DietaryRestriction[] = ['vegan', 'vegetarian', 'kosher'];

const FOOD_SOURCES: Partial<Record<NutrientKey, FoodSource[]>> = {
  protein: [
    { food: 'chicken breast', avoid: MEAT }, { food: 'Greek yoghurt', avoid: DAIRY },
    { food: 'eggs', avoid: EGG }, { food: 'lentils', avoid: [] },
    { food: 'tofu & tempeh', avoid: [] }, { food: 'salmon', avoid: FISH },
  ],
  fibre: [
    { food: 'oats', avoid: [] }, { food: 'black beans', avoid: [] },
    { food: 'raspberries', avoid: [] }, { food: 'chia seeds', avoid: [] },
    { food: 'broccoli', avoid: [] }, { food: 'wholegrain bread', avoid: WHEAT },
  ],
  carbs: [
    { food: 'brown rice', avoid: [] }, { food: 'sweet potato', avoid: [] },
    { food: 'bananas', avoid: [] }, { food: 'quinoa', avoid: [] },
    { food: 'wholewheat pasta', avoid: WHEAT },
  ],
  fat: [
    { food: 'avocado', avoid: [] }, { food: 'olive oil', avoid: [] },
    { food: 'almonds', avoid: NUTS }, { food: 'oily fish', avoid: FISH },
  ],
  vitaminA: [
    { food: 'carrots', avoid: [] }, { food: 'sweet potato', avoid: [] },
    { food: 'spinach', avoid: [] }, { food: 'eggs', avoid: EGG },
    { food: 'red peppers', avoid: [] },
  ],
  vitaminB1: [
    { food: 'sunflower seeds', avoid: [] }, { food: 'black beans', avoid: [] },
    { food: 'pork loin', avoid: PORK }, { food: 'fortified wholegrains', avoid: WHEAT },
  ],
  vitaminB2: [
    { food: 'milk', avoid: DAIRY }, { food: 'almonds', avoid: NUTS },
    { food: 'mushrooms', avoid: [] }, { food: 'eggs', avoid: EGG },
  ],
  vitaminB3: [
    { food: 'chicken breast', avoid: MEAT }, { food: 'tuna', avoid: FISH },
    { food: 'peanuts', avoid: NUTS }, { food: 'brown rice', avoid: [] },
    { food: 'mushrooms', avoid: [] },
  ],
  vitaminB6: [
    { food: 'chickpeas', avoid: [] }, { food: 'salmon', avoid: FISH },
    { food: 'potatoes', avoid: [] }, { food: 'bananas', avoid: [] },
  ],
  folate: [
    { food: 'spinach', avoid: [] }, { food: 'asparagus', avoid: [] },
    { food: 'lentils', avoid: [] }, { food: 'avocado', avoid: [] },
    { food: 'fortified cereal', avoid: WHEAT },
  ],
  vitaminB12: [
    { food: 'salmon', avoid: FISH }, { food: 'eggs', avoid: EGG },
    { food: 'milk & cheese', avoid: DAIRY }, { food: 'fortified plant milk', avoid: [] },
    { food: 'nutritional yeast', avoid: [] },
  ],
  vitaminC: [
    { food: 'oranges', avoid: [] }, { food: 'kiwi fruit', avoid: [] },
    { food: 'strawberries', avoid: [] }, { food: 'red peppers', avoid: [] },
    { food: 'broccoli', avoid: [] },
  ],
  vitaminD: [
    { food: 'oily fish (salmon, sardines)', avoid: FISH }, { food: 'egg yolks', avoid: EGG },
    { food: 'fortified milk', avoid: DAIRY }, { food: 'UV-exposed mushrooms', avoid: [] },
    { food: 'fortified plant milk', avoid: [] },
  ],
  vitaminE: [
    { food: 'sunflower seeds', avoid: [] }, { food: 'almonds', avoid: NUTS },
    { food: 'avocado', avoid: [] }, { food: 'olive oil', avoid: [] },
  ],
  vitaminK: [
    { food: 'kale', avoid: [] }, { food: 'spinach', avoid: [] },
    { food: 'broccoli', avoid: [] }, { food: 'Brussels sprouts', avoid: [] },
  ],
  calcium: [
    { food: 'yoghurt & cheese', avoid: DAIRY }, { food: 'fortified plant milk', avoid: [] },
    { food: 'tofu (calcium-set)', avoid: [] }, { food: 'sardines', avoid: FISH },
    { food: 'kale', avoid: [] },
  ],
  iron: [
    { food: 'lean red meat', avoid: MEAT }, { food: 'lentils', avoid: [] },
    { food: 'spinach', avoid: [] }, { food: 'pumpkin seeds', avoid: [] },
    { food: 'fortified cereal', avoid: WHEAT },
  ],
  magnesium: [
    { food: 'pumpkin seeds', avoid: [] }, { food: 'almonds', avoid: NUTS },
    { food: 'black beans', avoid: [] }, { food: 'dark chocolate', avoid: [] },
    { food: 'spinach', avoid: [] },
  ],
  potassium: [
    { food: 'bananas', avoid: [] }, { food: 'potatoes', avoid: [] },
    { food: 'white beans', avoid: [] }, { food: 'spinach', avoid: [] },
    { food: 'oranges', avoid: [] },
  ],
  zinc: [
    { food: 'oysters', avoid: SHELLFISH }, { food: 'beef', avoid: MEAT },
    { food: 'pumpkin seeds', avoid: [] }, { food: 'chickpeas', avoid: [] },
    { food: 'cashews', avoid: NUTS },
  ],
  phosphorus: [
    { food: 'chicken', avoid: MEAT }, { food: 'dairy products', avoid: DAIRY },
    { food: 'lentils', avoid: [] }, { food: 'pumpkin seeds', avoid: [] },
  ],
};

const CUT_DOWN_ADVICE: Partial<Record<NutrientKey, string>> = {
  calories:
    'You are over your calorie target — favour lighter, vegetable-forward meals for the rest of the day.',
  sugar:
    'Swap sugary drinks, sweets and refined snacks for water, whole fruit or unsweetened alternatives.',
  sodium:
    'Cut back on processed and packaged foods; season with herbs, spices and citrus instead of salt.',
  saturatedFat:
    'Choose lean proteins and plant oils — swap butter, fatty cuts and fried food for olive oil, fish or legumes.',
  fat: 'Go easy on fried foods and heavy sauces; grill, bake or steam instead.',
  carbs: 'Favour protein and vegetables over refined starches for your remaining meals.',
};

export interface FoodRecommendations {
  eatMore: { key: NutrientKey; label: string; percent: number; foods: string[] }[];
  cutDown: { key: NutrientKey; label: string; percent: number; advice: string }[];
}

export function recommendFoods(
  gaps: NutrientGap[],
  restrictions: DietaryRestriction[]
): FoodRecommendations {
  const eatMore = gaps
    .filter((g) => g.kind === 'target' && g.key !== 'calories' && g.status === 'deficient')
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 5)
    .map((g) => ({
      key: g.key,
      label: g.label,
      percent: g.percent,
      foods: (FOOD_SOURCES[g.key] ?? [])
        .filter((s) => !s.avoid.some((r) => restrictions.includes(r)))
        .map((s) => s.food)
        .slice(0, 4),
    }))
    .filter((r) => r.foods.length > 0);

  const cutDown = gaps
    .filter((g) => g.status === 'excess' && CUT_DOWN_ADVICE[g.key])
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3)
    .map((g) => ({
      key: g.key,
      label: g.label,
      percent: g.percent,
      advice: CUT_DOWN_ADVICE[g.key]!,
    }));

  return { eatMore, cutDown };
}
