'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Todo } from '@/lib/db';
import { formatSingaporeDate } from '@/lib/timezone';
import { sectionTodos } from '@/lib/todoSort';

type Draft = { title: string; priority: Todo['priority']; due_date: string };
const emptyDraft: Draft = { title: '', priority: 'medium', due_date: '' };

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [todayLabel] = useState(() => new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }).format(new Date()).toUpperCase());

  useEffect(() => {
    fetch('/api/todos').then(async (response) => {
      if (!response.ok) throw new Error('Could not load your todos');
      return response.json() as Promise<Todo[]>;
    }).then(setTodos).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  async function addTodo(event: FormEvent) {
    event.preventDefault();
    setError('');
    const title = draft.title.trim();
    if (!title) return setError('Give your task a title first.');
    const optimistic: Todo = { id: -Date.now(), user_id: 1, title, completed: false, due_date: draft.due_date || null, priority: draft.priority, is_recurring: false, recurrence_pattern: null, reminder_minutes: null, last_notification_sent: null, created_at: new Date().toISOString(), updated_at: null };
    setTodos((current) => [optimistic, ...current]);
    setDraft(emptyDraft);
    try {
      const response = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, priority: draft.priority, due_date: draft.due_date || null }) });
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
      if (!response.ok) throw new Error('Could not delete task');
    } catch (reason) {
      setTodos(previous);
      setError(reason instanceof Error ? reason.message : 'Could not delete task');
    }
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editing.title.trim()) return setError('Give your task a title first.');
    const changes = { title: editing.title.trim(), priority: editing.priority, due_date: editing.due_date || null };
    setEditing(null);
    void updateTodo(editing.id, changes);
  }

  const sections = sectionTodos(todos);
  return <main className="app-shell">
    <header className="app-header"><div><p className="kicker">{todayLabel}</p><h1>Daylight tasks.</h1><p className="muted">Keep the next right thing close.</p></div><span className="muted">Singapore time</span></header>
    <form className="composer" onSubmit={addTodo}><input aria-label="Task title" placeholder="What needs your attention?" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><select aria-label="Priority" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Todo['priority'] })}><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><input aria-label="Due date" type="datetime-local" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} /><button className="primary-button" type="submit">Add task</button></form>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p className="empty">Loading your workspace...</p> : <><TodoSection title="Overdue" todos={sections.overdue} onToggle={updateTodo} onEdit={setEditing} onDelete={deleteTodo} /><TodoSection title="Pending" todos={sections.pending} onToggle={updateTodo} onEdit={setEditing} onDelete={deleteTodo} /><TodoSection title="Completed" todos={sections.completed} onToggle={updateTodo} onEdit={setEditing} onDelete={deleteTodo} /></>}
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}><form className="edit-modal" onSubmit={submitEdit}><h2>Edit task</h2><input aria-label="Edit task title" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} autoFocus /><select aria-label="Edit priority" value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: event.target.value as Todo['priority'] })}><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><input aria-label="Edit due date" type="datetime-local" value={editing.due_date ?? ''} onChange={(event) => setEditing({ ...editing, due_date: event.target.value || null })} /><div className="modal-actions"><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" type="submit">Update</button></div></form></div>}
  </main>;
}

function TodoSection({ title, todos, onToggle, onEdit, onDelete }: { title: string; todos: Todo[]; onToggle: (id: number, changes: Partial<Todo>) => void; onEdit: (todo: Todo) => void; onDelete: (id: number) => void }) {
  return <section className="todo-section"><div className="section-heading"><h2>{title}</h2><span className="count">{todos.length}</span></div>{todos.length === 0 ? <p className="empty">Nothing here.</p> : <div className="todo-list">{todos.map((todo) => <article className={`todo-card ${todo.completed ? 'done' : ''}`} key={todo.id}><input type="checkbox" aria-label={`Mark ${todo.title} complete`} checked={todo.completed} onChange={(event) => onToggle(todo.id, { completed: event.target.checked })} /><div className="todo-copy"><span className="todo-title">{todo.title}</span><span className="todo-meta">{todo.priority} {todo.due_date ? `· due ${formatSingaporeDate(new Date(`${todo.due_date}:00+08:00`))}` : ''}</span></div><div className="todo-actions"><button className="text-button" onClick={() => onEdit(todo)}>Edit</button><button className="text-button delete-button" onClick={() => onDelete(todo.id)}>Delete</button></div></article>)}</div>}</section>;
}
