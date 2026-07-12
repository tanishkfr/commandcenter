import fs from 'fs';
import path from 'path';
import { Project, ProjectSchema, Todo, WorkspaceSchema } from '../types.js';
import { dataStore } from './dataStore.js';

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

async function appendLog(entry: any) {
  const logId = "log_" + Date.now();
  entry.logId = logId;
  const file = getLogFile();
  const logLine = JSON.stringify(entry) + '\n';
  await fs.promises.appendFile(file, logLine, 'utf8');
  return logId;
}

async function logMutation(action: string, success: boolean, details: any, previousState?: any) {
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
  
  async addInboxItem(text: string, dryRun: boolean = false): Promise<GatewayResult> {
    try {
      const inbox = await dataStore.readInbox();
      
      const newItem = {
        id: getNewId('inbox'),
        text,
        createdAt: new Date().toISOString()
      };
      
      if (dryRun) {
        return {
          success: true, action: 'addInboxItem', message: 'Dry run successful', dryRun: true, data: newItem,
          changes: { files: ['inbox.json'], todos: [newItem.id], projectTargeted: 'inbox', description: `Add item to inbox: '${text}'` }
        };
      }
      
      const previousState = [...inbox];
      inbox.push(newItem);
      await dataStore.writeInbox(inbox);
      
      const logId = await logMutation('addInboxItem', true, { itemId: newItem.id }, previousState);
      return { success: true, logId, action: 'addInboxItem', message: 'Added to inbox successfully', data: newItem };
    } catch (err: any) {
      await logMutation('addInboxItem', false, { error: err.message });
      return { success: false, action: 'addInboxItem', message: 'Failed to add to inbox', error: err.message };
    }
  },

  async createTodo(projectId: string, text: string, dryRun: boolean = false): Promise<GatewayResult<Todo>> {
    try {
      if (!text) throw new Error('Todo text cannot be empty');
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');
      
      const previousState = { ...project };
      
      const newTodo: Todo = {
        id: getNewId('todo'),
        text,
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      if (project.todos.some(t => t.id === newTodo.id)) {
        throw new Error(`Duplicate todo ID generated: ${newTodo.id}`);
      }
      
      project.todos.push(newTodo);
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'createTodo', projectId, todoId: newTodo.id, message: 'Dry run successful', data: newTodo, dryRun: true,
          changes: { files: [`${project.id}.json`], todos: [newTodo.id], projectTargeted: projectId, description: `Create todo '${text}' in project ${projectId}` }
        };
      }
      
      await dataStore.writeProject(project.workspace, project);
      
      const logId = await logMutation('createTodo', true, { projectId, todoId: newTodo.id }, previousState);
      return { success: true, logId, action: 'createTodo', projectId, todoId: newTodo.id, message: 'Todo created successfully', data: newTodo };
    } catch (err: any) {
      await logMutation('createTodo', false, { projectId, error: err.message });
      return { success: false, action: 'createTodo', projectId, message: 'Failed to create todo', error: err.message };
    }
  },

  async completeTodo(projectId: string, todoId: string, dryRun: boolean = false): Promise<GatewayResult<Todo>> {
    try {
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');
      
      const previousState = { ...project };
      
      const todo = project.todos.find(t => t.id === todoId);
      if (!todo) throw new Error('Todo not found');
      
      todo.completed = !todo.completed;
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'completeTodo', projectId, todoId, message: 'Dry run successful', data: todo, dryRun: true,
          changes: { files: [`${project.id}.json`], todos: [todoId], projectTargeted: projectId, description: `Toggle completion of todo ${todoId} in project ${projectId}` }
        };
      }
      
      await dataStore.writeProject(project.workspace, project);
      
      const logId = await logMutation('completeTodo', true, { projectId, todoId }, previousState);
      return { success: true, logId, action: 'completeTodo', projectId, todoId, message: 'Todo completion toggled successfully', data: todo };
    } catch (err: any) {
      await logMutation('completeTodo', false, { projectId, todoId, error: err.message });
      return { success: false, action: 'completeTodo', projectId, todoId, message: 'Failed to complete todo', error: err.message };
    }
  },

  async renameTodo(projectId: string, todoId: string, newText: string, dryRun: boolean = false): Promise<GatewayResult<Todo>> {
    try {
      if (!newText) throw new Error('Todo text cannot be empty');
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');
      
      const previousState = { ...project };
      
      const todo = project.todos.find(t => t.id === todoId);
      if (!todo) throw new Error('Todo not found');
      
      todo.text = newText;
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'renameTodo', projectId, todoId, message: 'Dry run successful', data: todo, dryRun: true,
          changes: { files: [`${project.id}.json`], todos: [todoId], projectTargeted: projectId, description: `Rename todo ${todoId} to '${newText}' in project ${projectId}` }
        };
      }
      
      await dataStore.writeProject(project.workspace, project);
      
      const logId = await logMutation('renameTodo', true, { projectId, todoId, newText }, previousState);
      return { success: true, logId, action: 'renameTodo', projectId, todoId, message: 'Todo renamed successfully', data: todo };
    } catch (err: any) {
      await logMutation('renameTodo', false, { projectId, todoId, error: err.message });
      return { success: false, action: 'renameTodo', projectId, todoId, message: 'Failed to rename todo', error: err.message };
    }
  },

  async deleteTodo(projectId: string, todoId: string, dryRun: boolean = false): Promise<GatewayResult> {
    try {
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');
      
      const previousState = { ...project };
      
      const idx = project.todos.findIndex(t => t.id === todoId);
      if (idx === -1) throw new Error('Todo not found');
      
      project.todos.splice(idx, 1);
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'deleteTodo', projectId, todoId, message: 'Dry run successful', dryRun: true,
          changes: { files: [`${project.id}.json`], todos: [todoId], projectTargeted: projectId, description: `Delete todo ${todoId} from project ${projectId}` }
        };
      }
      
      await dataStore.writeProject(project.workspace, project);
      
      const logId = await logMutation('deleteTodo', true, { projectId, todoId }, previousState);
      return { success: true, logId, action: 'deleteTodo', projectId, todoId, message: 'Todo deleted successfully' };
    } catch (err: any) {
      await logMutation('deleteTodo', false, { projectId, todoId, error: err.message });
      return { success: false, action: 'deleteTodo', projectId, todoId, message: 'Failed to delete todo', error: err.message };
    }
  },

  async moveTodo(fromProjectId: string, toProjectId: string, todoId: string, dryRun: boolean = false): Promise<GatewayResult> {
    try {
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const fromProject = projects.find(p => p.id === fromProjectId);
      const toProject = projects.find(p => p.id === toProjectId);
      
      if (!fromProject) throw new Error('Source project not found');
      if (!toProject) throw new Error('Target project not found');
      
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
          changes: { files: [`${fromProject.id}.json`, `${toProject.id}.json`], todos: [todoId], projectTargeted: toProjectId, description: `Move todo ${todoId} from ${fromProjectId} to ${toProjectId}` }
        };
      }
      
      await dataStore.writeProject(fromProject.workspace, fromProject);
      await dataStore.writeProject(toProject.workspace, toProject);
      
      const logId = await logMutation('moveTodo', true, { fromProjectId, toProjectId, todoId }, previousState);
      return { success: true, logId, action: 'moveTodo', projectId: toProjectId, todoId, message: 'Todo moved successfully' };
    } catch (err: any) {
      await logMutation('moveTodo', false, { fromProjectId, toProjectId, todoId, error: err.message });
      return { success: false, action: 'moveTodo', message: 'Failed to move todo', error: err.message };
    }
  },

  async createProject(workspaceId: string, categoryId: string, name: string, dryRun: boolean = false): Promise<GatewayResult<Project>> {
    try {
      const workspaces = await dataStore.readWorkspaces();
      const ws = workspaces.find(w => w.id === workspaceId);
      if (!ws) throw new Error(`Invalid workspace: ${workspaceId}`);
      if (!ws.categories.some(c => c.id === categoryId)) {
        throw new Error(`Invalid category: ${categoryId} in workspace ${workspaceId}`);
      }
      
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
      
      if (dryRun) {
        return {
          success: true, action: 'createProject', projectId: newProjectId, message: 'Dry run successful', data: newProject, dryRun: true,
          changes: { files: [`${newProjectId}.json`], todos: [], projectTargeted: newProjectId, description: `Create project ${newProjectId} named '${name}' in workspace ${workspaceId}` }
        };
      }
      
      await dataStore.writeProject(workspaceId, newProject);
      
      const logId = await logMutation('createProject', true, { projectId: newProjectId }, null);
      return { success: true, logId, action: 'createProject', projectId: newProjectId, message: 'Project created successfully', data: newProject };
    } catch (err: any) {
      await logMutation('createProject', false, { error: err.message });
      return { success: false, action: 'createProject', message: 'Failed to create project', error: err.message };
    }
  },

  async updateProject(projectId: string, updates: Partial<Project>, dryRun: boolean = false): Promise<GatewayResult<Project>> {
    try {
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');
      
      const previousState = { ...project };
      
      if (updates.workspace || updates.category) {
        const workspaces = await dataStore.readWorkspaces();
        const targetWsId = updates.workspace || project.workspace;
        const targetCatId = updates.category || project.category;
        
        const ws = workspaces.find(w => w.id === targetWsId);
        if (!ws) throw new Error(`Invalid workspace: ${targetWsId}`);
        if (!ws.categories.some(c => c.id === targetCatId)) {
          throw new Error(`Invalid category: ${targetCatId} in workspace ${targetWsId}`);
        }
      }
      
      const updatedProject = { ...project, ...updates, lastUpdated: new Date().toISOString() };
      // ID cannot be changed
      updatedProject.id = project.id;
      
      if (dryRun) {
        return {
          success: true, action: 'updateProject', projectId, message: 'Dry run successful', data: updatedProject, dryRun: true,
          changes: { files: [`${project.id}.json`], todos: [], projectTargeted: projectId, description: `Update project ${projectId}` }
        };
      }
      
      if (updates.workspace && updates.workspace !== project.workspace) {
        await dataStore.writeProject(updates.workspace, updatedProject);
        await dataStore.deleteProject(project.workspace, project.id);
      } else {
        await dataStore.writeProject(project.workspace, updatedProject);
      }
      
      const logId = await logMutation('updateProject', true, { projectId, updates }, previousState);
      return { success: true, logId, action: 'updateProject', projectId, message: 'Project updated successfully', data: updatedProject };
    } catch (err: any) {
      await logMutation('updateProject', false, { projectId, error: err.message });
      return { success: false, action: 'updateProject', projectId, message: 'Failed to update project', error: err?.name === 'ZodError' ? 'Schema validation failed: ' + err.message : err.message };
    }
  },

  async archiveProject(projectId: string, dryRun: boolean = false): Promise<GatewayResult<Project>> {
    const res = await this.updateProject(projectId, { status: 'On Hold' }, dryRun);
    res.action = 'archiveProject';
    return res;
  },
  
  async deleteProject(projectId: string, dryRun: boolean = false): Promise<GatewayResult> {
    try {
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');
      
      const previousState = { ...project };
      
      if (dryRun) {
        return {
          success: true, action: 'deleteProject', projectId, message: 'Dry run successful', dryRun: true,
          changes: { files: [`${project.id}.json`], todos: project.todos.map(t => t.id), projectTargeted: projectId, description: `Delete project ${projectId}` }
        };
      }
      
      await dataStore.deleteProject(project.workspace, project.id);
      
      const logId = await logMutation('deleteProject', true, { projectId }, previousState);
      return { success: true, logId, action: 'deleteProject', projectId, message: 'Project deleted successfully' };
    } catch (err: any) {
      await logMutation('deleteProject', false, { projectId, error: err.message });
      return { success: false, action: 'deleteProject', projectId, message: 'Failed to delete project', error: err.message };
    }
  },
  
  async undo(logId: string): Promise<GatewayResult> {
    try {
      if (!fs.existsSync(LOGS_DIR)) throw new Error('No logs found');
      
      const files = await fs.promises.readdir(LOGS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
      let foundLog = null;
      
      for (const file of jsonFiles) {
        const filePath = path.join(LOGS_DIR, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        const lines = data.trim().split('\n');
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
      
      if (action === 'moveInboxItem') {
         const { inbox, project } = previousState;
         await dataStore.writeInbox(inbox);
         await dataStore.writeProject(project.workspace, project);
      } else if (action === 'addInboxItem') {
         await dataStore.writeInbox(previousState);
      } else if (action === 'createProject') {
         const { projectId } = foundLog;
         const { projects } = await dataStore.getWorkspacesAndProjects();
         const proj = projects.find(p => p.id === projectId);
         if (proj) {
           await dataStore.deleteProject(proj.workspace, projectId);
         }
      } else if (action === 'moveTodo') {
         const { fromProject, toProject } = previousState;
         await dataStore.writeProject(fromProject.workspace, fromProject);
         await dataStore.writeProject(toProject.workspace, toProject);
      } else {
         await dataStore.writeProject(previousState.workspace, previousState);
      }
      
      return { success: true, message: 'Undo successful' };
    } catch (err: any) {
      return { success: false, message: 'Failed to undo', error: err.message };
    }
  },

  
  async moveInboxItem(inboxItemId: string, projectId: string, dryRun: boolean = false): Promise<GatewayResult> {
    try {
      const inbox = await dataStore.readInbox();
      const idx = inbox.findIndex(i => i.id === inboxItemId);
      if (idx === -1) throw new Error('Inbox item not found');
      
      const { projects } = await dataStore.getWorkspacesAndProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');
      
      const previousState = { inbox: [...inbox], project: { ...project } };
      
      const [item] = inbox.splice(idx, 1);
      
      const newTodo: Todo = {
        id: getNewId('todo'),
        text: item.text,
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      project.todos.push(newTodo);
      project.lastUpdated = new Date().toISOString();
      
      if (dryRun) {
        return {
          success: true, action: 'moveInboxItem', projectId, message: 'Dry run successful', dryRun: true, data: newTodo,
          changes: { files: ['inbox.json', `${project.id}.json`], todos: [newTodo.id], projectTargeted: projectId, description: `Move inbox item ${inboxItemId} to project ${projectId}` }
        };
      }
      
      await dataStore.writeInbox(inbox);
      await dataStore.writeProject(project.workspace, project);
      
      const logId = await logMutation('moveInboxItem', true, { inboxItemId, projectId, newTodoId: newTodo.id }, previousState);
      return { success: true, logId, action: 'moveInboxItem', projectId, todoId: newTodo.id, message: 'Inbox item moved to project successfully', data: newTodo };
    } catch (err: any) {
      await logMutation('moveInboxItem', false, { inboxItemId, projectId, error: err.message });
      return { success: false, action: 'moveInboxItem', message: 'Failed to move inbox item', error: err.message };
    }
  },

  async dispatchCommand(command: any): Promise<GatewayResult> {
    if (!command || typeof command.action !== 'string') {
       return { success: false, message: 'Invalid command format' };
    }
    
    const dryRun = !!command.dryRun;
    
    switch (command.action) {
      case 'createInboxItem':
      case 'addInboxItem':
        return await this.addInboxItem(command.text, dryRun);
      case 'moveInboxItem':
        return await this.moveInboxItem(command.inboxItemId, command.projectId, dryRun);
        return await this.addInboxItem(command.text, dryRun);
      case 'undo':
        return await this.undo(command.logId);
      case 'createTodo':
        return await this.createTodo(command.projectId, command.text, dryRun);
      case 'completeTodo':
        return await this.completeTodo(command.projectId, command.todoId, dryRun);
      case 'renameTodo':
        return await this.renameTodo(command.projectId, command.todoId, command.text, dryRun);
      case 'deleteTodo':
        return await this.deleteTodo(command.projectId, command.todoId, dryRun);
      case 'moveTodo':
        return await this.moveTodo(command.fromProjectId, command.toProjectId, command.todoId, dryRun);
      case 'createProject':
        return await this.createProject(command.workspaceId, command.categoryId, command.name, dryRun);
      case 'updateProject':
        return await this.updateProject(command.projectId, command.updates, dryRun);
      case 'archiveProject':
        return await this.archiveProject(command.projectId, dryRun);
      case 'deleteProject':
        return await this.deleteProject(command.projectId, dryRun);
      default:
        return { success: false, message: `Unknown action: ${command.action}` };
    }
  }
};
