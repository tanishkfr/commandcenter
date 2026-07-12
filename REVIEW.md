# Command Center Engineering Review

## Executive Summary
This review evaluates the Command Center application from the perspective of a senior software architect. The application serves as an AI-native headless tool and a React-based UI workspace. While the current implementation works, the reliance on synchronous file I/O, rigid natural language parsing, and naive event streams present severe risks for scalability, reliability, and security in a production environment.

## Critical Issues

### 1. Data Corruption & Synchronous I/O Blocking (Performance & Reliability)
- **Problem:** `server.ts` and `aiGateway.ts` use `fs.readFileSync` and `fs.writeFileSync` for all database operations. 
- **Impact:** Since Node is single-threaded, synchronous I/O blocks the entire event loop. Concurrent requests will cause the application to stall. If scaled horizontally across multiple containers (e.g., Cloud Run), lack of distributed locking or a central database will lead to immediate data corruption and lost writes.
- **Solution:** Migrate data access to an asynchronous Data Access Layer (DAL). Use `fs.promises` with a Mutex (lock) for local file safety, and cache the workspace structure in memory to avoid reading the filesystem on every request.

### 2. Path Traversal & Unvalidated Mutations (Security)
- **Problem:** The `PATCH /api/workspaces/:id` endpoint merges `req.body` directly into the workspace data without Zod validation. `aiGateway.ts` constructs file paths using `workspaceId` and `projectId` without sanitizing them against directory traversal (e.g., `../../`).
- **Impact:** Attackers or rogue AI agents could overwrite arbitrary files or inject malicious data that corrupts the application state.
- **Solution:** Validate all IDs against a strict regex (e.g., `/^[a-zA-Z0-9_-]+$/`). Enforce Zod schema validation on all write operations.

### 3. Fragile Server-Sent Events (Reliability)
- **Problem:** The `/api/events` endpoint adds clients to a `Set` but does not implement a keep-alive/heartbeat mechanism.
- **Impact:** Proxies, firewalls, and Cloud Run load balancers will silently terminate idle connections (typically after 5 minutes). The React frontend will stop receiving live updates without knowing it was disconnected.
- **Solution:** Implement a ping interval (e.g., every 30 seconds) that sends an empty comment or ping event over the SSE connection to keep it alive. Ensure the frontend reconnects on error.

## High Priority Issues

### 1. Timing Attacks on Authentication (Security)
- **Problem:** `POST /api/ai` uses standard string equality (`token !== process.env.API_KEY`) to verify API keys.
- **Impact:** Susceptible to timing attacks, allowing an attacker to theoretically guess the API key over time. Also, if `process.env.API_KEY` is not set, the endpoint fails closed but without a clear developer warning.
- **Solution:** Use `crypto.timingSafeEqual` and assert the presence of `process.env.API_KEY` during server startup.

### 2. Brittle Undo System (Maintainability)
- **Problem:** The undo mechanism reads a growing `.history/commands.json` log line-by-line and hardcodes the inverse of each action.
- **Impact:** If multiple mutations occur on a project, undoing an older action will blindly overwrite the current state with an outdated snapshot or crash. It does not handle cascading deletions properly.
- **Solution:** Transition to a state-snapshot rollback for specific entities rather than blind reversals, and optimize log reading by indexing or limiting log sizes.

### 3. Rigid Natural Language Parsing (AI Integration)
- **Problem:** `CommandParser` uses rigid Regular Expressions. External AI tools (like Claude, ChatGPT) may rephrase commands slightly, causing failures.
- **Impact:** High failure rate for natural language commands.
- **Solution:** While keeping the NLP for human users, the `/api/ai` endpoint should primarily encourage structured JSON commands (e.g., `{ action: "createTodo", ... }`) in its documentation for AI agents to bypass NLP ambiguity.

## Medium Priority

### 1. Duplicated State Logic
- **Problem:** Both `/api/command` and `/api/ai` share heavy overlap in parsing, dry-run handling, logging, and formatting the response.
- **Impact:** Hard to maintain and prone to inconsistent behavior if one endpoint is updated but not the other.
- **Solution:** Refactor the shared logic into an `executeCommand(reqBody, authContext)` service function.

## Low Priority / Nice to Have

### 1. In-Memory Caching
- **Problem:** Reading all `.json` files on every GET request is wasteful.
- **Impact:** Slower response times.
- **Solution:** Maintain an in-memory `WorkspaceStore` that acts as the source of truth, synchronizing to disk in the background.

