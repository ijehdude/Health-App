import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGenerateJson, confidenceSchema, nutritionSchema } from '@/lib/ai';
import { NUTRIENT_KEYS, NUTRIENT_META, addNutrition, emptyNutrition } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  text: z.string().trim().min(1).optional(),
  imageB64: z.string().min(1).optional(),
  mimeType: z.string().optional(),
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

export async function POST(req: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.text && !body.imageB64) {
    return NextResponse.json(
      { error: 'Provide either a text description or an image.' },
      { status: 400 }
    );
  }

  try {
    const raw = await aiGenerateJson({
      system: SYSTEM_PROMPT,
      text: body.text
        ? `Analyse this meal description: "${body.text}"`
        : 'Analyse the food and drink shown in this image.',
      imageB64: body.imageB64,
      mimeType: body.mimeType,
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
