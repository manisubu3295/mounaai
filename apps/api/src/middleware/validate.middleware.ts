import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate<T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const err = result.error as ZodError;
      return _res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: err.flatten(),
          request_id: req.id,
        },
      });
    }
    if (source === 'body') req.validatedBody = result.data;
    next();
  };
}
