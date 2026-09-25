'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Subtask, Tag, Template, Todo } from '@/lib/db';
import { calculateProgress } from '@/lib/subtasks';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { formatSingaporeDate } from '@/lib/timezone';
import { sectionTodos } from '@/lib/todoSort';

type Draft = { title: string; priority: Todo['priority']; due_date: string; reminder_minutes: number | null; is_recurring: boolean; recurrence_pattern: Todo['recurrence_pattern'] };
const emptyDraft: Draft = { title: '', priority: 'medium', due_date: '', reminder_minutes: null, is_recurring: false, recurrence_pattern: null };

export default function HomePage() {
  const router = useRouter();
  const { permission, requestPermission } = useNotifications();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [todayLabel] = useState(() => new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }).format(new Date()).toUpperCase());
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Todo['priority'] | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all');
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    fetch('/api/todos').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return null;
      }
      if (!response.ok) throw new Error('Could not load your todos');
      return response.json() as Promise<Todo[]>;
    }).then((loadedTodos) => {
      if (loadedTodos) setTodos(loadedTodos);
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetch('/api/tags').then(async (response) => {
      if (!response.ok) return [] as Tag[];
      return response.json() as Promise<Tag[]>;
    }).then(setTags).catch(() => setTags([]));
  }, []);

  useEffect(() => {
    fetch('/api/templates').then(async (response) => response.ok ? response.json() as Promise<Template[]> : []).then(setTemplates).catch(() => setTemplates([]));
  }, []);

  async function addTodo(event: FormEvent) {
    event.preventDefault();
    setError('');
    const title = draft.title.trim();
    if (!title) return setError('Give your task a title first.');
    const optimistic: Todo = { id: -Date.now(), user_id: 1, title, completed: false, due_date: draft.due_date || null, priority: draft.priority, is_recurring: draft.is_recurring, recurrence_pattern: draft.recurrence_pattern, reminder_minutes: draft.reminder_minutes, last_notification_sent: null, created_at: new Date().toISOString(), updated_at: null };
    setTodos((current) => [optimistic, ...current]);
    setDraft(emptyDraft);
    try {
      const response = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, priority: draft.priority, due_date: draft.due_date || null, reminder_minutes: draft.reminder_minutes, is_recurring: draft.is_recurring, recurrence_pattern: draft.recurrence_pattern }) });
      if (response.status === 401) {
        router.push('/login');
        throw new Error('Your session has expired');
      }
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not add task');
      const created = await response.json() as Todo;
      setTodos((current) => current.map((todo) => todo.id === optimistic.id ? created : todo));
    } catch (reason) {
      setTodos((current) => current.filter((todo) => todo.id !== optimistic.id));
      setError(reason instanceof Error ? reason.message : 'Could not add task');
    }
  }

  async function updateTodo(id: number, changes: Partial<Todo>) {
    const previous = todos;
    setTodos((current) => current.map((todo) => todo.id === id ? { ...todo, ...changes } : todo));
    try {
      const response = await fetch(`/api/todos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
      if (response.status === 401) {
        router.push('/login');
        throw new Error('Your session has expired');
      }
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not update task');
      const updated = await response.json() as Todo;
      setTodos((current) => current.map((todo) => todo.id === id ? updated : todo));
    } catch (reason) {
      setTodos(previous);
      setError(reason instanceof Error ? reason.message : 'Could not update task');
    }
  }

  async function deleteTodo(id: number) {
    const previous = todos;
    setTodos((current) => current.filter((todo) => todo.id !== id));
    try {
      const response = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (response.status === 401) {
        router.push('/login');
        throw new Error('Your session has expired');
      }
      if (!response.ok) throw new Error('Could not delete task');
    } catch (reason) {
      setTodos(previous);
      setError(reason instanceof Error ? reason.message : 'Could not delete task');
    }
  }

  async function exportTodos() {
    const response = await fetch('/api/todos/export');
    if (!response.ok) return setError('Could not export your todos');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'todos.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importTodos(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const response = await fetch('/api/todos/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await file.text() });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not import todos');
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import todos');
    } finally {
      event.target.value = '';
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function saveTemplate() {
    const title = draft.title.trim();
    if (!title) return setError('Enter a task title before saving a template.');
    const response = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: title, title, priority: draft.priority, recurrence_pattern: draft.is_recurring ? draft.recurrence_pattern : null, subtasks: [] }) });
    if (!response.ok) return setError('Could not save template');
    const created = await response.json() as Template;
    setTemplates((current) => [...current, created]);
  }

  async function applyTemplate() {
    if (!selectedTemplate) return;
    const response = await fetch(`/api/templates/${selectedTemplate}/use`, { method: 'POST' });
    if (!response.ok) return setError('Could not use template');
    const created = await response.json() as Todo;
    setTodos((current) => [created, ...current]);
    setSelectedTemplate('');
  }

  async function createTag(event: FormEvent) {
    event.preventDefault();
    if (!newTagName.trim()) return;
    const response = await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTagName.trim(), color: '#526b5a' }) });
    if (!response.ok) return setError('Could not create tag');
    const created = await response.json() as Tag;
    setTags((current) => [...current, created]);
    setNewTagName('');
  }

  async function assignTag(todoId: number, tagId: number) {
    const response = await fetch(`/api/todos/${todoId}/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag_id: tagId }) });
    if (!response.ok) return setError('Could not assign tag');
    const updated = await response.json() as Todo;
    setTodos((current) => current.map((todo) => todo.id === todoId ? updated : todo));
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editing.title.trim()) return setError('Give your task a title first.');
    const changes = { title: editing.title.trim(), priority: editing.priority, due_date: editing.due_date || null, reminder_minutes: editing.reminder_minutes, is_recurring: editing.is_recurring, recurrence_pattern: editing.recurrence_pattern };
    setEditing(null);
    void updateTodo(editing.id, changes);
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredTodos = todos.filter((todo) => {
    const matchesSearch = !normalizedSearch || todo.title.toLowerCase().includes(normalizedSearch) || (todo.tags ?? []).some((tag) => tag.name.toLowerCase().includes(normalizedSearch));
    const matchesPriority = priorityFilter === 'all' || todo.priority === priorityFilter;
    const matchesTag = tagFilter === 'all' || (todo.tags ?? []).some((tag) => tag.id === tagFilter);
    return matchesSearch && matchesPriority && matchesTag;
  });
  const sections = sectionTodos(filteredTodos);
  return <main className="app-shell">
    <header className="app-header"><div><p className="kicker">{todayLabel}</p><h1>Daylight tasks.</h1><p className="muted">Keep the next right thing close.</p></div><div className="header-actions"><span className="muted">Singapore time</span><button className="text-button" type="button" onClick={() => router.push('/calendar')}>Calendar</button>{permission === 'default' && <button className="text-button" type="button" onClick={() => void requestPermission()}>Enable notifications</button>}<button className="text-button" type="button" onClick={() => void saveTemplate()}>Save template</button>{templates.length > 0 && <><select aria-label="Select template" value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}><option value="">Templates</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select><button className="text-button" type="button" onClick={() => void applyTemplate()} disabled={!selectedTemplate}>Use</button></>}<button className="text-button" type="button" onClick={() => void exportTodos()}>Export</button><label className="text-button import-button">Import<input type="file" accept="application/json" onChange={importTodos} /></label><button className="text-button" type="button" onClick={() => void logout()}>Log out</button></div></header>
    <div className="filter-bar"><input aria-label="Search todos" placeholder="Search tasks or tags" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Todo['priority'] | 'all')}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><select aria-label="Filter tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}><option value="all">All tags</option>{tags.map((tag) => <option value={tag.id} key={tag.id}>{tag.name}</option>)}</select><form className="tag-create" onSubmit={createTag}><input aria-label="New tag name" placeholder="New tag" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} /><button className="text-button" type="submit">Create</button></form><button className="text-button" type="button" onClick={() => { setSearch(''); setPriorityFilter('all'); setTagFilter('all'); }}>Clear filters</button></div>
    <form className="composer" onSubmit={addTodo}><input aria-label="Task title" placeholder="What needs your attention?" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><select aria-label="Priority" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Todo['priority'] })}><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><input aria-label="Due date" type="datetime-local" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} /><select aria-label="Reminder" value={draft.reminder_minutes ?? ''} onChange={(event) => setDraft({ ...draft, reminder_minutes: event.target.value ? Number(event.target.value) : null })} disabled={!draft.due_date}><option value="">No reminder</option><option value="15">15 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select><label className="check-label"><input type="checkbox" checked={draft.is_recurring} onChange={(event) => setDraft({ ...draft, is_recurring: event.target.checked, recurrence_pattern: event.target.checked ? 'daily' : null })} /> Repeat</label>{draft.is_recurring && <select aria-label="Recurrence pattern" value={draft.recurrence_pattern ?? 'daily'} onChange={(event) => setDraft({ ...draft, recurrence_pattern: event.target.value as Todo['recurrence_pattern'] })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>}<button className="primary-button" type="submit">Add task</button></form>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p className="empty">Loading your workspace...</p> : filteredTodos.length === 0 ? <p className="empty">No tasks match these filters.</p> : <><TodoSection title="Overdue" todos={sections.overdue} tags={tags} onAssignTag={assignTag} onToggle={updateTodo} onEdit={setEditing} onDelete={deleteTodo} /><TodoSection title="Pending" todos={sections.pending} tags={tags} onAssignTag={assignTag} onToggle={updateTodo} onEdit={setEditing} onDelete={deleteTodo} /><TodoSection title="Completed" todos={sections.completed} tags={tags} onAssignTag={assignTag} onToggle={updateTodo} onEdit={setEditing} onDelete={deleteTodo} /></>}
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}><form className="edit-modal" onSubmit={submitEdit}><h2>Edit task</h2><input aria-label="Edit task title" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} autoFocus /><select aria-label="Edit priority" value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: event.target.value as Todo['priority'] })}><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><input aria-label="Edit due date" type="datetime-local" value={editing.due_date ?? ''} onChange={(event) => setEditing({ ...editing, due_date: event.target.value || null })} /><select aria-label="Edit reminder" value={editing.reminder_minutes ?? ''} onChange={(event) => setEditing({ ...editing, reminder_minutes: event.target.value ? Number(event.target.value) : null })} disabled={!editing.due_date}><option value="">No reminder</option><option value="15">15 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select><label className="check-label"><input type="checkbox" checked={editing.is_recurring} onChange={(event) => setEditing({ ...editing, is_recurring: event.target.checked, recurrence_pattern: event.target.checked ? (editing.recurrence_pattern ?? 'daily') : null })} /> Repeat</label>{editing.is_recurring && <select aria-label="Edit recurrence pattern" value={editing.recurrence_pattern ?? 'daily'} onChange={(event) => setEditing({ ...editing, recurrence_pattern: event.target.value as Todo['recurrence_pattern'] })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>}<div className="modal-actions"><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" type="submit">Update</button></div></form></div>}
  </main>;
}

function TodoSection({ title, todos, tags, onAssignTag, onToggle, onEdit, onDelete }: { title: string; todos: Todo[]; tags: Tag[]; onAssignTag: (todoId: number, tagId: number) => void; onToggle: (id: number, changes: Partial<Todo>) => void; onEdit: (todo: Todo) => void; onDelete: (id: number) => void }) {
  return <section className="todo-section"><div className="section-heading"><h2>{title}</h2><span className="count">{todos.length}</span></div>{todos.length === 0 ? <p className="empty">Nothing here.</p> : <div className="todo-list">{todos.map((todo) => <article className={`todo-card ${todo.completed ? 'done' : ''}`} key={todo.id}><div className="todo-row"><input type="checkbox" aria-label={`Mark ${todo.title} complete`} checked={todo.completed} onChange={(event) => onToggle(todo.id, { completed: event.target.checked })} /><div className="todo-copy"><span className="todo-title">{todo.title}</span><span className="todo-meta">{todo.priority} {todo.due_date ? `· due ${formatSingaporeDate(new Date(`${todo.due_date}:00+08:00`))}` : ''} {todo.is_recurring ? `· repeats ${todo.recurrence_pattern}` : ''}</span><div className="tag-list">{(todo.tags ?? []).map((tag) => <span className="tag-badge" style={{ backgroundColor: tag.color }} key={tag.id}>{tag.name}</span>)}{tags.length > 0 && <select aria-label={`Assign tag to ${todo.title}`} value="" onChange={(event) => { if (event.target.value) onAssignTag(todo.id, Number(event.target.value)); }}><option value="">Add tag</option>{tags.filter((tag) => !(todo.tags ?? []).some((existing) => existing.id === tag.id)).map((tag) => <option value={tag.id} key={tag.id}>{tag.name}</option>)}</select>}</div></div><div className="todo-actions"><button className="text-button" onClick={() => onEdit(todo)}>Edit</button><button className="text-button delete-button" onClick={() => onDelete(todo.id)}>Delete</button></div></div><SubtaskPanel todo={todo} /></article>)}</div>}</section>;
}

function SubtaskPanel({ todo }: { todo: Todo }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const progress = calculateProgress(subtasks);

  async function readError(response: Response, fallback: string): Promise<Error> {
    let message = fallback;
    try {
      const body = await response.json() as { error?: string };
      message = body.error ?? fallback;
    } catch {
      // Keep the fallback when the server does not return JSON.
    }
    return new Error(message);
  }

  async function loadSubtasks() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/todos/${todo.id}/subtasks`);
      if (response.status === 401) {
        router.push('/login');
        throw new Error('Your session has expired');
      }
      if (!response.ok) throw await readError(response, 'Could not load subtasks');
      const body = await response.json() as { subtasks: Subtask[] };
      setSubtasks(body.subtasks);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load subtasks');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !subtasks.length && !loading) void loadSubtasks();
  }

  async function addSubtask(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setError('');
    try {
      const response = await fetch(`/api/todos/${todo.id}/subtasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, position: subtasks.length }) });
      if (response.status === 401) {
        router.push('/login');
        throw new Error('Your session has expired');
      }
      if (!response.ok) throw await readError(response, 'Could not add subtask');
      const created = await response.json() as Subtask;
      setSubtasks((current) => [...current, created]);
      setNewTitle('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add subtask');
    }
  }

  async function toggleSubtask(subtask: Subtask) {
    const completed = !subtask.completed;
    setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, completed } : item));
    try {
      const response = await fetch(`/api/subtasks/${subtask.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) });
      if (response.status === 401) {
        router.push('/login');
        throw new Error('Your session has expired');
      }
      if (!response.ok) throw await readError(response, 'Could not update subtask');
      const updated = await response.json() as Subtask;
      setSubtasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, completed: subtask.completed } : item));
      setError(reason instanceof Error ? reason.message : 'Could not update subtask');
    }
  }

  async function deleteSubtask(subtask: Subtask) {
    setSubtasks((current) => current.filter((item) => item.id !== subtask.id));
    try {
      const response = await fetch(`/api/subtasks/${subtask.id}`, { method: 'DELETE' });
      if (response.status === 401) {
        router.push('/login');
        throw new Error('Your session has expired');
      }
      if (!response.ok) throw await readError(response, 'Could not delete subtask');
    } catch (reason) {
      setSubtasks((current) => [...current, subtask].sort((left, right) => left.position - right.position || left.id - right.id));
      setError(reason instanceof Error ? reason.message : 'Could not delete subtask');
    }
  }

  return <div className="subtask-panel"><button className="subtask-toggle" type="button" aria-expanded={expanded} onClick={toggleExpanded}>{expanded ? 'Hide subtasks' : 'Show subtasks'} <span className="subtask-progress">{progress.completed}/{progress.total}</span></button>{expanded && <div className="subtask-content">{loading ? <p className="subtask-status">Loading subtasks...</p> : <><div className="progress-summary" aria-live="polite"><span>{progress.completed} of {progress.total} complete</span><div className="progress-track" role="progressbar" aria-label={`${progress.percentage}% of subtasks complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}><span style={{ width: `${progress.percentage}%` }} /></div></div><div className="subtask-list">{subtasks.map((subtask) => <div className="subtask-row" key={subtask.id}><input type="checkbox" aria-label={`Complete subtask ${subtask.title}`} checked={subtask.completed} onChange={() => void toggleSubtask(subtask)} /><span className={subtask.completed ? 'subtask-title completed' : 'subtask-title'}>{subtask.title}</span><button className="text-button delete-button" type="button" aria-label={`Delete subtask ${subtask.title}`} onClick={() => void deleteSubtask(subtask)}>Delete</button></div>)}</div><form className="subtask-form" onSubmit={addSubtask}><input aria-label={`Add subtask to ${todo.title}`} placeholder="Add a subtask" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /><button className="text-button" type="submit">Add</button></form></>}{error && <p className="subtask-error" role="alert">{error}</p>}</div>}</div>;
}
