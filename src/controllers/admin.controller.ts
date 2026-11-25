import { NextFunction, Request, Response } from 'express';
import { BuildingService } from '../services/building.service';
import { UUID } from 'crypto';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { dataSource } from '../configurations/db.config';
import { Unit } from '../Entities/unit';
import { Building } from '../Entities/building';
import { User } from '../Entities/user';
import { Payment } from '../Entities/payment';

export class AdminController {
    private buildingService: BuildingService;

    constructor() {
        this.buildingService = new BuildingService();
    }

    // ==================== DASHBOARD ====================
    getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userRepo = dataSource.getRepository(User);
            const buildingRepo = dataSource.getRepository(Building);
            const paymentRepo = dataSource.getRepository(Payment);

            const [
                totalOwners,
                totalBuildings,
                pendingApprovals
            ] = await Promise.all([
                userRepo.countBy({ role: 'owner' }),
                buildingRepo.countBy({ status: 'APPROVED' }),
                buildingRepo.countBy({ status: 'PENDING_REVIEW' })
            ]);

            // Calculate monthly revenue (sum of all paid payments this month)
            const moment = (await import('moment')).default;
            const startOfMonth = moment().startOf('month').toDate();
            const endOfMonth = moment().endOf('month').toDate();

            const monthlyPayments = await paymentRepo
                .createQueryBuilder('payment')
                .where('payment.status = :status', { status: 'paid' })
                .andWhere('payment.paid_date BETWEEN :start AND :end', { start: startOfMonth, end: endOfMonth })
                .getMany();

            const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);

            return ApiResponse.success(res, {
                totalOwners,
                totalBuildings,
                pendingApprovals,
                monthlyRevenue
            });
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== OWNERS ====================
    getOwners = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userRepo = dataSource.getRepository(User);
            const buildingRepo = dataSource.getRepository(Building);
            const unitRepo = dataSource.getRepository(Unit);

            const owners = await userRepo.find({
                where: { role: 'owner' },
                order: { created_at: 'DESC' }
            });

            const ownersWithStats = await Promise.all(owners.map(async (owner) => {
                const buildingsCount = await buildingRepo.countBy({ owner_id: owner.id });
                const buildings = await buildingRepo.find({ where: { owner_id: owner.id } });
                const buildingIds = buildings.map(b => b.id);

                let unitsCount = 0;
                if (buildingIds.length > 0) {
                    unitsCount = await unitRepo
                        .createQueryBuilder('unit')
                        .where('unit.building_id IN (:...ids)', { ids: buildingIds })
                        .getCount();
                }

                return {
                    id: owner.id,
                    fullName: owner.fullname,
                    mobileNumber: owner.mobile,
                    email: owner.email,
                    status: owner.status || 'ACTIVE',
                    buildingsCount,
                    unitsCount,
                    createdAt: owner.created_at
                };
            }));

            return ApiResponse.success(res, ownersWithStats);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getPendingOwners = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userRepo = dataSource.getRepository(User);
            const pendingOwners = await userRepo.find({
                where: { role: 'owner', status: 'PENDING' },
                order: { created_at: 'DESC' }
            });

            const ownersData = pendingOwners.map(owner => ({
                id: owner.id,
                fullName: owner.fullname,
                mobileNumber: owner.mobile,
                email: owner.email,
                status: owner.status,
                role: owner.role,
                joinedDate: owner.created_at,
                requestedAt: owner.created_at
            }));

            return ApiResponse.success(res, ownersData);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    approveOwner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const userRepo = dataSource.getRepository(User);

            const owner = await userRepo.findOne({ where: { id, role: 'owner' } });
            if (!owner) return ApiResponse.error(res, 'Owner not found', 404);

            owner.status = 'ACTIVE';
            await userRepo.save(owner);

            // Send notification
            const { notificationService } = await import('../services/notification.service');
            await notificationService.sendNotification(
                owner.id,
                'Account Approved',
                'Your owner account has been approved. You can now add buildings.',
                'general'
            );

            return ApiResponse.success(res, owner, 'Owner approved');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    rejectOwner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const userRepo = dataSource.getRepository(User);

            const owner = await userRepo.findOne({ where: { id, role: 'owner' } });
            if (!owner) return ApiResponse.error(res, 'Owner not found', 404);

            // send notification before deleting so we still have the id
            const { notificationService } = await import('../services/notification.service');
            await notificationService.sendNotification(
                owner.id,
                'Account Rejected',
                'Your owner account registration was not approved.',
                'general'
            );

            // remove the record entirely
            await userRepo.remove(owner);

            // return just the id so client can update state
            return ApiResponse.success(res, { id }, 'Owner rejected');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getOwner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const userRepo = dataSource.getRepository(User);
            const buildingRepo = dataSource.getRepository(Building);

            const owner = await userRepo.findOne({ where: { id, role: 'owner' } });
            if (!owner) return ApiResponse.error(res, 'Owner not found', 404);

            const buildings = await buildingRepo.find({ where: { owner_id: id }, relations: ['units'] });
            const unitsCount = buildings.reduce((sum, b) => sum + (b.units?.length || 0), 0);

            return ApiResponse.success(res, {
                id: owner.id,
                fullName: owner.fullname,
                mobileNumber: owner.mobile,
                email: owner.email,
                status: owner.status || 'ACTIVE',
                role: owner.role,
                joinedDate: owner.created_at,
                lastActive: owner.updated_at,
                buildingsCount: buildings.length,
                unitsCount,
                buildings: buildings.map(b => ({
                    id: b.id,
                    name: b.name,
                    address: b.address,
                    totalUnits: b.units?.length || 0,
                    status: b.status
                }))
            });
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updateOwnerStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { status } = req.body;

            if (!['ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(status)) {
                return ApiResponse.error(res, 'Invalid status', 400);
            }

            const userRepo = dataSource.getRepository(User);
            const owner = await userRepo.findOne({ where: { id, role: 'owner' } });
            if (!owner) return ApiResponse.error(res, 'Owner not found', 404);

            owner.status = status;
            await userRepo.save(owner);

            return ApiResponse.success(res, owner, 'Owner status updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== TENANTS ====================
    getTenants = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userRepo = dataSource.getRepository(User);
            const { TenantAssignment } = await import('../Entities/tenant_assignment');
            const assignmentRepo = dataSource.getRepository(TenantAssignment);

            const tenants = await userRepo.find({
                where: { role: 'tenant' },
                order: { created_at: 'DESC' }
            });

            const tenantsWithStats = await Promise.all(tenants.map(async (tenant) => {
                const assignments = await assignmentRepo.find({
                    where: { tenant_id: tenant.id, active: true },
                    relations: ['unit']
                });

                return {
                    id: tenant.id,
                    fullName: tenant.fullname,
                    mobileNumber: tenant.mobile,
                    email: tenant.email,
                    status: tenant.status || 'ACTIVE',
                    role: tenant.role,
                    joinedDate: tenant.created_at,
                    lastActive: tenant.updated_at,
                    unitsCount: assignments.length
                };
            }));

            return ApiResponse.success(res, tenantsWithStats);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== BUILDINGS ====================
    getPendingBuildings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const buildings = await this.buildingService.getBuildingsByStatus('PENDING_REVIEW');
            return ApiResponse.success(res, buildings);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getBuilding = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const building = await this.buildingService.getBuildingById(id);
            if (!building) return ApiResponse.error(res, 'Building not found', 404);
            return ApiResponse.success(res, building);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    approveBuilding = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { confirmedTotalUnits, notes } = req.body;

            const building = await this.buildingService.approveBuilding(id, confirmedTotalUnits, notes);
            if (building && building.owner_id) {
                const { notificationService } = await import('../services/notification.service');
                await notificationService.sendNotification(
                    building.owner_id,
                    'Building Approved',
                    `Your building ${building.name} has been approved.`,
                    'general',
                    'Building',
                    building.id
                );
            }
            return ApiResponse.success(res, building, 'Building approved');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    rejectBuilding = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { reason } = req.body;

            const building = await this.buildingService.rejectBuilding(id, reason);
            if (building && building.owner_id) {
                const { notificationService } = await import('../services/notification.service');
                await notificationService.sendNotification(
                    building.owner_id,
                    'Building Rejected',
                    `Your building ${building.name} was rejected. Reason: ${reason}`,
                    'general',
                    'Building',
                    building.id
                );
            }
            return ApiResponse.success(res, building, 'Building rejected');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== TRANSACTIONS ====================
    getTransactions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const paymentRepo = dataSource.getRepository(Payment);
            const userRepo = dataSource.getRepository(User);

            const payments = await paymentRepo.find({
                relations: ['unit', 'unit.building'],
                order: { created_at: 'DESC' },
                take: 100
            });

            const transactions = await Promise.all(payments.map(async (p) => {
                let tenantPhone = 'N/A';
                let ownerPhone = 'N/A';

                // Get tenant phone
                if (p.tenant_id) {
                    const tenant = await userRepo.findOne({ where: { id: p.tenant_id as any } });
                    tenantPhone = tenant?.mobile || 'N/A';
                }

                // Get owner phone
                if (p.unit?.building?.owner_id) {
                    const owner = await userRepo.findOne({ where: { id: p.unit.building.owner_id as any } });
                    ownerPhone = owner?.mobile || 'N/A';
                }

                return {
                    id: p.id,
                    status: p.status,
                    dueDate: p.due_date,
                    paidDate: p.paid_date,
                    paymentMethod: p.payment_method,
                    transactionId: p.transaction_id,
                    unit: p.unit?.unit_number,
                    building: p.unit?.building?.name,
                    tenantPhone,
                    ownerPhone,
                    createdAt: p.created_at
                };
            }));

            return ApiResponse.success(res, transactions);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== AUDIT LOGS ====================
    getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { AuditLog } = await import('../Entities/audit_log');
            const auditRepo = dataSource.getRepository(AuditLog);
            const userRepo = dataSource.getRepository(User);

            const logs = await auditRepo.find({
                order: { created_at: 'DESC' },
                take: 100
            });

            const logsWithUserInfo = await Promise.all(logs.map(async (log) => {
                let phoneNumber = 'System';
                let userRole = 'system';

                if (log.user_id) {
                    const user = await userRepo.findOne({ where: { id: log.user_id as any } });
                    if (user) {
                        phoneNumber = user.mobile || 'N/A';
                        userRole = user.role || 'unknown';
                    }
                }

                return {
                    id: log.id,
                    user_id: log.user_id || undefined,
                    phoneNumber,
                    userRole,
                    action: log.action || '',
                    entity: log.entity || '',
                    entity_id: log.entity_id || undefined,
                    details: log.details || '',
                    ip_address: log.ip_address || '',
                    created_at: log.created_at
                };
            }));

            return ApiResponse.success(res, logsWithUserInfo);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== PAYMENT METHODS ====================
    getPaymentMethods = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { PaymentMethod } = await import('../Entities/payment_method');
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const methods = await pmRepo.find({
                order: { created_at: 'DESC' }
            });

            return ApiResponse.success(res, methods);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getPaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { PaymentMethod } = await import('../Entities/payment_method');
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const method = await pmRepo.findOne({ where: { id } });
            if (!method) return ApiResponse.error(res, 'Payment method not found', 404);

            return ApiResponse.success(res, method);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    createPaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, type, account_number, account_name, bank_name, provider, instructions, account_number_hint, account_name_hint, mobile_number_hint } = req.body;
            const { PaymentMethod } = await import('../Entities/payment_method');
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const method = pmRepo.create({
                name,
                type,
                account_number,
                account_name,
                bank_name,
                provider,
                instructions,
                account_number_hint,
                account_name_hint,
                mobile_number_hint,
                is_active: true
            });

            await pmRepo.save(method);

            // Log action
            await this.logAction(
                (req as any).user?.id,
                'PAYMENT_METHOD_CREATED',
                'PaymentMethod',
                method.id,
                `Created payment method: ${name}`
            );

            return ApiResponse.success(res, method, 'Payment method created');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updatePaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { name, type, account_number, account_name, bank_name, provider, instructions, account_number_hint, account_name_hint, mobile_number_hint, is_active } = req.body;
            const { PaymentMethod } = await import('../Entities/payment_method');
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const method = await pmRepo.findOne({ where: { id } });
            if (!method) return ApiResponse.error(res, 'Payment method not found', 404);

            Object.assign(method, { name, type, account_number, account_name, bank_name, provider, instructions, account_number_hint, account_name_hint, mobile_number_hint, is_active });
            await pmRepo.save(method);

            // Log action
            await this.logAction(
                (req as any).user?.id,
                'PAYMENT_METHOD_UPDATED',
                'PaymentMethod',
                method.id,
                `Updated payment method: ${name}`
            );

            return ApiResponse.success(res, method, 'Payment method updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    deletePaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { PaymentMethod } = await import('../Entities/payment_method');
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const method = await pmRepo.findOne({ where: { id } });
            if (!method) return ApiResponse.error(res, 'Payment method not found', 404);

            await pmRepo.remove(method);

            // Log action
            await this.logAction(
                (req as any).user?.id,
                'PAYMENT_METHOD_DELETED',
                'PaymentMethod',
                id,
                `Deleted payment method: ${method.name}`
            );

            return ApiResponse.success(res, null, 'Payment method deleted');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    togglePaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { PaymentMethod } = await import('../Entities/payment_method');
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const method = await pmRepo.findOne({ where: { id } });
            if (!method) return ApiResponse.error(res, 'Payment method not found', 404);

            method.is_active = !method.is_active;
            await pmRepo.save(method);

            return ApiResponse.success(res, method, `Payment method ${method.is_active ? 'enabled' : 'disabled'}`);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // Helper method to log actions
    private async logAction(userId: UUID | undefined, action: string, entityType: string, entityId: UUID | string | null, details: string) {
        try {
            const { AuditLog } = await import('../Entities/audit_log');
            const auditRepo = dataSource.getRepository(AuditLog);

            const log = auditRepo.create({
                user_id: userId || undefined,
                action,
                entity: entityType,
                entity_id: entityId || undefined,
                details,
                ip_address: '127.0.0.1'
            });
            await auditRepo.save(log);
        } catch (error) {
            logger.error('Failed to log action:', error);
        }
    }

    // ==================== CHARTS DATA ====================
    getChartData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { Payment } = await import('../Entities/payment');
            const { Building } = await import('../Entities/building');
            const { Receipt } = await import('../Entities/receipt');
            const paymentRepo = dataSource.getRepository(Payment);
            const buildingRepo = dataSource.getRepository(Building);
            const receiptRepo = dataSource.getRepository(Receipt);
            const userRepo = dataSource.getRepository(User);

            // Revenue by month (last 12 months)
            const revenueData = await paymentRepo
                .createQueryBuilder('p')
                .select("DATE_FORMAT(p.due_date, '%Y-%m') as month")
                .addSelect('SUM(p.amount) as revenue')
                .where('p.status = :status', { status: 'paid' })
                .andWhere('p.due_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)')
                .groupBy('month')
                .orderBy('month', 'ASC')
                .getRawMany();

            // Late payment rate by month
            const latePaymentData = await paymentRepo
                .createQueryBuilder('p')
                .select("DATE_FORMAT(p.due_date, '%Y-%m') as month")
                .addSelect('COUNT(*) as total')
                .addSelect('SUM(CASE WHEN p.status = :late THEN 1 ELSE 0 END) as late')
                .where('p.due_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)')
                .setParameter('late', 'overdue')
                .groupBy('month')
                .orderBy('month', 'ASC')
                .getRawMany();

            // Occupancy rate by month
            const occupancyData = await dataSource.query(`
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m') as month,
                    COUNT(*) as total_units,
                    SUM(CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END) as occupied
                FROM unit
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY month
                ORDER BY month ASC
            `);

            // Building distribution by type
            const buildingTypes = await buildingRepo
                .createQueryBuilder('b')
                .select('b.property_type', 'type')
                .addSelect('COUNT(*)', 'count')
                .groupBy('b.property_type')
                .getRawMany();

            // Active tenants by month (last 7 months)
            const activeTenants = await userRepo
                .createQueryBuilder('u')
                .select("DATE_FORMAT(u.created_at, '%Y-%m') as month")
                .addSelect('COUNT(*) as count')
                .where('u.role = :role', { role: 'tenant' })
                .andWhere('u.created_at >= DATE_SUB(NOW(), INTERVAL 7 MONTH)')
                .groupBy('month')
                .orderBy('month', 'ASC')
                .getRawMany();

            // Revenue per building (top 6)
            const revenuePerBuilding = await dataSource.query(`
                SELECT b.name, SUM(p.amount) as revenue
                FROM payment p
                JOIN unit u ON p.unit_id = u.id
                JOIN building b ON u.building_id = b.id
                WHERE p.status = 'paid'
                GROUP BY b.id, b.name
                ORDER BY revenue DESC
                LIMIT 6
            `);

            // Receipt rejection rate by month (last 6 months)
            const rejectionRate = await receiptRepo
                .createQueryBuilder('r')
                .select("DATE_FORMAT(r.created_at, '%Y-%m') as month")
                .addSelect('COUNT(*) as total')
                .addSelect('SUM(CASE WHEN r.status = :rejected THEN 1 ELSE 0 END) as rejected')
                .where('r.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
                .setParameter('rejected', 'rejected')
                .groupBy('month')
                .orderBy('month', 'ASC')
                .getRawMany();

            // Weekly payment activity (last 7 days)
            const weeklyActivity = await paymentRepo
                .createQueryBuilder('p')
                .select("DAYNAME(p.created_at) as day")
                .addSelect('COUNT(*) as count')
                .where('p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
                .groupBy('day')
                .getRawMany();

            // Payment methods distribution
            const paymentMethods = await paymentRepo
                .createQueryBuilder('p')
                .select('p.payment_method as method')
                .addSelect('COUNT(*) as count')
                .where('p.payment_method IS NOT NULL')
                .groupBy('p.payment_method')
                .getRawMany();

            // Payment volume by month (last 6 months)
            const paymentVolume = await paymentRepo
                .createQueryBuilder('p')
                .select("DATE_FORMAT(p.created_at, '%Y-%m') as month")
                .addSelect('COUNT(*) as count')
                .where('p.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
                .groupBy('month')
                .orderBy('month', 'ASC')
                .getRawMany();

            return ApiResponse.success(res, {
                revenue: revenueData,
                latePayments: latePaymentData,
                occupancy: occupancyData,
                buildingTypes,
                activeTenants,
                revenuePerBuilding,
                rejectionRate,
                weeklyActivity,
                paymentMethods,
                paymentVolume
            });
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== SYSTEM SETTINGS ====================
    getSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { SystemSettings } = await import('../Entities/system_settings');
            const settingsRepo = dataSource.getRepository(SystemSettings);

            const allSettings = await settingsRepo.find();

            // Group settings by category
            const grouped: any = {
                paymentCycle: {},
                notifications: {},
                system: {},
                general: {}
            };

            allSettings.forEach(setting => {
                const category = setting.category || 'general';
                const key = setting.setting_key;
                let value: any = setting.setting_value;

                // Parse boolean and number values
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (!isNaN(Number(value))) value = Number(value);

                if (category === 'financial') {
                    grouped.paymentCycle[key] = value;
                } else if (category === 'notifications') {
                    grouped.notifications[key] = value;
                } else if (category === 'security' || category === 'system') {
                    grouped.system[key] = value;
                } else {
                    grouped.general[key] = value;
                }
            });

            return ApiResponse.success(res, grouped);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updateSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const updates = req.body;
            const { SystemSettings } = await import('../Entities/system_settings');
            const settingsRepo = dataSource.getRepository(SystemSettings);

            // Flatten the nested structure
            const flatUpdates: any = {};
            Object.keys(updates).forEach(category => {
                Object.keys(updates[category]).forEach(key => {
                    flatUpdates[key] = updates[category][key];
                });
            });

            // Update each setting
            for (const [key, value] of Object.entries(flatUpdates)) {
                const setting = await settingsRepo.findOne({ where: { setting_key: key } });
                if (setting) {
                    setting.setting_value = String(value);
                    await settingsRepo.save(setting);
                }
            }

            // Log action
            await this.logAction(
                (req as any).user?.id,
                'SETTINGS_UPDATE',
                'SystemSettings',
                null,
                `Updated ${Object.keys(flatUpdates).length} settings`
            );

            return ApiResponse.success(res, updates, 'Settings updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getSetting = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { key } = req.params;
            const { SystemSettings } = await import('../Entities/system_settings');
            const settingsRepo = dataSource.getRepository(SystemSettings);

            const setting = await settingsRepo.findOne({ where: { setting_key: key as string } });
            if (!setting) return ApiResponse.error(res, 'Setting not found', 404);

            return ApiResponse.success(res, setting);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updateSetting = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { key } = req.params;
            const { value } = req.body;
            const { SystemSettings } = await import('../Entities/system_settings');
            const settingsRepo = dataSource.getRepository(SystemSettings);

            const setting = await settingsRepo.findOne({ where: { setting_key: key as string } });
            if (!setting) return ApiResponse.error(res, 'Setting not found', 404);

            setting.setting_value = String(value);
            await settingsRepo.save(setting);

            return ApiResponse.success(res, setting, 'Setting updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== NOTIFICATION TEMPLATES ====================
    getNotificationTemplates = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { NotificationTemplate } = await import('../Entities/notification_template');
            const templateRepo = dataSource.getRepository(NotificationTemplate);

            const templates = await templateRepo.find({ order: { created_at: 'DESC' } });
            return ApiResponse.success(res, templates);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    getNotificationTemplate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { NotificationTemplate } = await import('../Entities/notification_template');
            const templateRepo = dataSource.getRepository(NotificationTemplate);

            const template = await templateRepo.findOne({ where: { id } });
            if (!template) return ApiResponse.error(res, 'Template not found', 404);

            return ApiResponse.success(res, template);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    createNotificationTemplate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { template_key, title, message_template, target_role } = req.body;
            const { NotificationTemplate } = await import('../Entities/notification_template');
            const templateRepo = dataSource.getRepository(NotificationTemplate);

            const template = templateRepo.create({
                template_key,
                title,
                message_template,
                target_role,
                is_active: true
            });

            await templateRepo.save(template);

            await this.logAction(
                (req as any).user?.id,
                'TEMPLATE_CREATED',
                'NotificationTemplate',
                template.id,
                `Created template: ${template_key}`
            );

            return ApiResponse.success(res, template, 'Template created');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updateNotificationTemplate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { template_key, title, message_template, target_role, is_active } = req.body;
            const { NotificationTemplate } = await import('../Entities/notification_template');
            const templateRepo = dataSource.getRepository(NotificationTemplate);

            const template = await templateRepo.findOne({ where: { id } });
            if (!template) return ApiResponse.error(res, 'Template not found', 404);

            template.template_key = template_key || template.template_key;
            template.title = title || template.title;
            template.message_template = message_template || template.message_template;
            template.target_role = target_role || template.target_role;
            if (is_active !== undefined) template.is_active = is_active;

            await templateRepo.save(template);

            await this.logAction(
                (req as any).user?.id,
                'TEMPLATE_UPDATED',
                'NotificationTemplate',
                template.id,
                `Updated template: ${template.template_key}`
            );

            return ApiResponse.success(res, template, 'Template updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    deleteNotificationTemplate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as UUID;
            const { NotificationTemplate } = await import('../Entities/notification_template');
            const templateRepo = dataSource.getRepository(NotificationTemplate);

            const template = await templateRepo.findOne({ where: { id } });
            if (!template) return ApiResponse.error(res, 'Template not found', 404);

            await templateRepo.remove(template);

            await this.logAction(
                (req as any).user?.id,
                'TEMPLATE_DELETED',
                'NotificationTemplate',
                id,
                `Deleted template: ${template.template_key}`
            );

            return ApiResponse.success(res, null, 'Template deleted');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // ==================== NOTIFICATION SYSTEM SETTINGS ====================
    getNotificationSystemSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { unifiedNotificationService } = await import('../services/unified-notification.service');
            const settings = await unifiedNotificationService.getSystemNotificationSettings();
            return ApiResponse.success(res, settings);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    updateNotificationSystemSetting = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { notificationType } = req.params;
            const { enabled } = req.body;

            const { unifiedNotificationService } = await import('../services/unified-notification.service');
            await unifiedNotificationService.updateSystemNotificationSetting(notificationType as any, enabled);

            await this.logAction(
                (req as any).user?.id,
                'NOTIFICATION_SETTING_UPDATED',
                'SystemSettings',
                null,
                `${enabled ? 'Enabled' : 'Disabled'} ${notificationType} notifications`
            );

            return ApiResponse.success(res, null, 'Notification setting updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };
}

export default new AdminController();
