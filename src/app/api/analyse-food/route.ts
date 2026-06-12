import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGenerateJson, confidenceSchema, nutritionSchema } from '@/lib/ai';
import { validateSession } from '@/lib/serverAuth';
import { NUTRIENT_KEYS, NUTRIENT_META, addNutrition, emptyNutrition } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGES = 5;

const requestSchema = z.object({
  text: z.string().trim().min(1).optional(),
  /** Up to MAX_IMAGES photos of the same meal, analysed in one request. */
  images: z
    .array(z.object({ b64: z.string().min(1), mimeType: z.string().optional() }))
    .max(MAX_IMAGES)
    .optional(),
  // Legacy single-image fields, still accepted.
  imageB64: z.string().min(1).optional(),
  mimeType: z.string().optional(),
  /** The analysis being corrected (echoed back to the model as context). */
  previousAnalysis: z.unknown().optional(),
  /** User's correction, e.g. "you missed the fries, and the coke was diet". */
  correction: z.string().trim().min(1).optional(),
});

const responseSchema = z.object({
  foodItems: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string().catch(''),
        confidence: confidenceSchema,
        nutrition: nutritionSchema,
      })
    )
    .min(1),
  totalNutrition: nutritionSchema,
  confidence: confidenceSchema,
  warningMessage: z.string().nullish(),
});

const nutrientList = NUTRIENT_KEYS.map((k) => `"${k}" (${NUTRIENT_META[k].unit})`).join(', ');

const SYSTEM_PROMPT = `You are a registered dietitian and food-recognition expert.
Identify every food and drink item described or shown, estimate realistic portion sizes, and provide a complete nutritional analysis.

Respond with ONLY a valid JSON object — no markdown, no commentary — in exactly this shape:
{
  "foodItems": [
    {
      "name": "string — specific food name",
      "quantity": "string — estimated portion, e.g. '2 large eggs' or '150 g'",
      "confidence": "high" | "medium" | "low",
      "nutrition": { <all nutrient keys below, numeric values for THIS item's portion> }
    }
  ],
  "totalNutrition": { <all nutrient keys below, numeric sum across every item> },
  "confidence": "high" | "medium" | "low",
  "warningMessage": "string — include ONLY if portions or items are uncertain; otherwise omit"
}

Every nutrition object MUST contain all of these keys with numeric values (use 0 if negligible, never null):
${nutrientList}

Rules:
- Estimate using standard food-composition data (USDA-style values).
- "confidence" per item: "high" when the item and portion are clear, "medium" when the item is clear but the portion is estimated, "low" when the item itself is uncertain.
- Overall "confidence" is the lowest item confidence.
- Add "warningMessage" whenever portions are guessed, items are partially hidden, or the description is ambiguous.
- If the input contains no identifiable food or drink, return {"error": "no food identified"}.`;

function buildUserText(body: z.infer<typeof requestSchema>, imageCount: number): string {
  const lines: string[] = [];

  if (imageCount > 1) {
    lines.push(
      `These ${imageCount} images all show the SAME meal — they may be separate dishes, sides or drinks, or the same plate from different angles.`,
      'Analyse the meal as a whole across all images: include each distinct food or drink exactly once, and do NOT double-count anything that appears in more than one photo.'
    );
  } else if (imageCount === 1) {
    lines.push('Analyse the food and drink shown in this image.');
  }

  if (imageCount > 0 && body.text) {
    lines.push(
      `The user added context that refines or overrides what is visible — trust it over your visual estimate: "${body.text}"`
    );
  } else if (imageCount === 0) {
    lines.push(`Analyse this meal description: "${body.text}"`);
  }

  if (body.correction) {
    lines.push(
      `A previous analysis of this exact meal was: ${JSON.stringify(body.previousAnalysis ?? {})}`,
      `The user says that analysis missed or got something wrong: "${body.correction}"`,
      'Produce a complete REVISED analysis in the same JSON schema: add missing items, remove wrong ones, adjust portions as the user describes, and re-estimate all nutrition from scratch. The user’s correction outranks both the image and the previous analysis.'
    );
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
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Normalize legacy single-image fields into the images array.
  const images =
    body.images ?? (body.imageB64 ? [{ b64: body.imageB64, mimeType: body.mimeType }] : []);

  if (!body.text && images.length === 0) {
    return NextResponse.json(
      { error: 'Provide either a text description or at least one image.' },
      { status: 400 }
    );
  }

  try {
    const raw = await aiGenerateJson({
      system: SYSTEM_PROMPT,
      text: buildUserText(body, images.length),
      images,
      tier: 'full',
    });

    if (raw && typeof raw === 'object' && 'error' in raw && !('foodItems' in raw)) {
      return NextResponse.json(
        { error: 'No food or drink could be identified in your input.' },
        { status: 422 }
      );
    }

    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'The AI returned an unexpected format. Please try again.' },
        { status: 502 }
      );
    }

    const result = parsed.data;
    // Guard against models that forget to sum: rebuild totals from items.
    const summed = result.foodItems.reduce(
      (acc, item) => addNutrition(acc, item.nutrition),
      emptyNutrition()
    );
    if (result.totalNutrition.calories === 0 && summed.calories > 0) {
      result.totalNutrition = summed;
    }

    return NextResponse.json({
      foodItems: result.foodItems,
      totalNutrition: result.totalNutrition,
      confidence: result.confidence,
      warningMessage: result.warningMessage ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Food analysis failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
