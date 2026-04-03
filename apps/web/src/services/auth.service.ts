import { apiClient } from '@/lib/api-client';
import type { AuthUser, LoginResponse } from '@pocketcomputer/shared-types';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiClient.post<{ data: LoginResponse }>('/auth/login', { email, password });
  return res.data.data;
}

export async function register(data: {
  email: string; password: string; full_name: string; company_name: string;
}): Promise<LoginResponse> {
  const res = await apiClient.post<{ data: LoginResponse }>('/auth/register', data);
  return res.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getMe(): Promise<AuthUser> {
  const res = await apiClient.get<{ data: { user: AuthUser } }>('/auth/me');
  return res.data.data.user;
}

export async function refreshToken(): Promise<string> {
  const res = await apiClient.post<{ data: { access_token: string } }>('/auth/refresh');
  return res.data.data.access_token;
}
