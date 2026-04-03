import { apiClient } from '@/lib/api-client';
import type { Notification, NotificationPreference, PaginatedResponse } from '@pocketcomputer/shared-types';

export async function listNotifications(
  page = 1,
  limit = 20
): Promise<PaginatedResponse<Notification>> {
  const res = await apiClient.get<{ data: PaginatedResponse<Notification> }>('/notifications', {
    params: { page, limit },
  });
  return res.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await apiClient.get<{ data: { count: number } }>('/notifications/unread-count');
  return res.data.data.count;
}

export async function markAsRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}

export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const res = await apiClient.get<{ data: { preferences: NotificationPreference } }>('/notifications/preferences');
  return res.data.data.preferences;
}

export async function updateNotificationPreferences(
  input: Partial<Omit<NotificationPreference, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
): Promise<NotificationPreference> {
  const res = await apiClient.put<{ data: { preferences: NotificationPreference } }>('/notifications/preferences', input);
  return res.data.data.preferences;
}
