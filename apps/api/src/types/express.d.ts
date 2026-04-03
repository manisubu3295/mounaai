import { UserRole } from '@pocketcomputer/shared-types';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        tenant_id: string;
        role: UserRole;
        email: string;
      };
      validatedBody?: unknown;
    }
  }
}

export {};
