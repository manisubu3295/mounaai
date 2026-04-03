import { apiClient } from '@/lib/api-client';

export interface TenantUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  last_login_at: string | null;
  created_at: string;
}

export async function listUsers(): Promise<TenantUser[]> {
  const res = await apiClient.get<{ data: { users: TenantUser[] } }>('/users');
  return res.data.data.users;
}

export async function inviteUser(input: {
  email: string;
  role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER';
  full_name?: string;
}): Promise<TenantUser> {
  const res = await apiClient.post<{ data: { user: TenantUser } }>('/users', input);
  return res.data.data.user;
}

export async function updateUserRole(id: string, role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER'): Promise<TenantUser> {
  const res = await apiClient.put<{ data: { user: TenantUser } }>(`/users/${id}/role`, { role });
  return res.data.data.user;
}

export async function deactivateUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
