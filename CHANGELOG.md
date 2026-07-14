# Changelog

## Unreleased

- Replaced the brittle provider-specific AI connection with Vercel AI Gateway and deployment identity authentication.
- Made offline guidance prompt-specific, context-aware, and visibly distinct from hosted AI.
- Reduced the hosted response timeout and added actionable error categories for identity, credits, model, and availability failures.
- Removed the unfinished external-tool integration from onboarding, Help, server routes, dependencies, and documentation.
- Simplified reset so it always clears project memory while preserving deployment infrastructure.
- Updated connection health, onboarding, About, and memory provenance copy to match the real operating mode.
- Added regression tests proving unrelated prompts cannot receive the same offline response.

## 1.0 production hardening

- Repaired project reset, editing, deletion, restoration, search, capture, and connection diagnostics.
- Made conversations atomic and retained failed drafts.
- Added private Vercel Blob concurrency protection and recovery guidance.
- Completed keyboard, focus, empty-state, motion, typography, and visible-interaction audits.
- Added the Remainder identity, editorial voice, grouped search, living context, and reversible memory review.
