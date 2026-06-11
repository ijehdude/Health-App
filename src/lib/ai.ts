import { z } from 'zod';
import { NUTRIENT_KEYS, type Nutrition } from './types';

// ---------------------------------------------------------------------------
// Provider abstraction: switch with AI_PROVIDER=gemini|openai (no code changes)
// ---------------------------------------------------------------------------

type Provider = 'gemini' | 'openai';

/** 'full' = vision-capable analysis model, 'mini' = cheap text model. */
type ModelTier = 'full' | 'mini';

const MODELS: Record<Provider, Record<ModelTier, string>> = {
  // Override per-tier with env vars if needed.
  gemini: {
    full: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
    mini: process.env.GEMINI_MODEL_MINI ?? 'gemini-3.1-flash-lite',
  },
  openai: {
    full: process.env.OPENAI_MODEL ?? 'gpt-4o',
    mini: process.env.OPENAI_MODEL_MINI ?? 'gpt-4o-mini',
  },
};

/** Tried once when the primary Gemini model is overloaded or unavailable. */
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_MODEL_FALLBACK ?? 'gemini-3.1-flash-lite';

const BUSY_MESSAGE = 'Our AI is busy right now — please try again in a minute.';

/** Backoff before each retry; only 503 (overloaded) and 429 (rate limit) retry. */
const RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * Hard cap per Gemini request — overloaded models sometimes accept a request
 * and never respond. Treated as a 504, which skips retries but still allows
 * one fallback attempt, keeping the route inside Vercel's 60s budget.
 */
const PER_CALL_TIMEOUT_MS = 25_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 503 || status === 429;

class GeminiHttpError extends Error {
  constructor(
    public status: number,
    public body: string,
    public model: string
  ) {
    super(`Gemini API error (${status}) from ${model}: ${body.slice(0, 300)}`);
    this.name = 'GeminiHttpError';
  }
}

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
  const primary = MODELS.gemini[req.tier];

  try {
    return await callGeminiWithRetry(req, primary);
  } catch (err) {
    if (!(err instanceof GeminiHttpError)) throw err;

    // Fall back when the primary is overloaded/rate-limited (retries exhausted),
    // timed out (504), or the model id is unknown to this API key (404).
    const shouldFallback =
      (isRetryableStatus(err.status) || err.status === 404 || err.status === 504) &&
      primary !== GEMINI_FALLBACK_MODEL;
    if (!shouldFallback) {
      console.error('[ai] Gemini request failed:', err.message);
      throw isRetryableStatus(err.status) || err.status === 504 ? new Error(BUSY_MESSAGE) : err;
    }

    console.error(
      `[ai] ${primary} failed with ${err.status}; falling back to ${GEMINI_FALLBACK_MODEL}.`,
      err.body
    );
    try {
      return await callGeminiModel(req, GEMINI_FALLBACK_MODEL);
    } catch (fallbackErr) {
      console.error('[ai] Fallback model also failed:', fallbackErr);
      throw new Error(BUSY_MESSAGE);
    }
  }
}

/** Calls one model, retrying 503/429 with exponential backoff (1s, 2s, 4s). */
async function callGeminiWithRetry(req: AIRequest, model: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callGeminiModel(req, model);
    } catch (err) {
      const retryable =
        err instanceof GeminiHttpError &&
        isRetryableStatus(err.status) &&
        attempt < RETRY_DELAYS_MS.length;
      if (!retryable) throw err;
      const delay = RETRY_DELAYS_MS[attempt];
      console.error(
        `[ai] ${model} returned ${(err as GeminiHttpError).status}; ` +
          `retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${delay}ms.`
      );
      await sleep(delay);
    }
  }
}

async function callGeminiModel(req: AIRequest, model: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).');

  const parts: unknown[] = [{ text: `${req.system}\n\n${req.text}` }];
  if (req.imageB64) {
    parts.push({
      inline_data: { mime_type: req.mimeType ?? 'image/jpeg', data: req.imageB64 },
    });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
      }
    );
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new GeminiHttpError(504, `No response within ${PER_CALL_TIMEOUT_MS}ms`, model);
    }
    throw err;
  }

  if (!res.ok) {
    throw new GeminiHttpError(res.status, await res.text(), model);
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
