import { NextFunction, Request, Response } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiResponse } from '../utils/ApiResponse';

export const validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        for (const validation of validations) {
            await validation.run(req);
        }

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        return ApiResponse.error(
            res,
            'Validation Error',
            400,
            'VALIDATION_ERROR',
            errors.array()
        );
    };
};
