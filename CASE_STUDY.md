# Remainder — case study

## Provisional problem

Creative work increasingly happens through conversations, but the reasoning that changes the work stays trapped in transcripts. A transcript preserves sequence, not judgment. A generic knowledge base preserves fragments, not how direction changed.

Remainder tests a sharper proposition: **a project should remember the reviewed consequences of conversation, with enough provenance to challenge or reverse them later.**

This is a working product and systems-design investigation. It is not yet proof that the proposition improves creative outcomes.

## Design evolution

The first implementation was a Command Center of projects, metrics, inboxes, and dashboard cards. It made activity visible but did not solve continuity. The redesign removed that runtime and made conversation the primary surface.

Three rejected approaches shaped the system:

1. **Keep every summary automatically.** Rejected because model confidence is not consent.
2. **Overwrite conflicting memory.** Rejected because it destroys the evidence needed to understand change.
3. **Make AI the product persona.** Rejected because the project must remain durable when providers change.

The resulting loop is conversation → candidate memory → human judgment → active context → traceable history.

## Signature interaction

Capture stages a handoff, not a celebration. Candidates stay pending until dismissed, kept alongside current context, or used to explicitly change direction. Changed direction resolves earlier memory but retains it as lineage. Undo restores both review state and earlier context.

Motion follows reveal, carry, and settle. The candidate moves toward memory only after judgment; reduced-motion mode preserves the state without travel.

## Systems contribution

The domain model separates confidence from consent, active context from retained history, relatedness from supersession, deletion from reversible removal, and model availability from product availability. The same semantics hold across UI, REST, storage, search, export, and MCP.

## Demonstrated

- The product works with or without an external AI provider.
- Pending and resolved memory cannot silently steer a response.
- Supersession is explicit, constrained, retained, and reversible.
- Search spans the durable system.
- Message-level provenance is preserved.
- Obsolete prototype architecture was removed without workflow regression.
- Type checks, tests, build, and isolated smoke tests verify implementation.

## Still a hypothesis

- Reviewed memory reduces time spent re-establishing context.
- People understand “keep alongside” versus “change direction.”
- Provenance increases willingness to trust and correct AI memory.
- Editorial tone feels calm rather than precious.
- One JSON object remains appropriate beyond personal scale.

No participant quote, outcome metric, or usability claim should be added until RESEARCH_PROTOCOL.md is completed.

## Portfolio role

Remainder is strongest as a **Tool + System** project. The interaction is the visible entry point; the deeper contribution is a trust model for durable AI-mediated creative memory. The next admissions-level leap is external evidence, not another feature.
