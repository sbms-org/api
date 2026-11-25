import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';
import { PaymentGenerationService } from '../services/payment-generation.service';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';

const router: Router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(['admin', 'owner']));

/**
 * Manually trigger payment generation
 * POST /api/v1/jobs/generate-payments
 */
router.post('/generate-payments', async (req, res, next) => {
  try {
    const paymentService = new PaymentGenerationService();
    const result = await paymentService.generateDuePayments();
    
    return ApiResponse.success(res, result, 'Payment generation completed');
  } catch (error) {
    logger.error('Manual payment generation failed:', error);
    return next(error);
  }
});

/**
 * Send overdue reminders
 * POST /api/v1/jobs/send-overdue-reminders
 */
router.post('/send-overdue-reminders', async (req, res, next) => {
  try {
    const paymentService = new PaymentGenerationService();
    const reminded = await paymentService.sendOverdueReminders();
    
    return ApiResponse.success(res, { reminded }, 'Overdue reminders sent');
  } catch (error) {
    logger.error('Overdue reminders failed:', error);
    return next(error);
  }
});

export default router;
