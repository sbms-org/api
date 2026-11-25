import { NextFunction, Request, Response } from 'express';
import { BuildingService } from '../services/building.service';
import { UnitService } from '../services/unit.service';
import { ReceiptService } from '../services/receipt.service';
import { UUID } from 'crypto';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { dataSource } from '../configurations/db.config';
import { Unit } from '../Entities/unit';
import { User } from '../Entities/user';
import { Building } from '../Entities/building';
import { ReportService } from '../services/report.service';
import { PropertyManagerService } from '../services/property-manager.service';
import { AnalyticsService } from '../services/analytics.service';
import { notificationService } from '../services/notification.service';
import moment from 'moment';

export class OwnerController {
    private buildingService: BuildingService;
    private unitService: UnitService;
    private receiptService: ReceiptService;
    private reportService: ReportService;
    private propertyManagerService: PropertyManagerService;
    private analyticsService: AnalyticsService;

    constructor() {
        this.buildingService = new BuildingService();
        this.unitService = new UnitService();
        this.receiptService = new ReceiptService();
        this.reportService = new ReportService();
        this.propertyManagerService = new PropertyManagerService();
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

            let buildingIds: UUID[] = [];
            if (user.role === 'owner') {
                const buildings = await this.buildingService.getBuildingsByOwner(user.id);
                buildingIds = buildings.map(b => b.id);
            } else {
                const buildings = await this.buildingService.getBuildingsByManager(user.id, 'can_export_reports');
                buildingIds = buildings.map(b => b.id);
            }

            if (buildingIds.length === 0) {
                return ApiResponse.error(res, 'No buildings found or access denied', 404);
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
            logger.error('Controller Export Error:', error);
            if (!res.headersSent) {
                return next(error);
            }
        }
    };

    getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            let buildingIds: UUID[] = [];

            if (user.role === 'owner') {
                const buildings = await this.buildingService.getBuildingsByOwner(user.id);
                buildingIds = buildings.map(b => b.id);
            } else {
                const buildings = await this.buildingService.getBuildingsByManager(user.id, 'can_view_dashboard');
                buildingIds = buildings.map(b => b.id);
            }

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

    createBuilding = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id;
            let data: any = {};
            try {
                // The client sends 'data' as a JSON string due to multipart/form-data rules
                data = JSON.parse(req.body.data || '{}');
            } catch (e) {
                return ApiResponse.error(res, 'Invalid JSON in data payload', 400);
            }

            // Basic Validation
            if (!data.building_name || !data.property_type || !data.street_address || !data.state_or_province || !data.city) {
                return ApiResponse.error(res, 'Missing required fields: building_name, property_type, street_address, state_or_province, city', 400);
            }

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            if (!files || !files.property_deed || !files.certificate_of_title || !files.business_tin_number_url) {
                return ApiResponse.error(res, 'Missing required documents: property_deed, certificate_of_title, business_tin_number_url', 400);
            }

            const { UploadService } = await import('../services/upload.service');

            // Map data to the Building entity schema
            const buildingData: Partial<Building> = {
                name: data.building_name,
                property_type: data.property_type,
                total_floors: data.number_of_floors ? parseInt(data.number_of_floors, 10) : undefined,
                payment_cycle: data.payment_cycle || 'Monthly',
                unit_per_floor_distribution: data.unit_per_floor_distribution,
                total_units: data.total_rental_units ? parseInt(data.total_rental_units, 10) : 0,
                additional_notes: data.additional_notes,
                address: data.street_address,
                country: data.country || 'ETHIOPIA',
                state_or_province: data.state_or_province,
                city: data.city,
            };

            // Prepare for concurrent upload
            const uploadQueue: { buffer: Buffer, folder: string }[] = [
                { buffer: files.property_deed[0].buffer, folder: 'buildings/deeds' },
                { buffer: files.certificate_of_title[0].buffer, folder: 'buildings/titles' },
                { buffer: files.business_tin_number_url[0].buffer, folder: 'buildings/tins' }
            ];

            // Upload concurrently for scalability
            try {
                const urls = await UploadService.uploadMultipleFilesConcurrent(uploadQueue);
                buildingData.property_deed_url = urls[0];
                buildingData.certificate_of_title_url = urls[1];
                buildingData.business_tin_number_url = urls[2];
            } catch (err) {
                return ApiResponse.error(res, 'Error uploading documents to Cloud', 500);
            }

            const building = await this.buildingService.createBuilding(ownerId, buildingData);

            return ApiResponse.success(res, building, 'Building submitted for review');

        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updateBuilding = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id;
            const buildingId = req.params.id as UUID;
            let data: any = {};
            try {
                data = JSON.parse(req.body.data || '{}');
            } catch (e) {
                return ApiResponse.error(res, 'Invalid JSON in data payload', 400);
            }

            const buildingParams: Partial<Building> = {
                status: 'PENDING_REVIEW', // Resubmit for review
                ...data.building_name && { name: data.building_name },
                ...data.property_type && { property_type: data.property_type },
                ...data.number_of_floors && { total_floors: parseInt(data.number_of_floors, 10) },
                ...data.payment_cycle && { payment_cycle: data.payment_cycle },
                ...data.unit_per_floor_distribution && { unit_per_floor_distribution: data.unit_per_floor_distribution },
                ...data.total_rental_units && { total_units: parseInt(data.total_rental_units, 10) },
                ...data.additional_notes && { additional_notes: data.additional_notes },
                ...data.street_address && { address: data.street_address },
                ...data.country && { country: data.country },
                ...data.state_or_province && { state_or_province: data.state_or_province },
                ...data.city && { city: data.city },
            };

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            if (files && Object.keys(files).length > 0) {
                const { UploadService } = await import('../services/upload.service');
                const uploadQueue: { buffer: Buffer, folder: string, key: keyof Building }[] = [];

                if (files.property_deed) uploadQueue.push({ buffer: files.property_deed[0].buffer, folder: 'buildings/deeds', key: 'property_deed_url' });
                if (files.certificate_of_title) uploadQueue.push({ buffer: files.certificate_of_title[0].buffer, folder: 'buildings/titles', key: 'certificate_of_title_url' });
                if (files.business_tin_number_url) uploadQueue.push({ buffer: files.business_tin_number_url[0].buffer, folder: 'buildings/tins', key: 'business_tin_number_url' });

                if (uploadQueue.length > 0) {
                    try {
                        const urls = await UploadService.uploadMultipleFilesConcurrent(uploadQueue);
                        uploadQueue.forEach((item, index) => {
                            (buildingParams as any)[item.key] = urls[index];
                        });
                    } catch (err) {
                        return ApiResponse.error(res, 'Error uploading documents to Cloud', 500);
                    }
                }
            }

            const building = await this.buildingService.updateBuilding(buildingId, ownerId, buildingParams);
            if (!building) return ApiResponse.error(res, 'Building not found', 404);

            return ApiResponse.success(res, building, 'Building updated and resubmitted for review successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    private getEffectiveOwnerId = (req: Request): UUID | null => {
        const user = (req as any).user;
        if (!user) return null;
        if (user.role === 'owner') return user.id;
        if (user.role === 'property_manager') {
            return user.managed_by_owner_id;
        }
        return null;
    };

    getBuildings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            let buildings: any[] = [];

            if (user.role === 'owner') {
                buildings = await this.buildingService.getBuildingsByOwner(user.id);
            } else if (user.role === 'property_manager') {
                buildings = await this.buildingService.getBuildingsByManager(user.id);
            }

            return ApiResponse.success(res, buildings, 'Buildings retrieved successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getBuilding = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = req.query.ownerId as UUID;
            const id = req.params.id as UUID;
            const building = await this.buildingService.getBuildingById(id, ownerId);
            if (!building) {
                return ApiResponse.error(res, 'Building not found', 404, 'NOT_FOUND');
            }
            return ApiResponse.success(res, building);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getUnits = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const buildingId = req.params.id as UUID;

            const building = await this.buildingService.getBuildingById(buildingId, user.id, user.role);
            if (!building) return ApiResponse.error(res, 'Access denied', 403);

            const units = await this.unitService.getUnitsByBuilding(buildingId);
            return ApiResponse.success(res, units);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getUnit = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const unitId = req.params.id as UUID;
            const unit = await this.unitService.getUnitById(unitId);
            if (!unit) return ApiResponse.error(res, 'Unit not found', 404);

            const building = await this.buildingService.getBuildingById(unit.building_id, user.id, user.role);
            if (!building) return ApiResponse.error(res, 'Access denied', 403);

            return ApiResponse.success(res, unit);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    assignTenant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const unitId = req.params.unitId as UUID;
            const ownerId = (req as any).user?.id;
            
            let data: any = {};
            try {
                data = JSON.parse(req.body.data || '{}');
            } catch (e) {
                return ApiResponse.error(res, 'Invalid JSON in data payload', 400);
            }

            const { tenantMobile, startDate, endDate, paymentCycleMonths } = data;

            if (!tenantMobile || !startDate || !endDate) {
                return ApiResponse.error(res, 'tenantMobile, startDate, and endDate are required', 400);
            }

            const unit = await this.unitService.getUnitById(unitId);
            if (!unit) return ApiResponse.error(res, 'Unit not found', 404);

            const moment = (await import('moment')).default;
            const start = moment(startDate);
            const end = moment(endDate);
            const cycle = paymentCycleMonths || unit.payment_cycle_months || 3;

            // Calculate first rent due date (1st of next month after start date)
            const firstDueDate = start.clone().add(cycle, 'months').startOf('month').toDate();


            // Check if user exists with this mobile
            const userRepo = dataSource.getRepository(User);
            let user = await userRepo.findOne({ where: { mobile: tenantMobile } });

            // If user doesn't exist, create one
            if (!user) {
                user = userRepo.create({
                    mobile: tenantMobile,
                    fullname: data.tenantName || 'Tenant',
                    role: 'tenant' as any
                });
                await userRepo.save(user);
            }

            // Update unit
            unit.tenant_id = user.id;
            unit.status = 'occupied';
            unit.next_rent_due_date = firstDueDate;
            unit.payment_cycle_months = cycle;

            // Handle lease document upload
            let leaseDocumentUrl: string | undefined;
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            if (files?.lease_document) {
                const { UploadService } = await import('../services/upload.service');
                leaseDocumentUrl = await UploadService.uploadBufferToCloudinary(
                    files.lease_document[0].buffer,
                    'leases'
                );
            }

            // Deactivate previous assignments for this unit
            const { TenantAssignment } = await import('../Entities/tenant_assignment');
            const assignmentRepo = dataSource.getRepository(TenantAssignment);
            await assignmentRepo.update(
                { unit_id: unitId, active: true },
                { active: false }
            );

            // Create new tenant assignment record
            const assignment = assignmentRepo.create({
                tenant_id: user.id,
                unit_id: unitId,
                owner_id: ownerId,
                start_date: start.toDate(),
                end_date: end.toDate(),
                payment_cycle_months: cycle,
                first_rent_due_date: firstDueDate,
                lease_document_url: leaseDocumentUrl,
                active: true
            });

            await assignmentRepo.save(assignment);
            await dataSource.getRepository(Unit).save(unit);

            // Send notification to tenant (in-app/push/email)
            const { pushNotificationService } = await import('../services/push-notification.service');
            await pushNotificationService.notifyTenantAssigned(
                user.id,
                unit.unit_number,
                unit.building?.name || 'Building',
                start.toDate()
            );

            // Notify owner via push/email and DB
            await pushNotificationService.notifyOwnerTenantAssigned(
                ownerId,
                user.fullname,
                unit.unit_number,
                unit.building?.name || 'Building'
            );

            // Notify property managers (and owner again to be safe) via push/email
            await pushNotificationService.notifyBuildingManagersTenantAssigned(
                unit.building?.id as any,
                ownerId,
                user.fullname,
                unit.unit_number,
                unit.building?.name || 'Building'
            );

            // persist notification records for owner and managers
            const { notificationService } = await import('../services/notification.service');
            await notificationService.notifyBuildingManagers(
                unit.building?.id as any,
                ownerId,
                '👤 New Tenant Assigned',
                `${user.fullname} assigned to ${unit.unit_number}`,
                'tenant_assignment',
                unitId
            );

            // return response

            return ApiResponse.success(res, { unit, assignment, user }, 'Tenant assigned successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // notify tenant manually that rent is due soon/now
    notifyTenantDue = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const unitId = req.params.unitId as UUID;
            // ownerId not needed here so we omit

            const unit = await this.unitService.getUnitById(unitId);
            if (!unit) return ApiResponse.error(res, 'Unit not found', 404);
            if (!unit.tenant_id) return ApiResponse.error(res, 'Unit has no tenant', 400);

            const now = moment();
            const due = unit.next_rent_due_date ? moment(unit.next_rent_due_date) : null;
            let daysAway = due ? due.diff(now, 'days') : 0;
            const message = due
                ? `Rent due in ${Math.abs(daysAway)} day${daysAway == 1 ? '' : 's'}`
                : 'Rent due notification';

            const { pushNotificationService } = await import('../services/push-notification.service');
            // amount and paymentId can be derived
            const amount = unit.rent_amount || 0;
            const paymentId = unit.id; // use unit id as a placeholder
            await pushNotificationService.notifyTenantPaymentDue(
                unit.tenant_id,
                unit.unit_number,
                unit.building?.name || 'Building',
                amount,
                due ? due.toDate() : new Date(),
                daysAway,
                paymentId
            );

            const { notificationService } = await import('../services/notification.service');
            await notificationService.sendNotification(
                unit.tenant_id,
                '📢 Rent Due Reminder',
                message,
                'payment_due',
                unitId
            );

            return ApiResponse.success(res, null, 'Tenant notified');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    terminateTenantAssignment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const unitId = req.params.unitId as UUID;
            const ownerId = (req as any).user?.id;

            const unit = await this.unitService.getUnitById(unitId);
            if (!unit) return ApiResponse.error(res, 'Unit not found', 404);

            // Deactivate assignment
            const { TenantAssignment } = await import('../Entities/tenant_assignment');
            const result = await dataSource.getRepository(TenantAssignment).update(
                { unit_id: unitId, owner_id: ownerId, active: true },
                { active: false }
            );

            if (result.affected === 0) {
                return ApiResponse.error(res, 'No active assignment found', 404);
            }

            // send notification to previous tenant if any
            const prevTenantId = unit.tenant_id;
            const buildingName = unit.building?.name || 'Building';

            // Update unit
            unit.tenant_id = null as any;
            unit.status = 'vacant';
            unit.next_rent_due_date = null as any;
            await dataSource.getRepository(Unit).save(unit);

            if (prevTenantId) {
                const { pushNotificationService } = await import('../services/push-notification.service');
                await pushNotificationService.notifyTenantLeaseUpdate(
                    prevTenantId,
                    unit.unit_number,
                    buildingName,
                    'Your tenancy has been terminated by the owner.'
                );
            }

            return ApiResponse.success(res, unit, 'Tenant assignment terminated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getPendingReceipts = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const ownerId = this.getEffectiveOwnerId(req);
            if (!ownerId) return ApiResponse.error(res, 'Owner context not found', 400);

            const buildings = await this.buildingService.getBuildingsByManager(user.id);
            const buildingIds = buildings.map(b => b.id);

            if (buildingIds.length === 0) return ApiResponse.success(res, []);

            const receipts = await this.receiptService.getPendingReceiptsForBuildings(
                buildingIds,
                user.role === 'property_manager'
            );
            return ApiResponse.success(res, receipts);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getTenants = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            // support both owners and property managers
            let buildings: Building[] = [];
            if (user.role === 'owner') {
                buildings = await this.buildingService.getBuildingsByOwner(user.id);
            } else {
                buildings = await this.buildingService.getBuildingsByManager(user.id);
            }
            const buildingIds = buildings.map(b => b.id);
            if (buildingIds.length === 0) return ApiResponse.success(res, []);

            const units = await dataSource.getRepository(Unit)
                .createQueryBuilder('unit')
                .leftJoinAndSelect('unit.tenant', 'tenant')
                .leftJoinAndSelect('unit.building', 'building')
                .where('building.id IN (:...buildingIds)', { buildingIds })
                .andWhere('unit.tenant_id IS NOT NULL')
                .andWhere('unit.status = :status', { status: 'occupied' })
                .getMany();

            const tenantMap = new Map<string, any>();

            units.forEach(unit => {
                const tenantId = unit.tenant.id;
                if (!tenantMap.has(tenantId)) {
                    tenantMap.set(tenantId, {
                        id: unit.tenant.id,
                        fullname: unit.tenant.fullname,
                        mobile: unit.tenant.mobile,
                        email: unit.tenant.email,
                        units: [],
                        totalRent: 0,
                        paymentCycle: unit.payment_cycle_months,
                        hasDueRent: false,
                    });
                }

                const tenant = tenantMap.get(tenantId);
                tenant.units.push({
                    id: unit.id,
                    unit_number: unit.unit_number,
                    building_name: unit.building.name,
                    rent_amount: unit.rent_amount,
                    next_rent_due_date: unit.next_rent_due_date,
                });
                tenant.totalRent += Number(unit.rent_amount) || 0;
                if (unit.is_rent_due) tenant.hasDueRent = true;
            });

            const tenantsData = Array.from(tenantMap.values()).map(tenant => ({
                ...tenant,
                unitCount: tenant.units.length,
            }));

            return ApiResponse.success(res, tenantsData);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getTenantDetails = async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;
        const tenantId = req.params.tenantId as UUID;

        let buildings: Building[] = [];
        if (user.role === 'owner') {
          buildings = await this.buildingService.getBuildingsByOwner(user.id);
        } else {
          buildings = await this.buildingService.getBuildingsByManager(user.id);
        }
        const buildingIds = buildings.map(b => b.id);
        if (buildingIds.length === 0) return ApiResponse.success(res, null);

        const units = await dataSource.getRepository(Unit)
          .createQueryBuilder('unit')
          .leftJoinAndSelect('unit.tenant', 'tenant')
          .leftJoinAndSelect('unit.building', 'building')
          .where('unit.tenant_id = :tenantId', { tenantId })
          .andWhere('building.id IN (:...buildingIds)', { buildingIds })
          .andWhere('unit.status = :status', { status: 'occupied' })
          .getMany();

        if (units.length === 0) {
          return ApiResponse.success(res, null);
        }

        const t = units[0].tenant;
        const tenantObj: any = {
          id: t.id,
          fullname: t.fullname,
          mobile: t.mobile,
          email: t.email,
          units: [],
          totalRent: 0,
          paymentCycle: units[0].payment_cycle_months,
          hasDueRent: false,
        };

        units.forEach(u => {
          tenantObj.units.push({
            id: u.id,
            unit_number: u.unit_number,
            building_name: u.building.name,
            rent_amount: u.rent_amount,
            next_rent_due_date: u.next_rent_due_date,
          });
          tenantObj.totalRent += Number(u.rent_amount) || 0;
          if (u.is_rent_due) tenantObj.hasDueRent = true;
        });
        tenantObj.unitCount = tenantObj.units.length;

        return ApiResponse.success(res, tenantObj);
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
                relations: ['unit', 'unit.building']
            });
            if (!receipt) return ApiResponse.error(res, 'Receipt not found', 404);

            const building = await this.buildingService.getBuildingById(receipt.unit.building_id, user.id, user.role);
            if (!building) return ApiResponse.error(res, 'Access denied to this receipt', 403);

            const updatedReceipt = await this.receiptService.acceptReceipt(receiptId as UUID, notes);

            // Notify owner + all PMs of this building
            try {
                await notificationService.notifyBuildingManagers(
                    receipt.unit.building_id as string,
                    building.owner_id,
                    'Receipt Accepted',
                    `Payment receipt for Unit ${receipt.unit.unit_number} has been accepted.`,
                    'receipt_accepted',
                    'Receipt',
                    String(receiptId)
                );
            } catch (notifErr) {
                logger.warn('Failed to send receipt accepted notifications:', notifErr);
            }

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
            if (!reason) return ApiResponse.error(res, 'Reason is required', 400);

            const { Receipt } = await import('../Entities/receipt');
            const receipt = await dataSource.getRepository(Receipt).findOne({
                where: { id: receiptId as UUID },
                relations: ['unit', 'unit.building']
            });
            if (!receipt) return ApiResponse.error(res, 'Receipt not found', 404);

            const building = await this.buildingService.getBuildingById(receipt.unit.building_id, user.id, user.role);
            if (!building) return ApiResponse.error(res, 'Access denied to this receipt', 403);

            const updatedReceipt = await this.receiptService.rejectReceipt(receiptId as UUID, reason);

            // Notify owner + all PMs of this building
            try {
                await notificationService.notifyBuildingManagers(
                    receipt.unit.building_id as string,
                    building.owner_id,
                    'Receipt Rejected',
                    `Payment receipt for Unit ${receipt.unit.unit_number} was rejected. Reason: ${reason}`,
                    'receipt_rejected',
                    'Receipt',
                    String(receiptId)
                );
            } catch (notifErr) {
                logger.warn('Failed to send receipt rejected notifications:', notifErr);
            }

            return ApiResponse.success(res, updatedReceipt, 'Receipt rejected');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    registerTenantForUnit = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { mobile, fullname } = req.body;

            if (!mobile || !fullname) {
                return ApiResponse.error(res, 'Mobile and fullname are required', 400);
            }

            const userRepo = dataSource.getRepository(User);
            let user = await userRepo.findOneBy({ mobile });

            if (!user) {
                user = userRepo.create({
                    mobile,
                    fullname,
                    role: 'tenant',
                    account_status: true,
                });
            } else {
                user.fullname = fullname; // Update name if provided
                user.role = 'tenant'; // Ensure role is tenant
            }

            // Hardcode OTP for development/testing as a password as requested by user
            const otp = '123456';
            user.otp_code = otp;

            await userRepo.save(user);

            // Log OTP for dev/testing as per boilerplate style
            logger.info(`OTP (Password) for tenant ${mobile}: ${otp}`);

            return ApiResponse.success(res, { mobile }, `Tenant registered. They can login with OTP (Password): ${otp}`);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    verifyTenantOtp = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { unitId } = req.params;
            const { mobile, otp } = req.body;

            const userRepo = dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ mobile, otp_code: otp });

            const moment = (await import('moment')).default;
            if (!user) {
                return ApiResponse.error(res, 'Invalid OTP or Mobile', 400);
            }

            // Do not clear OTP so we can keep using it as a password for testing
            // user.otp_code = undefined;
            // user.otp_expires = undefined;
            // await userRepo.save(user);

            // Assign to unit
            const unit = await this.unitService.getUnitById(unitId as UUID);
            if (!unit) return ApiResponse.error(res, 'Unit not found', 404);

            unit.tenant_id = user.id;
            unit.status = 'occupied';
            const cycle = unit.payment_cycle_months || 3;
            unit.next_rent_due_date = moment().add(cycle, 'months').toDate();

            await dataSource.getRepository(Unit).save(unit);

            return ApiResponse.success(res, { unit, tenant: user }, 'Tenant verified and assigned to unit successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const buildings = await this.buildingService.getBuildingsByManager(user.id);
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
            // use query builder for security and flexibility
            const units = await unitRepo
                .createQueryBuilder('unit')
                .where('unit.building_id IN (:...buildingIds)', { buildingIds })
                .getMany();

            const receiptRepo = dataSource.getRepository(require('../Entities/receipt').Receipt);
            const pendingReceipts = await receiptRepo.count({
                where: { status: 'PENDING' }
            });

            const paymentRepo = dataSource.getRepository(require('../Entities/payment').Payment);

            // Paid revenue
            const paidPayments = await paymentRepo
                .createQueryBuilder('p')
                .leftJoin('p.unit', 'unit')
                .where('unit.building_id IN (:...buildingIds)', { buildingIds })
                .andWhere('p.status = :status', { status: 'paid' })
                .getMany();
            const totalRevenue = paidPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

            // Amount collected this month
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
            const collectedThisMonth = paymentsThisMonth.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

            // Overdue payments
            const overduePaymentList = await paymentRepo
                .createQueryBuilder('p')
                .leftJoin('p.unit', 'unit')
                .where('unit.building_id IN (:...buildingIds)', { buildingIds })
                .andWhere('p.status = :status', { status: 'overdue' })
                .getMany();
            const overduePayments = overduePaymentList.length;
            const overdueAmount = overduePaymentList.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

            const occupiedUnits = units.filter(u => u.status === 'occupied').length;
            const vacantUnits = units.filter(u => u.status === 'vacant').length;
            const maintenanceUnits = units.filter(u => u.status === 'maintenance').length;
            const occupancyRate = units.length > 0 ? (occupiedUnits / units.length) * 100 : 0;

            const stats = {
                totalBuildings: buildings.length,
                totalUnits: units.length,
                occupiedUnits,
                vacantUnits,
                maintenanceUnits,
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

    getPropertyManagers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id;
            const managers = await this.propertyManagerService.getPropertyManagersByOwner(ownerId as UUID);
            return ApiResponse.success(res, managers, 'Property Managers retrieved successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getPropertyManagerDetails = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id;
            const pmId = req.params.id as UUID;
            const details = await this.propertyManagerService.getPropertyManagerDetails(ownerId as UUID, pmId);
            return ApiResponse.success(res, details, 'Property Manager details retrieved successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    assignPropertyManager = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id || req.query.ownerId;
            const { mobile, fullname } = req.body;

            if (!mobile || !fullname) {
                return ApiResponse.error(res, 'Mobile and fullname are required', 400);
            }

            const result = await this.propertyManagerService.registerPropertyManager(ownerId as UUID, fullname, mobile);
            return ApiResponse.success(res, result, 'Property Manager registration initiated. OTP sent to their phone (Simulated: 123456).');
        } catch (error: any) {
            logger.error(error);
            return ApiResponse.error(res, error.message, 400);
        }
    };

    verifyPropertyManager = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id || req.query.ownerId;
            const { mobile, otp } = req.body;

            if (!mobile || !otp) {
                return ApiResponse.error(res, 'Mobile and OTP are required', 400);
            }

            const pm = await this.propertyManagerService.verifyPropertyManager(ownerId as UUID, mobile, otp);

            // At this point, the PM account is ACTIVE and they can log in via standard Auth login
            return ApiResponse.success(res, pm, 'Property Manager account verified and activated successfully. They can now log in using their mobile and 123456 for OTP.');
        } catch (error: any) {
            logger.error(error);
            return ApiResponse.error(res, error.message, 400);
        }
    };

    assignBuildingsToPM = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id || req.query.ownerId;
            const pmId = req.params.pmId as UUID;
            const { assignments } = req.body; // Array of { buildingId, permissions }

            await this.propertyManagerService.updateAssignments(ownerId as UUID, pmId, assignments);

            return ApiResponse.success(res, null, 'Building assignments updated successfully');
        } catch (error: any) {
            logger.error(error);
            return ApiResponse.error(res, error.message, 400);
        }
    };

    revokePropertyManager = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id || req.query.ownerId;
            const pmId = req.params.id as UUID;

            await this.propertyManagerService.revokePropertyManager(ownerId as UUID, pmId);

            return ApiResponse.success(res, null, 'Property Manager access revoked successfully');
        } catch (error: any) {
            logger.error(error);
            return ApiResponse.error(res, error.message, 400);
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
