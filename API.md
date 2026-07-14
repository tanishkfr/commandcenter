# Remainder API

The first-party API is mounted at **/api/studio**. All responses are JSON unless the export route is downloading a file.

## Health and state

- `GET /api/health`
- `GET /api/studio/bootstrap?projectId=...`
- `GET /api/studio/settings/connections`
- `POST /api/studio/settings/diagnostics` with optional `{"testAI":true}`
- `POST /api/studio/settings/reset`
- `GET /api/studio/export`

Diagnostics verifies storage configuration. With `testAI`, it performs a real AI Gateway request when authentication is available. Reset clears project memory and preserves deployment infrastructure.

## Projects

- `POST /api/studio/projects`
- `PATCH /api/studio/projects/:id`
- `DELETE /api/studio/projects/:id`
- `POST /api/studio/projects/restore`

Deleting a project returns a snapshot that can be restored by the browser's Undo action. A workspace always retains at least one project.

## Conversations

- `POST /api/studio/sessions`
- `GET /api/studio/sessions/:id`
- `POST /api/studio/sessions/:id/messages`
- `POST /api/studio/sessions/:id/capture`
- `POST /api/studio/import`

A message exchange is stored atomically after the response is ready. The response includes `mode: "ai" | "local"`; local mode may include `fallbackReason` for calm, actionable recovery.

## Memory

- `PATCH /api/studio/artifacts/:id`
- `POST /api/studio/artifacts/:id/review`
- `DELETE /api/studio/artifacts/:id`
- `POST /api/studio/artifacts/restore`

Review accepts `accept`, `reject`, or `pending`. Accepted memory may include `supersedeIds`; earlier direction stays in history.

## Sources and search

- `POST /api/studio/sources`
- `GET /api/studio/search?q=...&projectId=...`

Search returns grouped browser-ready results across projects, conversations, memory, sources, and history.

## Concurrency

Private Vercel Blob writes use ETags. A stale write returns a calm retry message instead of overwriting newer project memory.

## Security boundary

The personal build has no account layer. Keep the deployment private. Production AI credentials remain server-side and are never returned by the API or included in exports.
