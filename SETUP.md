# NutriCoach — Setup & Deployment Guide

NutriCoach is an AI-powered, offline-first nutrition and fitness coach built with
Next.js 15 (App Router), TypeScript, Tailwind CSS, Dexie.js (IndexedDB) and Recharts.
Food analysis runs through a swappable AI provider (Google Gemini 1.5 Flash by default,
or OpenAI GPT-4o). Cloud sync via Supabase is optional — by default **all data stays on
the user's device**.

---

## 1. Prerequisites

- Node.js 20+ and npm
- A Google Gemini API key (free tier: https://aistudio.google.com/apikey)
  *or* an OpenAI API key (https://platform.openai.com/api-keys)
- Optional: a Supabase project (https://supabase.com) for cloud sync
- Optional: GitHub + Vercel accounts for deployment

## 2. Local development

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env.local
```

Edit `.env.local`:

```bash
AI_PROVIDER=gemini          # or "openai"
GEMINI_API_KEY=your-key     # required when AI_PROVIDER=gemini
OPENAI_API_KEY=             # required when AI_PROVIDER=openai
```

Then:

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to the onboarding wizard.

### Switching AI providers

Set `AI_PROVIDER=openai` (and `OPENAI_API_KEY`) — no code changes needed.

| Provider | Food analysis (vision) | Insights |
|---|---|---|
| `gemini` (default) | gemini-3.5-flash | gemini-3.1-flash-lite |
| `openai` | gpt-4o | gpt-4o-mini |

Gemini calls retry 503/429 responses with exponential backoff (1s/2s/4s), then
fall back to `gemini-3.1-flash-lite` for one attempt before surfacing a
friendly "AI is busy" message. To pin different models, set
`GEMINI_MODEL`/`GEMINI_MODEL_MINI`/`GEMINI_MODEL_FALLBACK` (or
`OPENAI_MODEL`/`OPENAI_MODEL_MINI`) in your environment.

## 3. Optional: Supabase cloud sync

1. Create a project at https://supabase.com.
2. Open **SQL Editor → New query**, paste the contents of `supabase_schema.sql`
   and run it. This creates the mirrored tables with Row Level Security and
   `updated_at` triggers, plus the private `meal-photos` storage bucket where
   meal photos are kept (database rows only store their paths). If you ran an
   older version of the schema, just re-run the file — it is idempotent.
3. **Authentication → Providers**: email/password is on by default. To enable
   Google sign-in, add your Google OAuth client ID/secret (from Google Cloud
   Console) and register the redirect URI Supabase shows you.
4. **Project Settings → API**: copy the URL and anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # keep secret; server-side use only
```

5. Restart the dev server. A **Cloud sync** card appears in Settings where users
   can sign in and push their local data.

## 4. Deploy to Vercel

### One-time setup

1. Push this repo to GitHub:

```bash
git init
git add .
git commit -m "Initial NutriCoach build"
git branch -M main
git remote add origin https://github.com/<you>/nutricoach.git
git push -u origin main
```

2. In Vercel, **Add New → Project**, import the repo, and add the environment
   variables from step 2 (and step 3 if using Supabase) under
   **Settings → Environment Variables**.

That alone gives you Vercel's built-in git deployments. For the GitHub Actions
pipeline in `.github/workflows/deploy.yml` (typecheck + build gate before
production deploys), continue below.

### GitHub Actions CI/CD

1. Get your Vercel credentials:
   - `VERCEL_TOKEN`: https://vercel.com/account/tokens
   - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`: run `npx vercel link` in the repo,
     then read both IDs from `.vercel/project.json`.
2. In GitHub: **Repo → Settings → Secrets and variables → Actions** and add all
   three as repository secrets.
3. Push to `main`. The workflow typechecks and builds every push/PR, and deploys
   to production on `main`.

> If you use the Actions pipeline, disable Vercel's automatic git deployments
> (Vercel → Project → Settings → Git) to avoid double deploys.

## 5. Project structure

```
src/
  app/                  Pages (App Router) + API routes
    api/analyse-food    POST — AI food/photo analysis (Zod-validated)
    api/generate-insight POST — AI trend insights
  lib/
    types.ts            All interfaces + nutrient metadata
    db.ts               Dexie.js database + helpers
    nutrition.ts        BMR/TDEE/macros/micro RDAs, gap analysis, food recs
    workout.ts          Nutrition-driven workout plan generator
    ai.ts               Provider abstraction (Gemini/OpenAI)
    supabase.ts         Optional cloud sync client
  data/exercises.ts     Exercise database (16 exercises, age modifications)
  components/           Navigation, ExerciseSVG, Rings, ProfileFields
  hooks/                useProfile, useFoodLogs
supabase_schema.sql     Cloud sync schema (RLS + triggers)
.github/workflows/      CI/CD pipeline
```

## 6. Useful commands

```bash
npm run dev         # dev server
npm run build       # production build
npm run start       # serve production build
npm run typecheck   # TypeScript check (also run in CI)
```

## Notes

- **Privacy**: food logs, profile and history live in the browser's IndexedDB.
  Photos are sent to the AI provider for analysis but are never stored.
- **Not medical advice**: targets use the Mifflin–St Jeor equation, WHO/NIH
  reference intakes and common heuristics; consult a professional for medical
  conditions.
