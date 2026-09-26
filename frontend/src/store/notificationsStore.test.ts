import { beforeEach, describe, expect, it } from 'vitest';
import { useNotificationsStore } from './notificationsStore';
import type { Notification } from '../types';

const makeNotification = (id: string, is_read = false): Notification => ({
  id,
  user_id: 'u1',
  point_id: 'p1',
  type: 'KUNDORDER',
  message: 'Test',
  is_read,
  created_at: '2026-09-26T08:00:00Z',
  priority: 1,
});

beforeEach(() => {
  useNotificationsStore.getState().setNotifications([
    makeNotification('n1'),
    makeNotification('n2'),
    makeNotification('n3', true),
  ]);
});

describe('notificationsStore.markAsRead', () => {
  it('decrements the unread count for an unread notification', () => {
    useNotificationsStore.getState().markAsRead('n1');
    const state = useNotificationsStore.getState();
    expect(state.unreadCount).toBe(1);
    expect(state.notifications.find((n) => n.id === 'n1')?.is_read).toBe(true);
  });

  it('does not decrement twice when the same notification is marked again', () => {
    useNotificationsStore.getState().markAsRead('n1');
    useNotificationsStore.getState().markAsRead('n1');
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
  });

  it('leaves the count alone for an already-read or unknown notification', () => {
    useNotificationsStore.getState().markAsRead('n3');
    useNotificationsStore.getState().markAsRead('missing');
    expect(useNotificationsStore.getState().unreadCount).toBe(2);
  });
});
