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
    } finally {
      if (createdId !== undefined) await page.request.delete(`/api/todos/${createdId}`);
    }

    expect(createdId).toBeDefined();
    const missing = await page.request.get(`/api/todos/${createdId}`);
    expect(missing.status()).toBe(404);
  });
});
