'use client';

import { useCallback, useEffect, useState } from 'react';
import { getExerciseSessionsByDate } from '@/lib/db';
import { onSynced } from '@/lib/supabase';
import type { ExerciseSession } from '@/lib/types';
import { dateStr } from '@/lib/utils';

/** Today's logged exercise sessions and total energy expenditure. */
export function useExercise() {
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const today = await getExerciseSessionsByDate(dateStr());
      setSessions(today);
      setCaloriesBurned(today.reduce((sum, s) => sum + (s.caloriesBurned || 0), 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return onSynced(refresh); // re-read after a cloud pull merges new data
  }, [refresh]);

  return { sessions, caloriesBurned, loading, refresh };
}
