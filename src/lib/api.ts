import { Project, WorkspaceData, Todo, Workspace } from '../types';

let projectsStore: Project[] = [];
let workspacesStore: WorkspaceData[] = [];
let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach(l => l());
}

export function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export async function fetchInitialData(): Promise<{ workspaces: WorkspaceData[], projects: Project[] }> {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error('Failed to fetch data');
  const data = await res.json();
  workspacesStore = data.workspaces;
  projectsStore = data.projects;
  notify();
  return data;
}

export async function getWorkspaces(): Promise<Workspace[]> {
  if (workspacesStore.length === 0) {
    await fetchInitialData();
  }
  return workspacesStore.map(ws => {
    const wsProjects = projectsStore.filter(p => p.workspace === ws.id);
    return {
      ...ws,
      projects: wsProjects
    };
  });
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  const workspaces = await getWorkspaces();
  return workspaces.find(w => w.id === id);
}

export async function getProjects(): Promise<Project[]> {
  if (projectsStore.length === 0) {
    await fetchInitialData();
  }
  return projectsStore;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const projects = await getProjects();
  return projects.find(p => p.id === id);
}

// Commands
async function dispatch(action: string, payload: any) {
  const res = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await res.json();
  if (!result.success) {
    throw new Error(result.message || 'Action failed');
  }
  await fetchInitialData();
  return result.data;
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
  return dispatch('updateProject', { projectId, updates });
}

export async function addTodo(projectId: string, text: string): Promise<Todo> {
  return dispatch('createTodo', { projectId, text });
}

export async function toggleTodo(projectId: string, todoId: string): Promise<Todo> {
  return dispatch('completeTodo', { projectId, todoId });
}

export async function renameTodo(projectId: string, todoId: string, newText: string): Promise<Todo> {
  return dispatch('renameTodo', { projectId, todoId, text: newText });
}

export async function removeTodo(projectId: string, todoId: string): Promise<void> {
  await dispatch('deleteTodo', { projectId, todoId });
}

export async function moveTodo(fromProjectId: string, toProjectId: string, todoId: string): Promise<void> {
  await dispatch('moveTodo', { fromProjectId, toProjectId, todoId });
}

export async function addProject(workspaceId: string, categoryId: string): Promise<Project> {
  return dispatch('createProject', { workspaceId, categoryId, name: 'New Project' });
}

export async function deleteProject(projectId: string): Promise<void> {
  await dispatch('deleteProject', { projectId });
}

export async function updateWorkspace(workspaceId: string, updates: Partial<WorkspaceData>): Promise<WorkspaceData> {
  const res = await fetch(`/api/workspaces/${workspaceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update workspace');
  await fetchInitialData();
  return await res.json();
}

