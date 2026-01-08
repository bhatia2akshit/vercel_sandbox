This is a demo “vibe coding platform”: a Next.js web app where a user chats with an agent that can (1) call models via Vercel AI Gateway and (2) create/run code inside an E2B sandbox.

## What You’re Deploying

- **Web app**: Next.js (App Router) UI + API routes (chat, sandbox file reads, model list, etc.)
- **Models**: Vercel AI Gateway via `@ai-sdk/gateway`
- **Sandbox execution**: E2B sandboxes via `e2b` SDK
- **(Optional) Background jobs**: Trigger.dev task definitions live in `trigger/` + `trigger.config.ts`

## Prerequisites

- Node.js `22.x` (see `package.json#engines`)
- A package manager (recommended: `pnpm` via `corepack`)
- Accounts/keys:
  - **Vercel AI Gateway** (API key or Vercel OIDC token)
  - **E2B** (API key + optional template)
  - **Trigger.dev** (optional; project ref + secret key)

## Local Development

1. Install dependencies:

```bash
corepack enable
pnpm install
```

2. Create `.env.local`:

```bash
cp env.example .env.local
```

3. Fill in environment variables in `.env.local`:

- `AI_GATEWAY_API_KEY` (recommended for local)
- `E2B_API_KEY`
- Trigger.dev vars

4. Run the dev server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Deploying to Vercel (Web App)

### 1) Create the Vercel project

If you imported the whole `vercel/examples` repo, set the **Root Directory** to `apps/vibe-coding-platform`.

### 2) Configure environment variables

Set these in Vercel Project Settings → Environment Variables:

- `AI_GATEWAY_API_KEY` (recommended; simplest auth path)
  - Alternative: rely on Vercel OIDC auth (no API key). For local dev you’ll typically do `npx vercel link` and `npx vercel env pull`.
- `AI_GATEWAY_BASE_URL` (optional; the gateway SDK has a default)
- `E2B_API_KEY`
- `E2B_TEMPLATE` (optional; defaults to `base`)

Also make sure your Vercel AI Gateway project has at least one provider configured (and the models you want enabled), otherwise model discovery and chat will fail.

If you’re using Trigger.dev (next section), also set:

- `TRIGGER_PROJECT_REF`
- `TRIGGER_SECRET_KEY` (or `TRIGGER_DEV_API_KEY`)
- `TRIGGER_API_URL` (optional; defaults to Trigger.dev Cloud)

### 3) Deploy

Vercel will build and deploy the Next.js app normally.

Notes:

- Vercel should pick up the required Node version from `package.json#engines` (`22.x`).
- This project uses `pnpm` (see `pnpm-lock.yaml`).

## Deploying Trigger.dev (Optional)

This repo includes Trigger.dev v3 task definitions in `trigger/` (see `trigger/run-command.ts`). If you want background jobs, deploy these tasks to Trigger.dev and provide the Trigger credentials as env vars.

High-level steps:

1. Create a Trigger.dev project and copy:
   - `TRIGGER_PROJECT_REF` (looks like `proj_...`)
   - `TRIGGER_SECRET_KEY`
2. In your CI (or locally), run Trigger.dev deploy from this directory:

```bash
# Example (CLI command may vary by Trigger.dev version)
npx trigger.dev@latest deploy
```

Make sure the deploy environment has the same required env vars (at least `TRIGGER_*` and `E2B_API_KEY`).

## E2B Notes

- `E2B_API_KEY` is required for any sandbox operations.
- Use `E2B_TEMPLATE` to point at a custom template that has tooling you want preinstalled (Node, pnpm, etc.) to speed up sandbox startup. Docker-style values like `e2b/code-interpreter` are normalized to `code-interpreter`.

## Troubleshooting

- **401 / auth errors from AI Gateway**: set `AI_GATEWAY_API_KEY` (or link/pull envs so OIDC works).
- **“Missing required env var: E2B_API_KEY”**: set `E2B_API_KEY` in `.env.local` (local) and in Vercel env vars (prod).
- **Vercel project builds the wrong folder**: ensure Root Directory is `apps/vibe-coding-platform` when importing the whole repo.
