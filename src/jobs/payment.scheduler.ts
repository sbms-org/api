import cron from 'node-cron';
import { PaymentGenerationService } from '../services/payment-generation.service';
import logger from '../configurations/logger';

export class PaymentScheduler {
  private paymentService: PaymentGenerationService;

  constructor() {
    this.paymentService = new PaymentGenerationService();
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    // Run daily at 6:00 AM to generate due payments
    cron.schedule('0 6 * * *', async () => {
      logger.info('Running scheduled payment generation job...');
      try {
        const result = await this.paymentService.generateDuePayments();
        logger.info(`Payment generation completed: ${result.created} created, ${result.notified} notified`);
      } catch (error) {
        logger.error('Payment generation job failed:', error);
      }
    });

    // Run daily at 9:00 AM to send overdue reminders
    cron.schedule('0 9 * * *', async () => {
      logger.info('Running scheduled overdue reminder job...');
      try {
        const reminded = await this.paymentService.sendOverdueReminders();
        logger.info(`Overdue reminders sent: ${reminded}`);
      } catch (error) {
        logger.error('Overdue reminder job failed:', error);
      }
    });

    // Run at 6:00 PM to send evening reminders for payments due tomorrow
    cron.schedule('0 18 * * *', async () => {
      logger.info('Running evening reminder job...');
      try {
        await this.paymentService.generateDuePayments();
      } catch (error) {
        logger.error('Evening reminder job failed:', error);
      }
    });

    logger.info('Payment scheduler started successfully');
  }

  /**
   * Run payment generation manually (for testing)
   */
  async runManually(): Promise<void> {
    logger.info('Running manual payment generation...');
    const result = await this.paymentService.generateDuePayments();
    logger.info(`Manual generation completed: ${result.created} created, ${result.notified} notified`);
  }
}
