import Dexie, { type Table } from 'dexie';
import {
  type DailySummary,
  type ExerciseSession,
  type FoodLog,
  type RaceGoal,
  type TrainingPlan,
  type UserProfile,
  type WeeklyInsight,
  emptyNutrition,
  addNutrition,
} from './types';
import { dateStr, addDays } from './utils';
import { queueCloudDelete, queueDelete } from './syncQueue';

class NutriCoachDB extends Dexie {
  profiles!: Table<UserProfile, number>;
  foodLogs!: Table<FoodLog, number>;
  dailySummaries!: Table<DailySummary, number>;
  weeklyInsights!: Table<WeeklyInsight, number>;
  // Fitness stores (v2) — see types.ts.
  exerciseSessions!: Table<ExerciseSession, number>;
  raceGoals!: Table<RaceGoal, number>;
  trainingPlans!: Table<TrainingPlan, number>;

  constructor() {
    super('nutricoach');
    this.version(1).stores({
      profiles: '++id, updatedAt',
      foodLogs: '++id, date, mealType, createdAt, synced',
      dailySummaries: '++id, &date, updatedAt',
      weeklyInsights: '++id, weekStart, createdAt',
    });
    // v2 adds fitness stores; existing stores are carried over unchanged.
    this.version(2).stores({
      exerciseSessions: '++id, date, createdAt, synced',
      raceGoals: '++id, createdAt, updatedAt, synced',
      trainingPlans: '++id, createdAt, updatedAt, synced',
    });
  }
}

export const db = new NutriCoachDB();

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profiles.toCollection().first();
}

export async function saveProfile(profile: UserProfile): Promise<number> {
  const existing = await getProfile();
  const record = { ...profile, updatedAt: new Date().toISOString() };
  if (existing?.id != null) {
    await db.profiles.update(existing.id, record);
    return existing.id;
  }
  return db.profiles.add(record);
}

// ---------------------------------------------------------------------------
// Food logs
// ---------------------------------------------------------------------------

export async function addFoodLog(log: FoodLog): Promise<number> {
  const id = await db.foodLogs.add(log);
  await recomputeDailySummary(log.date);
  return id;
}

export async function getFoodLogsByDate(date: string): Promise<FoodLog[]> {
  return db.foodLogs.where('date').equals(date).sortBy('createdAt');
}

export async function getFoodLogsByDateRange(start: string, end: string): Promise<FoodLog[]> {
  return db.foodLogs.where('date').between(start, end, true, true).sortBy('createdAt');
}

/**
 * Updates a saved meal in place (same id/createdAt, so the cloud upsert on
 * (user_id, created_at) overwrites the existing row). Marks it unsynced and
 * recomputes the day's summary so Dashboard totals reflect the change.
 */
export async function updateFoodLog(id: number, changes: Partial<FoodLog>): Promise<void> {
  const log = await db.foodLogs.get(id);
  if (!log) throw new Error('Meal not found.');
  await db.foodLogs.update(id, { ...changes, synced: 0 });
  await recomputeDailySummary(changes.date ?? log.date);
}

export async function deleteFoodLog(id: number): Promise<void> {
  const log = await db.foodLogs.get(id);
  await db.foodLogs.delete(id);
  if (log) {
    queueCloudDelete(log.createdAt);
    await recomputeDailySummary(log.date);
  }
}

// ---------------------------------------------------------------------------
// Exercise sessions (Feature 1)
// ---------------------------------------------------------------------------

export async function addExerciseSession(session: ExerciseSession): Promise<number> {
  return db.exerciseSessions.add(session);
}

export async function addExerciseSessions(sessions: ExerciseSession[]): Promise<void> {
  await db.exerciseSessions.bulkAdd(sessions);
}

export async function getExerciseSessionsByDate(date: string): Promise<ExerciseSession[]> {
  return db.exerciseSessions.where('date').equals(date).sortBy('createdAt');
}

export async function getExerciseSessionsByDateRange(
  start: string,
  end: string
): Promise<ExerciseSession[]> {
  return db.exerciseSessions.where('date').between(start, end, true, true).sortBy('createdAt');
}

/** Total kcal burned through logged exercise on a given local date. */
export async function getCaloriesBurnedForDate(date: string): Promise<number> {
  const sessions = await getExerciseSessionsByDate(date);
  return sessions.reduce((sum, s) => sum + (s.caloriesBurned || 0), 0);
}

export async function updateExerciseSession(
  id: number,
  changes: Partial<ExerciseSession>
): Promise<void> {
  await db.exerciseSessions.update(id, { ...changes, synced: 0 });
}

export async function deleteExerciseSession(id: number): Promise<void> {
  const session = await db.exerciseSessions.get(id);
  await db.exerciseSessions.delete(id);
  if (session) queueDelete('exercise-sessions', session.createdAt);
}

// ---------------------------------------------------------------------------
// Race goal (Feature 3) — a single active goal at a time (latest wins).
// ---------------------------------------------------------------------------

export async function getRaceGoal(): Promise<RaceGoal | undefined> {
  return db.raceGoals.orderBy('updatedAt').last();
}

export async function saveRaceGoal(goal: RaceGoal): Promise<number> {
  const existing = await getRaceGoal();
  const record: RaceGoal = { ...goal, updatedAt: new Date().toISOString(), synced: 0 };
  if (existing?.id != null) {
    await db.raceGoals.update(existing.id, { ...record, createdAt: existing.createdAt });
    return existing.id;
  }
  return db.raceGoals.add(record);
}

export async function deleteRaceGoal(): Promise<void> {
  const goal = await getRaceGoal();
  if (!goal?.id) return;
  await db.raceGoals.delete(goal.id);
  queueDelete('race-goals', goal.createdAt);
}

// ---------------------------------------------------------------------------
// Training plan (Feature 3) — one active plan at a time (latest wins).
// ---------------------------------------------------------------------------

export async function getTrainingPlan(): Promise<TrainingPlan | undefined> {
  return db.trainingPlans.orderBy('updatedAt').last();
}

export async function saveTrainingPlan(plan: TrainingPlan): Promise<number> {
  const existing = await getTrainingPlan();
  const record: TrainingPlan = { ...plan, updatedAt: new Date().toISOString(), synced: 0 };
  if (existing?.id != null) {
    await db.trainingPlans.update(existing.id, { ...record, createdAt: existing.createdAt });
    return existing.id;
  }
  return db.trainingPlans.add(record);
}

export async function deleteTrainingPlan(): Promise<void> {
  const plan = await getTrainingPlan();
  if (!plan?.id) return;
  await db.trainingPlans.delete(plan.id);
  queueDelete('training-plans', plan.createdAt);
}

// ---------------------------------------------------------------------------
// Daily summaries
// ---------------------------------------------------------------------------

export async function getDailySummary(date: string): Promise<DailySummary | undefined> {
  return db.dailySummaries.where('date').equals(date).first();
}

export async function upsertDailySummary(summary: DailySummary): Promise<void> {
  const existing = await getDailySummary(summary.date);
  if (existing?.id != null) {
    await db.dailySummaries.update(existing.id, { ...summary, id: existing.id });
  } else {
    await db.dailySummaries.add(summary);
  }
}

export async function getSummariesByDateRange(
  start: string,
  end: string
): Promise<DailySummary[]> {
  return db.dailySummaries.where('date').between(start, end, true, true).sortBy('date');
}

export async function recomputeDailySummary(date: string): Promise<void> {
  const logs = await getFoodLogsByDate(date);
  const profile = await getProfile();
  const total = logs.reduce((acc, l) => addNutrition(acc, l.totalNutrition), emptyNutrition());
  await upsertDailySummary({
    date,
    totalNutrition: total,
    mealsLogged: logs.length,
    calorieTarget: profile?.targets.calorieTarget ?? 0,
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/**
 * Consecutive days (ending today, or yesterday if nothing is logged yet today)
 * with at least one food log.
 */
export async function getLogStreak(): Promise<number> {
  const dates = new Set((await db.foodLogs.orderBy('date').uniqueKeys()) as string[]);
  if (dates.size === 0) return 0;

  let cursor = dateStr();
  if (!dates.has(cursor)) cursor = addDays(cursor, -1);

  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Export / wipe
// ---------------------------------------------------------------------------

export async function exportAllData() {
  return {
    exportedAt: new Date().toISOString(),
    app: 'health-app',
    profiles: await db.profiles.toArray(),
    foodLogs: await db.foodLogs.toArray(),
    dailySummaries: await db.dailySummaries.toArray(),
    weeklyInsights: await db.weeklyInsights.toArray(),
    exerciseSessions: await db.exerciseSessions.toArray(),
    raceGoals: await db.raceGoals.toArray(),
    trainingPlans: await db.trainingPlans.toArray(),
  };
}

export async function deleteAllData(): Promise<void> {
  await db.delete();
}
