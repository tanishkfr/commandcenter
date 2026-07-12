# Command Center MCP Server

The Command Center provides a complete Model Context Protocol (MCP) server, allowing AI assistants (like Claude, Cursor, Raycast, and Gemini) to seamlessly inspect and modify the workspace state. 

The MCP server wraps the existing backend, reusing its authentication, command parsing, and validation layers.

## Connecting

The server uses the standard MCP Server-Sent Events (SSE) transport over HTTP. 

- **Endpoint:** `GET /api/mcp/sse` (to establish connection)
- **Messages Endpoint:** `POST /api/mcp/messages`

### Authentication
Both the SSE and Messages endpoints require the standard Command Center API key to be passed via the `Authorization` header:
```http
Authorization: Bearer <API_KEY>
```

## Available Resources

The MCP server exposes the workspace's internal state via the following URIs. These allow AI agents to safely read the state without executing tools.

| Resource URI | Description | Mime Type |
|--------------|-------------|-----------|
| `command-center://workspaces` | A complete list of all workspaces and their respective categories. | `application/json` |
| `command-center://projects` | A list of all projects across all workspaces (includes their metadata). | `application/json` |
| `command-center://projects/{id}` | Deep dive into a specific project, including all of its inner `todos`. | `application/json` |
| `command-center://inbox` | A list of all unprocessed inbox items. | `application/json` |

## Available Tools

The MCP server exposes direct, structured tools to manipulate the workspace. Every tool supports an optional `dryRun` boolean parameter to safely preview the impact of the command.

### 1. Inbox Management
- **`createInboxItem`**
  - **Description**: Add a new raw thought or item to the global inbox.
  - **Parameters**: `text` (string).
- **`moveInboxItem`**
  - **Description**: Convert an inbox item into an actionable Todo within a specific project.
  - **Parameters**: `inboxItemId` (string), `projectId` (string).

### 2. Project Management
- **`createProject`**
  - **Description**: Create a new project under a specific workspace and category.
  - **Parameters**: `workspaceId` (string), `categoryId` (string), `name` (string).
- **`archiveProject`**
  - **Description**: Sets the status of a project to "On Hold".
  - **Parameters**: `projectId` (string).
- **`updateProject`**
  - **Description**: Update a project's metadata (or move it to a different workspace/category).
  - **Parameters**: `projectId` (string), `name`? (string), `status`? (string), `description`? (string), `url`? (string), `workspace`? (string), `category`? (string).

### 3. Todo Management
- **`createTodo`**
  - **Description**: Create a new todo inside a project.
  - **Parameters**: `projectId` (string), `text` (string).
- **`completeTodo`**
  - **Description**: Toggle the completion status of a todo.
  - **Parameters**: `projectId` (string), `todoId` (string).
- **`renameTodo`**
  - **Description**: Rename an existing todo.
  - **Parameters**: `projectId` (string), `todoId` (string), `text` (string).
- **`deleteTodo`**
  - **Description**: Delete a todo.
  - **Parameters**: `projectId` (string), `todoId` (string).
- **`moveTodo`**
  - **Description**: Move a todo from one project to another.
  - **Parameters**: `fromProjectId` (string), `toProjectId` (string), `todoId` (string).

## Example Client Usage (Conceptual)

1. **Agent wants to see all projects:**
   - The agent reads `command-center://projects`.
2. **Agent wants to capture a thought:**
   - The agent calls the `createInboxItem` tool with `{ "text": "Draft Q3 roadmap" }`.
3. **Agent wants to assign an inbox item to a project:**
   - The agent calls `moveInboxItem` with `{ "inboxItemId": "inbox_123", "projectId": "project_abc" }`.
