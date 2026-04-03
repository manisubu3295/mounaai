import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { createTestTenant, createTestUser, makeAuthToken, cleanupTenant } from '../helpers.js';

// Mock Redis so the health check and rate limiter don't need a real connection
vi.mock('../../src/lib/redis.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
}));

// Mock BullMQ queue so analysis run creation doesn't need Redis
vi.mock('../../src/jobs/analysis-run.queue.js', () => ({
  enqueueAnalysisRun: vi.fn().mockResolvedValue(undefined),
  analysisRunQueue: { add: vi.fn() },
}));

describe('Auth API', () => {
  let tenantId: string;
  const TEST_EMAIL = `auth-test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'SecurePass1!';

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupTenant(tenantId);
  });

  // ── Register ────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('creates a new user and returns tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          tenant_slug: (await import('../../src/lib/prisma.js')).then(
            async m => (await m.prisma.tenant.findUnique({ where: { id: tenantId } }))!.slug
          ),
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          full_name: 'Auth Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.user.email).toBe(TEST_EMAIL);
    });

    it('rejects duplicate email', async () => {
      const tenant = await import('../../src/lib/prisma.js').then(
        async m => (await m.prisma.tenant.findUnique({ where: { id: tenantId } }))!
      );
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ tenant_slug: tenant.slug, email: TEST_EMAIL, password: TEST_PASSWORD, full_name: 'Dup' });

      expect(res.status).toBe(409);
    });

    it('rejects a weak password', async () => {
      const tenant = await import('../../src/lib/prisma.js').then(
        async m => (await m.prisma.tenant.findUnique({ where: { id: tenantId } }))!
      );
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ tenant_slug: tenant.slug, email: `weak-${Date.now()}@test.com`, password: '123', full_name: 'Weak' });

      expect(res.status).toBe(400);
    });
  });

  // ── Login ───────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('returns access_token on valid credentials', async () => {
      const tenant = await import('../../src/lib/prisma.js').then(
        async m => (await m.prisma.tenant.findUnique({ where: { id: tenantId } }))!
      );
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ tenant_slug: tenant.slug, email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.user.email).toBe(TEST_EMAIL);
    });

    it('rejects wrong password', async () => {
      const tenant = await import('../../src/lib/prisma.js').then(
        async m => (await m.prisma.tenant.findUnique({ where: { id: tenantId } }))!
      );
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ tenant_slug: tenant.slug, email: TEST_EMAIL, password: 'WrongPass99!' });

      expect(res.status).toBe(401);
    });
  });

  // ── Protected route ─────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    it('returns user info with a valid token', async () => {
      const user = await createTestUser(tenantId);
      const token = makeAuthToken(user.id, tenantId, user.role);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(user.id);
      expect(res.body.data.email).toBe(user.email);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with an invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });
});
