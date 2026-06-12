'use client';

import { useCallback, useEffect, useState } from 'react';
import { getFoodLogsByDate, getLogStreak } from '@/lib/db';
import { onSynced } from '@/lib/supabase';
import { addNutrition, emptyNutrition, type FoodLog, type Nutrition } from '@/lib/types';
import { dateStr } from '@/lib/utils';

/** Today's food logs, their combined nutrition, and the current logging streak. */
export function useFoodLogs() {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [total, setTotal] = useState<Nutrition>(emptyNutrition());
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const today = await getFoodLogsByDate(dateStr());
      setLogs(today);
      setTotal(today.reduce((acc, l) => addNutrition(acc, l.totalNutrition), emptyNutrition()));
      setStreak(await getLogStreak());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return onSynced(refresh); // re-read after a cloud pull merges new data
  }, [refresh]);

  return { logs, total, streak, loading, refresh };
}
