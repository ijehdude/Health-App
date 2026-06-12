import Dexie, { type Table } from 'dexie';
import {
  type DailySummary,
  type FoodLog,
  type UserProfile,
  type WeeklyInsight,
  emptyNutrition,
  addNutrition,
} from './types';
import { dateStr, addDays } from './utils';
import { queueCloudDelete } from './syncQueue';

class NutriCoachDB extends Dexie {
  profiles!: Table<UserProfile, number>;
  foodLogs!: Table<FoodLog, number>;
  dailySummaries!: Table<DailySummary, number>;
  weeklyInsights!: Table<WeeklyInsight, number>;

  constructor() {
    super('nutricoach');
    this.version(1).stores({
      profiles: '++id, updatedAt',
      foodLogs: '++id, date, mealType, createdAt, synced',
      dailySummaries: '++id, &date, updatedAt',
      weeklyInsights: '++id, weekStart, createdAt',
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
    app: 'NutriCoach',
    profiles: await db.profiles.toArray(),
    foodLogs: await db.foodLogs.toArray(),
    dailySummaries: await db.dailySummaries.toArray(),
    weeklyInsights: await db.weeklyInsights.toArray(),
  };
}

export async function deleteAllData(): Promise<void> {
  await db.delete();
}
