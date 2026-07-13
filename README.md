# Remainder

A personal, local-first workspace where conversations become durable project memory.

**The conversation is the interface. The project is the memory. Judgment decides what remains.**

## Product loop

1. Open a project and continue a conversation.
2. Keep from the session when something changes the work.
3. Review every candidate before it enters project context.
4. Keep new context alongside earlier memory, or explicitly mark a changed direction.
5. Recover the reasoning through Memory, History, Search, export, or MCP.
6. Undo review and deletion decisions without erasing provenance.

Remainder has no account system in this personal build. It works without an AI key through a deterministic local collaborator and extractor. NVIDIA NIM adds richer synthesis when configured.

## Complete workflows

- Persistent projects, conversations, sources, import, export, and reset
- Local or NVIDIA NIM conversation and extraction
- Human-reviewed memory with message-level provenance
- Explicit supersession with retained lineage and undo
- Grouped search across projects, memory, conversations, history, and sources
- Living context rail and chronological history
- Protected MCP access
- Atomic local storage and private Vercel Blob persistence
- Keyboard navigation, focus states, reduced motion, and recovery states

## Run locally on Windows

~~~powershell
npm install
Copy-Item .env.example .env
npm run dev
~~~

Open http://localhost:3000. The environment file is optional.

## Optional NVIDIA NIM

~~~env
NVIDIA_API_KEY=your_key
NVIDIA_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
~~~

If NIM is unavailable, Remainder falls back locally without losing the user message.

## Data and deployment

Local memory is written atomically to .memory/studio.json. Set REMAINDER_DATA_DIR to isolate development or smoke-test data. Hosted deployments use private Vercel Blob storage; see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Verification

~~~powershell
npm run lint
npm test
npm run build
~~~

See [QUALITY.md](./QUALITY.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [CASE_STUDY.md](./CASE_STUDY.md), [RESEARCH_PROTOCOL.md](./RESEARCH_PROTOCOL.md), and [PORTFOLIO_STORYBOARD.md](./PORTFOLIO_STORYBOARD.md).
