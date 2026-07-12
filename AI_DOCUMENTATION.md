# AI Architecture & Editing Guidelines

This document outlines the data architecture for the Command Center application. It is designed to be deterministic, safely mutable, and strictly validated.

**If you are an AI assistant (like Claude Code, ChatGPT, Gemini, or Copilot) modifying this project, YOU MUST STRICTLY FOLLOW THESE RULES.**

## 1. Folder Structure

```
src/
├── data/
│   ├── workspaces.json          # Defines workspaces and their category structures
│   └── workspaces/
│       ├── personal/            # Folders match workspace IDs
│       │   ├── *.json           # Individual project files (one file per project)
│       └── fluxion/
│           ├── *.json
├── lib/
│   └── api.ts                   # The core mutation layer & validation logic
├── types.ts                     # Zod schemas for the entire domain
└── components/
```

## 2. JSON Schema

All project data is strictly validated on load using Zod (see `src/types.ts`). If a JSON file violates the schema, the application will crash loudly.

**Project JSON Schema Rules:**
- `id`: Stable, unique string starting with `project_` (e.g., `project_9f82a1b`).
- `workspace`: Must exactly match an ID in `workspaces.json`.
- `category`: Must exactly match a category ID in the `categories` array of the referenced workspace in `workspaces.json`.
- `status`: Must be one of: `"Active"`, `"Review"`, `"Shipped"`, `"On Hold"`.
- `lastUpdated`: ISO-8601 datetime string.
- `github`, `deployment`, `figma`, `url`, `description`: String (can be empty but must exist).
- `todos`: Array of objects.

**Todo JSON Schema Rules:**
- `id`: Stable, unique string starting with `todo_` (e.g., `todo_a4f9b2`).
- `text`: String.
- `completed`: Boolean.
- Optional fields: `createdAt`, `priority`.

*Important: Never omit required fields in JSON files. Do not change object ordering unnecessarily.*

## 3. How Data is Loaded

1. `api.ts` uses Vite's `import.meta.glob` to eager-load all `.json` files inside `src/data/workspaces/**/*.json`.
2. Every loaded file is parsed through `ProjectSchema`.
3. Validation enforces that:
   - There are no duplicate `project.id` or `todo.id` values.
   - The `workspace` and `category` references point to existing IDs in `workspacesData`.
4. If everything is valid, data is copied to an in-memory/`localStorage` store.

## 4. How to Modify Data (The Mutation Layer)

**DO NOT** modify the state variables in `Dashboard.tsx` manually.
**DO NOT** add custom modification logic to UI components.

All changes must go through the atomic mutation functions exported from `src/lib/api.ts`:

- **Projects**:
  - `addProject(workspaceId, categoryId)`
  - `updateProject(projectId, updates)`
  - `deleteProject(projectId)`
- **Todos**:
  - `addTodo(projectId, text)`
  - `toggleTodo(projectId, todoId)`
  - `renameTodo(projectId, todoId, newText)`
  - `removeTodo(projectId, todoId)`
  - `moveTodo(fromProjectId, toProjectId, todoId)`
- **Workspaces**:
  - `updateWorkspace(workspaceId, updates)`

*These functions are designed identically to a REST API. In the future, they will directly map to `POST`, `PATCH`, and `DELETE` requests.*

## 5. Safely Editing via Natural Language

If a human gives you a command like:
> "Move 'Fix typography' from Atlas to Invisible Interfaces"

**Step 1:** Use `grep` or file viewing tools to find the `project.id` for "Atlas" and "Invisible Interfaces", and the `todo.id` for "Fix typography".
**Step 2:** Never assume array indices. Locate the exact IDs.
**Step 3:** (If executing code dynamically or updating data directly): Call `moveTodo('project_atlas', 'project_invisible', 'todo_12345')`.
**Step 4:** (If modifying the JSON files on disk): Edit the exact JSON files representing those projects. Remove the todo object from the source JSON and insert it into the target JSON. **Preserve the `todo.id`.**

**General AI Constraints:**
- **Atomic Operations**: Only use the specific API helper for the task requested. Don't bulk-update unless requested.
- **Git Friendly**: Format any JSON you write with `2` spaces to keep Git diffs minimal.
- **Never Fail Silently**: If you detect an invalid ID during an operation, throw an error. Do not try to randomly guess missing IDs.
