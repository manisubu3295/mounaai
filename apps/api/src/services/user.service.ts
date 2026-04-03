import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../types/errors.js';
import { sendEmail } from './email.service.js';
import * as bcrypt from 'bcryptjs';

export interface TenantUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  last_login_at: string | null;
  created_at: string;
}

function fmt(u: {
  id: string;
  email: string;
  full_name: string | null;
  role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  last_login_at: Date | null;
  created_at: Date;
}): TenantUser {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    status: u.status,
    last_login_at: u.last_login_at?.toISOString() ?? null,
    created_at: u.created_at.toISOString(),
  };
}

export async function listUsers(tenantId: string): Promise<TenantUser[]> {
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'asc' },
  });
  return users.map(fmt);
}

export async function inviteUser(
  tenantId: string,
  inviterName: string,
  tenantName: string,
  email: string,
  role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER',
  full_name?: string
): Promise<TenantUser> {
  const existing = await prisma.user.findFirst({ where: { tenant_id: tenantId, email } });
  if (existing) throw new ConflictError('A user with this email already exists in this workspace');

  const tempPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';
  const password_hash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      email,
      full_name: full_name ?? null,
      password_hash,
      role,
    },
  });

  await sendEmail({
    to: email,
    subject: `You've been invited to ${tenantName} on PocketComputer`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>You have been invited</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${tenantName}</strong> on PocketComputer as <strong>${role.replace('_', ' ')}</strong>.</p>
        <p>Your temporary password is: <strong style="letter-spacing:2px">${tempPassword}</strong></p>
        <p>Please log in and change your password immediately.</p>
      </div>
    `,
  });

  return fmt(user);
}

export async function updateUserRole(
  tenantId: string,
  userId: string,
  role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER'
): Promise<TenantUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (user.tenant_id !== tenantId) throw new ForbiddenError();

  const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
  return fmt(updated);
}

export async function deactivateUser(tenantId: string, userId: string, requesterId: string): Promise<boolean> {
  if (userId === requesterId) throw new ForbiddenError('Cannot deactivate your own account');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.tenant_id !== tenantId) throw new ForbiddenError();

  await prisma.user.update({ where: { id: userId }, data: { status: 'INACTIVE' } });
  return true;
}
