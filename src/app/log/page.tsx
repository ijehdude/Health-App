'use client';

/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { addFoodLog } from '@/lib/db';
import {
  MACRO_KEYS,
  NUTRIENT_META,
  type AnalyseFoodResponse,
  type Confidence,
  type MealType,
} from '@/lib/types';
import { cn, dateStr, fmt } from '@/lib/utils';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

function autoMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

const CONFIDENCE_PILL: Record<Confidence, string> = {
  high: 'pill-green',
  medium: 'pill-amber',
  low: 'pill-red',
};

const KEY_MICROS = ['iron', 'calcium', 'vitaminC', 'vitaminD', 'potassium', 'vitaminB12'] as const;

export default function LogPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'photo' | 'text'>('photo');
  const [mealType, setMealType] = useState<MealType>(autoMealType);
  const [image, setImage] = useState<{ b64: string; mime: string; dataUrl: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalyseFoodResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image is too large (max 8 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(',')[1];
      setImage({ b64, mime: file.type, dataUrl });
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const analyse = async () => {
    setError(null);
    setAnalysing(true);
    try {
      const body =
        tab === 'photo'
          ? { imageB64: image?.b64, mimeType: image?.mime }
          : { text: text.trim() };
      const res = await fetch('/api/analyse-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed. Please try again.');
      setResult(data as AnalyseFoodResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setAnalysing(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await addFoodLog({
        date: dateStr(),
        mealType,
        items: result.foodItems,
        totalNutrition: result.totalNutrition,
        confidence: result.confidence,
        warningMessage: result.warningMessage,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        synced: 0,
      });
      router.push('/');
    } catch {
      setError('Could not save this meal. Please try again.');
      setSaving(false);
    }
  };

  const canAnalyse = tab === 'photo' ? !!image : text.trim().length > 2;

  // -------------------------------------------------------------------------
  // Review screen
  // -------------------------------------------------------------------------
  if (result) {
    const total = result.totalNutrition;
    return (
      <div className="animate-slide-up space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Review your meal</h1>
          <button type="button" className="btn-ghost" onClick={() => setResult(null)}>
            <Pencil size={16} /> Edit input
          </button>
        </header>

        {result.warningMessage && (
          <div className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>{result.warningMessage}</p>
          </div>
        )}

        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Identified items</h2>
            <span className={CONFIDENCE_PILL[result.confidence]}>
              {result.confidence} confidence
            </span>
          </div>
          {result.foodItems.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-400">{item.quantity}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-slate-700">
                  {fmt(item.nutrition.calories)} kcal
                </span>
                <span className={CONFIDENCE_PILL[item.confidence]}>{item.confidence}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold text-slate-900">Total nutrition</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MACRO_KEYS.map((k) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs text-slate-400">{NUTRIENT_META[k].label}</p>
                <p className="text-sm font-bold tabular-nums text-slate-800">
                  {fmt(total[k])} {NUTRIENT_META[k].unit}
                </p>
              </div>
            ))}
          </div>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Key micronutrients
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {KEY_MICROS.map((k) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs text-slate-400">{NUTRIENT_META[k].label}</p>
                <p className="text-sm font-bold tabular-nums text-slate-800">
                  {fmt(total[k])} {NUTRIENT_META[k].unit}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-4">
          <div>
            <label className="label">Meal type</label>
            <MealTypeSelector value={mealType} onChange={setMealType} />
          </div>
          <div>
            <label className="label" htmlFor="log-notes">
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="log-notes"
              className="input min-h-[72px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. ate out, extra dressing on the side…"
            />
          </div>
        </section>

        {error && (
          <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">{error}</p>
        )}

        <button type="button" className="btn-primary w-full py-3.5" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Save to log
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Input screen
  // -------------------------------------------------------------------------
  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Log Food</h1>
        <p className="text-sm text-slate-400">Snap a photo or describe what you ate.</p>
      </header>

      {/* Tab toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            { value: 'photo', label: 'Photo', icon: Camera },
            { value: 'text', label: 'Text', icon: Type },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
              tab === value ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
            )}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div>
        <label className="label">Meal type</label>
        <MealTypeSelector value={mealType} onChange={setMealType} />
      </div>

      {tab === 'photo' ? (
        <div className="card">
          {image ? (
            <div className="relative">
              <img
                src={image.dataUrl}
                alt="Meal preview"
                className="max-h-80 w-full rounded-xl object-cover"
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setImage(null)}
                className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-slate-900"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-colors',
                dragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 bg-slate-50 hover:border-primary-300'
              )}
            >
              <Upload size={28} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                Drag & drop a photo, or tap to select
              </span>
              <span className="text-xs text-slate-400">Camera opens on mobile · JPG/PNG, max 8 MB</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div className="card">
          <label className="label" htmlFor="log-text">
            What did you eat?
          </label>
          <textarea
            id="log-text"
            className="input min-h-[120px] resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 2 scrambled eggs with toast and orange juice"
          />
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">{error}</p>
      )}

      <button
        type="button"
        className="btn-primary w-full py-3.5"
        onClick={analyse}
        disabled={!canAnalyse || analysing}
      >
        {analysing ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Analysing your meal…
          </>
        ) : (
          <>
            <Sparkles size={18} /> Analyse with AI
          </>
        )}
      </button>
    </div>
  );
}

function MealTypeSelector({
  value,
  onChange,
}: {
  value: MealType;
  onChange: (v: MealType) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MEAL_TYPES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={cn(
            'rounded-xl border py-2 text-xs font-semibold transition-colors sm:text-sm',
            value === m.value
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
