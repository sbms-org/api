// import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
// import { User } from '../Entities/user';
import { unifiedNotificationService } from './unified-notification.service';
import logger from '../configurations/logger';
import { UUID } from 'crypto';

export class PushNotificationService {
  private static instance: PushNotificationService;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  // ==================== TENANT → OWNER NOTIFICATIONS ====================

  /**
   * Tenant uploaded payment receipt
   */
  async notifyOwnerReceiptUploaded(
    ownerId: UUID,
    tenantName: string,
    unitNumber: string,
    buildingName: string,
    receiptId: UUID,
    amount: number
  ): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);

    await unifiedNotificationService.sendNotification(
      ownerId,
      '📄 New Receipt Uploaded',
      `${tenantName} uploaded a payment receipt for ${unitNumber} (${buildingName}) - ${formattedAmount}. Review now.`,
      'receipt_uploaded',
      'Receipt',
      receiptId,
      { action: 'review_receipt', receiptId, unitNumber, amount: amount.toString() }
    );
  }

  async notifyOwnerTenantMessage(
    ownerId: UUID,
    tenantName: string,
    unitNumber: string,
    messagePreview: string
  ): Promise<void> {
    await unifiedNotificationService.sendNotification(
      ownerId,
      '💬 New Message from Tenant',
      `${tenantName} (${unitNumber}): ${messagePreview}`,
      'tenant_message',
      undefined,
      undefined,
      { action: 'view_messages', unitNumber }
    );
  }

  async notifyOwnerMaintenanceRequest(
    ownerId: UUID,
    tenantName: string,
    unitNumber: string,
    buildingName: string,
    issue: string,
    requestId: UUID
  ): Promise<void> {
    await unifiedNotificationService.sendNotification(
      ownerId,
      '🔧 Maintenance Request',
      `${tenantName} reported: "${issue}" in ${unitNumber} (${buildingName})`,
      'maintenance_request',
      'MaintenanceRequest',
      requestId,
      { action: 'view_maintenance', requestId, unitNumber }
    );
  }

  // ==================== OWNER → TENANT NOTIFICATIONS ====================

  async notifyTenantReceiptApproved(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    amount: number,
    receiptId: UUID
  ): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);

    await unifiedNotificationService.sendNotification(
      tenantId,
      '✅ Receipt Approved',
      `Your payment of ${formattedAmount} for ${unitNumber} (${buildingName}) has been approved. Thank you!`,
      'receipt_approved',
      'Receipt',
      receiptId,
      { action: 'view_receipt', receiptId, status: 'approved' }
    );
  }

  async notifyTenantReceiptRejected(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    amount: number,
    reason: string,
    receiptId: UUID
  ): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);

    await unifiedNotificationService.sendNotification(
      tenantId,
      '❌ Receipt Rejected',
      `Your payment receipt for ${unitNumber} (${buildingName}) - ${formattedAmount} was rejected. Reason: ${reason}. Please resubmit.`,
      'receipt_rejected',
      'Receipt',
      receiptId,
      { action: 'resubmit_receipt', receiptId, status: 'rejected', reason }
    );
  }

  async notifyTenantOwnerMessage(
    tenantId: UUID,
    ownerName: string,
    unitNumber: string,
    messagePreview: string
  ): Promise<void> {
    await unifiedNotificationService.sendNotification(
      tenantId,
      '💬 Message from Owner',
      `${ownerName}: ${messagePreview}`,
      'owner_message',
      undefined,
      undefined,
      { action: 'view_messages', unitNumber }
    );
  }

  async notifyTenantMaintenanceScheduled(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    scheduledDate: Date,
    description: string
  ): Promise<void> {
    const moment = (await import('moment')).default;
    const formattedDate = moment(scheduledDate).format('MMM DD, YYYY [at] h:mm A');

    await unifiedNotificationService.sendNotification(
      tenantId,
      '🔧 Maintenance Scheduled',
      `Maintenance scheduled for ${unitNumber} (${buildingName}) on ${formattedDate}. ${description}`,
      'maintenance_scheduled',
      undefined,
      undefined,
      { action: 'view_maintenance', unitNumber, scheduledDate: scheduledDate.toISOString() }
    );
  }

  async notifyTenantLeaseUpdate(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    updateType: string
  ): Promise<void> {
    await unifiedNotificationService.sendNotification(
      tenantId,
      '📋 Lease Update',
      `Your lease for ${unitNumber} (${buildingName}) has been updated. ${updateType}. Please review.`,
      'lease_update',
      undefined,
      undefined,
      { action: 'view_lease', unitNumber }
    );
  }

  // ==================== PAYMENT NOTIFICATIONS ====================

  async notifyTenantPaymentDue(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    amount: number,
    dueDate: Date,
    daysUntilDue: number,
    paymentId: UUID
  ): Promise<void> {
    const moment = (await import('moment')).default;
    const formattedDate = moment(dueDate).format('MMM DD, YYYY');
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);

    let title: string;
    let message: string;

    if (daysUntilDue === 0) {
      title = '🔔 Rent Payment Due Today';
      message = `Your rent for ${unitNumber} (${buildingName}) of ${formattedAmount} is due today. Please upload your payment receipt.`;
    } else if (daysUntilDue === 1) {
      title = '⏰ Rent Payment Due Tomorrow';
      message = `Your rent for ${unitNumber} (${buildingName}) of ${formattedAmount} is due tomorrow (${formattedDate}). Please prepare your payment.`;
    } else {
      title = '📅 Upcoming Rent Payment';
      message = `Your rent for ${unitNumber} (${buildingName}) of ${formattedAmount} is due in ${daysUntilDue} days (${formattedDate}).`;
    }

    await unifiedNotificationService.sendNotification(
      tenantId,
      title,
      message,
      'payment_due',
      'Payment',
      paymentId,
      { action: 'pay_rent', paymentId, unitNumber, amount: amount.toString(), dueDate: dueDate.toISOString() }
    );
  }

  async notifyTenantPaymentOverdue(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    amount: number,
    daysOverdue: number,
    paymentId: UUID
  ): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);

    await unifiedNotificationService.sendNotification(
      tenantId,
      '⚠️ Overdue Rent Payment',
      `Your rent for ${unitNumber} (${buildingName}) of ${formattedAmount} is ${daysOverdue} day(s) overdue. Please upload your payment receipt immediately.`,
      'payment_overdue',
      'Payment',
      paymentId,
      { action: 'pay_rent', paymentId, unitNumber, amount: amount.toString(), daysOverdue: daysOverdue.toString() }
    );
  }

  // ==================== SYSTEM NOTIFICATIONS ====================

  async notifyTenantWelcome(
    tenantId: UUID,
    tenantName: string,
    unitNumber: string,
    buildingName: string
  ): Promise<void> {
    await unifiedNotificationService.sendNotification(
      tenantId,
      '🎉 Welcome to Your New Home!',
      `Welcome ${tenantName}! You've been assigned to ${unitNumber} in ${buildingName}. We're glad to have you!`,
      'welcome',
      undefined,
      undefined,
      { action: 'view_unit', unitNumber }
    );
  }

  async notifyTenantLeaseExpiring(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    expiryDate: Date,
    daysUntilExpiry: number
  ): Promise<void> {
    const moment = (await import('moment')).default;
    const formattedDate = moment(expiryDate).format('MMM DD, YYYY');

    await unifiedNotificationService.sendNotification(
      tenantId,
      '📅 Lease Expiring Soon',
      `Your lease for ${unitNumber} (${buildingName}) expires in ${daysUntilExpiry} days (${formattedDate}). Please contact your owner for renewal.`,
      'lease_expiring',
      undefined,
      undefined,
      { action: 'view_lease', unitNumber, expiryDate: expiryDate.toISOString() }
    );
  }

  async notifyOwnerPendingReceipts(
    ownerId: UUID,
    pendingCount: number
  ): Promise<void> {
    if (pendingCount === 0) return;

    await unifiedNotificationService.sendNotification(
      ownerId,
      '📋 Pending Receipt Reviews',
      `You have ${pendingCount} payment receipt${pendingCount > 1 ? 's' : ''} waiting for your review.`,
      'receipt_uploaded',
      undefined,
      undefined,
      { action: 'review_receipts', count: pendingCount.toString() }
    );
  }

  // ==================== ASSIGNMENT NOTIFICATIONS ====================

  /**
   * Notify a tenant that they have been assigned to a unit.
   * startDate is used in message if available.
   */
  async notifyTenantAssigned(
    tenantId: UUID,
    unitNumber: string,
    buildingName: string,
    startDate?: Date
  ): Promise<void> {
    const moment = (await import('moment')).default;
    let message = `You've been assigned to ${unitNumber} (${buildingName}).`;
    if (startDate) {
      message += ` Lease starts ${moment(startDate).format('DD MMM YYYY')}.`;
    }

    await unifiedNotificationService.sendNotification(
      tenantId,
      '🏠 You Have a New Home!',
      message,
      'tenant_assigned',
      undefined,
      undefined,
      { action: 'view_unit', unitNumber }
    );
  }

  /**
   * Notify an owner that a tenant has been assigned to one of their units.
   */
  async notifyOwnerTenantAssigned(
    ownerId: UUID,
    tenantName: string,
    unitNumber: string,
    buildingName: string
  ): Promise<void> {
    await unifiedNotificationService.sendNotification(
      ownerId,
      '👤 Tenant Assigned',
      `${tenantName} has been assigned to ${unitNumber} (${buildingName}).`,
      'tenant_assignment',
      'Unit',
      undefined,
      { action: 'view_unit', unitNumber }
    );
  }

  /**
   * Notify all active property managers (and optionally the owner) for a building
   * about a new tenant assignment. This uses the same message format as the owner
   * notification but sends to each manager as well.
   */
  async notifyBuildingManagersTenantAssigned(
    buildingId: UUID,
    ownerId: UUID,
    tenantName: string,
    unitNumber: string,
    buildingName: string,
    includeOwner: boolean = true
  ): Promise<void> {
    const { BuildingManagement } = await import('../Entities/building_management');
    const repo = dataSource.getRepository(BuildingManagement);
    const assignments = await repo.find({where:{building_id: buildingId as any, is_active: true}});
    const userIds = new Set<UUID>();
    if (includeOwner) userIds.add(ownerId);
    assignments.forEach(a => userIds.add(a.manager_id));

    const title = '👤 Tenant Assigned';
    const message = `${tenantName} has been assigned to ${unitNumber} (${buildingName}).`;

    for (const userId of userIds) {
      await unifiedNotificationService.sendNotification(
        userId,
        title,
        message,
        'tenant_assignment',
        'Unit',
        undefined,
        { action: 'view_unit', unitNumber }
      );
    }
  }

  // existing method follows
  async notifyBuildingTenants(
    buildingId: UUID,
    title: string,
    message: string
  ): Promise<void> {
    try {
      const { Unit } = await import('../Entities/unit');
      const units = await dataSource.getRepository(Unit).find({
        where: { building_id: buildingId, status: 'occupied' },
        relations: ['tenant'],
      });

      const tenantIds = units
        .filter(u => u.tenant_id)
        .map(u => u.tenant_id);

      for (const tenantId of tenantIds) {
        await unifiedNotificationService.sendNotification(
          tenantId,
          title,
          message,
          'building_announcement',
          undefined,
          undefined,
          { action: 'view_announcement', buildingId }
        );
      }

      logger.info(`Broadcast notification sent to ${tenantIds.length} tenants in building ${buildingId}`);
    } catch (error) {
      logger.error('Error sending building broadcast:', error);
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
