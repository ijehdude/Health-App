import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGenerateJson } from '@/lib/ai';
import { validateSession } from '@/lib/serverAuth';
import { EXERCISE_MODALITIES } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TEXT_CHARS = 60_000;

const requestSchema = z
  .object({
    /** Free-text description, or text already extracted from an uploaded file. */
    text: z.string().trim().min(1).max(MAX_TEXT_CHARS).optional(),
    /** A document (typically a scanned PDF) for the model to read directly. */
    document: z
      .object({ b64: z.string().min(1), mimeType: z.string().min(1) })
      .optional(),
    /** Today's local date (YYYY-MM-DD) so relative dates resolve correctly. */
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Profile context used to estimate calories burned. */
    weightKg: z.number().positive().optional(),
    sex: z.enum(['male', 'female', 'other']).optional(),
    age: z.number().positive().optional(),
    /** Hint about what the upload is (filename / Strava / Garmin / etc.). */
    sourceHint: z.string().trim().max(200).optional(),
  })
  .refine((b) => b.text || b.document, {
    message: 'Provide a description or a document.',
  });

const modalityValues = EXERCISE_MODALITIES.map((m) => m.value) as [string, ...string[]];

const sessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity: z.string().min(1).catch('Workout'),
  modality: z.enum(modalityValues).catch('other'),
  durationMinutes: z.number().nonnegative().catch(0),
  distanceKm: z.number().nonnegative().optional(),
  pace: z.string().optional(),
  intensity: z.enum(['light', 'moderate', 'vigorous']).catch('moderate'),
  caloriesBurned: z.number().nonnegative().catch(0),
  notes: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).catch('medium'),
});

const responseSchema = z.object({
  sessions: z.array(sessionSchema).max(200),
  warningMessage: z.string().nullish(),
});

const SYSTEM_PROMPT = `You are a sports-science assistant that extracts structured exercise records from messy real-world inputs: free-text descriptions, fitness-tracker exports (Strava, Garmin Connect, Apple Health), spreadsheets, and freeform training logs.

Respond with ONLY a valid JSON object — no markdown, no commentary — in exactly this shape:
{
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "activity": "string — short label, e.g. 'Easy run', 'Tempo intervals', 'Upper body'",
      "modality": "run" | "bike" | "swim" | "walk" | "row" | "strength" | "cardio" | "hiit" | "yoga" | "other",
      "durationMinutes": number,
      "distanceKm": number (omit if not applicable, e.g. strength),
      "pace": "string — e.g. '5:36 /km' (omit if unknown)",
      "intensity": "light" | "moderate" | "vigorous",
      "caloriesBurned": number,
      "notes": "string — anything notable (omit if none)",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "warningMessage": "string — include ONLY if data was ambiguous, partially unreadable, or assumptions were made; otherwise omit"
}

Rules:
- Output ONE session object per distinct workout. A single description like "ran 5k then 20 min easy bike" is TWO sessions.
- Resolve relative dates ("today", "this morning", "yesterday", "Monday") against the provided current date. If a row has its own explicit date, use that. If no date can be determined at all, use the current date and lower confidence.
- Convert all distances to kilometres and all durations to minutes.
- Estimate caloriesBurned realistically using METs and the user's body weight when provided (e.g. running ~10 METs, moderate cycling ~7, swimming ~8, walking ~3.5, vigorous strength ~6). kcal ≈ METs × weightKg × hours. If weight is unknown, assume 70 kg and set confidence no higher than "medium".
- Estimate intensity from pace/effort/heart-rate cues; default to "moderate" when unclear.
- "confidence" per session: "high" when activity, duration and date are explicit; "medium" when some values are estimated; "low" when the row is sparse or unclear.
- Ignore non-exercise rows (headers, totals, rest days, sleep, weight entries). Never invent workouts that aren't in the input.
- If no exercise can be identified at all, return {"sessions": []} with a warningMessage explaining why.`;

function buildUserText(body: z.infer<typeof requestSchema>): string {
  const lines: string[] = [`Current date (user's local time): ${body.today}.`];
  if (body.weightKg) lines.push(`User body weight: ${body.weightKg} kg.`);
  if (body.sex) lines.push(`Sex: ${body.sex}.`);
  if (body.age) lines.push(`Age: ${body.age}.`);
  if (body.sourceHint) lines.push(`Source of this data: ${body.sourceHint}.`);

  if (body.document) {
    lines.push(
      'Extract every exercise session from the attached document. It may be a fitness-tracker export or a scanned/handwritten training log.'
    );
  }
  if (body.text) {
    lines.push('Extract every exercise session from the following input:', '---', body.text, '---');
  }
  return lines.join('\n');
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session.ok) {
    return NextResponse.json({ error: session.message }, { status: session.status });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'Provide a workout description or a file to import.' },
      { status: 400 }
    );
  }

  try {
    const raw = await aiGenerateJson({
      system: SYSTEM_PROMPT,
      text: buildUserText(body),
      images: body.document
        ? [{ b64: body.document.b64, mimeType: body.document.mimeType }]
        : undefined,
      // Files / documents need the stronger model; plain free text can use mini.
      tier: body.document ? 'full' : 'mini',
    });

    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'The AI returned an unexpected format. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      sessions: parsed.data.sessions,
      warningMessage: parsed.data.warningMessage ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not parse the workout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
