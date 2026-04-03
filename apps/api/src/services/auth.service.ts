import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AuthError, AppError, NotFoundError } from '../types/errors.js';
import { AuthUser } from '@pocketcomputer/shared-types';

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
    '-' + Math.random().toString(36).slice(2, 6);
}

function signAccessToken(user: { id: string; tenant_id: string; role: string; email: string }) {
  const expiresIn = env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>;

  return jwt.sign(
    { tenant_id: user.tenant_id, role: user.role, email: user.email },
    env.JWT_SECRET,
    { subject: user.id, expiresIn }
  );
}

async function createRefreshToken(userId: string, tenantId: string, familyId?: string) {
  const raw = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      tenant_id: tenantId,
      token_hash: hash,
      family_id: familyId ?? uuidv4(),
      expires_at: expiresAt,
    },
  });

  return raw;
}

export async function register(input: {
  email: string;
  password: string;
  full_name: string;
  company_name: string;
}) {
  const existingUser = await prisma.user.findFirst({ where: { email: input.email } });
  if (existingUser) {
    throw new AppError('EMAIL_EXISTS', 'An account with this email already exists.', 409);
  }

  const password_hash = await bcrypt.hash(input.password, 12);
  const slug = generateSlug(input.company_name);

  const [tenant, geminiProvider] = await Promise.all([
    prisma.tenant.create({
      data: { name: input.company_name, slug },
    }),
    prisma.llmProvider.findFirst({ where: { name: 'gemini' } }),
  ]);

  if (!geminiProvider) {
    throw new AppError('SETUP_ERROR', 'Default LLM provider not configured.', 500);
  }

  const user = await prisma.user.create({
    data: {
      tenant_id: tenant.id,
      email: input.email,
      password_hash,
      full_name: input.full_name,
      role: 'TENANT_ADMIN',
    },
  });

  const access_token = signAccessToken(user);
  const refresh_token = await createRefreshToken(user.id, tenant.id);

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    plan: tenant.plan,
  };

  return { user: authUser, access_token, refresh_token };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findFirst({
    where: { email: input.email },
    include: { tenant: true },
  });

  if (!user || user.status === 'INACTIVE') {
    throw new AuthError('Invalid email or password');
  }

  if (user.status === 'LOCKED' && user.locked_until && user.locked_until > new Date()) {
    throw new AppError('ACCOUNT_LOCKED', 'Account is temporarily locked. Try again later.', 423);
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    const attempts = user.failed_attempts + 1;
    const update: Parameters<typeof prisma.user.update>[0]['data'] = { failed_attempts: attempts };
    if (attempts >= 5) {
      update.status = 'LOCKED';
      update.locked_until = new Date(Date.now() + 15 * 60 * 1000);
    }
    await prisma.user.update({ where: { id: user.id }, data: update });
    throw new AuthError('Invalid email or password');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failed_attempts: 0, last_login_at: new Date(), status: 'ACTIVE', locked_until: null },
  });

  const access_token = signAccessToken(user);
  const refresh_token = await createRefreshToken(user.id, user.tenant_id);

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    tenant_id: user.tenant_id,
    tenant_name: user.tenant.name,
    plan: user.tenant.plan,
  };

  return { user: authUser, access_token, refresh_token };
}

export async function refreshAccessToken(rawToken: string) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const token = await prisma.refreshToken.findUnique({
    where: { token_hash: hash },
    include: { user: { include: { tenant: true } } },
  });

  if (!token || !token.is_valid || token.expires_at < new Date()) {
    // If token exists but is invalid — possible reuse, invalidate whole family
    if (token && !token.is_valid) {
      await prisma.refreshToken.updateMany({
        where: { family_id: token.family_id },
        data: { is_valid: false },
      });
    }
    throw new AuthError('Invalid or expired refresh token', 'TOKEN_EXPIRED');
  }

  // Rotate: invalidate old, issue new
  await prisma.refreshToken.update({ where: { id: token.id }, data: { is_valid: false } });
  const newRaw = await createRefreshToken(token.user.id, token.tenant_id, token.family_id);
  const access_token = signAccessToken(token.user);

  return { access_token, refresh_token: newRaw };
}

export async function logout(rawToken: string) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.refreshToken.updateMany({ where: { token_hash: hash }, data: { is_valid: false } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  if (!user) throw new NotFoundError('User');

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    tenant_id: user.tenant_id,
    tenant_name: user.tenant.name,
    plan: user.tenant.plan,
  };
  return authUser;
}
