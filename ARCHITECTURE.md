# Architecture

```text
React + Vite client
  → /api/studio
Express server
  → creative memory store
      → local .memory/studio.json
      → or Private Vercel Blob with ETags
  → Vercel AI Gateway
      → hosted conversation and extraction
      → prompt-specific offline fallback
```

## Domain model

Projects contain conversations, sources, memory artifacts, and history events. Memory artifacts preserve provenance, confidence, review state, relatedness, and supersession. A captured item does not enter active context until the user accepts it.

The same model powers conversation context, Memory, History, Search, export, and the living context rail.

## Storage

Local development writes `.memory/studio.json`. `REMAINDER_DATA_DIR` can isolate verification data. Vercel uses one private Blob object and optimistic ETag writes. Reset replaces that state with one valid blank project.

## AI boundary

`creativeAI.ts` is the only hosted-model boundary. It calls the OpenAI-compatible Vercel AI Gateway endpoint using `VERCEL_OIDC_TOKEN` in production or `AI_GATEWAY_API_KEY` locally. Default model: `google/gemini-2.5-flash-lite`.

Provider failure does not break conversation. The offline path uses the actual prompt, inferred intent, matching memory, and project context to produce a distinct response, then exposes the recovery reason separately.

## Failure semantics

- Message writes are atomic after a response is available.
- Failed client requests retain the composer draft.
- Storage conflicts never silently overwrite newer state.
- Deleted projects and memory support Undo.
- Capture candidates require explicit review.
- Reset preserves deployment infrastructure and reports failure without claiming success.

## Security boundary

Credentials are environment-only and excluded from export. The browser API assumes a private personal deployment. Public multi-user hosting requires authentication and per-user authorization before release.
