import fs from 'fs';
import path from 'path';
import { Project, ProjectSchema, Todo, WorkspaceSchema } from '../types';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const LOGS_DIR = path.join(process.cwd(), '.logs');

export type GatewayResult<T = any> = {
  logId?: string;
  success: boolean;
  action?: string;
  projectId?: string;
  todoId?: string;
  message: string;
  data?: T;
  error?: string;
  dryRun?: boolean;
  changes?: {
    files: string[];
    todos: string[];
    projectTargeted: string;
    description: string;
  };
};

function getLogFile(): string {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  return path.join(LOGS_DIR, `${dateStr}.json`);
}

function appendLog(entry: any) {
  const logId = "log_" + Date.now();
  entry.logId = logId;
  const file = getLogFile();
  const logLine = JSON.stringify(entry) + '\n';
  fs.appendFileSync(file, logLine, 'utf8');
  return logId;
}

function findProjectFile(projectId: string): string | null {
  if (!fs.existsSync(WORKSPACES_DIR)) return null;
  const workspaces = fs.readdirSync(WORKSPACES_DIR);
  for (const ws of workspaces) {
    const wsPath = path.join(WORKSPACES_DIR, ws);
    if (!fs.statSync(wsPath).isDirectory()) continue;
    const files = fs.readdirSync(wsPath);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(wsPath, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (data.id === projectId) return filePath;
    }
  }
  return null;
}

function loadProject(filePath: string): Project {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return ProjectSchema.parse(data);
}

function saveProject(filePath: string, project: Project) {
  const result = ProjectSchema.safeParse(project);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.message}`);
  }
  fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf-8');
}

function validateWorkspaceAndCategory(workspaceId: string, categoryId: string) {
  const wsData = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf-8'));
  const workspaces = z.array(WorkspaceSchema).parse(wsData);
  const ws = workspaces.find(w => w.id === workspaceId);
  if (!ws) throw new Error(`Invalid workspace: ${workspaceId}`);
  if (!ws.categories.some(c => c.id === categoryId)) {
    throw new Error(`Invalid category: ${categoryId} in workspace ${workspaceId}`);
  }
}

import { z } from 'zod';

function logMutation(action: string, success: boolean, details: any, previousState?: any) {
  return appendLog({
    timestamp: new Date().toISOString(),
    action,
    success,
    ...details,
    previousState
  });
}

function getNewId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}`;
}

export const aiGateway = {
  
  addInboxItem(text: string, dryRun: boolean = false): GatewayResult {
    try {
      const inboxFile = path.join(DATA_DIR, 'inbox.json');
      let inbox = [];
      if (fs.existsSync(inboxFile)) {
        inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf8'));
      }
      
      const newItem = {
        id: getNewId('inbox'),
        text,
        createdAt: new Date().toISOString()
      };
      
      if (dryRun) {
        return {
          success: true, action: 'addInboxItem', message: 'Dry run successful', dryRun: true, data: newItem,
          changes: { files: [inboxFile], todos: [newItem.id], projectTargeted: 'inbox', description: `Add item to inbox: '${text}'` }
        };
      }
      
      const previousState = [...inbox];
      inbox.push(newItem);
      fs.writeFileSync(inboxFile, JSON.stringify(inbox, null, 2), 'utf8');
      
      const logId = logMutation('addInboxItem', true, { itemId: newItem.id }, previousState);
      return { success: true, logId, action: 'addInboxItem', message: 'Added to inbox successfully', data: newItem };
    } catch (err: any) {
      logMutation('addInboxItem', false, { error: err.message });
      return { success: false, action: 'addInboxItem', message: 'Failed to add to inbox', error: err.message };
    }
  },

  createTodo(projectId: string, text: string, dryRun: boolean = false): GatewayResult<Todo> {
    try {
      if (!text) throw new Error('Todo text cannot be empty');
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      const newTodo: Todo = {
        id: getNewId('todo'),
        text,
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      // Check for duplicate ID (highly unlikely but mandated)
      if (project.todos.some(t => t.id === newTodo.id)) {
        throw new Error(`Duplicate todo ID generated: ${newTodo.id}`);
      }
      
      project.todos.push(newTodo);
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'createTodo', projectId, todoId: newTodo.id, message: 'Dry run successful', data: newTodo, dryRun: true,
          changes: { files: [file], todos: [newTodo.id], projectTargeted: projectId, description: `Create todo '${text}' in project ${projectId}` }
        };
      }
      
      saveProject(file, project);
      
      const logId = logMutation('createTodo', true, { projectId, todoId: newTodo.id }, previousState);
      return { success: true, logId, action: 'createTodo', projectId, todoId: newTodo.id, message: 'Todo created successfully', data: newTodo };
    } catch (err: any) {
      logMutation('createTodo', false, { projectId, error: err.message });
      return { success: false, action: 'createTodo', projectId, message: 'Failed to create todo', error: err.message };
    }
  },

  completeTodo(projectId: string, todoId: string, dryRun: boolean = false): GatewayResult<Todo> {
    try {
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      const todo = project.todos.find(t => t.id === todoId);
      if (!todo) throw new Error('Todo not found');
      
      todo.completed = !todo.completed;
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'completeTodo', projectId, todoId, message: 'Dry run successful', data: todo, dryRun: true,
          changes: { files: [file], todos: [todoId], projectTargeted: projectId, description: `Toggle completion of todo ${todoId} in project ${projectId}` }
        };
      }
      
      saveProject(file, project);
      
      const logId = logMutation('completeTodo', true, { projectId, todoId }, previousState);
      return { success: true, logId, action: 'completeTodo', projectId, todoId, message: 'Todo completion toggled successfully', data: todo };
    } catch (err: any) {
      logMutation('completeTodo', false, { projectId, todoId, error: err.message });
      return { success: false, action: 'completeTodo', projectId, todoId, message: 'Failed to complete todo', error: err.message };
    }
  },

  renameTodo(projectId: string, todoId: string, newText: string, dryRun: boolean = false): GatewayResult<Todo> {
    try {
      if (!newText) throw new Error('Todo text cannot be empty');
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      const todo = project.todos.find(t => t.id === todoId);
      if (!todo) throw new Error('Todo not found');
      
      todo.text = newText;
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'renameTodo', projectId, todoId, message: 'Dry run successful', data: todo, dryRun: true,
          changes: { files: [file], todos: [todoId], projectTargeted: projectId, description: `Rename todo ${todoId} to '${newText}' in project ${projectId}` }
        };
      }
      
      saveProject(file, project);
      
      const logId = logMutation('renameTodo', true, { projectId, todoId, newText }, previousState);
      return { success: true, logId, action: 'renameTodo', projectId, todoId, message: 'Todo renamed successfully', data: todo };
    } catch (err: any) {
      logMutation('renameTodo', false, { projectId, todoId, error: err.message });
      return { success: false, action: 'renameTodo', projectId, todoId, message: 'Failed to rename todo', error: err.message };
    }
  },

  deleteTodo(projectId: string, todoId: string, dryRun: boolean = false): GatewayResult {
    try {
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      const idx = project.todos.findIndex(t => t.id === todoId);
      if (idx === -1) throw new Error('Todo not found');
      
      project.todos.splice(idx, 1);
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'deleteTodo', projectId, todoId, message: 'Dry run successful', dryRun: true,
          changes: { files: [file], todos: [todoId], projectTargeted: projectId, description: `Delete todo ${todoId} from project ${projectId}` }
        };
      }
      
      saveProject(file, project);
      
      const logId = logMutation('deleteTodo', true, { projectId, todoId }, previousState);
      return { success: true, logId, action: 'deleteTodo', projectId, todoId, message: 'Todo deleted successfully' };
    } catch (err: any) {
      logMutation('deleteTodo', false, { projectId, todoId, error: err.message });
      return { success: false, action: 'deleteTodo', projectId, todoId, message: 'Failed to delete todo', error: err.message };
    }
  },

  moveTodo(fromProjectId: string, toProjectId: string, todoId: string, dryRun: boolean = false): GatewayResult {
    try {
      const fromFile = findProjectFile(fromProjectId);
      const toFile = findProjectFile(toProjectId);
      if (!fromFile) throw new Error('Source project not found');
      if (!toFile) throw new Error('Target project not found');
      
      const fromProject = loadProject(fromFile);
      const toProject = loadProject(toFile);
      
      const previousState = { fromProject: { ...fromProject }, toProject: { ...toProject } };
      
      const idx = fromProject.todos.findIndex(t => t.id === todoId);
      if (idx === -1) throw new Error('Todo not found in source project');
      
      const [todo] = fromProject.todos.splice(idx, 1);
      
      if (toProject.todos.some(t => t.id === todoId)) {
        throw new Error('Todo ID already exists in target project');
      }
      
      toProject.todos.push(todo);
      fromProject.lastUpdated = new Date().toISOString();
      toProject.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'moveTodo', projectId: toProjectId, todoId, message: 'Dry run successful', dryRun: true,
          changes: { files: [fromFile, toFile], todos: [todoId], projectTargeted: toProjectId, description: `Move todo ${todoId} from ${fromProjectId} to ${toProjectId}` }
        };
      }
      
      saveProject(fromFile, fromProject);
      saveProject(toFile, toProject);
      
      const logId = logMutation('moveTodo', true, { fromProjectId, toProjectId, todoId }, previousState);
      return { success: true, logId, action: 'moveTodo', projectId: toProjectId, todoId, message: 'Todo moved successfully' };
    } catch (err: any) {
      logMutation('moveTodo', false, { fromProjectId, toProjectId, todoId, error: err.message });
      return { success: false, action: 'moveTodo', message: 'Failed to move todo', error: err.message };
    }
  },

  createProject(workspaceId: string, categoryId: string, name: string, dryRun: boolean = false): GatewayResult<Project> {
    try {
      validateWorkspaceAndCategory(workspaceId, categoryId);
      
      const newProjectId = getNewId('project');
      const newProject: Project = {
        id: newProjectId,
        name: name || 'New Project',
        workspace: workspaceId,
        category: categoryId,
        status: 'Active',
        description: 'Project description goes here.',
        url: '',
        github: '',
        deployment: '',
        figma: '',
        lastUpdated: new Date().toISOString(),
        todos: []
      };
      
      const wsPath = path.join(WORKSPACES_DIR, workspaceId);
      if (!fs.existsSync(wsPath) && !dryRun) {
        fs.mkdirSync(wsPath, { recursive: true });
      }
      
      const file = path.join(wsPath, `${newProjectId}.json`);
      
      if (dryRun) {
        return {
          success: true, action: 'createProject', projectId: newProjectId, message: 'Dry run successful', data: newProject, dryRun: true,
          changes: { files: [file], todos: [], projectTargeted: newProjectId, description: `Create project ${newProjectId} named '${name}' in workspace ${workspaceId}` }
        };
      }
      
      saveProject(file, newProject);
      
      const logId = logMutation('createProject', true, { projectId: newProjectId }, null);
      return { success: true, logId, action: 'createProject', projectId: newProjectId, message: 'Project created successfully', data: newProject };
    } catch (err: any) {
      logMutation('createProject', false, { error: err.message });
      return { success: false, action: 'createProject', message: 'Failed to create project', error: err.message };
    }
  },

  updateProject(projectId: string, updates: Partial<Project>, dryRun: boolean = false): GatewayResult<Project> {
    try {
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      if (updates.workspace || updates.category) {
        validateWorkspaceAndCategory(
          updates.workspace || project.workspace, 
          updates.category || project.category
        );
      }
      
      const updatedProject = { ...project, ...updates, lastUpdated: new Date().toISOString() };
      // ID cannot be changed
      updatedProject.id = project.id;
      
      let newFile = file;
      if (updates.workspace && updates.workspace !== project.workspace) {
         const newWsPath = path.join(WORKSPACES_DIR, updates.workspace);
         newFile = path.join(newWsPath, path.basename(file));
      }
      
      if (dryRun) {
        return {
          success: true, action: 'updateProject', projectId, message: 'Dry run successful', data: updatedProject, dryRun: true,
          changes: { files: file !== newFile ? [file, newFile] : [file], todos: [], projectTargeted: projectId, description: `Update project ${projectId}` }
        };
      }
      
      saveProject(file, updatedProject);
      
      // If workspace changed, move it.
      if (updates.workspace && updates.workspace !== project.workspace) {
         const newWsPath = path.join(WORKSPACES_DIR, updates.workspace);
         if (!fs.existsSync(newWsPath)) fs.mkdirSync(newWsPath, { recursive: true });
         fs.renameSync(file, newFile);
      }
      
      const logId = logMutation('updateProject', true, { projectId, updates }, previousState);
      return { success: true, logId, action: 'updateProject', projectId, message: 'Project updated successfully', data: updatedProject };
    } catch (err: any) {
      logMutation('updateProject', false, { projectId, error: err.message });
      return { success: false, action: 'updateProject', projectId, message: 'Failed to update project', error: err.message };
    }
  },

  archiveProject(projectId: string, dryRun: boolean = false): GatewayResult<Project> {
    const res = this.updateProject(projectId, { status: 'On Hold' }, dryRun);
    res.action = 'archiveProject';
    return res;
  },
  
  deleteProject(projectId: string, dryRun: boolean = false): GatewayResult {
    try {
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      if (dryRun) {
        return {
          success: true, action: 'deleteProject', projectId, message: 'Dry run successful', dryRun: true,
          changes: { files: [file], todos: project.todos.map(t => t.id), projectTargeted: projectId, description: `Delete project ${projectId}` }
        };
      }
      
      fs.unlinkSync(file);
      
      const logId = logMutation('deleteProject', true, { projectId }, previousState);
      return { success: true, logId, action: 'deleteProject', projectId, message: 'Project deleted successfully' };
    } catch (err: any) {
      logMutation('deleteProject', false, { projectId, error: err.message });
      return { success: false, action: 'deleteProject', projectId, message: 'Failed to delete project', error: err.message };
    }
  },
  
  // Natural Language Layer Parser
  
  undo(logId: string): GatewayResult {
    try {
      const logsDir = path.join(process.cwd(), '.logs');
      if (!fs.existsSync(logsDir)) throw new Error('No logs found');
      
      const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.json')).sort().reverse();
      let foundLog = null;
      
      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          if (!lines[i]) continue;
          const entry = JSON.parse(lines[i]);
          if (entry.logId === logId) {
            foundLog = entry;
            break;
          }
        }
        if (foundLog) break;
      }
      
      if (!foundLog) throw new Error('Log not found for undo');
      if (!foundLog.previousState) throw new Error('No previous state available for undo');
      
      const { action, previousState } = foundLog;
      
      
      if (action === 'addInboxItem') {
         const inboxFile = path.join(DATA_DIR, 'inbox.json');
         fs.writeFileSync(inboxFile, JSON.stringify(previousState, null, 2), 'utf8');
      } else if (action === 'createProject') {

         const { projectId } = foundLog;
         const file = findProjectFile(projectId);
         if (file && fs.existsSync(file)) fs.unlinkSync(file);
      } else if (action === 'moveTodo') {
         const { fromProject, toProject } = previousState;
         const fromWs = path.join(WORKSPACES_DIR, fromProject.workspace);
         if (!fs.existsSync(fromWs)) fs.mkdirSync(fromWs, { recursive: true });
         saveProject(path.join(fromWs, `${fromProject.id}.json`), fromProject);
         
         const toWs = path.join(WORKSPACES_DIR, toProject.workspace);
         if (!fs.existsSync(toWs)) fs.mkdirSync(toWs, { recursive: true });
         saveProject(path.join(toWs, `${toProject.id}.json`), toProject);
      } else {
         const wsPath = path.join(WORKSPACES_DIR, previousState.workspace);
         if (!fs.existsSync(wsPath)) fs.mkdirSync(wsPath, { recursive: true });
         saveProject(path.join(wsPath, `${previousState.id}.json`), previousState);
      }
      
      return { success: true, message: 'Undo successful' };
    } catch (err: any) {
      return { success: false, message: 'Failed to undo', error: err.message };
    }
  },

  dispatchCommand(command: any): GatewayResult {
    if (!command || typeof command.action !== 'string') {
       return { success: false, message: 'Invalid command format' };
    }
    
    const dryRun = !!command.dryRun;
    
    switch (command.action) {
      
      case 'addInboxItem':
        return this.addInboxItem(command.text, dryRun);
      case 'undo':
        return this.undo(command.logId);
      case 'createTodo':

        return this.createTodo(command.projectId, command.text, dryRun);
      case 'completeTodo':
        return this.completeTodo(command.projectId, command.todoId, dryRun);
      case 'renameTodo':
        return this.renameTodo(command.projectId, command.todoId, command.text, dryRun);
      case 'deleteTodo':
        return this.deleteTodo(command.projectId, command.todoId, dryRun);
      case 'moveTodo':
        return this.moveTodo(command.fromProjectId, command.toProjectId, command.todoId, dryRun);
      case 'createProject':
        return this.createProject(command.workspaceId, command.categoryId, command.name, dryRun);
      case 'updateProject':
        return this.updateProject(command.projectId, command.updates, dryRun);
      case 'archiveProject':
        return this.archiveProject(command.projectId, dryRun);
      case 'deleteProject':
        return this.deleteProject(command.projectId, dryRun);
      default:
        return { success: false, message: `Unknown action: ${command.action}` };
    }
  }
};
