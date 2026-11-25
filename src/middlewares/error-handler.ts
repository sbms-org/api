import { Request, Response, NextFunction } from 'express';
import logger from '../configurations/logger';
import { ApiResponse } from '../utils/ApiResponse';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`${req.method} ${req.url} - ${message}`, {
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    correlationId: req.headers['x-correlation-id'],
  });

  return ApiResponse.error(
    res,
    message,
    status,
    err.errorCode || 'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? undefined : { stack: err.stack }
  );
};
