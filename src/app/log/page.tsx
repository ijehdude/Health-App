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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // ~10 MB

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Browsers often report no MIME type for HEIC — fall back to the extension. */
function resolveImageMime(file: File): string | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? null;
}

/** Longest side of the normalized JPEG sent to the AI. */
const MAX_IMAGE_DIMENSION = 1536;

/** Thrown when the browser cannot decode the image at all (e.g. HEIC on older WebKit). */
class UnsupportedImageError extends Error {
  constructor() {
    super('Browser could not decode this image format.');
    this.name = 'UnsupportedImageError';
  }
}

/**
 * Normalizes any uploaded/taken photo to JPEG client-side: decode (with an
 * <img> object-URL fallback for formats createImageBitmap rejects), downscale
 * to max 1536px on the longest side, re-encode at quality 0.85. This makes
 * iPhone HEIC photos safe before they reach the data-URL/Gemini pipeline.
 */
async function convertToJpeg(file: File): Promise<{ b64: string; dataUrl: string }> {
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | null = null;

  try {
    source = await createImageBitmap(file);
  } catch {
    objectUrl = URL.createObjectURL(file);
    try {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new UnsupportedImageError());
        img.src = objectUrl!;
      });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw err instanceof UnsupportedImageError ? err : new UnsupportedImageError();
    }
  }

  try {
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) throw new UnsupportedImageError();

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    // Split on the first comma only — no assumptions about the mime prefix.
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (!dataUrl.startsWith('data:image/jpeg') || !b64) {
      throw new UnsupportedImageError();
    }
    return { b64, dataUrl };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (source instanceof ImageBitmap) source.close();
  }
}

export default function LogPage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!resolveImageMime(file)) {
      setError('That file type isn’t supported — please choose a JPG, PNG, WebP or HEIC image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        `That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 10 MB. Try a smaller photo.`
      );
      return;
    }
    try {
      // Everything is re-encoded as JPEG, so the preview, the data-URL split
      // and the Gemini mime type are format-independent from here on.
      const { b64, dataUrl } = await convertToJpeg(file);
      setImage({ b64, mime: 'image/jpeg', dataUrl });
    } catch (err) {
      console.error('[log] image conversion failed', {
        step: 'convertToJpeg',
        fileName: file.name,
        fileType: file.type || '(empty)',
        fileSizeBytes: file.size,
        error: err,
      });
      setError(
        err instanceof UnsupportedImageError
          ? 'This photo format isn’t supported — please choose a JPEG or PNG, or screenshot the photo and upload that.'
          : 'Could not process that image — please try a different photo.'
      );
    }
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
      console.error('[log] analyse failed', {
        step: 'analyse-food request',
        mode: tab,
        imageMime: image?.mime ?? null,
        imageB64Length: image?.b64.length ?? 0,
        textLength: text.trim().length,
        error: err,
      });
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
            <div
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
                'flex w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-4 py-10 transition-colors',
                dragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 bg-slate-50'
              )}
            >
              <Upload size={28} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                Drag & drop a photo here, or
              </span>
              <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera size={16} /> Take Photo
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload size={16} /> Upload Photo
                </button>
              </div>
              <span className="text-xs text-slate-400">JPG, PNG, WebP or HEIC · max 10 MB</span>
            </div>
          )}
          {/* Camera capture (mobile opens the camera; desktop falls back to a file picker) */}
          <input
            ref={cameraInputRef}
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
          {/* Gallery / file picker (no capture attribute) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
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
