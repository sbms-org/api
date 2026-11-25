import { NextFunction, Request, Response } from 'express';
import { ReceiptService } from '../services/receipt.service';
import { UUID } from 'crypto';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { dataSource } from '../configurations/db.config';
import { Unit } from '../Entities/unit';
import { Payment } from '../Entities/payment';

import { TenantService } from '../services/tenant.service';
import { User } from '../Entities';

export class TenantController {
  private receiptService: ReceiptService;
  private tenantService: TenantService;

  constructor() {
    this.receiptService = new ReceiptService();
    this.tenantService = new TenantService();
  }

  getOwnerPaymentMethods = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const unitId = req.params.unitId as UUID;

      const unit = await dataSource.getRepository(Unit).findOne({
        where: { id: unitId },
        relations: ['building']
      });

      if (!unit) {
        return ApiResponse.error(res, 'Unit not found', 404);
      }

      const ownerId = unit.building.owner_id;

      const { OwnerPaymentMethod } = await import('../Entities/owner_payment_method');
      const { PaymentMethod } = await import('../Entities/payment_method');

      // Join OwnerPaymentMethod with PaymentMethod to get the full details
      const ownerMethods = await dataSource.getRepository(OwnerPaymentMethod)
        .createQueryBuilder('opm')
        .innerJoinAndMapOne('opm.methodDetails', PaymentMethod, 'pm', 'pm.id = opm.payment_method_id')
        .where('opm.owner_id = :ownerId', { ownerId })
        .andWhere('opm.is_active = :isActive', { isActive: true })
        .getMany();

      // Transform to a clean format for the app
      const formattedMethods = ownerMethods.map(m => ({
        id: m.id,
        paymentMethodId: m.payment_method_id,
        name: (m as any).methodDetails.name,
        type: (m as any).methodDetails.type,
        bankName: m.account_number ? (m as any).methodDetails.bank_name : undefined,
        accountNumber: m.account_number,
        accountName: m.account_name,
        mobileNumber: m.mobile_number,
        provider: (m as any).methodDetails.provider,
        instructions: m.additional_info || (m as any).methodDetails.instructions,
        accountNumberHint: (m as any).methodDetails.account_number_hint,
        accountNameHint: (m as any).methodDetails.account_name_hint,
        mobileNumberHint: (m as any).methodDetails.mobile_number_hint,
      }));

      return ApiResponse.success(res, formattedMethods);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getTenants = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // tenants should only see their own assignments, not the global tenant list.
      // the previous implementation simply delegated to TenantService which
      // returned every tenant record in the database.  that's misleading and
      // exposes data the tenant shouldn't have access to.
      if (user?.role === 'tenant') {
        const tenantId = user.id;
        const { TenantAssignment } = await import('../Entities/tenant_assignment');
        const assignments = await dataSource.getRepository(TenantAssignment).find({
          where: { tenant_id: tenantId },
          relations: ['unit', 'unit.building'],
        });

        // return just the assigned units similar to /tenant/my-units
        const units = assignments.map(a => a.unit);
        return ApiResponse.success(res, units);
      }

      // fallback for other roles (owner/admin) – still return full tenant list
      const tenants = await this.tenantService.getTenants();
      return ApiResponse.success(res, tenants);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  createTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = await this.tenantService.createTenant(req.body);
      return ApiResponse.success(res, tenant, 'Tenant created successfully', 201);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as UUID;
      const tenant = await this.tenantService.getTenantById(id);
      if (!tenant) return ApiResponse.error(res, 'Tenant not found', 404);
      return ApiResponse.success(res, tenant);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  updateTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as UUID;
      const tenant = await this.tenantService.updateTenant(id, req.body);
      if (!tenant) return ApiResponse.error(res, 'Tenant not found', 404);
      return ApiResponse.success(res, tenant, 'Tenant updated successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  deleteTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as UUID;
      const success = await this.tenantService.deleteTenant(id);
      if (!success) return ApiResponse.error(res, 'Tenant not found', 404);
      return ApiResponse.success(res, null, 'Tenant deleted successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getMyUnits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.id;
      
      if (!tenantId) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      // Get active tenant assignments for this user
      const { TenantAssignment } = await import('../Entities/tenant_assignment');
      const assignments = await dataSource.getRepository(TenantAssignment).find({
        where: { tenant_id: tenantId, active: true },
        relations: ['unit', 'unit.building']
      });

      const units = assignments.map(a => a.unit);

      return ApiResponse.success(res, units);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };
  
  uploadReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.id || req.query.tenantId;
      const { unitId, notes, paymentMethodId, receiptUrl: directUrl } = req.body;
      const file = req.file as Express.Multer.File;

      // Check for due payment warning
      const paymentRepo = dataSource.getRepository(Payment);
      const duePayment = await paymentRepo.findOne({
        where: { unit_id: unitId, tenant_id: tenantId, status: 'pending' },
        relations: ['unit']
      });

      if (!duePayment) {
        return ApiResponse.error(res, 'No pending payment found for this unit', 400);
      }

      let receiptUrl = directUrl;

      if (file && file.buffer) {
        const { UploadService } = await import('../services/upload.service');
        receiptUrl = await UploadService.uploadBufferToCloudinary(file.buffer, 'receipts');
      }

      if (!unitId || !receiptUrl) {
        return ApiResponse.error(res, 'unitId and receipt file/URL are required', 400);
      }

      const receipt = await this.receiptService.uploadReceipt(tenantId, unitId as UUID, receiptUrl, paymentMethodId, notes);

      // Notify owner
      const unit = await dataSource.getRepository(Unit).findOne({
        where: { id: unitId },
        relations: ['building']
      });

      if (unit?.building?.owner_id) {
        const { notificationService } = await import('../services/notification.service');
        await notificationService.sendFromTemplate(
          unit.building.owner_id,
          'receipt_uploaded',
          {
            unit_number: unit.unit_number,
            tenant_name: 'Tenant'
          },
          'Receipt',
          receipt.id
        );
      }

      return ApiResponse.success(res, receipt, 'Receipt uploaded successfully', 201);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getDuePayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.id;
      const { PaymentGenerationService } = await import('../services/payment-generation.service');
      const paymentGenService = new PaymentGenerationService();

      const duePayments = await paymentGenService.getTenantDuePayments(tenantId);

      return ApiResponse.success(res, duePayments);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.id || req.query.tenantId;
      const { notificationService } = await import('../services/notification.service');
      const notifications = await notificationService.getUserNotifications(tenantId);
      return ApiResponse.success(res, notifications);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as UUID;
      const { notificationService } = await import('../services/notification.service');
      await notificationService.markAsRead(id);
      return ApiResponse.success(res, null, 'Notification marked as read');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.id || req.query.tenantId;
      const { notificationService } = await import('../services/notification.service');
      await notificationService.markAllAsRead(tenantId);
      return ApiResponse.success(res, null, 'All notifications marked as read');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.id;
      const unitId = req.params.unitId as UUID;
      const payments = await dataSource.getRepository(Payment).find({
        where: { tenant_id: tenantId, unit_id: unitId },
        order: { created_at: 'DESC' },
      });
      return ApiResponse.success(res, payments);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.id || req.query.tenantId;

      const unitRepo = dataSource.getRepository(Unit);
      const units = await unitRepo.find({
        where: { tenant_id: tenantId, is_active: true },
        relations: ['building'],
      });

      const paymentRepo = dataSource.getRepository(Payment);
      const payments = await paymentRepo.find({
        where: { tenant_id: tenantId, status: 'paid' },
      });

      const receiptRepo = dataSource.getRepository(require('../Entities/receipt').Receipt);
      const pendingReceipts = await receiptRepo.count({
        where: { tenant_id: tenantId, status: 'PENDING' }
      });

      const moment = (await import('moment')).default;
      const overdueUnits = units.filter(u =>
        u.next_rent_due_date && moment(u.next_rent_due_date).isBefore(moment())
      ).length;

      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      const stats = {
        totalUnits: units.length,
        overdueUnits,
        pendingReceipts,
        totalPaid,
        units: units.map(u => ({
          id: u.id,
          unitNumber: u.unit_number,
          buildingName: u.building?.name,
          rentAmount: u.rent_amount,
          nextDueDate: u.next_rent_due_date,
          isOverdue: u.next_rent_due_date ? moment(u.next_rent_due_date).isBefore(moment()) : false,
        })),
      };

      return ApiResponse.success(res, stats);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  updateFcmToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { fcmToken } = req.body;

      if (!fcmToken) {
        return ApiResponse.error(res, 'FCM token is required', 400);
      }

      await dataSource.getRepository(User).update(userId, { fcm_token: fcmToken });

      return ApiResponse.success(res, null, 'FCM token updated successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  updateNotificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { email } = req.body;

      // Validate email format if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return ApiResponse.error(res, 'Invalid email format', 400);
      }

      await dataSource.getRepository(User).update(userId, {
        notification_email: email || null
      });

      return ApiResponse.success(res, null, 'Notification email updated successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };
}