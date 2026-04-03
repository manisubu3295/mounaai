import axios from 'axios';
import { logger } from './logger.js';

export const httpClient = axios.create({
  timeout: 30000,
  headers: { 'User-Agent': 'PocketComputer/1.0' },
});

httpClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err)) {
      logger.debug('HTTP client error', {
        url: err.config?.url,
        status: err.response?.status,
        message: err.message,
      });
    }
    return Promise.reject(err);
  }
);
