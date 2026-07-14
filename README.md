# Remainder

Remainder is a personal project-memory workspace where conversations become durable creative context. It keeps the decisions, questions, experiments, risks, and unfinished threads that explain how a project became itself.

> **Status: Alpha testing.** Core workflows are usable, but integrations and edge cases are still being refined. Export important work regularly and expect occasional rough edges.

## The working loop

1. Create or open a project.
2. Think through a design problem in conversation.
3. Keep the session when something should endure.
4. Review the extracted memory before it joins project context.
5. Recover the reasoning through Memory, History, Search, or export.

There is no account system in this personal build. The core workflow remains usable without hosted AI: prompt-specific offline guidance responds to the actual subject and local extraction keeps explicit decisions and questions. Vercel AI Gateway adds richer project-aware synthesis when connected.

## Included

- Editable projects and conversations
- Project-aware AI Gateway conversation
- Prompt-specific offline guidance
- Reviewable memory capture with provenance
- Grouped search across projects, conversations, memory, sources, and history
- Reversible project and memory deletion
- Workspace export and complete reset
- Local file storage or Private Vercel Blob
- In-product connection diagnostics and recovery instructions

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

Local project data is written to `.memory/studio.json`. To isolate test or demo data, set `REMAINDER_DATA_DIR` to another local directory.

## Optional hosted AI in local development

Create an AI Gateway key in Vercel and add it to a local `.env` file:

```text
AI_GATEWAY_API_KEY=your_key
AI_MODEL=google/gemini-2.5-flash-lite
```

Restart the server after changing `.env`. Never expose this key through a `VITE_` variable.

On Vercel, do not create or copy `VERCEL_OIDC_TOKEN`; Vercel injects it automatically for the deployment.

## Verify

```powershell
npm test
npm run lint
npm run build
```

In the product, open **Settings → Connection health** and run the full check. It verifies a real storage write and, when configured, a live AI Gateway response.

## Reset and recovery

**Begin again** removes every project, conversation, memory, source, and history event, then creates one blank project and restarts onboarding. Storage and AI deployment settings are deliberately preserved because they are infrastructure, not project memory.

Before resetting, use **Export workspace backup** if anything may be useful later.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosted setup and [API.md](./API.md) for the first-party API.
