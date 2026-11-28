/* src/routers/auth.routes.ts */

import { Router } from 'express';
import { body } from 'express-validator';
import AuthController from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.handler';
import { ApiResponse } from '../utils/ApiResponse';

const router: Router = Router();

router.post(
  '/send-otp',
  validate([
    body('mobile').notEmpty().withMessage('Mobile number is required'),
  ]),
  async (req, res, next) => {
    try {
      const { mobile } = req.body;
      const result = await AuthController.sendOtp(
        mobile,
        false,
        req.get('X-SBMS-Data-Mode') === 'database',
      );
      return ApiResponse.success(res, result, 'OTP sent successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/verify-otp',
  validate([
    body('mobile').notEmpty().withMessage('Mobile number is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ]),
  async (req, res, next) => {
    try {
      const { mobile, otp } = req.body;
      const result = await AuthController.verifyOtp(
        mobile,
        otp,
        req.get('X-SBMS-Data-Mode') === 'database',
      );
      return ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/register',
  validate([
    body('mobile').notEmpty().withMessage('Mobile number is required'),
    body('fullname').notEmpty().withMessage('Full name is required'),
  ]),
  async (req, res, next) => {
    try {
      const { mobile, fullname } = req.body;
      const result = await AuthController.registerClient(
        fullname,
        mobile,
        req.get('X-SBMS-Data-Mode') === 'database',
      );
      return ApiResponse.success(res, result, 'Registration initiated');
    } catch (error) {
      return next(error);
    }
  }
);

export const AuthRouter: Router = router;
