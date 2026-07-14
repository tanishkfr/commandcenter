# Release quality gate

A release is ready only when all of the following are true:

- `npm test` passes, including AI Gateway contract, prompt-specific offline replies, extraction, Blob concurrency, interaction integrity, migration, supersession, and undo.
- `npm run lint` passes with no TypeScript errors.
- `npm run build` produces the client and server bundles.
- An isolated API smoke test covers clean bootstrap, distinct offline conversation responses, capture, search, project create/rename/delete/restore, reset, export, diagnostics, and storage recovery.
- A production deployment returns JSON from `/api/health` and passes the in-product full connection check.
- Every visible control has a working action, accessible label, keyboard path, and recoverable error state.
- Search, project switching, reset, conversation, capture, memory review, undo, and export reach a complete conclusion.

A broken primary workflow, silent data loss, inaccessible control, fake functionality, failed build, unverified migration, or a fallback presented as hosted AI blocks release.
