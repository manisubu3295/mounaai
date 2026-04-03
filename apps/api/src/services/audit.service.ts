import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

interface AuditEntry {
  tenant_id: string;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  payload?: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILURE';
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenant_id: entry.tenant_id,
        user_id: entry.user_id ?? null,
        action: entry.action,
        resource_type: entry.resource_type ?? null,
        resource_id: entry.resource_id ?? null,
        ip_address: entry.ip_address ?? null,
        user_agent: entry.user_agent ?? null,
        payload: (entry.payload ?? {}) as object,
        status: entry.status,
      },
    });
  } catch (err) {
    // Audit failures must not crash the main flow
    logger.error('Failed to write audit log', { action: entry.action, err });
  }
}
