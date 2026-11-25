import { Request, Response, NextFunction } from 'express';
import logger from '../configurations/logger';

export const devSecretHandler = (req: Request, res: Response, next: NextFunction) => {
    const devSecret = process.env.DEV_SECRET;
    const clientSecret = req.headers['x-dev-secret'];

    if (process.env.NODE_ENV !== 'production' && devSecret && clientSecret === devSecret) {
        (req as any).isDevTesting = true;
        logger.info(`Dev Secret authenticated for ${req.method} ${req.url}`);
    } else {
        (req as any).isDevTesting = false;
    }

    next();
};
