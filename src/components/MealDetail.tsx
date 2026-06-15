'use client';

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import CorrectionEditor, { type CorrectionImage } from './CorrectionEditor';
import { deleteFoodLog, updateFoodLog } from '@/lib/db';
import { backgroundSync } from '@/lib/supabase';
import {
  NUTRIENT_META,
  type AnalyseFoodResponse,
  type Confidence,
  type FoodLog,
  type MealType,
} from '@/lib/types';
import { cn, fmt } from '@/lib/utils';

const CONFIDENCE_PILL: Record<Confidence, string> = {
  high: 'pill-green',
  medium: 'pill-amber',
  low: 'pill-red',
};

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const TOTAL_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fibre', 'sugar'] as const;

interface Props {
  log: FoodLog;
  onClose: () => void;
  /** Called after the meal is amended or deleted so the parent can reload. */
  onChanged: () => void;
}

/** Full-detail modal for a saved meal: untruncated items, photos, amend, delete. */
export default function MealDetail({ log, onClose, onChanged }: Props) {
  const [current, setCurrent] = useState<FoodLog>(log);
  const [mode, setMode] = useState<'view' | 'amend'>('view');
  const [revision, setRevision] = useState<AnalyseFoodResponse | null>(null);
  const [mealType, setMealType] = useState<MealType>(log.mealType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stored photos (data URLs) → raw parts for the re-analysis request.
  const correctionImages = useMemo<CorrectionImage[]>(
    () =>
      (current.photos ?? []).map((dataUrl) => {
        const comma = dataUrl.indexOf(',');
        const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
        return { b64: dataUrl.slice(comma + 1), mimeType: mime || 'image/jpeg' };
      }),
    [current.photos]
  );

  const analysisOfCurrent: AnalyseFoodResponse = useMemo(
    () => ({
      foodItems: current.items,
      totalNutrition: current.totalNutrition,
      confidence: current.confidence,
      warningMessage: current.warningMessage,
    }),
    [current]
  );

  // Without photos, the revision is grounded in the stored item list instead.
  const contextText =
    correctionImages.length > 0
      ? undefined
      : current.items.map((i) => `${i.quantity} ${i.name}`).join(', ');

  const hasChanges = revision !== null || mealType !== current.mealType;

  const confirmAmend = async () => {
    if (current.id == null || !hasChanges) return;
    setBusy(true);
    setError(null);
    try {
      const changes: Partial<FoodLog> = { mealType };
      if (revision) {
        changes.items = revision.foodItems;
        changes.totalNutrition = revision.totalNutrition;
        changes.confidence = revision.confidence;
        changes.warningMessage = revision.warningMessage ?? undefined;
      }
      await updateFoodLog(current.id, changes);
      backgroundSync();
      setCurrent((c) => ({ ...c, ...changes }));
      setRevision(null);
      setMode('view');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this meal.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (current.id == null) return;
    const sure = window.confirm('Delete this meal? This cannot be undone.');
    if (!sure) return;
    await deleteFoodLog(current.id);
    backgroundSync();
    onChanged();
    onClose();
  };

  const when = `${new Date(current.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${new Date(current.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const shownAnalysis = revision ?? analysisOfCurrent;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:rounded-2xl md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span className="pill bg-primary-100 capitalize text-primary-700">{current.mealType}</span>
            <p className="mt-1.5 text-xs text-slate-400">{when}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={CONFIDENCE_PILL[current.confidence]}>{current.confidence}</span>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Photos */}
        {(current.photos?.length ?? 0) > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            {current.photos!.map((p, i) => (
              <img
                key={i}
                src={p}
                alt={`Meal photo ${i + 1}`}
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        )}

        {current.warningMessage && mode === 'view' && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2.5 text-xs text-warning-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {current.warningMessage}
          </div>
        )}

        {mode === 'view' ? (
          <>
            {/* Full per-item breakdown, untruncated */}
            <div className="space-y-2">
              {current.items.map((item, i) => (
                <div key={`${item.name}-${i}`} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.quantity}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                      {fmt(item.nutrition.calories)} kcal
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    P {fmt(item.nutrition.protein)}g · C {fmt(item.nutrition.carbs)}g · F{' '}
                    {fmt(item.nutrition.fat)}g
                  </p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {TOTAL_KEYS.map((k) => (
                <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    {NUTRIENT_META[k].label}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-slate-800">
                    {fmt(current.totalNutrition[k])} {NUTRIENT_META[k].unit}
                  </p>
                </div>
              ))}
            </div>

            {current.notes && (
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{current.notes}</p>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setMode('amend')}>
                <Pencil size={16} /> Amend
              </button>
              <button type="button" className="btn-danger flex-1" onClick={remove}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-3 font-semibold text-slate-900">Amend this meal</h3>

            <CorrectionEditor
              analysis={shownAnalysis}
              images={correctionImages}
              contextText={contextText}
              onRevised={setRevision}
            />

            {revision && (
              <div className="mt-4 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
                Revised: <strong>{fmt(revision.totalNutrition.calories)} kcal</strong> (was{' '}
                {fmt(current.totalNutrition.calories)}) ·{' '}
                {revision.foodItems.map((i) => i.name).join(', ')}
              </div>
            )}

            <div className="mt-4">
              <label className="label">Meal type</label>
              <div className="grid grid-cols-4 gap-2">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMealType(m)}
                    className={cn(
                      'rounded-xl border py-2 text-xs font-semibold capitalize transition-colors',
                      mealType === m
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => {
                  setRevision(null);
                  setMealType(current.mealType);
                  setMode('view');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={confirmAmend}
                disabled={!hasChanges || busy}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Confirm & update
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
