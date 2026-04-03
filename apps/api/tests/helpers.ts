import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

export async function createTestTenant(slug?: string) {
  return prisma.tenant.create({
    data: { name: 'Test Tenant', slug: slug ?? `test-${uuidv4().slice(0, 8)}` },
  });
}

export async function createTestUser(
  tenantId: string,
  overrides?: { email?: string; role?: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER'; password?: string }
) {
  const password = overrides?.password ?? 'Test1234!';
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      tenant_id: tenantId,
      email: overrides?.email ?? `test-${uuidv4().slice(0, 8)}@example.com`,
      password_hash: passwordHash,
      full_name: 'Test User',
      role: overrides?.role ?? 'ANALYST',
      status: 'ACTIVE',
    },
  });
}

export function makeAuthToken(userId: string, tenantId: string, role = 'ANALYST') {
  return jwt.sign({ sub: userId, tenant_id: tenantId, role }, env.JWT_SECRET, {
    expiresIn: '1h',
  });
}

/** Delete the tenant and all cascade-deleted records */
export async function cleanupTenant(tenantId: string) {
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
}
