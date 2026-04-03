import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load test env before any module is imported
config({ path: resolve(__dirname, '.env.test') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/lib/prisma.ts', 'src/lib/redis.ts'],
    },
  },
});
