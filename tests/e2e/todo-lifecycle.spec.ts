import { expect, test, type Page } from '@playwright/test';

const title = `Playwright task ${Date.now()}`;

function todoCard(page: Page, cardTitle: string) {
  return page.locator('article.todo-card').filter({ hasText: cardTitle });
}

async function cleanUp(page: Page): Promise<void> {
  const response = await page.request.get('/api/todos');
  if (!response.ok()) return;
  const todos = await response.json() as Array<{ id: number; title: string }>;
  for (const todo of todos.filter((item) => item.title.startsWith(title))) {
    await page.request.delete(`/api/todos/${todo.id}`);
  }
}

test.describe('todo lifecycle', () => {
  test('redirects, logs in, and persists create, edit, complete, and delete', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    const loginResponse = await page.request.post('/api/auth/dev-login');
    expect(loginResponse.status()).toBe(200);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('textbox', { name: 'Task title' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Task title' }).fill(title);
    const createResponse = page.waitForResponse((response) => response.url().includes('/api/todos') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add task' }).click();
    expect((await createResponse).status()).toBe(201);

    const card = todoCard(page, title);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('textbox', { name: 'Edit task title' }).fill(`${title} edited`);
    const updateResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Update' }).click();
    expect((await updateResponse).status()).toBe(200);

    const editedCard = todoCard(page, `${title} edited`);
    await expect(editedCard).toBeVisible();
    await editedCard.getByRole('button', { name: /Show subtasks/ }).click();
    const subtaskTitle = `${title} subtask`;
    await editedCard.getByRole('textbox', { name: `Add subtask to ${title} edited` }).fill(subtaskTitle);
    const subtaskCreateResponse = page.waitForResponse((response) => response.url().includes('/subtasks') && response.request().method() === 'POST');
    await editedCard.getByRole('button', { name: 'Add' }).click();
    expect((await subtaskCreateResponse).status()).toBe(201);
    await expect(editedCard).toContainText('0 of 1 complete');
    const subtask = editedCard.getByRole('checkbox', { name: `Complete subtask ${subtaskTitle}` });
    const subtaskUpdateResponse = page.waitForResponse((response) => response.url().includes('/api/subtasks/') && response.request().method() === 'PUT');
    await subtask.check();
    expect((await subtaskUpdateResponse).status()).toBe(200);
    await expect(editedCard).toContainText('1 of 1 complete');
    const subtaskDeleteResponse = page.waitForResponse((response) => response.url().includes('/api/subtasks/') && response.request().method() === 'DELETE');
    await editedCard.getByRole('button', { name: `Delete subtask ${subtaskTitle}` }).click();
    expect((await subtaskDeleteResponse).status()).toBe(200);
    await expect(editedCard).toContainText('0 of 0 complete');
    const completeResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.request().method() === 'PUT');
    await editedCard.getByRole('checkbox').check();
    expect((await completeResponse).status()).toBe(200);
    await expect(editedCard).toHaveClass(/done/);

    await page.reload();
    const persistedCard = todoCard(page, `${title} edited`);
    await expect(persistedCard).toBeVisible();
    await expect(persistedCard.getByRole('checkbox')).toBeChecked();

    const deleteResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.request().method() === 'DELETE');
    await persistedCard.getByRole('button', { name: 'Delete' }).click();
    expect((await deleteResponse).status()).toBe(200);
    await expect(persistedCard).toHaveCount(0);

    await page.reload();
    await expect(todoCard(page, `${title} edited`)).toHaveCount(0);
  });

  test.afterEach(async ({ page }) => {
    await cleanUp(page);
  });
});
