import { describe, it, expect } from 'vitest';
import { CommandParser } from './commandParser.js';

describe('CommandParser', () => {
  const workspaces = [
    {
      id: 'ws_1',
      name: 'Personal',
      icon: 'User',
      categories: [
        { id: 'cat_1', name: 'Inbox' }
      ]
    },
    {
      id: 'ws_2',
      name: 'Work',
      icon: 'Briefcase',
      categories: [
        { id: 'cat_2', name: 'Active' },
        { id: 'cat_3', name: 'Backlog' }
      ]
    }
  ];

  const projects: any[] = [
    {
      id: 'proj_1',
      name: 'Design or Disaster',
      workspace: 'ws_1',
      category: 'cat_1',
      todos: [
        { id: 'todo_1', text: 'Rewrite onboarding narrative' },
        { id: 'todo_2', text: 'Add a new feature' }
      ]
    },
    {
      id: 'proj_2',
      name: 'Interaction Atlas',
      workspace: 'ws_2',
      category: 'cat_2',
      todos: []
    },
    {
      id: 'proj_3',
      name: 'Atlas',
      workspace: 'ws_2',
      category: 'cat_3',
      todos: []
    }
  ];

  const parser = new CommandParser(workspaces, projects);

  it('parses add todo', () => {
    const res = parser.parse("Add 'Rewrite onboarding narrative' to Design or Disaster.");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'createTodo', projectId: 'proj_1', text: 'Rewrite onboarding narrative' });
    }
  });

  it('parses complete todo', () => {
    const res = parser.parse("Complete 'Rewrite onboarding narrative' in Design or Disaster");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'completeTodo', projectId: 'proj_1', todoId: 'todo_1' });
    }
  });

  it('handles ambiguous projects', () => {
    const res = parser.parse("Archive project Atl");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.reason).toBe('Multiple projects matched.');
      expect(res.options).toContain('Interaction Atlas');
      expect(res.options).toContain('Atlas');
    }
  });

  it('handles exact match in ambiguous projects', () => {
    // Both 'Atlas' and 'Interaction Atlas' match 'Atlas' string if we just use 'includes'.
    // But 'Atlas' is an exact match for 'proj_3'. Let's see if the logic prefers exact matches.
    // In our logic: if exact matches exist, it uses exact matches. So 'Atlas' should exact-match 'proj_3'.
    const parserExact = new CommandParser(workspaces, projects);
    const res = parserExact.parse("Archive project Atlas");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command.projectId).toBe('proj_3');
    }
  });

  it('handles ambiguous partial match', () => {
    const res = parser.parse("Archive project Atl");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.reason).toBe('Multiple projects matched.');
      expect(res.options).toContain('Interaction Atlas');
      expect(res.options).toContain('Atlas');
    }
  });
  
  it('parses move todo', () => {
    const res = parser.parse("Move todo 'Rewrite onboarding narrative' from Design or Disaster to Interaction Atlas");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'moveTodo', fromProjectId: 'proj_1', toProjectId: 'proj_2', todoId: 'todo_1' });
    }
  });

  it('parses create project', () => {
    const res = parser.parse("Create project 'New App' in workspace 'Personal' under category 'Inbox'");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'createProject', workspaceId: 'ws_1', categoryId: 'cat_1', name: 'New App' });
    }
  });

  it('parses archive project', () => {
    const res = parser.parse("Archive project 'Interaction Atlas'");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'archiveProject', projectId: 'proj_2' });
    }
  });

  it('parses update project status', () => {
    const res = parser.parse("Update status of project 'Interaction Atlas' to 'Completed'");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'updateProject', projectId: 'proj_2', updates: { status: 'Completed' } });
    }
  });

  it('parses update project description', () => {
    const res = parser.parse("Change the description of project 'Interaction Atlas' to 'This is a test'");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'updateProject', projectId: 'proj_2', updates: { description: 'This is a test' } });
    }
  });

  it('parses change workspace', () => {
    const res = parser.parse("Move project 'Interaction Atlas' to workspace 'Personal' under category 'Inbox'");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.command).toEqual({ action: 'updateProject', projectId: 'proj_2', updates: { workspace: 'ws_1', category: 'cat_1' } });
    }
  });
});
