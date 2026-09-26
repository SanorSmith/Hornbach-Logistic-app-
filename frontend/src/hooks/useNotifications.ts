import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationsStore } from '../store/notificationsStore';
import { useAuthStore } from '../store/authStore';
import { Notification } from '../types';
import toast from 'react-hot-toast';

async function fetchNotifications(userId: string) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        point:red_points(point_number)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    useNotificationsStore.getState().setNotifications((data ?? []) as Notification[]);
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }
}

export function useNotifications() {
  const user = useAuthStore((state) => state.user);
  const { notifications, unreadCount, addNotification, markAsRead } = useNotificationsStore();

  useEffect(() => {
    if (!user) return;

    fetchNotifications(user.id);

    const channel = supabase
      .channel(`user-notifications-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new as Notification;
          
          const { data: point } = await supabase
            .from('red_points')
            .select('point_number')
            .eq('id', notification.point_id)
            .single();

          if (point) {
            addNotification({ ...notification, point });
            
            toast.success(notification.message, {
              duration: 6000,
              icon: '🔔',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification]);

  const markNotificationAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      markAsRead(id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    markNotificationAsRead,
    refreshNotifications: () => (user ? fetchNotifications(user.id) : Promise.resolve()),
  };
}
