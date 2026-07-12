import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { aiGateway } from './src/lib/aiGateway.js';
import { CommandParser } from './src/lib/commandParser.js';
import { dataStore } from './src/lib/dataStore.js';
import crypto from 'crypto';
import { contextManager } from './src/lib/contextManager.js';

import { mcpServer } from './src/lib/mcp.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const mcpTransports = new Map<string, SSEServerTransport>();

function verifyAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, reason: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  const expectedKey = process.env.API_KEY || '';
  
  if (!expectedKey) {
    console.error('CRITICAL: API_KEY environment variable is not set!');
    return res.status(500).json({ success: false, reason: 'Server configuration error' });
  }

  try {
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedKey);
    
    if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
      return res.status(403).json({ success: false, reason: 'Forbidden' });
    }
  } catch (e) {
    return res.status(403).json({ success: false, reason: 'Forbidden' });
  }
  next();
}



const app = express();
const PORT = 3000;
app.use(express.json());

const clients = new Set<express.Response>();

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  clients.add(res);
  
  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':\n\n'); // Empty comment for ping
  }, 30000);
  
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

function broadcastEvent(type: string, data: any) {
  for (const client of clients) {
    client.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}


app.get('/api/context', (req, res) => {
  res.json(contextManager.getContext());
});

app.patch('/api/context', (req, res) => {
  contextManager.updateContext(req.body);
  broadcastEvent('context-changed', contextManager.getContext());
  res.json(contextManager.getContext());
});

app.get('/api/data', async (req, res) => {
  try {
    const { workspaces, projects } = await dataStore.getWorkspacesAndProjects();
    res.json({ workspaces, projects });
  } catch (error: any) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/workspaces/:id', async (req, res) => {
  try {
    const workspaces = await dataStore.readWorkspaces();
    const idx = workspaces.findIndex(w => w.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Workspace not found' });
    
    // Apply patch and validate
    const updated = { ...workspaces[idx], ...req.body };
    workspaces[idx] = updated;
    await dataStore.writeWorkspaces(workspaces);
    
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    // Basic implementation that could be optimized in a real scenario
    // We're keeping it simple for the preview but switching to async
    const fs = await import('fs/promises');
    const historyDir = path.join(process.cwd(), '.history');
    const historyFile = path.join(historyDir, 'commands.json');
    try {
      const data = await fs.readFile(historyFile, 'utf-8');
      const lines = data.trim().split('\n');
      const history = lines.filter(Boolean).map(l => JSON.parse(l)).reverse();
      res.json(history);
    } catch {
      res.json([]);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/undo', async (req, res) => {
  try {
    const { logId } = req.body;
    if (!logId) return res.status(400).json({ success: false, message: 'Missing logId' });
    const result = await aiGateway.undo(logId);
    if (result.success) {
      broadcastEvent('data-changed', { action: 'undo' });
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/inbox', async (req, res) => {
  try {
    const items = await dataStore.readInbox();
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/gateway', async (req, res) => {
  try {
    const command = req.body;
    const result = await aiGateway.dispatchCommand(command);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function executeCommand(reqBody: any, isAiEndpoint: boolean = false) {
  const { message, command: reqCommand, dryRun, ...structuredCommand } = reqBody;
  
  // If reqCommand is a string, treat it as natural language input. Otherwise it's a structured command.
  const inputCommandString = message || (typeof reqCommand === 'string' ? reqCommand : null);
  
  let actionCommand = { ...structuredCommand };
  if (typeof reqCommand === 'object' && reqCommand !== null) {
    actionCommand = { ...actionCommand, ...reqCommand };
  }
  
  if (inputCommandString) {
    const { workspaces, projects } = await dataStore.getWorkspacesAndProjects();
    const parser = new CommandParser(workspaces, projects, contextManager.getContext());
    const parseResult = parser.parse(inputCommandString);
    
    if (!parseResult.success) {
      const pr: any = parseResult;
      return { success: false, reason: pr.reason, options: pr.options, status: 400 };
    }
    
    actionCommand = parseResult.command;
  } else if (Object.keys(actionCommand).length === 0 && isAiEndpoint) {
    return { success: false, reason: 'Missing message or valid structured command', status: 400 };
  }

  if (dryRun) {
    actionCommand.dryRun = true;
  }

  
  const startTime = Date.now();
  const result = await aiGateway.dispatchCommand(actionCommand);
  const duration = Date.now() - startTime;
  
  if (result.success && !dryRun) {
    try {
      const fs = await import('fs/promises');
      const fsSync = await import('fs');
      const historyDir = path.join(process.cwd(), '.history');
      if (!fsSync.existsSync(historyDir)) await fs.mkdir(historyDir, { recursive: true });
      
      const entry = {
        timestamp: new Date().toISOString(),
        command: inputCommandString || JSON.stringify(structuredCommand),
        parsedAction: actionCommand.action,
        result,
        duration
      };
      
      await fs.appendFile(
        path.join(historyDir, 'commands.json'),
        JSON.stringify(entry) + '\n',
        'utf-8'
      );
    } catch (e) {
      console.error('Failed to write history', e);
    }
    broadcastEvent('data-changed', { action: result.action });
  }

  if (!isAiEndpoint) {
    return { ...result, status: result.success ? 200 : 400 };
  }

  let projectObj = undefined;
  let filesChanged = [];
  
  const { projects } = await dataStore.getWorkspacesAndProjects();
  if (actionCommand.projectId) {
    const p = projects.find(p => p.id === actionCommand.projectId);
    if (p) projectObj = { id: p.id, title: p.name };
    filesChanged.push(`${actionCommand.projectId}.json`);
  } else if (actionCommand.fromProjectId && actionCommand.toProjectId) {
     const p2 = projects.find(p => p.id === actionCommand.toProjectId);
     if (p2) projectObj = { id: p2.id, title: p2.name };
     filesChanged.push(`${actionCommand.fromProjectId}.json`);
     filesChanged.push(`${actionCommand.toProjectId}.json`);
  }
  
  if (actionCommand.action === 'addInboxItem') {
    filesChanged.push('inbox.json');
  }
  if (actionCommand.action === 'createProject' && result.projectId) {
    projectObj = { id: result.projectId, title: actionCommand.name };
    filesChanged.push(`${result.projectId}.json`);
  }
  if (actionCommand.action === 'deleteProject') {
    projectObj = { id: actionCommand.projectId };
    filesChanged.push(`${actionCommand.projectId}.json`);
  }
  
  let todoObj = undefined;
  if (result.data && result.data.text) {
     todoObj = { id: result.data.id, text: result.data.text };
  } else if (actionCommand.todoId) {
     todoObj = { id: actionCommand.todoId };
  }

  const formattedResult = {
    success: result.success,
    action: actionCommand.action,
    project: projectObj,
    todo: todoObj,
    filesChanged: filesChanged,
    error: result.error,
    message: result.message,
    status: result.success ? 200 : 400
  };

  return formattedResult;
}

app.post('/api/command', async (req, res) => {
  try {
    const result = await executeCommand(req.body, false);
    const { status, ...data } = result;
    res.status(status).json(data);
  } catch (e: any) {
    res.status(500).json({ success: false, reason: 'Failed to process command', error: e.message });
  }
});


app.get('/api/mcp/sse', verifyAuth, async (req, res) => {
  const transport = new SSEServerTransport('/api/mcp/messages', res);
  await mcpServer.connect(transport);
  mcpTransports.set(transport.sessionId, transport);
  req.on('close', () => {
    mcpTransports.delete(transport.sessionId);
  });
});

app.post('/api/mcp/messages', verifyAuth, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = mcpTransports.get(sessionId);
  if (!transport) {
    return res.status(404).send('Session not found');
  }
  await transport.handlePostMessage(req, res, req.body);
});

app.post('/api/ai', verifyAuth, async (req, res) => {


  try {
    const result = await executeCommand(req.body, true);
    const { status, ...data } = result;
    res.status(status).json(data);
  } catch (e: any) {
    res.status(500).json({ success: false, reason: 'Failed to process AI command', error: e.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
