import { z } from 'zod';
import { NUTRIENT_KEYS, type Nutrition } from './types';

// ---------------------------------------------------------------------------
// Provider abstraction: switch with AI_PROVIDER=gemini|openai (no code changes)
// ---------------------------------------------------------------------------

type Provider = 'gemini' | 'openai';

/** 'full' = vision-capable analysis model, 'mini' = cheap text model. */
type ModelTier = 'full' | 'mini';

const MODELS: Record<Provider, Record<ModelTier, string>> = {
  // gemini-1.5-flash was retired for new API keys; 2.5-flash is the current
  // free-tier flash model. Override per-tier with env vars if needed.
  gemini: {
    full: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    mini: process.env.GEMINI_MODEL_MINI ?? 'gemini-2.5-flash-lite',
  },
  openai: {
    full: process.env.OPENAI_MODEL ?? 'gpt-4o',
    mini: process.env.OPENAI_MODEL_MINI ?? 'gpt-4o-mini',
  },
};

export function getProvider(): Provider {
  return process.env.AI_PROVIDER === 'openai' ? 'openai' : 'gemini';
}

export interface AIRequest {
  system: string;
  text: string;
  imageB64?: string;
  mimeType?: string;
  tier: ModelTier;
}

/** Sends a JSON-mode request to the configured provider and parses the reply. */
export async function aiGenerateJson(req: AIRequest): Promise<unknown> {
  const provider = getProvider();
  const raw =
    provider === 'openai' ? await callOpenAI(req) : await callGemini(req);
  return parseJsonReply(raw);
}

async function callGemini(req: AIRequest): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).');

  const model = MODELS.gemini[req.tier];
  const parts: unknown[] = [{ text: `${req.system}\n\n${req.text}` }];
  if (req.imageB64) {
    parts.push({
      inline_data: { mime_type: req.mimeType ?? 'image/jpeg', data: req.imageB64 },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

async function callOpenAI(req: AIRequest): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set. Add it to .env.local (see .env.example).');

  const content: unknown[] = [{ type: 'text', text: req.text }];
  if (req.imageB64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${req.mimeType ?? 'image/jpeg'};base64,${req.imageB64}` },
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODELS.openai[req.tier],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response.');
  return text;
}

function parseJsonReply(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI response was not valid JSON.');
  }
}

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

/** Coerces anything numeric-ish to a finite non-negative number, else 0. */
const num = z.preprocess((v) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}, z.number());

export const nutritionSchema = z.object(
  Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num]))
) as unknown as z.ZodType<Nutrition>;

export const confidenceSchema = z.enum(['high', 'medium', 'low']).catch('medium');
