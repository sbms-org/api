import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { Payment } from '../Entities/payment';
import { Unit } from '../Entities/unit';
import { pushNotificationService } from './push-notification.service';
import logger from '../configurations/logger';
import { UUID } from 'crypto';

export class PaymentGenerationService {
  private paymentRepository: Repository<Payment>;
  private unitRepository: Repository<Unit>;

  constructor() {
    this.paymentRepository = dataSource.getRepository(Payment);
    this.unitRepository = dataSource.getRepository(Unit);
  }

  /**
   * Generate payments for all occupied units that are due
   */
  async generateDuePayments(): Promise<{ created: number; notified: number }> {
    try {
      const moment = (await import('moment')).default;
      const today = moment().startOf('day');
      
      const units = await this.unitRepository.find({
        where: { status: 'occupied', is_active: true },
        relations: ['tenant', 'building'],
      });

      let created = 0;
      let notified = 0;

      for (const unit of units) {
        if (!unit.tenant_id || !unit.next_rent_due_date) continue;

        const dueDate = moment(unit.next_rent_due_date).startOf('day');
        const daysUntilDue = dueDate.diff(today, 'days');

        if (daysUntilDue <= 7 && daysUntilDue >= 0) {
          const existingPayment = await this.paymentRepository.findOne({
            where: {
              unit_id: unit.id,
              tenant_id: unit.tenant_id,
              status: 'pending',
              due_date: unit.next_rent_due_date,
            },
          });

          if (!existingPayment) {
            const payment = this.paymentRepository.create({
              amount: unit.rent_amount || 0,
              due_date: unit.next_rent_due_date,
              status: 'pending',
              tenant_id: unit.tenant_id,
              unit_id: unit.id,
            });

            await this.paymentRepository.save(payment);
            created++;

            await pushNotificationService.notifyTenantPaymentDue(
              unit.tenant_id,
              unit.unit_number,
              unit.building?.name || 'Building',
              unit.rent_amount || 0,
              unit.next_rent_due_date,
              daysUntilDue,
              payment.id
            );
            notified++;

            logger.info(`Generated payment for unit ${unit.unit_number}`);
          }
        }
      }

      logger.info(`Payment generation complete: ${created} created, ${notified} notified`);
      return { created, notified };
    } catch (error) {
      logger.error('Error generating due payments:', error);
      throw error;
    }
  }

  /**
   * Send overdue reminders
   */
  async sendOverdueReminders(): Promise<number> {
    try {
      const moment = (await import('moment')).default;
      const today = moment().startOf('day');

      const overduePayments = await this.paymentRepository.find({
        where: { status: 'pending' },
        relations: ['unit', 'unit.building'],
      });

      let reminded = 0;

      for (const payment of overduePayments) {
        const dueDate = moment(payment.due_date).startOf('day');
        const daysOverdue = today.diff(dueDate, 'days');

        if (daysOverdue > 0) {
          payment.status = 'overdue';
          await this.paymentRepository.save(payment);

          await pushNotificationService.notifyTenantPaymentOverdue(
            payment.tenant_id,
            payment.unit?.unit_number || 'Unit',
            payment.unit?.building?.name || 'Building',
            payment.amount,
            daysOverdue,
            payment.id
          );
          reminded++;
        }
      }

      logger.info(`Overdue reminders sent: ${reminded}`);
      return reminded;
    } catch (error) {
      logger.error('Error sending overdue reminders:', error);
      throw error;
    }
  }

  /**
   * Get all due payments for a tenant
   */
  async getTenantDuePayments(tenantId: UUID): Promise<any[]> {
    const moment = (await import('moment')).default;
    const { Receipt } = await import('../Entities/receipt');
    const today = moment().startOf('day');

    const payments = await this.paymentRepository.find({
      where: { tenant_id: tenantId },
      relations: ['unit', 'unit.building'],
      order: { due_date: 'ASC' },
    });

    // Get pending receipts for this tenant
    const receiptRepo = dataSource.getRepository(Receipt);
    const pendingReceipts = await receiptRepo.find({
      where: { tenant_id: tenantId, status: 'PENDING' },
    });

    const pendingReceiptUnitIds = new Set(pendingReceipts.map(r => r.unit_id));

    return payments
      .filter((p) => {
        const dueDate = moment(p.due_date).startOf('day');
        const daysUntilDue = dueDate.diff(today, 'days');
        // Show only payments due within 5 days (including overdue)
        return (p.status === 'pending' || p.status === 'overdue') && daysUntilDue <= 5;
      })
      .map((p) => {
        const dueDate = moment(p.due_date).startOf('day');
        const hasReceipt = pendingReceiptUnitIds.has(p.unit_id);
        return {
          ...p,
          daysUntilDue: dueDate.diff(today, 'days'),
          isDue: today.isSameOrAfter(dueDate),
          hasReceipt,
          receiptStatus: hasReceipt ? 'PENDING' : null,
        };
      });
  }

  /**
   * Create notifications for pending rent payments
   */
  async createRentDueNotifications(): Promise<number> {
    try {
      const moment = (await import('moment')).default;
      const { User } = await import('../Entities/user');
      const { Notification } = await import('../Entities/notification');
      const today = moment().startOf('day');
      
      const userRepo = dataSource.getRepository(User);
      const notificationRepo = dataSource.getRepository(Notification);

      const payments = await this.paymentRepository.find({
        where: { status: 'pending' },
        relations: ['unit', 'unit.building'],
      });

      let notificationsCreated = 0;

      for (const payment of payments) {
        const dueDate = moment(payment.due_date).startOf('day');
        const daysUntilDue = dueDate.diff(today, 'days');

        // Only notify for payments due within 5 days
        if (daysUntilDue > 5) continue;

        // Check if notification already exists for this payment today
        const existingNotification = await notificationRepo.findOne({
          where: {
            user_id: payment.tenant_id,
            title: `Rent Due: ${payment.unit?.unit_number || 'Unit'}`,
            created_at: moment().startOf('day').toDate() as any,
          },
        });

        if (existingNotification) continue;

        const user = await userRepo.findOne({ where: { id: payment.tenant_id } });
        if (!user) continue;

        const message = daysUntilDue <= 0
          ? `Your rent for ${payment.unit?.unit_number} is overdue. Please upload your receipt.`
          : `Your rent for ${payment.unit?.unit_number} is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}. Amount: ETB ${payment.amount}`;

        await notificationRepo.save({
          user_id: payment.tenant_id,
          title: `Rent Due: ${payment.unit?.unit_number || 'Unit'}`,
          message,
          type: 'payment_due',
          is_read: false,
        });

        notificationsCreated++;
      }

      return notificationsCreated;
    } catch (error) {
      logger.error('Error creating rent due notifications:', error);
      return 0;
    }
  }
}
