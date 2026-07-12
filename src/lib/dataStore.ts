import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { WorkspaceSchema, ProjectSchema, Project, WorkspaceData, Todo } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const INBOX_FILE = path.join(DATA_DIR, 'inbox.json');

// Ensure directories exist
if (!fs.existsSync(WORKSPACES_DIR)) fs.mkdirSync(WORKSPACES_DIR, { recursive: true });

type MutexTask<T> = () => Promise<T>;

class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  async run<T>(task: MutexTask<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}

class DataStore {
  private fileMutexes = new Map<string, Mutex>();

  private getMutex(filePath: string): Mutex {
    if (!this.fileMutexes.has(filePath)) {
      this.fileMutexes.set(filePath, new Mutex());
    }
    return this.fileMutexes.get(filePath)!;
  }

  private sanitizeId(id: string): string {
    const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) throw new Error(`Invalid ID: ${id}`);
    return sanitized;
  }

  async readWorkspaces(): Promise<WorkspaceData[]> {
    return this.getMutex(WORKSPACES_FILE).run(async () => {
      const data = await fsPromises.readFile(WORKSPACES_FILE, 'utf-8');
      return z.array(WorkspaceSchema).parse(JSON.parse(data));
    });
  }

  async writeWorkspaces(workspaces: WorkspaceData[]): Promise<void> {
    const validated = z.array(WorkspaceSchema).parse(workspaces);
    await this.getMutex(WORKSPACES_FILE).run(async () => {
      await fsPromises.writeFile(WORKSPACES_FILE, JSON.stringify(validated, null, 2), 'utf-8');
    });
  }

  async getWorkspacesAndProjects(): Promise<{ workspaces: WorkspaceData[], projects: Project[] }> {
    const workspaces = await this.readWorkspaces();
    const projects: Project[] = [];
    
    const dirs = await fsPromises.readdir(WORKSPACES_DIR);
    for (const ws of dirs) {
      const wsPath = path.join(WORKSPACES_DIR, ws);
      const stat = await fsPromises.stat(wsPath);
      if (stat.isDirectory()) {
        const files = await fsPromises.readdir(wsPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(wsPath, file);
            await this.getMutex(filePath).run(async () => {
              const data = JSON.parse(await fsPromises.readFile(filePath, 'utf-8'));
              projects.push(ProjectSchema.parse(data));
            });
          }
        }
      }
    }
    return { workspaces, projects };
  }

  async readProject(workspaceId: string, projectId: string): Promise<Project> {
    const wsId = this.sanitizeId(workspaceId);
    const pId = this.sanitizeId(projectId);
    const filePath = path.join(WORKSPACES_DIR, wsId, `${pId}.json`);
    
    return this.getMutex(filePath).run(async () => {
      const data = JSON.parse(await fsPromises.readFile(filePath, 'utf-8'));
      return ProjectSchema.parse(data);
    });
  }

  async writeProject(workspaceId: string, project: Project): Promise<void> {
    const wsId = this.sanitizeId(workspaceId);
    const pId = this.sanitizeId(project.id);
    const validated = ProjectSchema.parse(project);
    
    const wsPath = path.join(WORKSPACES_DIR, wsId);
    await fsPromises.mkdir(wsPath, { recursive: true });
    
    const filePath = path.join(wsPath, `${pId}.json`);
    await this.getMutex(filePath).run(async () => {
      await fsPromises.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8');
    });
  }
  
  async deleteProject(workspaceId: string, projectId: string): Promise<void> {
    const wsId = this.sanitizeId(workspaceId);
    const pId = this.sanitizeId(projectId);
    const filePath = path.join(WORKSPACES_DIR, wsId, `${pId}.json`);
    await this.getMutex(filePath).run(async () => {
      await fsPromises.unlink(filePath);
    });
  }

  async moveProjectFile(oldWorkspaceId: string, newWorkspaceId: string, projectId: string): Promise<void> {
    const oldWsId = this.sanitizeId(oldWorkspaceId);
    const newWsId = this.sanitizeId(newWorkspaceId);
    const pId = this.sanitizeId(projectId);
    
    const oldPath = path.join(WORKSPACES_DIR, oldWsId, `${pId}.json`);
    const newPath = path.join(WORKSPACES_DIR, newWsId, `${pId}.json`);
    
    // Acquire both locks to prevent race conditions during move
    // Sort to prevent deadlocks
    const [lock1, lock2] = [oldPath, newPath].sort();
    
    await this.getMutex(lock1).run(async () => {
      await this.getMutex(lock2).run(async () => {
        const newWsPath = path.dirname(newPath);
        await fsPromises.mkdir(newWsPath, { recursive: true });
        await fsPromises.rename(oldPath, newPath);
      });
    });
  }

  async readInbox(): Promise<any[]> {
    return this.getMutex(INBOX_FILE).run(async () => {
      if (!fs.existsSync(INBOX_FILE)) return [];
      const data = await fsPromises.readFile(INBOX_FILE, 'utf-8');
      return JSON.parse(data);
    });
  }

  async writeInbox(inbox: any[]): Promise<void> {
    await this.getMutex(INBOX_FILE).run(async () => {
      await fsPromises.writeFile(INBOX_FILE, JSON.stringify(inbox, null, 2), 'utf-8');
    });
  }
}

export const dataStore = new DataStore();
