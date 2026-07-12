import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { aiGateway } from './aiGateway.js';
import fs from 'fs';
import path from 'path';

const TEST_DATA_DIR = path.join(process.cwd(), 'src/data');
const WORKSPACES_DIR = path.join(TEST_DATA_DIR, 'workspaces');
const LOGS_DIR = path.join(process.cwd(), '.logs');

describe('AI Gateway', () => {
  // Use real filesystem for testing since it's the simplest way to test the actual integration
  let testProjectId: string;
  let testWorkspaceId: string;
  let testCategoryId: string;

  beforeEach(async () => {
    // Note: in a real environment we would mock fs, but for this demo let's use the actual test data
    // assuming 'personal' workspace and 'inbox' category exist.
    const wsData = JSON.parse(fs.readFileSync(path.join(TEST_DATA_DIR, 'workspaces.json'), 'utf-8'));
    testWorkspaceId = wsData[0].id;
    testCategoryId = wsData[0].categories[0].id;

    const res = await aiGateway.createProject(testWorkspaceId, testCategoryId, 'Test Project');
    testProjectId = res.projectId!;
  });

  afterEach(async () => {
    // cleanup
    await aiGateway.deleteProject(testProjectId);
  });

  it('should create a todo', async () => {
    const res = await aiGateway.createTodo(testProjectId, 'New test todo');
    expect((res as any).success).toBe(true);
    expect((res as any).todoId).toBeDefined();
    
    // Verify it was saved
    const projectPath = path.join(WORKSPACES_DIR, testWorkspaceId, `${testProjectId}.json`);
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    expect(project.todos.length).toBe(1);
    expect(project.todos[0].text).toBe('New test todo');
  });

  it('should complete a todo', async () => {
    const todoRes = await aiGateway.createTodo(testProjectId, 'To be completed');
    const res = await aiGateway.completeTodo(testProjectId, todoRes.todoId!);
    expect((res as any).success).toBe(true);

    const projectPath = path.join(WORKSPACES_DIR, testWorkspaceId, `${testProjectId}.json`);
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    expect(project.todos[0].completed).toBe(true);
  });

  it('should rename a todo', async () => {
    const todoRes = await aiGateway.createTodo(testProjectId, 'To be renamed');
    const res = await aiGateway.renameTodo(testProjectId, todoRes.todoId!, 'Renamed');
    expect((res as any).success).toBe(true);

    const projectPath = path.join(WORKSPACES_DIR, testWorkspaceId, `${testProjectId}.json`);
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    expect(project.todos[0].text).toBe('Renamed');
  });

  it('should move a todo', async () => {
    const p2Res = await aiGateway.createProject(testWorkspaceId, testCategoryId, 'Target Project');
    const p2Id = p2Res.projectId!;

    const todoRes = await aiGateway.createTodo(testProjectId, 'To be moved');
    const todoId = todoRes.todoId!;

    const res = await aiGateway.moveTodo(testProjectId, p2Id, todoId);
    expect((res as any).success).toBe(true);

    // Verify removed from source
    const project1 = JSON.parse(fs.readFileSync(path.join(WORKSPACES_DIR, testWorkspaceId, `${testProjectId}.json`), 'utf-8'));
    expect(project1.todos.length).toBe(0);

    // Verify added to target
    const project2 = JSON.parse(fs.readFileSync(path.join(WORKSPACES_DIR, testWorkspaceId, `${p2Id}.json`), 'utf-8'));
    expect(project2.todos.length).toBe(1);
    expect(project2.todos[0].id).toBe(todoId);

    await aiGateway.deleteProject(p2Id);
  });

  it('should archive a project', async () => {
    const res = await aiGateway.archiveProject(testProjectId);
    expect((res as any).success).toBe(true);

    const projectPath = path.join(WORKSPACES_DIR, testWorkspaceId, `${testProjectId}.json`);
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    expect(project.status).toBe('On Hold');
  });

  it('should fail with invalid project IDs', async () => {
    const res = await aiGateway.createTodo('invalid_project_id', 'Test');
    expect((res as any).success).toBe(false);
    expect((res as any).error).toBe('Project not found');
  });

  it('should fail with invalid workspace IDs', async () => {
    const res = await aiGateway.createProject('invalid_ws', testCategoryId, 'Test');
    expect((res as any).success).toBe(false);
    expect((res as any).error).toContain('Invalid workspace');
  });

  it('should fail on schema failures', async () => {
    // If we try to update with a bad status, schema validation should fail
    const res = await aiGateway.updateProject(testProjectId, { status: 'Invalid Status' as any });
    expect((res as any).success).toBe(false);
    expect((res as any).error).toContain('Schema validation failed');
  });
});