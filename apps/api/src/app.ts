import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { requestId } from './middleware/request-id.middleware.js';
import { errorHandler } from './middleware/error-handler.middleware.js';
import { apiRouter } from './routes/index.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app: Express = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(requestId);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  let dbStatus = 'OK';
  let redisStatus = 'OK';

  try { await prisma.$queryRaw`SELECT 1`; } catch { dbStatus = 'ERROR'; }
  try { await redis.ping(); } catch { redisStatus = 'ERROR'; }

  const healthy = dbStatus === 'OK' && redisStatus === 'OK';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    components: { database: { status: dbStatus }, redis: { status: redisStatus } },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found', request_id: '' } });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export { app };
