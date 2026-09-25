'use client';

import { useEffect, useState } from 'react';

export function useNotifications(): { permission: NotificationPermission; requestPermission: () => Promise<void> } {
  const [permission, setPermission] = useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'denied' : Notification.permission);

  useEffect(() => {
    if (permission !== 'granted') return;
    const check = async () => {
      const response = await fetch('/api/notifications/check');
      if (!response.ok) return;
      const body = await response.json() as { todos: Array<{ title: string; due_date: string | null }> };
      for (const todo of body.todos) new Notification('Todo reminder', { body: todo.title });
    };
    void check();
    const interval = window.setInterval(() => void check(), 30_000);
    return () => window.clearInterval(interval);
  }, [permission]);

  async function requestPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  }

  return { permission, requestPermission };
}