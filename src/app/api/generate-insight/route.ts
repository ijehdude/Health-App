import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGenerateJson } from '@/lib/ai';
import { validateSession } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const summarySchema = z.object({
  date: z.string(),
  calorieTarget: z.number().catch(0),
  mealsLogged: z.number().catch(0),
  totalNutrition: z.record(z.string(), z.number()).catch({}),
});

const requestSchema = z.object({
  summaries: z.array(summarySchema).min(1).max(60),
});

const responseSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()).catch([]),
  concerns: z.array(z.string()).catch([]),
  recommendation: z.string().catch(''),
});

const SYSTEM_PROMPT = `You are an encouraging but evidence-based nutrition coach reviewing a user's recent food-tracking data.

Respond with ONLY a valid JSON object — no markdown, no commentary:
{
  "summary": "2-3 sentence overview of their recent eating patterns and consistency",
  "highlights": ["2-4 short bullet points of things going well"],
  "concerns": ["1-3 short bullet points of patterns worth attention"],
  "recommendation": "one specific, actionable suggestion for the coming week"
}

Be specific — reference actual numbers from the data. Stay supportive and never give medical advice.`;

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
      { error: 'Provide at least one daily summary.' },
      { status: 400 }
    );
  }

  const lines = body.summaries.map((s) => {
    const n = s.totalNutrition;
    return (
      `${s.date}: ${Math.round(n.calories ?? 0)} kcal (target ${s.calorieTarget}), ` +
      `protein ${Math.round(n.protein ?? 0)}g, carbs ${Math.round(n.carbs ?? 0)}g, ` +
      `fat ${Math.round(n.fat ?? 0)}g, sugar ${Math.round(n.sugar ?? 0)}g, ` +
      `fibre ${Math.round(n.fibre ?? 0)}g, sodium ${Math.round(n.sodium ?? 0)}mg, ` +
      `${s.mealsLogged} meals logged`
    );
  });

  try {
    const raw = await aiGenerateJson({
      system: SYSTEM_PROMPT,
      text: `Here is the user's daily nutrition data:\n${lines.join('\n')}`,
      tier: 'mini',
    });

    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'The AI returned an unexpected format. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Insight generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
