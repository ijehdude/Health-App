import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGenerateText } from '@/lib/ai';
import { validateSession } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const messageSchema = z.object({
  role: z.enum(['user', 'coach']),
  content: z.string().min(1).max(4000),
});

const sessionSchema = z.object({
  date: z.string(),
  activity: z.string(),
  modality: z.string(),
  durationMinutes: z.number().catch(0),
  distanceKm: z.number().optional(),
  intensity: z.string().optional(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  today: z.string(),
  profile: z.object({
    age: z.number().optional(),
    sex: z.string().optional(),
    weightKg: z.number().optional(),
    heightCm: z.number().optional(),
    goal: z.string().optional(),
    activityLevel: z.string().optional(),
  }),
  raceGoal: z
    .object({
      raceType: z.string(),
      customDistanceKm: z.number().optional(),
      targetTime: z.string().optional(),
      raceDate: z.string(),
      experience: z.string(),
      currentWeeklyKm: z.number().optional(),
      recentPerformance: z.string().optional(),
    })
    .optional(),
  recentExercise: z.array(sessionSchema).max(60).catch([]),
  planSummary: z.string().max(2000).optional(),
});

const SYSTEM_PROMPT = `You are an experienced, encouraging endurance running coach inside a combined nutrition + fitness app. You give specific, actionable, evidence-based advice grounded in the user's own logged training, profile and race goal.

Guidelines:
- Be concrete and personal: reference the user's actual recent sessions, weekly volume, goal and timeline. Avoid generic filler.
- Give clear next steps the user can act on this week.
- Respect training-science safety: progress weekly load gradually (~10% per week guidance), include easy/recovery and rest, emphasise that most running should be easy-paced, and tailor everything to their stated experience level (don't give a beginner an advanced plan).
- Warn the user to stop and seek help for pain, injury or illness rather than training through it.
- Keep a warm, motivating, non-judgemental tone. Never frame food as something to "earn" or "burn off".
- This is general fitness guidance, not medical advice. If the user mentions injury, a medical condition, pregnancy, or disordered eating, gently recommend they consult a qualified professional.
- Write in plain prose (short paragraphs and the occasional bullet list). Do not output JSON. Keep replies focused — usually under 250 words.`;

function describeRace(g: NonNullable<z.infer<typeof requestSchema>['raceGoal']>): string {
  const dist =
    g.raceType === 'custom' ? `${g.customDistanceKm ?? '?'} km` : g.raceType.toUpperCase();
  const bits = [`Race: ${dist} on ${g.raceDate}`];
  if (g.targetTime) bits.push(`target time ${g.targetTime}`);
  bits.push(`experience: ${g.experience}`);
  if (g.currentWeeklyKm) bits.push(`current volume ~${g.currentWeeklyKm} km/week`);
  if (g.recentPerformance) bits.push(`recent form: ${g.recentPerformance}`);
  return bits.join(', ') + '.';
}

function buildContext(body: z.infer<typeof requestSchema>): string {
  const p = body.profile;
  const lines: string[] = [`Today is ${body.today}.`];
  const profBits: string[] = [];
  if (p.age) profBits.push(`age ${p.age}`);
  if (p.sex) profBits.push(p.sex);
  if (p.weightKg) profBits.push(`${p.weightKg} kg`);
  if (p.heightCm) profBits.push(`${p.heightCm} cm`);
  if (p.goal) profBits.push(`nutrition goal: ${p.goal}`);
  if (p.activityLevel) profBits.push(`activity level: ${p.activityLevel}`);
  if (profBits.length) lines.push(`User: ${profBits.join(', ')}.`);

  if (body.raceGoal) lines.push(describeRace(body.raceGoal));
  else lines.push('No race goal has been set yet.');

  if (body.planSummary) lines.push(`Active training plan: ${body.planSummary}`);

  if (body.recentExercise.length > 0) {
    lines.push('Recent logged sessions (most recent last):');
    for (const s of body.recentExercise.slice(-20)) {
      lines.push(
        `- ${s.date}: ${s.activity} (${s.modality}), ${s.durationMinutes} min` +
          (s.distanceKm ? `, ${s.distanceKm} km` : '') +
          (s.intensity ? `, ${s.intensity}` : '')
      );
    }
  } else {
    lines.push('No exercise has been logged yet.');
  }
  return lines.join('\n');
}

function buildConversation(body: z.infer<typeof requestSchema>): string {
  const transcript = body.messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n');
  return `Context about this user:\n${buildContext(body)}\n\nConversation so far:\n${transcript}\n\nWrite the coach's next reply.`;
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

  try {
    const reply = await aiGenerateText({
      system: SYSTEM_PROMPT,
      text: buildConversation(body),
      tier: 'full',
      temperature: 0.5,
    });
    if (!reply) {
      return NextResponse.json({ error: 'The coach had nothing to say — please try again.' }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The coach is unavailable right now.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
