# Remainder API

The active first-party API is mounted at **/api/studio**. The protected MCP endpoint is **/api/mcp**.

## Health and bootstrap

- GET /api/health
- GET /api/studio/bootstrap?projectId=…

## Connections and reset

- GET /api/studio/settings/connections
- POST /api/studio/settings/ai
- DELETE /api/studio/settings/ai
- POST /api/studio/settings/mcp
- POST /api/studio/settings/reset
- POST /api/studio/settings/diagnostics

Secrets are never returned after storage. Local reset can preserve or remove credentials. Hosted reset cannot mutate Vercel environment variables. Diagnostics checks storage and configuration; `{"testAI":true}` adds a live NIM request.

## Projects and conversations

- POST /api/studio/projects
- PATCH /api/studio/projects/:id
- DELETE /api/studio/projects/:id
- POST /api/studio/projects/restore
- POST /api/studio/sessions
- GET /api/studio/sessions/:id
- POST /api/studio/sessions/:id/messages
- POST /api/studio/sessions/:id/capture
- POST /api/studio/import

Project selection is browser-local and read-only; navigation never rewrites shared Blob memory. A message endpoint first generates the response, then persists the user and assistant messages as one atomic exchange. Capture creates pending candidates. Pending memory is excluded from model context.

## Memory lifecycle

- PATCH /api/studio/artifacts/:id
- POST /api/studio/artifacts/:id/review
- DELETE /api/studio/artifacts/:id
- POST /api/studio/artifacts/restore

Review body:

~~~json
{"action":"accept","supersedeIds":["memory_earlier"]}
~~~

Valid actions are accept, reject, and pending. Supersede IDs are optional and constrained to accepted, related memory in the same project. Accepting without IDs keeps the new memory alongside current context. Undo restores the prior review state and lineage.

## Sources, search, and export

- POST /api/studio/sources
- GET /api/studio/search?q=…&projectId=…
- GET /api/studio/export

## MCP

POST /api/mcp accepts stateless MCP requests with a bearer token:

~~~http
Authorization: Bearer YOUR_API_KEY
~~~

The reviewMemoryArtifact tool exposes the same optional supersedeIds semantics as the interface. Errors return JSON and the first-party interface never assumes a mutation succeeded.
