import { apiDelete, apiGet, apiPut } from '@lib/api/client';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export async function getNotifications(_userId: string, limit = 50, offset = 0) {
  try {
    const response = await apiGet<any>(`/api/notifications?limit=${limit}&offset=${offset}`);
    return { data: response.data || { data: [], total: 0, limit, offset }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to fetch notifications') };
  }
}

export async function getUnreadCount(_userId: string) {
  try {
    const response = await apiGet<{ count: number }>('/api/notifications/unread-count');
    return { data: response.data?.count || 0, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to get unread count') };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    await apiPut(`/api/notifications/${encodeURIComponent(notificationId)}`, { read: true });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to mark notification as read') };
  }
}

export async function markAllNotificationsAsRead(_userId: string) {
  try {
    await apiPut('/api/notifications/read-all', {});
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to mark all notifications as read') };
  }
}

export async function deleteNotification(notificationId: string) {
  try {
    await apiDelete(`/api/notifications/${encodeURIComponent(notificationId)}`);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to delete notification') };
  }
}

export async function deleteAllNotifications(_userId: string) {
  try {
    await apiDelete('/api/notifications');
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to delete notifications') };
  }
}

export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void,
  intervalMs = 30000,
) {
  let knownIds = new Set<string>();
  const intervalId = setInterval(async () => {
    const { data, error } = await getNotifications(userId, 5, 0);
    if (error) return;
    for (const notification of data?.data || []) {
      if (!knownIds.has(notification.id) && !notification.read) callback(notification);
      knownIds.add(notification.id);
    }
  }, intervalMs);
  return () => clearInterval(intervalId);
}
