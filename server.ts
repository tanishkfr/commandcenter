import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { aiGateway } from './src/lib/aiGateway.js';
import { CommandParser } from './src/lib/commandParser.js';
import fs from 'fs';
import { z } from 'zod';
import { WorkspaceSchema } from './src/types.js';

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
  req.on('close', () => clients.delete(res));
});

function broadcastEvent(type: string, data: any) {
  for (const client of clients) {
    client.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

function loadWorkspaceAndProjects() {
  const DATA_DIR = path.join(process.cwd(), 'src/data');
  const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
  const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
  
  const wsData = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf-8'));
  const workspaces = z.array(WorkspaceSchema).parse(wsData);
  
  const projects: any[] = [];
  if (fs.existsSync(WORKSPACES_DIR)) {
    const dirs = fs.readdirSync(WORKSPACES_DIR);
    for (const ws of dirs) {
      const wsPath = path.join(WORKSPACES_DIR, ws);
      if (fs.statSync(wsPath).isDirectory()) {
        const files = fs.readdirSync(wsPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const data = JSON.parse(fs.readFileSync(path.join(wsPath, file), 'utf-8'));
            projects.push(data);
          }
        }
      }
    }
  }
  return { workspaces, projects };
}

// API route to get initial data
app.get('/api/data', (req, res) => {
  try {
    const { workspaces, projects } = loadWorkspaceAndProjects();
    res.json({ workspaces, projects });
  } catch (error: any) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update Workspace
app.patch('/api/workspaces/:id', (req, res) => {
  try {
    const DATA_DIR = path.join(process.cwd(), 'src/data');
    const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
    const wsData = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf-8'));
    const workspaces = z.array(WorkspaceSchema).parse(wsData);
    
    const idx = workspaces.findIndex(w => w.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Workspace not found' });
    
    workspaces[idx] = { ...workspaces[idx], ...req.body };
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2), 'utf-8');
    
    res.json(workspaces[idx]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gateway API route
app.get('/api/history', (req, res) => {
  try {
    const historyDir = path.join(process.cwd(), '.history');
    const historyFile = path.join(historyDir, 'commands.json');
    if (!fs.existsSync(historyFile)) return res.json([]);
    const lines = fs.readFileSync(historyFile, 'utf-8').trim().split('\n');
    const history = lines.filter(Boolean).map(l => JSON.parse(l)).reverse();
    res.json(history);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/undo', (req, res) => {
  try {
    const { logId } = req.body;
    if (!logId) return res.status(400).json({ success: false, message: 'Missing logId' });
    const result = aiGateway.undo(logId);
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

app.get('/api/inbox', (req, res) => {
  try {
    const inboxFile = path.join(process.cwd(), 'src/data/inbox.json');
    if (!fs.existsSync(inboxFile)) return res.json([]);
    const items = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/gateway', (req, res) => {
  const command = req.body;
  const result = aiGateway.dispatchCommand(command);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// AI Command Layer Endpoint
app.post('/api/command', (req, res) => {
  const { command: nlCommand, dryRun, ...structuredCommand } = req.body;
  
  let actionCommand = structuredCommand;
  
  if (nlCommand) {
    try {
      const { workspaces, projects } = loadWorkspaceAndProjects();
      
      const parser = new CommandParser(workspaces, projects);
      const parseResult = parser.parse(nlCommand);
      
      if (!parseResult.success) {
        return res.status(400).json(parseResult);
      }
      
      actionCommand = parseResult.command;
    } catch (e: any) {
      return res.status(500).json({ success: false, reason: 'Failed to load data for parsing', error: e.message });
    }
  }

  // Pass dryRun flag
  if (dryRun) {
    actionCommand.dryRun = true;
  }
  
  const startTime = Date.now();
  const result = aiGateway.dispatchCommand(actionCommand);
  const duration = Date.now() - startTime;
  
  if (result.success && !dryRun) {
    // Append to history
    try {
      const historyDir = path.join(process.cwd(), '.history');
      if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
      
      const entry = {
        timestamp: new Date().toISOString(),
        command: nlCommand || JSON.stringify(structuredCommand),
        parsedAction: actionCommand.action,
        result,
        duration
      };
      
      fs.appendFileSync(
        path.join(historyDir, 'commands.json'),
        JSON.stringify(entry) + '\n',
        'utf-8'
      );
    } catch (e) {
      console.error('Failed to write history', e);
    }
    broadcastEvent('data-changed', { action: result.action });
  }
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/ai', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, reason: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== process.env.API_KEY) {
    return res.status(403).json({ success: false, reason: 'Forbidden' });
  }

  const { message, dryRun } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, reason: 'Missing message' });
  }

  try {
    const { workspaces, projects } = loadWorkspaceAndProjects();
    const parser = new CommandParser(workspaces, projects);
    const parseResult = parser.parse(message);
    
    if (!parseResult.success) {
      return res.status(400).json({
         success: false,
         reason: parseResult.reason,
         options: parseResult.options
      });
    }
    
    let actionCommand = parseResult.command;
    if (dryRun) {
      actionCommand.dryRun = true;
    }
    
    const startTime = Date.now();
    const result = aiGateway.dispatchCommand(actionCommand);
    const duration = Date.now() - startTime;
    
    if (result.success && !dryRun) {
      try {
        const historyDir = path.join(process.cwd(), '.history');
        if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
        
        const entry = {
          timestamp: new Date().toISOString(),
          command: message,
          parsedAction: actionCommand.action,
          result,
          duration
        };
        
        fs.appendFileSync(
          path.join(historyDir, 'commands.json'),
          JSON.stringify(entry) + '\n',
          'utf-8'
        );
      } catch (e) {
        console.error('Failed to write history', e);
      }
      
      broadcastEvent('data-changed', { action: result.action });
    }

    let projectObj = undefined;
    let filesChanged = [];
    
    if (actionCommand.projectId) {
      const p = projects.find((p: any) => p.id === actionCommand.projectId);
      if (p) projectObj = { id: p.id, title: p.name };
      filesChanged.push(`${actionCommand.projectId}.json`);
    } else if (actionCommand.fromProjectId && actionCommand.toProjectId) {
       const p1 = projects.find((p: any) => p.id === actionCommand.fromProjectId);
       const p2 = projects.find((p: any) => p.id === actionCommand.toProjectId);
       if (p2) projectObj = { id: p2.id, title: p2.name };
       filesChanged.push(`${actionCommand.fromProjectId}.json`);
       filesChanged.push(`${actionCommand.toProjectId}.json`);
    }
    
    if (actionCommand.action === 'addInboxItem') {
      filesChanged.push('inbox.json');
    }
    if (actionCommand.action === 'createProject') {
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
      message: result.message
    };

    if (result.success) {
       res.json(formattedResult);
    } else {
       res.status(400).json(formattedResult);
    }
  } catch (e: any) {
    return res.status(500).json({ success: false, reason: 'Failed to process AI command', error: e.message });
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
