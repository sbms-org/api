import { Response } from 'express';

export interface ApiResponseData {
    success: boolean;
    message: string;
    data?: any;
    errorCode?: string;
}

export class ApiResponse {
    static success(res: Response, data: any = null, message: string = 'Success', status: number = 200) {
        return res.status(status).json({
            success: true,
            message,
            data,
        });
    }

    static error(res: Response, message: string = 'Internal Server Error', status: number = 500, errorCode?: string, data?: any) {
        return res.status(status).json({
            success: false,
            message,
            data,
            errorCode: errorCode || `ERR_${status}`,
        });
    }
}
