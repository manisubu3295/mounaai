import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { createTestTenant, createTestUser, makeAuthToken, cleanupTenant } from '../helpers.js';

vi.mock('../../src/lib/redis.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
}));

// Prevent actual BullMQ/Redis connections during tests
vi.mock('../../src/jobs/analysis-run.queue.js', () => ({
  enqueueAnalysisRun: vi.fn().mockResolvedValue(undefined),
  analysisRunQueue: { add: vi.fn() },
}));

// Prevent n8n webhook calls
vi.mock('../../src/services/automation.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/automation.service.js')>();
  return {
    ...actual,
    triggerAnalysisRunRequestedAutomation: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Analysis Runs API', () => {
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const user = await createTestUser(tenantId, { role: 'ANALYST' });
    token = makeAuthToken(user.id, tenantId, 'ANALYST');
  });

  afterAll(async () => {
    await cleanupTenant(tenantId);
  });

  describe('POST /api/v1/analysis-runs', () => {
    it('creates a run with QUEUED status', async () => {
      const res = await request(app)
        .post('/api/v1/analysis-runs')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.id).toBeDefined();
    });

    it('enqueues the BullMQ job', async () => {
      const { enqueueAnalysisRun } = await import('../../src/jobs/analysis-run.queue.js');

      await request(app)
        .post('/api/v1/analysis-runs')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(enqueueAnalysisRun).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/v1/analysis-runs').send({});
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/analysis-runs', () => {
    it('returns a paginated list of runs for the tenant', async () => {
      const res = await request(app)
        .get('/api/v1/analysis-runs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(typeof res.body.data.total).toBe('number');
    });

    it('only returns runs for the authenticated tenant', async () => {
      // Create a second isolated tenant
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser(otherTenant.id);
      const otherToken = makeAuthToken(otherUser.id, otherTenant.id);

      // Create a run under the other tenant
      await request(app)
        .post('/api/v1/analysis-runs')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({});

      // Our tenant should not see the other tenant's run
      const res = await request(app)
        .get('/api/v1/analysis-runs')
        .set('Authorization', `Bearer ${token}`);

      const ids: string[] = res.body.data.items.map((r: { id: string }) => r.id);
      const otherRes = await request(app)
        .get('/api/v1/analysis-runs')
        .set('Authorization', `Bearer ${otherToken}`);
      const otherIds: string[] = otherRes.body.data.items.map((r: { id: string }) => r.id);

      // No overlap
      expect(ids.some(id => otherIds.includes(id))).toBe(false);

      await cleanupTenant(otherTenant.id);
    });
  });
});
