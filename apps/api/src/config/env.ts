import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().length(64), // 32-byte hex

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  WHATSAPP_NUMBER: z.string().default('919000000000'),
  WHATSAPP_MESSAGE: z.string().default('Hi, I am interested in PocketComputer Pro.'),

  // Notifications
  RESEND_API_KEY: z.string().optional().default(''),
  APP_BASE_URL: z.string().optional().default('http://localhost:5173'),
  NOTIFICATION_EMAIL: z.string().email().optional().default('info@aadhiraiinnovations.com'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
