'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Todo } from '@/lib/db';

type Holiday = { date: string; name: string };

function monthDays(month: string): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: total }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
}

export default function CalendarPage() {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    Promise.all([fetch('/api/todos'), fetch('/api/holidays')]).then(async ([todoResponse, holidayResponse]) => {
      if (todoResponse.status === 401 || holidayResponse.status === 401) return router.push('/login');
      setTodos(await todoResponse.json());
      setHolidays(await holidayResponse.json());
    }).catch(() => undefined);
  }, [router]);

  const days = monthDays(month);
  const previous = () => setMonth((value) => {
    const [year, monthNumber] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 2, 1));
    return date.toISOString().slice(0, 7);
  });
  const next = () => setMonth((value) => {
    const [year, monthNumber] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthNumber, 1));
    return date.toISOString().slice(0, 7);
  });

  return <main className="app-shell"><header className="app-header"><div><p className="kicker">PLANNING VIEW</p><h1>Calendar.</h1><p className="muted">Singapore dates and public holidays.</p></div><button className="text-button" onClick={() => router.push('/')}>Back to tasks</button></header><div className="calendar-toolbar"><button className="text-button" onClick={previous}>Previous</button><strong>{month}</strong><button className="text-button" onClick={next}>Next</button></div><div className="calendar-grid">{days.map((day) => { const dayTodos = todos.filter((todo) => todo.due_date?.startsWith(day)); const holiday = holidays.find((item) => item.date === day); return <article className="calendar-day" key={day}><strong>{day.slice(-2)}</strong>{holiday && <span className="holiday">{holiday.name}</span>}{dayTodos.map((todo) => <span className="calendar-todo" key={todo.id}>{todo.title}</span>)}</article>; })}</div></main>;
}
