import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Application error', {
        code: err.code,
        message: err.message,
        request_id: req.id,
        tenant_id: req.user?.tenant_id,
        user_id: req.user?.id,
      });
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        request_id: req.id,
      },
    });
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    request_id: req.id,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      request_id: req.id,
    },
  });
}
