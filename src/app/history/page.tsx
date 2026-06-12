'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import {
  deleteFoodLog,
  getFoodLogsByDateRange,
  getSummariesByDateRange,
} from '@/lib/db';
import { backgroundSync, getAccessToken, onSynced } from '@/lib/supabase';
import type { DailySummary, FoodLog, InsightResponse } from '@/lib/types';
import { addDays, cn, dateStr, fmt } from '@/lib/utils';

type Period = '7d' | '30d' | 'week';

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'week', label: 'This Week' },
];

function rangeFor(period: Period): { start: string; end: string } {
  const end = dateStr();
  if (period === '7d') return { start: addDays(end, -6), end };
  if (period === '30d') return { start: addDays(end, -29), end };
  // This week (Monday → today)
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const sinceMonday = (day + 6) % 7;
  return { start: addDays(end, -sinceMonday), end };
}

export default function HistoryPage() {
  const { profile } = useProfile();
  const [period, setPeriod] = useState<Period>('7d');
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = rangeFor(period);
    const [s, l] = await Promise.all([
      getSummariesByDateRange(start, end),
      getFoodLogsByDateRange(start, end),
    ]);
    setSummaries(s);
    setLogs(l.reverse()); // most recent first
    setLoading(false);
  }, [period]);

  useEffect(() => {
    setInsight(null);
    setInsightError(null);
    load();
    return onSynced(load); // re-read after a cloud pull merges new data
  }, [load]);

  const target = profile?.targets.calorieTarget ?? 0;

  const chartData = useMemo(() => {
    const { start, end } = rangeFor(period);
    const byDate = new Map(summaries.map((s) => [s.date, s]));
    const data: {
      date: string;
      label: string;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
      target: number;
    }[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const s = byDate.get(d);
      const n = s?.totalNutrition;
      data.push({
        date: d,
        label: new Date(d + 'T12:00:00').toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        }),
        calories: Math.round(n?.calories ?? 0),
        protein: Math.round(n?.protein ?? 0),
        fat: Math.round(n?.fat ?? 0),
        carbs: Math.round(n?.carbs ?? 0),
        target,
      });
    }
    return data;
  }, [summaries, period, target]);

  const trackedDays = summaries.filter((s) => s.mealsLogged > 0);
  const avgCalories =
    trackedDays.length > 0
      ? trackedDays.reduce((sum, s) => sum + s.totalNutrition.calories, 0) / trackedDays.length
      : 0;
  const totalMeals = trackedDays.reduce((sum, s) => sum + s.mealsLogged, 0);

  const generateInsight = async () => {
    if (trackedDays.length === 0) return;
    setInsightLoading(true);
    setInsightError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/generate-insight', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          summaries: trackedDays.map((s) => ({
            date: s.date,
            calorieTarget: s.calorieTarget || target,
            mealsLogged: s.mealsLogged,
            totalNutrition: s.totalNutrition,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not generate an insight.');
      setInsight(data as InsightResponse);
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : 'Could not generate an insight.');
    } finally {
      setInsightLoading(false);
    }
  };

  const removeLog = async (id?: number) => {
    if (id == null) return;
    await deleteFoodLog(id); // queues the cloud delete if the request can't be sent now
    backgroundSync();
    load();
  };

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">History</h1>
        <p className="text-sm text-slate-400">Trends and past meals.</p>
      </header>

      {/* Period selector */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={cn(
              'rounded-lg py-2 text-xs font-semibold transition-colors sm:text-sm',
              period === p.value ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin text-primary-600" size={28} />
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card py-4 text-center">
              <p className="text-xl font-extrabold text-slate-900">{fmt(avgCalories)}</p>
              <p className="text-xs text-slate-400">Avg kcal/day</p>
            </div>
            <div className="card py-4 text-center">
              <p className="text-xl font-extrabold text-slate-900">{totalMeals}</p>
              <p className="text-xs text-slate-400">Meals logged</p>
            </div>
            <div className="card py-4 text-center">
              <p className="text-xl font-extrabold text-slate-900">{trackedDays.length}</p>
              <p className="text-xs text-slate-400">Days tracked</p>
            </div>
          </div>

          {/* AI Insight */}
          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">AI Insight</h2>
              <button
                type="button"
                className="btn-secondary"
                onClick={generateInsight}
                disabled={insightLoading || trackedDays.length === 0}
              >
                {insightLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {insight ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            {insightError && (
              <p className="mt-3 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {insightError}
              </p>
            )}
            {insight && (
              <div className="mt-3 animate-slide-up space-y-3 text-sm">
                <p className="text-slate-700">{insight.summary}</p>
                {insight.highlights.length > 0 && (
                  <ul className="space-y-1">
                    {insight.highlights.map((h, i) => (
                      <li key={i} className="flex gap-2 text-success-700">
                        <span>✓</span> {h}
                      </li>
                    ))}
                  </ul>
                )}
                {insight.concerns.length > 0 && (
                  <ul className="space-y-1">
                    {insight.concerns.map((c, i) => (
                      <li key={i} className="flex gap-2 text-warning-700">
                        <span>!</span> {c}
                      </li>
                    ))}
                  </ul>
                )}
                {insight.recommendation && (
                  <p className="rounded-xl bg-primary-50 px-4 py-3 font-medium text-primary-700">
                    {insight.recommendation}
                  </p>
                )}
              </div>
            )}
            {!insight && !insightError && (
              <p className="mt-2 text-sm text-slate-400">
                {trackedDays.length === 0
                  ? 'Log some meals first, then generate an AI summary of your habits.'
                  : 'Get an AI summary of your recent eating patterns.'}
              </p>
            )}
          </section>

          {/* Calorie trend */}
          <section className="card">
            <h2 className="mb-4 font-semibold text-slate-900">Calorie trend</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="calories"
                    name="Calories"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="Target"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Macro stacked bars */}
          <section className="card">
            <h2 className="mb-4 font-semibold text-slate-900">Macros per day (g)</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="protein" name="Protein" stackId="a" fill="#16a34a" />
                  <Bar dataKey="fat" name="Fat" stackId="a" fill="#9333ea" />
                  <Bar dataKey="carbs" name="Carbs" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Meal log list */}
          <section className="card">
            <h2 className="mb-3 font-semibold text-slate-900">Meal log</h2>
            {logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No meals logged in this period.
              </p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                        {log.mealType} ·{' '}
                        {new Date(log.date + 'T12:00:00').toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="truncate text-sm font-medium text-slate-800">
                        {log.items.map((i) => i.name).join(', ')}
                      </p>
                      {log.notes && <p className="truncate text-xs text-slate-400">{log.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-slate-700">
                        {fmt(log.totalNutrition.calories)} kcal
                      </span>
                      <button
                        type="button"
                        aria-label="Delete log"
                        onClick={() => removeLog(log.id)}
                        className="rounded-lg p-1.5 text-slate-300 hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
