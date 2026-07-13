# Release quality gate

## Automated gates

- TypeScript has no diagnostics.
- Every test passes, including fallback AI, extraction, Blob concurrency, MCP, interaction integrity, migration, supersession, and undo.
- Client and server production bundles complete.
- An isolated production API smoke test covers clean bootstrap, atomic conversation, local fallback, capture, search, project create/open/rename/delete/restore, reset, export, diagnostics, MCP authentication, and MCP initialization.
- The repository contains no stale runtime, scratch script, secret, placeholder control, mojibake, conflict marker, or unintended lockfile.

## Manual interface gate

Test desktop and narrow mobile widths. Every visible control must complete a workflow. Verify keyboard order, focus visibility, dialog trapping and return, Escape, grouped search states, project switching and CRUD, retained message drafts, reset confirmation, the three capture choices, lineage and undo, connection troubleshooting, educational empty states, calm errors, reduced motion, and stable loading geometry.

A broken primary workflow, silent data loss, inaccessible control, unprotected MCP mutation, fake functionality, failed build, or unverified migration blocks release.

Automated correctness is not evidence of desirability. Research findings may only be claimed after the protocol in RESEARCH_PROTOCOL.md is completed.
