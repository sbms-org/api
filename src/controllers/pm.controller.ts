import { NextFunction, Request, Response } from 'express';
import { BuildingService } from '../services/building.service';
import { ReceiptService } from '../services/receipt.service';
import { UUID } from 'crypto';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { dataSource } from '../configurations/db.config';
import { User } from '../Entities/user';
import { Unit } from '../Entities/unit';
import { Payment } from '../Entities/payment';
import { MoreThanOrEqual } from 'typeorm';
import moment from 'moment';
import { ReportService } from '../services/report.service';
import { AnalyticsService } from '../services/analytics.service';
import { notificationService } from '../services/notification.service';

export class PropertyManagerController {
    private buildingService: BuildingService;
    private receiptService: ReceiptService;
    private reportService: ReportService;
    private analyticsService: AnalyticsService;

    constructor() {
        this.buildingService = new BuildingService();
        this.receiptService = new ReceiptService();
        this.reportService = new ReportService();
        this.analyticsService = new AnalyticsService();
    }

    exportReports = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const typeParam = req.query.type as string;
            const format = (req.query.format as string) || 'excel';

            if (!typeParam) {
                return ApiResponse.error(res, 'At least one report type is required', 400);
            }

            const types = typeParam.split(',').map(t => t.trim());

            const buildings = await this.buildingService.getBuildingsByManager(user.id, 'can_export_reports');
            const buildingIds = buildings.map(b => b.id);

            if (buildingIds.length === 0) {
                return ApiResponse.error(res, 'No buildings assigned to you with export permissions', 403);
            }

            return await this.reportService.exportCompositeReport(
                buildingIds,
                res,
                format as any,
                types,
                {
                    startDate: req.query.startDate as string,
                    endDate: req.query.endDate as string,
                    floor: req.query.floor ? parseInt(req.query.floor as string) : undefined,
                    unitId: req.query.unitId as UUID
                }
            );
        } catch (error) {
            logger.error('PM Controller Export Error:', error);
            if (!res.headersSent) {
                return next(error);
            }
        }
    };

    getBuildings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const buildings = await this.buildingService.getBuildingsByManager(user.id);
            return ApiResponse.success(res, buildings);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getPendingReceipts = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const buildings = await this.buildingService.getBuildingsByManager(user.id, 'can_manage_receipts');
            const buildingIds = buildings.map(b => b.id);

            if (buildingIds.length === 0) return ApiResponse.success(res, []);

            const receipts = await this.receiptService.getPendingReceiptsForBuildings(buildingIds);
            return ApiResponse.success(res, receipts);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    acceptReceipt = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const { receiptId } = req.params;
            const { notes } = req.body;

            const { Receipt } = await import('../Entities/receipt');
            const receipt = await dataSource.getRepository(Receipt).findOne({
                where: { id: receiptId as UUID },
                relations: ['unit']
            });
            if (!receipt) return ApiResponse.error(res, 'Receipt not found', 404);

            const building = await this.buildingService.getBuildingById(receipt.unit.building_id, user.id, 'property_manager', 'can_manage_receipts');
            if (!building) return ApiResponse.error(res, 'Access denied or missing can_manage_receipts permission', 403);

            const updatedReceipt = await this.receiptService.acceptReceipt(receiptId as UUID, notes);
            return ApiResponse.success(res, updatedReceipt, 'Receipt accepted successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    rejectReceipt = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const { receiptId } = req.params;
            const { reason } = req.body;

            const { Receipt } = await import('../Entities/receipt');
            const receipt = await dataSource.getRepository(Receipt).findOne({
                where: { id: receiptId as UUID },
                relations: ['unit']
            });
            if (!receipt) return ApiResponse.error(res, 'Receipt not found', 404);

            const building = await this.buildingService.getBuildingById(receipt.unit.building_id, user.id, 'property_manager', 'can_manage_receipts');
            if (!building) return ApiResponse.error(res, 'Access denied or missing can_manage_receipts permission', 403);

            const updatedReceipt = await this.receiptService.rejectReceipt(receiptId as UUID, reason);
            return ApiResponse.success(res, updatedReceipt, 'Receipt rejected');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updateUnitCycle = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const unitId = req.params.id as UUID;
            const { cycleMonths } = req.body;

            const unitRepo = dataSource.getRepository(Unit);
            const unit = await unitRepo.findOneBy({ id: unitId });
            if (!unit) return ApiResponse.error(res, 'Unit not found', 404);

            const building = await this.buildingService.getBuildingById(unit.building_id, user.id, 'property_manager', 'can_manage_units');
            if (!building) return ApiResponse.error(res, 'Access denied or missing can_manage_units permission', 403);

            unit.payment_cycle_months = cycleMonths;
            await unitRepo.save(unit);

            return ApiResponse.success(res, unit, 'Payment cycle updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getTenantHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const tenantId = req.params.id as UUID;

            // Should verify PM has access to this tenant (via at least one unit/building)
            // For simplicity, let's just fetch the history but we should ideally filter.
            // Actually, better to check if any unit of this tenant is managed by this PM.
            const query = dataSource.getRepository(Unit).createQueryBuilder('unit')
                .where('unit.tenant_id = :tenantId', { tenantId });

            const units = await query.getMany();
            let hasAccess = false;
            for (const unit of units) {
                const b = await this.buildingService.getBuildingById(unit.building_id, user.id, 'property_manager', 'can_manage_tenants');
                if (b) {
                    hasAccess = true;
                    break;
                }
            }

            if (!hasAccess) return ApiResponse.error(res, 'Access denied or missing can_manage_tenants permission', 403);

            const oneYearAgo = moment().subtract(1, 'year').toDate();
            const paymentRepo = dataSource.getRepository(Payment);
            const history = await paymentRepo.find({
                where: {
                    tenant_id: tenantId,
                    created_at: MoreThanOrEqual(oneYearAgo),
                },
                order: { created_at: 'DESC' },
            });

            return ApiResponse.success(res, history);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const buildings = await this.buildingService.getBuildingsByManager(user.id, 'can_view_dashboard');
            const buildingIds = buildings.map(b => b.id);

            if (buildingIds.length === 0) {
                return ApiResponse.success(res, {
                    totalBuildings: 0,
                    totalUnits: 0,
                    occupiedUnits: 0,
                    vacantUnits: 0,
                    maintenanceUnits: 0,
                    occupancyRate: 0,
                    pendingReceipts: 0,
                    totalRevenue: 0,
                    overduePayments: 0,
                    overdueAmount: 0,
                });
            }

            const unitRepo = dataSource.getRepository(Unit);
            const units = await unitRepo
                .createQueryBuilder('unit')
                .where('unit.building_id IN (:...buildingIds)', { buildingIds })
                .getMany();

            const receipts = await this.receiptService.getPendingReceiptsForBuildings(buildingIds);
            const pendingReceipts = receipts.length;

            const paymentRepo = dataSource.getRepository(Payment);

            // Total revenue (all paid payments for these buildings)
            const paidPayments = await paymentRepo
                .createQueryBuilder('p')
                .leftJoin('p.unit', 'unit')
                .where('unit.building_id IN (:...buildingIds)', { buildingIds })
                .andWhere('p.status = :status', { status: 'paid' })
                .getMany();
            const totalRevenue = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

            // Overdue payments
            const overduePaymentList = await paymentRepo
                .createQueryBuilder('p')
                .leftJoin('p.unit', 'unit')
                .where('unit.building_id IN (:...buildingIds)', { buildingIds })
                .andWhere('p.status = :status', { status: 'overdue' })
                .getMany();
            const overduePayments = overduePaymentList.length;
            const overdueAmount = overduePaymentList.reduce((sum, p) => sum + Number(p.amount), 0);

            const occupiedCount = units.filter(u => u.status === 'occupied').length;
            const vacantCount = units.filter(u => u.status === 'vacant').length;
            const maintenanceCount = units.filter(u => u.status === 'maintenance').length;
            const occupancyRate = units.length > 0 ? (occupiedCount / units.length) * 100 : 0;

            // calculate collected this month
            const moment = (await import('moment')).default;
            const startOfMonth = moment().startOf('month').toDate();
            const endOfMonth = moment().endOf('month').toDate();
            const paymentsThisMonth = await paymentRepo
                .createQueryBuilder('p')
                .leftJoin('p.unit', 'unit')
                .where('unit.building_id IN (:...buildingIds)', { buildingIds })
                .andWhere('p.status = :status', { status: 'paid' })
                .andWhere('p.paid_date BETWEEN :start AND :end', { start: startOfMonth, end: endOfMonth })
                .getMany();
            const collectedThisMonth = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0);

            const stats = {
                totalBuildings: buildings.length,
                totalUnits: units.length,
                occupiedUnits: occupiedCount,
                vacantUnits: vacantCount,
                maintenanceUnits: maintenanceCount,
                occupancyRate: Math.round(occupancyRate * 10) / 10,
                pendingReceipts,
                totalRevenue,
                collectedThisMonth,
                overduePayments,
                overdueAmount,
            };

            return ApiResponse.success(res, stats);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getMyPermissions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user?.id;
            const { BuildingManagement } = await import('../Entities/building_management');
            const managementRepo = dataSource.getRepository(BuildingManagement);

            const assignments = await managementRepo.find({
                where: { manager_id: userId, is_active: true },
                relations: ['building'],
            });

            const permissions = assignments.map(a => ({
                buildingId: a.building_id,
                buildingName: a.building?.name || '',
                buildingType: a.building?.property_type || 'Residential',
                permissions: {
                    can_view_dashboard: a.can_view_dashboard,
                    can_manage_units: a.can_manage_units,
                    can_manage_tenants: a.can_manage_tenants,
                    can_manage_receipts: a.can_manage_receipts,
                    can_export_reports: a.can_export_reports,
                }
            }));

            return ApiResponse.success(res, permissions);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const buildings = await this.buildingService.getBuildingsByManager(user.id, 'can_view_dashboard');
            const buildingIds = buildings.map(b => b.id);

            const analytics = await this.analyticsService.getAnalytics(
                buildingIds,
                req.query.month ? parseInt(req.query.month as string) : undefined,
                req.query.year ? parseInt(req.query.year as string) : undefined,
                req.query.propertyType as string
            );
            return ApiResponse.success(res, analytics);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getNotifications = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user?.id;
            const notifications = await notificationService.getUserNotifications(userId as UUID);
            return ApiResponse.success(res, notifications);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await notificationService.markAsRead(id as UUID);
            return ApiResponse.success(res, null, 'Notification marked as read');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user?.id;
            await notificationService.markAllAsRead(userId as UUID);
            return ApiResponse.success(res, null, 'All notifications marked as read');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user?.id;
            const userRepo = dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id: userId });

            if (!user) {
                return ApiResponse.error(res, 'User not found', 404);
            }

            return ApiResponse.success(res, {
                id: user.id,
                fullname: user.fullname,
                mobile: user.mobile,
                email: user.email,
                notification_email: user.notification_email,
                role: user.role
            });
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
