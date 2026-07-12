import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "command-center",
  version: "1.0.0"
});

console.log("McpServer created successfully");
