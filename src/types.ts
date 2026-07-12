export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export type ProjectStatus = 'Active' | 'Review' | 'Shipped' | 'On Hold';

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ProjectStatus;
  url: string;
  todos: Todo[];
}

export interface Workspace {
  id: string;
  name: string;
  color?: string;
  categories: string[];
  projects: Project[];
}
