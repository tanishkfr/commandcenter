import { z } from 'zod';

export const TodoSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  completed: z.boolean(),
  createdAt: z.string().datetime().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

export const ProjectStatusSchema = z.enum(['Active', 'Review', 'Shipped', 'On Hold']);

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  workspace: z.string().min(1),
  category: z.string().min(1),
  status: ProjectStatusSchema,
  description: z.string(),
  url: z.string(),
  github: z.string(),
  deployment: z.string(),
  figma: z.string(),
  lastUpdated: z.string().datetime(),
  todos: z.array(TodoSchema)
});

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1)
});

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().optional(),
  categories: z.array(CategorySchema)
});

export type Todo = z.infer<typeof TodoSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type WorkspaceData = z.infer<typeof WorkspaceSchema>;

export interface Workspace extends WorkspaceData {
  projects: Project[];
}
