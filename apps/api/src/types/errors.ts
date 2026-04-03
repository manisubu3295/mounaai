export class AppError extends Error {
  constructor(
    public readonly code: string,
    public override readonly message: string,
    public readonly statusCode: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class PlanGateError extends AppError {
  constructor(public readonly feature: string) {
    super('PLAN_LIMIT_EXCEEDED', 'Upgrade to Pro to access this feature.', 402);
  }
}

export class ConnectorError extends AppError {
  constructor(message: string, code = 'CONNECTOR_EXEC_FAILED', retryable = false) {
    super(code, message, 503, retryable);
  }
}

export class LLMError extends AppError {
  constructor(message: string, code = 'LLM_UNAVAILABLE', retryable = false) {
    super(code, message, 503, retryable);
  }
}

export class SecurityError extends AppError {
  constructor(message: string) {
    super('SECURITY_VIOLATION', message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super('CONFLICT', message, 409);
  }
}
