# Command Center API Documentation

The Command Center provides a headless API that allows external AI systems (like ChatGPT, Claude Code, Gemini, and custom agents) to control the workspace directly.

## Authentication

All requests to the AI tool endpoint require an API key to be passed via the `Authorization` header as a Bearer token. 

Example:
```http
Authorization: Bearer <API_KEY>
```

*(Note: The API key is configured using the `API_KEY` environment variable on the server.)*

## Endpoints

### Execute AI Command

Process natural language instructions to interact with workspaces, projects, and todos. The endpoint internally parses the instruction and updates the underlying data system.

**Endpoint:** `POST /api/ai`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <API_KEY>`

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | Yes | The natural language command to execute. |
| `dryRun` | boolean | No | If true, parses and returns the intended action without actually modifying the data. Default is false. |

**Example Request:**
```json
{
  "message": "Add 'Rewrite onboarding' to 'Design or Disaster'.",
  "dryRun": false
}
```

**Example Response (Success):**
```json
{
  "success": true,
  "action": "createTodo",
  "project": {
    "id": "proj_a1b2c3d4",
    "title": "Design or Disaster"
  },
  "todo": {
    "id": "todo_e5f6g7h8",
    "text": "Rewrite onboarding"
  },
  "filesChanged": [
    "proj_a1b2c3d4.json"
  ]
}
```

**Example Response (Error):**
If a command is ambiguous or cannot be parsed, the API will return a 400 Bad Request with an error description and potential options.

```json
{
  "success": false,
  "reason": "Multiple projects match 'Design'",
  "options": [
    "Design or Disaster",
    "Design System V2"
  ]
}
```

## Real-time Events (Server-Sent Events)

When data is changed via the API, the backend broadcasts a Server-Sent Event (SSE) to connected clients. 

**Endpoint:** `GET /api/events`

Clients can subscribe to the `/api/events` endpoint to automatically update UI or synchronized state.

**Event Type:** `data-changed`

**Data Payload:**
```json
{
  "action": "createTodo"
}
```
