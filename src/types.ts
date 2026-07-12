export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export type ProjectCategory = 'Products' | 'Research' | 'Systems' | 'Tools';
export type ProjectStatus = 'Active' | 'Review' | 'Shipped' | 'On Hold';

export interface Project {
  id: string;
  name: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  url: string;
  todos: Todo[];
}
