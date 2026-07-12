import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { aiGateway } from './src/lib/aiGateway.js';
import fs from 'fs';
import { z } from 'zod';
import { WorkspaceSchema } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// API route to get initial data
app.get('/api/data', (req, res) => {
  try {
    const DATA_DIR = path.join(process.cwd(), 'src/data');
    const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
    const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
    
    const wsData = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf-8'));
    const workspaces = z.array(WorkspaceSchema).parse(wsData);
    
    const projects = [];
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
app.post('/api/gateway', (req, res) => {
  const command = req.body;
  const result = aiGateway.dispatchCommand(command);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
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