# Remainder MCP Server

The MCP server lets compatible AI clients work directly with the projects and memory in your local Remainder.

## Recommended setup

1. Start the product with `npm run dev`.
2. Open [http://localhost:3000](http://localhost:3000).
3. Open the setup guide using the question-mark button.
4. Continue to **MCP server**.
5. Generate a personal credential.
6. Copy the displayed JSON into your MCP-compatible client.
7. Keep Remainder running whenever the client needs access.

The generated configuration follows this shape:

~~~json
{
  "mcpServers": {
    "creative-memory": {
      "url": "http://localhost:3000/api/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_GENERATED_TOKEN"
      }
    }
  }
}
~~~

The token is stored locally as `API_KEY` in `.env`. Generating a new token rotates the previous credential.

## Creative-memory tools

- `listCreativeProjects` -- list projects and memory counts
- `getProjectMemory` -- read a project with conversations, artifacts, sources, and history
- `searchProjectMemory` -- search decisions, rationale, conversations, and references
- `createCreativeProject` -- create a personal memory project
- `importCreativeConversation` -- import an external AI conversation
- `captureCreativeSession` -- extract durable memory from a conversation
- `addCreativeSource` -- attach a Figma file, repository, document, note, or URL
- `updateMemoryArtifact` -- edit, resolve, or archive captured memory

Legacy command-center todo tools remain available for compatibility.

## Resources

- `creative-memory://projects`
- `creative-memory://projects/{id}`

## Connection requirements

- Transport: SSE
- URL: `http://localhost:3000/api/mcp/sse`
- Header: `Authorization: Bearer <token>`
- The local server must be running.
- The client must support remote/SSE MCP servers and custom headers.

Different clients may label this feature as **MCP server**, **custom connector**, **remote MCP**, or **SSE transport**. The URL and Authorization header remain the same.
