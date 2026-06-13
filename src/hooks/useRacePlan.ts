'use client';

import { useCallback, useEffect, useState } from 'react';
import { getRaceGoal, getTrainingPlan } from '@/lib/db';
import { onSynced } from '@/lib/supabase';
import type { RaceGoal, TrainingPlan } from '@/lib/types';

/** The user's active race goal and training plan (singletons). */
export function useRacePlan() {
  const [goal, setGoal] = useState<RaceGoal | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [g, p] = await Promise.all([getRaceGoal(), getTrainingPlan()]);
      setGoal(g ?? null);
      setPlan(p ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return onSynced(refresh);
  }, [refresh]);

  return { goal, plan, loading, refresh };
}
