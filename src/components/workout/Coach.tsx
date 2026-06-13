'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import Disclaimer from '@/components/Disclaimer';
import { useRacePlan } from '@/hooks/useRacePlan';
import { getExerciseSessionsByDateRange } from '@/lib/db';
import { apiHeaders } from '@/lib/supabase';
import type { CoachMessage, ExerciseSession, UserProfile } from '@/lib/types';
import { addDays, cn, dateStr } from '@/lib/utils';

const SUGGESTIONS = [
  'How do I improve my 10K time?',
  'Is my training volume on track for my goal?',
  'What should my next two workouts be?',
  'How should I fuel my long runs?',
];

export default function Coach({ profile }: { profile: UserProfile }) {
  const { goal, plan } = useRacePlan();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ExerciseSession[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getExerciseSessionsByDateRange(addDays(dateStr(), -14), dateStr()).then(setRecent);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setError(null);
    const next: CoachMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({
          messages: next,
          today: dateStr(),
          profile: {
            age: profile.age,
            sex: profile.sex,
            weightKg: profile.weightKg,
            heightCm: profile.heightCm,
            goal: profile.goal,
            activityLevel: profile.activityLevel,
          },
          raceGoal: goal
            ? {
                raceType: goal.raceType,
                customDistanceKm: goal.customDistanceKm,
                targetTime: goal.targetTime,
                raceDate: goal.raceDate,
                experience: goal.experience,
                currentWeeklyKm: goal.currentWeeklyKm,
                recentPerformance: goal.recentPerformance,
              }
            : undefined,
          planSummary: plan?.summary,
          recentExercise: recent.map((s) => ({
            date: s.date,
            activity: s.activity,
            modality: s.modality,
            durationMinutes: s.durationMinutes,
            distanceKm: s.distanceKm,
            intensity: s.intensity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'The coach is unavailable right now.');
      setMessages((prev) => [...prev, { role: 'coach', content: data.reply }]);
    } catch (err) {
      console.error('[coach] request failed', err);
      setError(err instanceof Error ? err.message : 'The coach is unavailable right now.');
      // Roll back the optimistic user message so they can retry cleanly.
      setMessages((prev) => prev.slice(0, -1));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-in flex h-[calc(100dvh-14rem)] min-h-[24rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary-600" size={18} />
              <h2 className="font-semibold text-slate-900">Ask the coach</h2>
            </div>
            <p className="text-sm text-slate-500">
              Ask anything about your training. Answers are grounded in your logged sessions,
              profile{goal ? ' and race goal' : ''}.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                >
                  {s}
                </button>
              ))}
            </div>
            <Disclaimer />
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-100'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
              <Loader2 size={16} className="animate-spin" /> Coach is thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="mb-2 rounded-xl bg-danger-50 px-4 py-2.5 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-slate-100 bg-white pt-3">
        <label htmlFor="coach-input" className="sr-only">
          Message to coach
        </label>
        <textarea
          id="coach-input"
          aria-label="Message to coach"
          className="input max-h-32 min-h-[44px] flex-1 resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask your coach…"
          rows={1}
        />
        <button
          type="button"
          aria-label="Send"
          className="btn-primary h-11 w-11 shrink-0 !px-0"
          onClick={() => send(input)}
          disabled={sending || input.trim().length === 0}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
