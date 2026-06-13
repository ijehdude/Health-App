import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGenerateJson } from '@/lib/ai';
import { validateSession } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Monday of the current week — plans start here for clean weeks. */
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  raceGoal: z.object({
    raceType: z.string(),
    customDistanceKm: z.number().optional(),
    raceName: z.string().optional(),
    targetTime: z.string().optional(),
    raceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    experience: z.string(),
    currentWeeklyKm: z.number().optional(),
    recentPerformance: z.string().optional(),
  }),
  weeksAvailable: z.number().int().positive().max(40),
  profile: z.object({
    age: z.number().optional(),
    sex: z.string().optional(),
    weightKg: z.number().optional(),
    goal: z.string().optional(),
  }),
});

const plannedSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  focus: z.enum(['easy', 'tempo', 'interval', 'long', 'rest', 'cross', 'recovery', 'race']).catch('easy'),
  title: z.string().min(1).catch('Session'),
  description: z.string().catch(''),
  durationMinutes: z.number().nonnegative().optional(),
  distanceKm: z.number().nonnegative().optional(),
  intensity: z.enum(['light', 'moderate', 'vigorous']).catch('light'),
});

const weekSchema = z.object({
  weekNumber: z.number().int(),
  startDate: z.string(),
  phase: z.string().catch('base'),
  focus: z.string().catch(''),
  totalKm: z.number().nonnegative().optional(),
  isDeload: z.boolean().optional(),
  sessions: z.array(plannedSessionSchema).max(7),
});

const responseSchema = z.object({
  summary: z.string(),
  weeks: z.array(weekSchema).min(1).max(40),
});

const SYSTEM_PROMPT = `You are an expert endurance running coach. Build a safe, periodised, personalised training plan that takes the user from now to their race date.

Respond with ONLY a valid JSON object — no markdown, no commentary — in exactly this shape:
{
  "summary": "2-3 sentences: the plan's overall approach, phases and how it fits the goal/timeline",
  "weeks": [
    {
      "weekNumber": 1,
      "startDate": "YYYY-MM-DD (the Monday of the week)",
      "phase": "base" | "build" | "peak" | "taper",
      "focus": "short phrase describing the week's emphasis",
      "totalKm": number (approx planned running volume),
      "isDeload": boolean,
      "sessions": [
        {
          "date": "YYYY-MM-DD",
          "focus": "easy" | "tempo" | "interval" | "long" | "rest" | "cross" | "recovery" | "race",
          "title": "short label, e.g. 'Easy 5 km' or 'Rest day'",
          "description": "1-2 sentences: what to do and at what effort",
          "durationMinutes": number (omit for rest),
          "distanceKm": number (omit for rest/cross),
          "intensity": "light" | "moderate" | "vigorous"
        }
      ]
    }
  ]
}

Hard rules (safety first):
- Produce exactly one week per training week from the given week start up to and including the race week. Each week MUST contain 7 sessions, one per day (Mon–Sun), including explicit "rest" days.
- The final session, on the race date, must have focus "race".
- Tailor volume and intensity to the user's stated experience and current weekly km. A beginner must NOT be given an advanced plan — start conservatively near their current volume.
- Increase weekly running volume by no more than ~10% week-on-week. Do NOT ramp aggressively.
- Include at least 1-2 rest or recovery days every week. For plans of 5+ weeks, insert a lighter "deload" week (isDeload: true, reduced volume) roughly every 3-4 weeks.
- Most running should be easy/light intensity (~80%). Limit hard sessions (interval/tempo) to 1-2 per week.
- Always taper in the final 1-2 weeks before the race (reduced volume, maintained light intensity).
- Keep descriptions concise. Use realistic paces/efforts, not exact clock times.`;

function describeRace(g: z.infer<typeof requestSchema>['raceGoal']): string {
  const dist = g.raceType === 'custom' ? `${g.customDistanceKm ?? '?'} km` : g.raceType.toUpperCase();
  const bits = [`Race distance: ${dist}`, `Race date: ${g.raceDate}`, `Experience: ${g.experience}`];
  if (g.raceName) bits.push(`Event: ${g.raceName}`);
  if (g.targetTime) bits.push(`Target finish time: ${g.targetTime}`);
  if (g.currentWeeklyKm) bits.push(`Current weekly volume: ~${g.currentWeeklyKm} km`);
  if (g.recentPerformance) bits.push(`Recent form: ${g.recentPerformance}`);
  return bits.join('\n');
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
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userText = [
    `Today: ${body.today}. Plan should start the week of ${body.weekStart}.`,
    `There are about ${body.weeksAvailable} weeks until race day.`,
    body.profile.age ? `Athlete: age ${body.profile.age}, ${body.profile.sex ?? ''}.` : '',
    describeRace(body.raceGoal),
    'Build the full week-by-week plan now.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const raw = await aiGenerateJson({
      system: SYSTEM_PROMPT,
      text: userText,
      tier: 'full',
      temperature: 0.3,
    });

    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'The AI returned an unexpected plan format. Please try again.' },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate a plan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
