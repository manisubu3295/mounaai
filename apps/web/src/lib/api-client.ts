import axios, { AxiosError } from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

function isRefreshRequest(url?: string) {
  return typeof url === 'string' && url.includes('/auth/refresh');
}

export function setAccessToken(token: string) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as (typeof err.config & { _retry?: boolean }) | undefined;
    const requestUrl = original?.url;

    if (err.response?.status === 401 && original && !original._retry && !isRefreshRequest(requestUrl)) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers!['Authorization'] = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post<{ data: { access_token: string } }>(
          '/api/v1/auth/refresh',
          {},
          { withCredentials: true }
        );
        const newToken = res.data.data.access_token;
        setAccessToken(newToken);
        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];
        original.headers!['Authorization'] = `Bearer ${newToken}`;
        return apiClient(original);
      } catch (refreshError) {
        clearAccessToken();
        refreshQueue.forEach(({ reject }) => reject(refreshError));
        refreshQueue = [];

        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);
