import { Project, WorkspaceData, Todo } from '../types.js';

export type ParseResult = 
  | { success: true; command: any }
  | { success: false; reason: string; options?: string[] };

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

import { ActiveContext } from './contextManager.js';

export class CommandParser {
  workspaces: WorkspaceData[];
  projects: Project[];

  private context?: ActiveContext;
  constructor(workspaces: WorkspaceData[], projects: Project[], context?: ActiveContext) {
    this.workspaces = workspaces;
    this.projects = projects;
    this.context = context;
  }

  private resolveProject(name: string): { success: true, id: string } | { success: false, reason: string, options?: string[] } {
    const norm = normalize(name);
    if (!norm) return { success: false, reason: 'Empty project name provided.' };
    const matches = this.projects.filter(p => {
      const n = normalize(p.name);
      return n === norm || n.includes(norm);
    });

    if (matches.length === 0) return { success: false, reason: `No project matched '${name}'.` };
    
    // Check for exact match
    const exact = matches.filter(p => normalize(p.name) === norm);
    if (exact.length === 1) return { success: true, id: exact[0].id };
    if (exact.length > 1) return { success: false, reason: "Multiple projects matched.", options: exact.map(p => p.name) };

    if (matches.length === 1) return { success: false, reason: 'Did you mean', options: [(matches[0] as any).name || (matches[0] as any).text] };
    return { success: false, reason: "Multiple projects matched.", options: matches.map(p => p.name) };
  }

  private resolveTodo(projectId: string, text: string): { success: true, id: string } | { success: false, reason: string, options?: string[] } {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return { success: false, reason: `Project not found for resolving todo.` };
    
    const norm = normalize(text);
    if (!norm) return { success: false, reason: 'Empty todo text provided.' };
    const matches = project.todos.filter(t => {
      const n = normalize(t.text);
      return n === norm || n.includes(norm);
    });

    if (matches.length === 0) return { success: false, reason: `No todo matched '${text}'.` };
    
    const exact = matches.filter(t => normalize(t.text) === norm);
    if (exact.length === 1) return { success: true, id: exact[0].id };
    if (exact.length > 1) return { success: false, reason: "Multiple todos matched.", options: exact.map(t => t.text) };

    if (matches.length === 1) return { success: false, reason: 'Did you mean', options: [(matches[0] as any).name || (matches[0] as any).text] };
    return { success: false, reason: "Multiple todos matched.", options: matches.map(t => t.text) };
  }

  private resolveWorkspace(name: string): { success: true, id: string } | { success: false, reason: string, options?: string[] } {
    const norm = normalize(name);
    if (!norm) return { success: false, reason: 'Empty workspace name provided.' };
    const matches = this.workspaces.filter(w => {
      const n = normalize(w.name);
      return n === norm || n.includes(norm);
    });

    if (matches.length === 0) return { success: false, reason: `No workspace matched '${name}'.` };
    
    const exact = matches.filter(w => normalize(w.name) === norm);
    if (exact.length === 1) return { success: true, id: exact[0].id };
    if (exact.length > 1) return { success: false, reason: "Multiple workspaces matched.", options: exact.map(w => w.name) };

    if (matches.length === 1) return { success: false, reason: 'Did you mean', options: [(matches[0] as any).name || (matches[0] as any).text] };
    return { success: false, reason: "Multiple workspaces matched.", options: matches.map(w => w.name) };
  }

  private resolveCategory(workspaceId: string, name: string): { success: true, id: string } | { success: false, reason: string, options?: string[] } {
    const ws = this.workspaces.find(w => w.id === workspaceId);
    if (!ws) return { success: false, reason: `Workspace not found.` };
    
    const norm = normalize(name);
    if (!norm) return { success: false, reason: 'Empty category name provided.' };
    const matches = ws.categories.filter(c => {
      const n = normalize(c.name);
      return n === norm || n.includes(norm);
    });

    if (matches.length === 0) return { success: false, reason: `No category matched '${name}'.` };
    
    const exact = matches.filter(c => normalize(c.name) === norm);
    if (exact.length === 1) return { success: true, id: exact[0].id };
    if (exact.length > 1) return { success: false, reason: "Multiple categories matched.", options: exact.map(c => c.name) };

    if (matches.length === 1) return { success: false, reason: 'Did you mean', options: [(matches[0] as any).name || (matches[0] as any).text] };
    return { success: false, reason: "Multiple categories matched.", options: matches.map(c => c.name) };
  }

  parse(nl: string): ParseResult {
    const cp = this.context?.currentProject;

    // 0. Inbox / Remember this
    let match = nl.match(/^(?:remember|inbox) (?:this )?['"]?(.+?)['"]?\.?$/i) ||
            nl.match(/add ['"]?(.+?)['"]? to (?:my )?inbox\.?$/i);
    if (match) {
      return { success: true, command: { action: 'addInboxItem', text: match[1] } };
    }
    
    // 1. Add todo
    match = nl.match(/add (?:a |new )?todo (?:called |named )?['"]?(.+?)['"]? to (?:project )?['"]?(.+?)['"]?\.?$/i) ||
                nl.match(/add ['"]?(.+?)['"]? to (?:project )?['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, text, projectName] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      return { success: true, command: { action: 'createTodo', projectId: projRes.id, text } };
    }
    
    // 1b. Add todo with context
    match = nl.match(/add (?:a |new )?todo (?:called |named )?['"]?(.+?)['"]?\.?$/i) ||
            nl.match(/^add ['"]?(.+?)['"]?\.?$/i);
    if (match && cp) {
      return { success: true, command: { action: 'createTodo', projectId: cp, text: match[1] } };
    } else if (match && !cp) {
      return { success: false, reason: "No active project in context. Please specify a project." };
    }

    // 2. Complete a todo
    match = nl.match(/complete (?:todo )?['"]?(.+?)['"]? in (?:project )?['"]?(.+?)['"]?\.?$/i) ||
            nl.match(/complete ['"]?(.+?)['"]? in (?:project )?['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, todoName, projectName] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      const todoRes = this.resolveTodo(projRes.id, todoName);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'completeTodo', projectId: projRes.id, todoId: todoRes.id } };
    }
    
    // 2b. Complete a todo with context
    match = nl.match(/complete (?:todo )?['"]?(.+?)['"]?\.?$/i) ||
            nl.match(/^complete ['"]?(.+?)['"]?\.?$/i);
    if (match && cp) {
      const todoRes = this.resolveTodo(cp, match[1]);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'completeTodo', projectId: cp, todoId: todoRes.id } };
    } else if (match && !cp) {
      return { success: false, reason: "No active project in context. Please specify a project." };
    }
    
    // 3. Rename a todo
    match = nl.match(/rename (?:todo )?['"]?(.+?)['"]? in (?:project )?['"]?(.+?)['"]? to ['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, todoName, projectName, newText] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      const todoRes = this.resolveTodo(projRes.id, todoName);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'renameTodo', projectId: projRes.id, todoId: todoRes.id, text: newText } };
    }

    // 3b. Rename a todo with context
    match = nl.match(/rename (?:todo )?['"]?(.+?)['"]? to ['"]?(.+?)['"]?\.?$/i);
    if (match && cp) {
      const [, todoName, newText] = match;
      const todoRes = this.resolveTodo(cp, todoName);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'renameTodo', projectId: cp, todoId: todoRes.id, text: newText } };
    }

    // 4. Delete a todo
    match = nl.match(/delete (?:todo )?['"]?(.+?)['"]? in (?:project )?['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, todoName, projectName] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      const todoRes = this.resolveTodo(projRes.id, todoName);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'deleteTodo', projectId: projRes.id, todoId: todoRes.id } };
    }

    // 4b. Delete a todo with context
    match = nl.match(/delete (?:todo )?['"]?(.+?)['"]?\.?$/i);
    if (match && cp) {
      const todoRes = this.resolveTodo(cp, match[1]);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'deleteTodo', projectId: cp, todoId: todoRes.id } };
    }

    // 5. Move a todo
    match = nl.match(/move (?:todo )?['"]?(.+?)['"]? from (?:project )?['"]?(.+?)['"]? to (?:project )?['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, todoName, fromProjName, toProjName] = match;
      const fromProjRes = this.resolveProject(fromProjName);
      if (!fromProjRes.success) return { success: false, reason: `From project: ${(fromProjRes as any).reason}`, options: (fromProjRes as any).options };
      const toProjRes = this.resolveProject(toProjName);
      if (!toProjRes.success) return { success: false, reason: `To project: ${(toProjRes as any).reason}`, options: (toProjRes as any).options };
      
      const todoRes = this.resolveTodo(fromProjRes.id, todoName);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'moveTodo', fromProjectId: fromProjRes.id, toProjectId: toProjRes.id, todoId: todoRes.id } };
    }


    // 5b. Move a todo with context
    match = nl.match(/move (?:todo )?['"]?(.+?)['"]? to (?:project )?['"]?(.+?)['"]?\.?$/i);
    if (match && cp) {
      const [, todoName, toProjName] = match;
      const toProjRes = this.resolveProject(toProjName);
      if (!toProjRes.success) return { success: false, reason: `To project: ${(toProjRes as any).reason}`, options: (toProjRes as any).options };
      
      const todoRes = this.resolveTodo(cp, todoName);
      if (!todoRes.success) return { success: false, reason: (todoRes as any).reason, options: (todoRes as any).options };
      return { success: true, command: { action: 'moveTodo', fromProjectId: cp, toProjectId: toProjRes.id, todoId: todoRes.id } };
    }

    // 6. Create project
    match = nl.match(/create project ['"]?(.+?)['"]? in (?:workspace )?['"]?(.+?)['"]? under (?:category )?['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, name, workspaceName, categoryName] = match;
      const wsRes = this.resolveWorkspace(workspaceName);
      if (!wsRes.success) return { success: false, reason: (wsRes as any).reason, options: (wsRes as any).options };
      const catRes = this.resolveCategory(wsRes.id, categoryName);
      if (!catRes.success) return { success: false, reason: (catRes as any).reason, options: (catRes as any).options };
      return { success: true, command: { action: 'createProject', workspaceId: wsRes.id, categoryId: catRes.id, name } };
    }

    // 6b. Create project with context (uses current workspace and category if available)
    match = nl.match(/create project ['"]?(.+?)['"]?\.?$/i);
    if (match && this.context?.currentWorkspace && this.context?.currentCategory) {
       return { success: true, command: { action: 'createProject', workspaceId: this.context.currentWorkspace, categoryId: this.context.currentCategory, name: match[1] } };
    }

    // 7. Archive project
    match = nl.match(/archive project ['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, projectName] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      return { success: true, command: { action: 'archiveProject', projectId: projRes.id } };
    }

    // 7b. Archive project with context
    match = nl.match(/archive project\.?$/i);
    if (match && cp) {
      return { success: true, command: { action: 'archiveProject', projectId: cp } };
    }

    // 8. Update project status
    match = nl.match(/update status of project ['"]?(.+?)['"]? to ['"]?(.+?)['"]?\.?$/i) || nl.match(/change status of project ['"]?(.+?)['"]? to ['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, projectName, status] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      return { success: true, command: { action: 'updateProject', projectId: projRes.id, updates: { status } } };
    }

    // 8b. Update project status with context
    match = nl.match(/update status to ['"]?(.+?)['"]?\.?$/i) || nl.match(/change status to ['"]?(.+?)['"]?\.?$/i);
    if (match && cp) {
      return { success: true, command: { action: 'updateProject', projectId: cp, updates: { status: match[1] } } };
    }

    // 9. Update description
    match = nl.match(/(?:update|change) (?:the )?description of project ['"]?(.+?)['"]? to ['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, projectName, description] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      return { success: true, command: { action: 'updateProject', projectId: projRes.id, updates: { description } } };
    }

    // 10. Change workspace
    match = nl.match(/move project ['"]?(.+?)['"]? to workspace ['"]?(.+?)['"]? under category ['"]?(.+?)['"]?\.?$/i);
    if (match) {
      const [, projectName, workspaceName, categoryName] = match;
      const projRes = this.resolveProject(projectName);
      if (!projRes.success) return { success: false, reason: (projRes as any).reason, options: (projRes as any).options };
      const wsRes = this.resolveWorkspace(workspaceName);
      if (!wsRes.success) return { success: false, reason: (wsRes as any).reason, options: (wsRes as any).options };
      const catRes = this.resolveCategory(wsRes.id, categoryName);
      if (!catRes.success) return { success: false, reason: (catRes as any).reason, options: (catRes as any).options };
      return { success: true, command: { action: 'updateProject', projectId: projRes.id, updates: { workspace: wsRes.id, category: catRes.id } } };
    }
    
    return { success: false, reason: "Command not understood." };
  }
}
