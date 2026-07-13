# Remainder architecture

## Boundary

Remainder is one React application, one Express API, and one creative-memory domain store. Local, production, and Vercel runtimes expose the same domain behavior. The removed Command Center dashboard, command parser, workspace fixtures, and file-per-project layer are not part of the active runtime.

## Product flow

~~~text
Conversation
  → capture candidates
  → human review
      → dismiss
      → keep alongside
      → change direction
  → active project context
  → conversation, memory, search, history, context rail, export, MCP
~~~

## Memory schema, version 3

Every artifact contains review status, origin, confidence, source message IDs, related IDs, supersedesArtifactIds, and supersededByArtifactId. Only accepted, active memory enters AI context.

## Invariants

1. Capture never enters context without review.
2. Supersession is explicit; accepting without IDs keeps both memories active.
3. Only accepted related memory in the same project can be superseded.
4. Superseded memory is resolved, never deleted.
5. Undo, successor deletion, or review release restores earlier direction.
6. Every mutation writes history.
7. Local writes are atomic; Blob writes use conditional replacement and retry.
8. Export contains the complete portable state.
9. AI failure falls back locally before a conversation is lost.
10. The project—not the model—is the durable object.

## Storage and trust

Local mode writes .memory/studio.json. REMAINDER_DATA_DIR isolates verification data. Vercel uses a private Blob object and ETags. Credentials remain in environment configuration and are excluded from export. MCP mutations require bearer authentication. The browser API assumes a private personal deployment; public multi-user hosting requires authentication and authorization first.
