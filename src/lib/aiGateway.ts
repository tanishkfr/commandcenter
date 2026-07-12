import fs from 'fs';
import path from 'path';
import { Project, ProjectSchema, Todo, WorkspaceSchema } from '../types';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const LOGS_DIR = path.join(process.cwd(), '.logs');

export type GatewayResult<T = any> = {
  success: boolean;
  projectId?: string;
  todoId?: string;
  message: string;
  data?: T;
  error?: string;
};

function getLogFile(): string {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  return path.join(LOGS_DIR, `${dateStr}.json`);
}

function appendLog(entry: any) {
  const file = getLogFile();
  const logLine = JSON.stringify(entry) + '\n';
  fs.appendFileSync(file, logLine, 'utf8');
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
  appendLog({
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
  createTodo(projectId: string, text: string): GatewayResult<Todo> {
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
      saveProject(file, project);
      
      logMutation('createTodo', true, { projectId, todoId: newTodo.id }, previousState);
      return { success: true, projectId, todoId: newTodo.id, message: 'Todo created successfully', data: newTodo };
    } catch (err: any) {
      logMutation('createTodo', false, { projectId, error: err.message });
      return { success: false, projectId, message: 'Failed to create todo', error: err.message };
    }
  },

  completeTodo(projectId: string, todoId: string): GatewayResult<Todo> {
    try {
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      const todo = project.todos.find(t => t.id === todoId);
      if (!todo) throw new Error('Todo not found');
      
      todo.completed = !todo.completed;
      project.lastUpdated = new Date().toISOString();
      saveProject(file, project);
      
      logMutation('completeTodo', true, { projectId, todoId }, previousState);
      return { success: true, projectId, todoId, message: 'Todo completion toggled successfully', data: todo };
    } catch (err: any) {
      logMutation('completeTodo', false, { projectId, todoId, error: err.message });
      return { success: false, projectId, todoId, message: 'Failed to complete todo', error: err.message };
    }
  },

  renameTodo(projectId: string, todoId: string, newText: string): GatewayResult<Todo> {
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
      saveProject(file, project);
      
      logMutation('renameTodo', true, { projectId, todoId, newText }, previousState);
      return { success: true, projectId, todoId, message: 'Todo renamed successfully', data: todo };
    } catch (err: any) {
      logMutation('renameTodo', false, { projectId, todoId, error: err.message });
      return { success: false, projectId, todoId, message: 'Failed to rename todo', error: err.message };
    }
  },

  deleteTodo(projectId: string, todoId: string): GatewayResult {
    try {
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      const idx = project.todos.findIndex(t => t.id === todoId);
      if (idx === -1) throw new Error('Todo not found');
      
      project.todos.splice(idx, 1);
      project.lastUpdated = new Date().toISOString();
      saveProject(file, project);
      
      logMutation('deleteTodo', true, { projectId, todoId }, previousState);
      return { success: true, projectId, todoId, message: 'Todo deleted successfully' };
    } catch (err: any) {
      logMutation('deleteTodo', false, { projectId, todoId, error: err.message });
      return { success: false, projectId, todoId, message: 'Failed to delete todo', error: err.message };
    }
  },

  moveTodo(fromProjectId: string, toProjectId: string, todoId: string): GatewayResult {
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
      
      saveProject(fromFile, fromProject);
      saveProject(toFile, toProject);
      
      logMutation('moveTodo', true, { fromProjectId, toProjectId, todoId }, previousState);
      return { success: true, projectId: toProjectId, todoId, message: 'Todo moved successfully' };
    } catch (err: any) {
      logMutation('moveTodo', false, { fromProjectId, toProjectId, todoId, error: err.message });
      return { success: false, message: 'Failed to move todo', error: err.message };
    }
  },

  createProject(workspaceId: string, categoryId: string, name: string): GatewayResult<Project> {
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
      if (!fs.existsSync(wsPath)) {
        fs.mkdirSync(wsPath, { recursive: true });
      }
      
      const file = path.join(wsPath, `${newProjectId}.json`);
      saveProject(file, newProject);
      
      logMutation('createProject', true, { projectId: newProjectId }, null);
      return { success: true, projectId: newProjectId, message: 'Project created successfully', data: newProject };
    } catch (err: any) {
      logMutation('createProject', false, { error: err.message });
      return { success: false, message: 'Failed to create project', error: err.message };
    }
  },

  updateProject(projectId: string, updates: Partial<Project>): GatewayResult<Project> {
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
      
      saveProject(file, updatedProject);
      
      // If workspace changed, we should technically move the file, but for now we just save it in place
      // or move it. Let's move it to ensure folder structure matches workspace.
      if (updates.workspace && updates.workspace !== project.workspace) {
         const newWsPath = path.join(WORKSPACES_DIR, updates.workspace);
         if (!fs.existsSync(newWsPath)) fs.mkdirSync(newWsPath, { recursive: true });
         const newFile = path.join(newWsPath, path.basename(file));
         fs.renameSync(file, newFile);
      }
      
      logMutation('updateProject', true, { projectId, updates }, previousState);
      return { success: true, projectId, message: 'Project updated successfully', data: updatedProject };
    } catch (err: any) {
      logMutation('updateProject', false, { projectId, error: err.message });
      return { success: false, projectId, message: 'Failed to update project', error: err.message };
    }
  },

  archiveProject(projectId: string): GatewayResult<Project> {
    return this.updateProject(projectId, { status: 'On Hold' });
  },
  
  deleteProject(projectId: string): GatewayResult {
    try {
      const file = findProjectFile(projectId);
      if (!file) throw new Error('Project not found');
      
      const project = loadProject(file);
      const previousState = { ...project };
      
      fs.unlinkSync(file);
      
      logMutation('deleteProject', true, { projectId }, previousState);
      return { success: true, projectId, message: 'Project deleted successfully' };
    } catch (err: any) {
      logMutation('deleteProject', false, { projectId, error: err.message });
      return { success: false, projectId, message: 'Failed to delete project', error: err.message };
    }
  },
  
  // Natural Language Layer Parser
  dispatchCommand(command: any): GatewayResult {
    if (!command || typeof command.action !== 'string') {
       return { success: false, message: 'Invalid command format' };
    }
    
    switch (command.action) {
      case 'createTodo':
        return this.createTodo(command.projectId, command.text);
      case 'completeTodo':
        return this.completeTodo(command.projectId, command.todoId);
      case 'renameTodo':
        return this.renameTodo(command.projectId, command.todoId, command.text);
      case 'deleteTodo':
        return this.deleteTodo(command.projectId, command.todoId);
      case 'moveTodo':
        return this.moveTodo(command.fromProjectId, command.toProjectId, command.todoId);
      case 'createProject':
        return this.createProject(command.workspaceId, command.categoryId, command.name);
      case 'updateProject':
        return this.updateProject(command.projectId, command.updates);
      case 'archiveProject':
        return this.archiveProject(command.projectId);
      case 'deleteProject':
        return this.deleteProject(command.projectId);
      default:
        return { success: false, message: `Unknown action: ${command.action}` };
    }
  }
};
