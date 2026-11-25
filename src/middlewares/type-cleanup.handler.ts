import { Request, Response, NextFunction } from 'express';

export const typeCleanupHandler = (req: Request, res: Response, next: NextFunction) => {
    const convertNullOrFalse = (data: any) => {
        if (!data || typeof data !== 'object') return;

        for (const key in data) {
            if (data[key] && typeof data[key] === 'object') {
                convertNullOrFalse(data[key]);
                continue;
            }
            if (typeof data[key] !== 'string') {
                continue;
            }
            const value = data[key].toLowerCase();
            if (value === 'null') {
                data[key] = null;
            } else if (value === 'undefined') {
                data[key] = undefined;
            } else if (value === 'false') {
                data[key] = false;
            } else if (value === 'true') {
                data[key] = true;
            }
        }
    };

    try {
        convertNullOrFalse(req.body);
        convertNullOrFalse(req.query);
    } catch (err) {
        // Ignore cleanup errors
    }
    next();
};
