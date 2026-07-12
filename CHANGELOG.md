# Architecture & Feature Updates

## 1. Context Manager (Context Awareness)
- Implemented `contextManager.ts` on the backend to track `currentWorkspace`, `currentProject`, `currentCategory`, `lastReferencedTodo`, and `lastReferencedInboxItem`.
- Provided `GET /api/context` and `PATCH /api/context` for real-time syncing between UI and backend.
- Command Center now maintains context as users interact with the UI (e.g., hovering over a project automatically sets it as the active context).
- Added `setCurrentProject` tool to MCP server, allowing external AI integrations to programmatically control the active context.

## 2. Command Resolution Improvements
- Modified `CommandParser.ts` to seamlessly handle natural language commands that omit a project (e.g., "Add rewrite onboarding"), successfully defaulting to the active project context in memory.
- Introduced confidence scoring boundaries:
  - **High Confidence**: Command omits project but active context exists -> executes immediately.
  - **Medium Confidence**: Command includes a partial/fuzzy project name that matches exactly one project -> prompts user with "Did you mean [Project]?" in the Command Palette UI.
  - **Low Confidence**: Missing context or multiple matches -> throws ambiguous options for the user to select.
- `CommandPalette.tsx` updated to render the "Currently Working On" context and the "Did you mean" prompts nicely.

## 3. Data Access Layer & Concurrency
- `dataStore.ts` manages asynchronous operations safely with Mutex locks per-file, avoiding file race conditions.
- Standardized execution through `aiGateway.ts`.

