# Creative Memory Studio

A personal, local-first workspace where conversations become durable project memory.

The conversation is the interface. The project is the memory. Studio is the librarian.

## What works

- Create and switch projects
- Start multiple persistent conversations per project
- Think with a context-aware AI collaborator
- Capture decisions, principles, questions, ideas, experiments, risks, actions, references, and abandoned directions
- Review and edit captured memory
- Resolve, archive, or delete memories
- Link Figma files, GitHub repositories, research, documents, and notes
- Import pasted ChatGPT, Claude, Gemini, or other conversations
- Search across conversations, memory, rationale, and sources
- Follow a chronological project history
- Export all personal data as JSON
- Work without an AI key through the built-in local collaborator and extractor

There is intentionally no account system. This build is designed for one person running it locally.

## Start the product

Install dependencies:

~~~bash
npm install
~~~

Optional: copy the environment template and add an NVIDIA API key for richer responses and extraction.

~~~bash
copy .env.example .env
~~~

Then run:

~~~bash
npm run dev
~~~

Open [http://localhost:3000](http://localhost:3000).

The development server watches both the interface and server code.

## First-run setup

The setup guide opens automatically the first time you run the product. You can replay it at any time with the question-mark button in the top bar or **Settings -> Replay setup guide**.

It walks through:

1. how conversations become durable project memory;
2. where personal data is stored;
3. testing and saving an optional NVIDIA NIM connection;
4. generating a protected MCP credential;
5. copying a complete MCP client configuration;
6. starting the first real conversation.

NVIDIA API keys and MCP credentials are saved only to the ignored local `.env` file. The full MCP token is shown when it is generated, so copy it into your client before leaving that setup step.

## AI configuration

Without configuration, Studio runs in local-intelligence mode. Conversations, capture, persistence, search, import, and editing all continue to work.

For NVIDIA NIM-backed thinking and extraction, create a .env file:

~~~env
NVIDIA_API_KEY=your_key
NVIDIA_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
~~~

If an AI request fails, Studio automatically falls back to local mode rather than losing the conversation.

## Your data

Personal data is written atomically to:

~~~
.memory/studio.json
~~~

The .memory directory is ignored by Git. Use Settings → Export all personal data to create a portable JSON backup.

The first run creates three starter projects. Everything you add after that is persisted across restarts.

## Core workflow

1. Open or create a project.
2. Start a conversation and think through the work.
3. Add relevant project sources.
4. Click Capture session.
5. Review the memories that were created.
6. Edit, resolve, archive, or remove them in Memory.
7. Use Search or History to recover what changed and why.

## Keyboard shortcuts

- Ctrl/Cmd + K — search project memory
- Shift + Ctrl/Cmd + S — capture the current session
- / — focus the conversation composer
- Escape — close the active overlay

## Verification

~~~bash
npm run lint
npm test
npm run build
~~~

## Architecture

- React 19, TypeScript, Vite, Motion, and Lucide for the application
- Express for the local API
- Atomic JSON persistence for a zero-setup personal installation
- Optional NVIDIA NIM integration
- Local heuristic collaborator and extraction fallback
- Server-sent events, MCP, command gateway, undo, and the existing project API remain available

The local persistence layer is intentionally replaceable. A hosted multi-user version can move the same domain model to PostgreSQL, object storage, and background jobs without changing the product loop.
