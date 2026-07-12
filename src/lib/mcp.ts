import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { aiGateway } from "./aiGateway.js";
import { dataStore } from "./dataStore.js";
import { contextManager } from "./contextManager.js";

export const mcpServer = new McpServer({
  name: "Command Center MCP",
  version: "1.0.0"
});

// Helper for executing commands and formatting responses
async function execute(action: string, args: any) {
  const result = await aiGateway.dispatchCommand({ action, ...args });
  if (result.success) {
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } else {
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
}

// ----------------------------------------------------------------
// Tools
// ----------------------------------------------------------------

mcpServer.tool(
  "createTodo",
  "Create a new todo in a project",
  {
    projectId: z.string().describe("The ID of the project"),
    text: z.string().describe("The text of the todo"),
    dryRun: z.boolean().optional().describe("Perform a dry run without modifying state")
  },
  args => execute("createTodo", args)
);

mcpServer.tool(
  "completeTodo",
  "Toggle completion status of a todo",
  {
    projectId: z.string().describe("The ID of the project"),
    todoId: z.string().describe("The ID of the todo"),
    dryRun: z.boolean().optional()
  },
  args => execute("completeTodo", args)
);

mcpServer.tool(
  "renameTodo",
  "Rename an existing todo",
  {
    projectId: z.string().describe("The ID of the project"),
    todoId: z.string().describe("The ID of the todo"),
    text: z.string().describe("The new text for the todo"),
    dryRun: z.boolean().optional()
  },
  args => execute("renameTodo", args)
);

mcpServer.tool(
  "deleteTodo",
  "Delete a todo from a project",
  {
    projectId: z.string().describe("The ID of the project"),
    todoId: z.string().describe("The ID of the todo"),
    dryRun: z.boolean().optional()
  },
  args => execute("deleteTodo", args)
);

mcpServer.tool(
  "moveTodo",
  "Move a todo from one project to another",
  {
    fromProjectId: z.string().describe("The ID of the source project"),
    toProjectId: z.string().describe("The ID of the target project"),
    todoId: z.string().describe("The ID of the todo"),
    dryRun: z.boolean().optional()
  },
  args => execute("moveTodo", args)
);

mcpServer.tool(
  "createProject",
  "Create a new project in a workspace",
  {
    workspaceId: z.string().describe("The ID of the workspace"),
    categoryId: z.string().describe("The ID of the category"),
    name: z.string().describe("The name of the new project"),
    dryRun: z.boolean().optional()
  },
  args => execute("createProject", args)
);

mcpServer.tool(
  "archiveProject",
  "Archive a project (sets status to On Hold)",
  {
    projectId: z.string().describe("The ID of the project to archive"),
    dryRun: z.boolean().optional()
  },
  args => execute("archiveProject", args)
);

mcpServer.tool(
  "updateProject",
  "Update project metadata",
  {
    projectId: z.string().describe("The ID of the project"),
    name: z.string().optional().describe("New project name"),
    status: z.string().optional().describe("Project status (e.g., Active, Review, On Hold)"),
    description: z.string().optional().describe("Project description"),
    url: z.string().optional().describe("Project URL"),
    workspace: z.string().optional().describe("New workspace ID (to move project)"),
    category: z.string().optional().describe("New category ID"),
    dryRun: z.boolean().optional()
  },
  args => {
    const { projectId, dryRun, ...updates } = args;
    return execute("updateProject", { projectId, updates, dryRun });
  }
);

mcpServer.tool(
  "createInboxItem",
  "Add a new item to the inbox",
  {
    text: z.string().describe("The text of the inbox item"),
    dryRun: z.boolean().optional()
  },
  args => execute("createInboxItem", args)
);

mcpServer.tool(
  "moveInboxItem",
  "Convert an inbox item into a Todo in a project",
  {
    inboxItemId: z.string().describe("The ID of the inbox item"),
    projectId: z.string().describe("The ID of the project to move the item to"),
    dryRun: z.boolean().optional()
  },
  args => execute("moveInboxItem", args)
);


mcpServer.tool(
  "setCurrentProject",
  "Set the active project in the user's command center context",
  {
    projectId: z.string().describe("The ID of the project to set as active")
  },
  async ({ projectId }) => {
    const { projects } = await dataStore.getWorkspacesAndProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return { isError: true, content: [{ type: "text" as const, text: "Project not found" }] };
    
    contextManager.updateContext({ currentProject: project.id, currentCategory: project.category, currentWorkspace: project.workspace });
    
    return { content: [{ type: "text" as const, text: "Active project set to " + project.name }] };
  }
);

// ----------------------------------------------------------------
// Resources
// ----------------------------------------------------------------

mcpServer.resource(
  "workspaces",
  "command-center://workspaces",
  { description: "List of all workspaces and their categories" },
  async (uri) => {
    const workspaces = await dataStore.readWorkspaces();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(workspaces, null, 2),
        mimeType: "application/json"
      }]
    };
  }
);

mcpServer.resource(
  "projects",
  "command-center://projects",
  { description: "List of all projects across all workspaces" },
  async (uri) => {
    const { projects } = await dataStore.getWorkspacesAndProjects();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(projects, null, 2),
        mimeType: "application/json"
      }]
    };
  }
);

mcpServer.resource(
  "project",
  new ResourceTemplate("command-center://projects/{id}", { list: undefined }),
  { description: "Details of a specific project including todos" },
  async (uri, { id }) => {
    const { projects } = await dataStore.getWorkspacesAndProjects();
    const project = projects.find(p => p.id === id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(project, null, 2),
        mimeType: "application/json"
      }]
    };
  }
);

mcpServer.resource(
  "inbox",
  "command-center://inbox",
  { description: "List of all unprocessed inbox items" },
  async (uri) => {
    const inbox = await dataStore.readInbox();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(inbox, null, 2),
        mimeType: "application/json"
      }]
    };
  }
);
