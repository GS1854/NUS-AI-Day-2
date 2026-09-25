import { expect, test } from '@playwright/test';

test.describe('todo API contract', () => {
  test('rejects unauthenticated reads', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/todos'),
      request.get('/api/todos/1'),
      request.post('/api/todos', { data: { title: 'Unauthenticated' } }),
      request.put('/api/todos/1', { data: { completed: true } }),
      request.delete('/api/todos/1'),
    ]);
    for (const response of responses) expect(response.status()).toBe(401);
  });

  test('supports the authenticated todo CRUD contract', async ({ page }) => {
    const login = await page.request.post('/api/auth/dev-login');
    expect(login.status()).toBe(200);

    const title = `API contract task ${Date.now()}`;
    let createdId: number | undefined;
    try {
      const create = await page.request.post('/api/todos', {
        data: { title, priority: 'high' },
      });
      expect(create.status()).toBe(201);
      const created = await create.json() as { id: number; title: string; priority: string; completed: boolean };
      createdId = created.id;
      expect(created).toMatchObject({ title, priority: 'high', completed: false });

      const list = await page.request.get('/api/todos');
      expect(list.status()).toBe(200);
      const listed = await list.json() as Array<{ id: number }>;
      expect(listed.some((todo) => todo.id === created.id)).toBe(true);

      const read = await page.request.get(`/api/todos/${created.id}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({ id: created.id, title });

      const update = await page.request.put(`/api/todos/${created.id}`, {
        data: { title: `${title} updated`, completed: true },
      });
      expect(update.status()).toBe(200);
      expect(await update.json()).toMatchObject({ title: `${title} updated`, completed: true });

      const invalid = await page.request.post('/api/todos', {
        data: { title: '   ' },
      });
      expect(invalid.status()).toBe(400);

      const exported = await page.request.get('/api/todos/export');
      expect(exported.status()).toBe(200);
      expect((await exported.json()).version).toBe(1);

      const invalidImport = await page.request.post('/api/todos/import', { data: { version: 99, todos: [] } });
      expect(invalidImport.status()).toBe(400);
    } finally {
      if (createdId !== undefined) await page.request.delete(`/api/todos/${createdId}`);
    }

    expect(createdId).toBeDefined();
    const missing = await page.request.get(`/api/todos/${createdId}`);
    expect(missing.status()).toBe(404);
  });

  test('supports the subtask progress lifecycle and cascades with its todo', async ({ page }) => {
    const login = await page.request.post('/api/auth/dev-login');
    expect(login.status()).toBe(200);

    let todoId: number | undefined;
    let firstSubtaskId: number | undefined;
    try {
      const todoResponse = await page.request.post('/api/todos', { data: { title: `Subtask task ${Date.now()}` } });
      expect(todoResponse.status()).toBe(201);
      todoId = (await todoResponse.json() as { id: number }).id;

      const first = await page.request.post(`/api/todos/${todoId}/subtasks`, { data: { title: 'First step', position: 1 } });
      expect(first.status()).toBe(201);
      firstSubtaskId = (await first.json() as { id: number }).id;
      const second = await page.request.post(`/api/todos/${todoId}/subtasks`, { data: { title: 'Second step', position: 2 } });
      expect(second.status()).toBe(201);

      const initial = await page.request.get(`/api/todos/${todoId}/subtasks`);
      expect(initial.status()).toBe(200);
      expect(await initial.json()).toMatchObject({ progress: { completed: 0, total: 2, percentage: 0 } });

      const toggle = await page.request.put(`/api/subtasks/${firstSubtaskId}`, { data: { completed: true } });
      expect(toggle.status()).toBe(200);
      const updated = await page.request.get(`/api/todos/${todoId}/subtasks`);
      expect(await updated.json()).toMatchObject({ progress: { completed: 1, total: 2, percentage: 50 } });

      const remove = await page.request.delete(`/api/subtasks/${firstSubtaskId}`);
      expect(remove.status()).toBe(200);
      const afterRemove = await page.request.get(`/api/todos/${todoId}/subtasks`);
      expect(await afterRemove.json()).toMatchObject({ progress: { completed: 0, total: 1, percentage: 0 } });
    } finally {
      if (todoId !== undefined) {
        const deleted = await page.request.delete(`/api/todos/${todoId}`);
        expect(deleted.status()).toBe(200);
      }
    }

    expect(todoId).toBeDefined();
    const missingTodo = await page.request.get(`/api/todos/${todoId}/subtasks`);
    expect(missingTodo.status()).toBe(404);
    if (firstSubtaskId !== undefined) {
      const missingSubtask = await page.request.put(`/api/subtasks/${firstSubtaskId}`, { data: { completed: false } });
      expect(missingSubtask.status()).toBe(404);
    }
  });

  test('supports user-scoped tag assignment', async ({ page }) => {
    expect((await page.request.post('/api/auth/dev-login')).status()).toBe(200);
    const suffix = Date.now();
    const todoResponse = await page.request.post('/api/todos', { data: { title: `Tagged API task ${suffix}` } });
    expect(todoResponse.status()).toBe(201);
    const todo = await todoResponse.json() as { id: number };
    const tagResponse = await page.request.post('/api/tags', { data: { name: `review-${suffix}`, color: '#526b5a' } });
    expect(tagResponse.status()).toBe(201);
    const tag = await tagResponse.json() as { id: number };
    try {
      const assignment = await page.request.post(`/api/todos/${todo.id}/tags`, { data: { tag_id: tag.id } });
      expect(assignment.status()).toBe(200);
      const read = await page.request.get(`/api/todos/${todo.id}`);
      expect((await read.json()).tags).toEqual([expect.objectContaining({ id: tag.id })]);
    } finally {
      await page.request.delete(`/api/tags/${tag.id}`);
      await page.request.delete(`/api/todos/${todo.id}`);
    }
  });

  test('supports reusable templates', async ({ page }) => {
    expect((await page.request.post('/api/auth/dev-login')).status()).toBe(200);
    const suffix = Date.now();
    const templateResponse = await page.request.post('/api/templates', { data: { name: `Standup ${suffix}`, title: 'Daily standup', category: 'Work', subtasks: [{ title: 'Review blockers', position: 0 }] } });
    expect(templateResponse.status()).toBe(201);
    const template = await templateResponse.json() as { id: number };
    let createdTodoId: number | undefined;
    try {
      const useResponse = await page.request.post(`/api/templates/${template.id}/use`);
      expect(useResponse.status()).toBe(201);
      createdTodoId = (await useResponse.json() as { id: number }).id;
      const subtasks = await page.request.get(`/api/todos/${createdTodoId}/subtasks`);
      expect(await subtasks.json()).toMatchObject({ progress: { total: 1 } });
    } finally {
      if (createdTodoId !== undefined) await page.request.delete(`/api/todos/${createdTodoId}`);
      await page.request.delete(`/api/templates/${template.id}`);
    }
  });
});
