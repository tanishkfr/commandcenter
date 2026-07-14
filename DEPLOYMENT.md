# Vercel deployment

Remainder deploys as one Vite client plus an Express serverless entry point.

## 1. Import the repository

Import `tanishkfr/commandcenter` into Vercel. Keep the repository root as the project root and use the existing build configuration.

## 2. Connect private storage

In the Vercel project, open **Storage** and create or connect a **Private Vercel Blob** store. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically. Do not paste a Blob URL as this value.

## 3. Use Vercel AI Gateway

Production does not need a copied provider secret. Vercel injects `VERCEL_OIDC_TOKEN` automatically, and Remainder uses that deployment identity to call AI Gateway.

Optional Production variables:

- `AI_MODEL` — defaults to `google/gemini-2.5-flash-lite`.
- `AI_TIMEOUT_MS` — defaults to `12000`; accepted range is 3000–25000.

For local development outside Vercel only, use `AI_GATEWAY_API_KEY` in `.env`.

AI Gateway requires available credits for the Vercel team that owns the deployment. Review usage at `https://vercel.com/ai-gateway` if the live check reports a budget or credit error.

## 4. Redeploy

Storage and environment changes apply only to new deployments. Redeploy the latest Production commit after connecting Blob or changing the model.

## 5. Verify

Open:

```text
https://YOUR-DOMAIN/api/health
```

It should return JSON containing:

```json
{"ok":true,"runtime":"vercel","storage":"vercel-blob"}
```

Then open the app, go to **Settings → Connection health**, and choose **Run check**. This performs a real Blob write and a live AI Gateway request.

If AI is unavailable, the composer remains functional with prompt-specific offline guidance. Open **Help → AI** for the exact message-specific recovery path.

## Privacy boundary

This is a personal build without authentication. Treat the deployment URL as private. Do not use it as a multi-user public service until authentication and per-user authorization are added.
