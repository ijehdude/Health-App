'use client';

import { useCallback, useEffect, useState } from 'react';
import { getProfile } from '@/lib/db';
import type { UserProfile } from '@/lib/types';

/** Loads the user profile from Dexie (client-side only). */
export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const p = await getProfile();
      setProfile(p ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
