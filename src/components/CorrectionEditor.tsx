'use client';

import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { getAccessToken } from '@/lib/supabase';
import type { AnalyseFoodResponse, Confidence, FoodItem } from '@/lib/types';
import { cn, fmt } from '@/lib/utils';

export interface CorrectionImage {
  b64: string;
  mimeType: string;
}

interface DraftItem {
  name: string;
  quantity: string;
  removed: boolean;
}

const CONFIDENCE_PILL: Record<Confidence, string> = {
  high: 'pill-green',
  medium: 'pill-amber',
  low: 'pill-red',
};

/**
 * Builds a natural-language correction from the user's inline edits (renames,
 * portion changes, removals) plus the free-text box. The API treats this as
 * ground truth when producing the revised analysis.
 */
function buildCorrectionText(original: FoodItem[], draft: DraftItem[], freeText: string): string {
  const lines: string[] = [];
  draft.forEach((d, i) => {
    const o = original[i];
    if (!o) return;
    if (d.removed) {
      lines.push(`Remove "${o.name}" entirely — it is not part of this meal.`);
      return;
    }
    const newName = d.name.trim();
    const newQty = d.quantity.trim();
    if (newName && newName !== o.name) {
      lines.push(`The item identified as "${o.name}" is actually "${newName}".`);
    }
    if (newQty && newQty !== o.quantity) {
      lines.push(`The portion of "${newName || o.name}" is "${newQty}", not "${o.quantity}".`);
    }
  });
  if (freeText.trim()) lines.push(freeText.trim());
  return lines.join('\n');
}

interface Props {
  /** The analysis being reviewed/corrected. */
  analysis: AnalyseFoodResponse;
  /** Photos of the meal, included in the re-analysis request when available. */
  images?: CorrectionImage[];
  /** Original text/context the user provided (re-sent for grounding). */
  contextText?: string;
  /** Receives the revised analysis returned by the AI. */
  onRevised: (revised: AnalyseFoodResponse) => void;
}

/**
 * Editable list of detected items (rename, fix portion, remove) plus a
 * free-text box for missed items. "Update analysis" re-queries the AI with
 * the photos + previous analysis + corrections and returns a full revision.
 * Repeatable — nothing is persisted here.
 */
export default function CorrectionEditor({ analysis, images, contextText, onRevised }: Props) {
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [freeText, setFreeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(analysis.foodItems.map((i) => ({ name: i.name, quantity: i.quantity, removed: false })));
    setFreeText('');
  }, [analysis]);

  const setItem = (index: number, changes: Partial<DraftItem>) =>
    setDraft((d) => d.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const correctionText = buildCorrectionText(analysis.foodItems, draft, freeText);

  const submit = async () => {
    if (!correctionText) return;
    setBusy(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/analyse-food', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images: images && images.length > 0 ? images : undefined,
          text: contextText?.trim() || undefined,
          previousAnalysis: analysis,
          correction: correctionText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not update the analysis. Please try again.');
      onRevised(data as AnalyseFoodResponse);
    } catch (err) {
      console.error('[correction] re-analysis failed', {
        imageCount: images?.length ?? 0,
        correctionLength: correctionText.length,
        error: err,
      });
      setError(err instanceof Error ? err.message : 'Could not update the analysis. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {analysis.foodItems.map((item, i) => {
          const d = draft[i];
          if (!d) return null;
          return (
            <div
              key={`${item.name}-${i}`}
              className={cn(
                'rounded-xl bg-slate-50 px-3 py-2.5',
                d.removed && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    className="input px-2.5 py-1.5 text-sm font-medium disabled:line-through"
                    value={d.name}
                    disabled={d.removed}
                    onChange={(e) => setItem(i, { name: e.target.value })}
                    aria-label={`Name of item ${i + 1}`}
                  />
                  <input
                    className="input px-2.5 py-1.5 text-xs"
                    value={d.quantity}
                    disabled={d.removed}
                    onChange={(e) => setItem(i, { quantity: e.target.value })}
                    aria-label={`Portion of item ${i + 1}`}
                    placeholder="portion, e.g. 1 bowl (250 ml)"
                  />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-slate-700">
                    {fmt(item.nutrition.calories)} kcal
                  </span>
                  <span className={CONFIDENCE_PILL[item.confidence]}>{item.confidence}</span>
                  <button
                    type="button"
                    onClick={() => setItem(i, { removed: !d.removed })}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
                      d.removed
                        ? 'text-slate-500 hover:bg-slate-200'
                        : 'text-danger-600 hover:bg-danger-50'
                    )}
                  >
                    {d.removed ? (
                      <>
                        <RotateCcw size={12} /> Undo
                      </>
                    ) : (
                      <>
                        <X size={12} /> Remove
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <label className="label" htmlFor="correction-free-text">
          Anything we missed? <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="correction-free-text"
          className="input min-h-[56px] resize-y"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="e.g. that's miso soup, not a bowl of oil — and there was also a side of edamame"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">{error}</p>
      )}

      <button
        type="button"
        className="btn-secondary w-full"
        onClick={submit}
        disabled={!correctionText || busy}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Re-analysing with your corrections…
          </>
        ) : (
          <>
            <Sparkles size={16} /> Update analysis
          </>
        )}
      </button>
      <p className="text-center text-xs text-slate-400">
        Edit names or portions above, remove wrong items, or describe what&apos;s missing — your
        corrections are treated as ground truth. Repeat as often as you like.
      </p>
    </div>
  );
}
