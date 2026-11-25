import { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { dataSource } from '../configurations/db.config';
import { OwnerPaymentMethod } from '../Entities/owner_payment_method';
import { PaymentMethod } from '../Entities/payment_method';
import { UUID } from 'crypto';

export class OwnerPaymentMethodController {
    // Get all available payment methods (for owner to choose from)
    getAvailablePaymentMethods = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const pmRepo = dataSource.getRepository(PaymentMethod);
            const methods = await pmRepo.find({ where: { is_active: true } });
            return ApiResponse.success(res, methods);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // Get owner's configured payment methods
    getOwnerPaymentMethods = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id;
            const opmRepo = dataSource.getRepository(OwnerPaymentMethod);
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const ownerMethods = await opmRepo.find({ 
                where: { owner_id: ownerId as any },
                order: { created_at: 'DESC' }
            });

            const methodsWithDetails = await Promise.all(ownerMethods.map(async (om) => {
                const pm = await pmRepo.findOne({ where: { id: om.payment_method_id as any } });
                return {
                    id: om.id,
                    paymentMethodId: om.payment_method_id,
                    paymentMethodName: pm?.name,
                    paymentMethodType: pm?.type,
                    bankName: pm?.bank_name,
                    accountNumber: om.account_number,
                    accountName: om.account_name,
                    mobileNumber: om.mobile_number,
                    additionalInfo: om.additional_info,
                    isActive: om.is_active,
                    createdAt: om.created_at
                };
            }));

            return ApiResponse.success(res, methodsWithDetails);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // Add payment method for owner
    addOwnerPaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerId = (req as any).user?.id;
            const { paymentMethodId, accountNumber, accountName, mobileNumber, additionalInfo } = req.body;

            const opmRepo = dataSource.getRepository(OwnerPaymentMethod);
            
            const newMethod = opmRepo.create({
                owner_id: ownerId,
                payment_method_id: paymentMethodId,
                account_number: accountNumber,
                account_name: accountName,
                mobile_number: mobileNumber,
                additional_info: additionalInfo,
                is_active: true
            });

            await opmRepo.save(newMethod);
            return ApiResponse.success(res, newMethod, 'Payment method added successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // Update owner payment method
    updateOwnerPaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const ownerId = (req as any).user?.id;
            const { accountNumber, accountName, mobileNumber, additionalInfo, isActive } = req.body;

            const opmRepo = dataSource.getRepository(OwnerPaymentMethod);
            const method = await opmRepo.findOne({ 
                where: { id: id as UUID, owner_id: ownerId as any }
            });

            if (!method) {
                return ApiResponse.error(res, 'Payment method not found', 404);
            }

            method.account_number = accountNumber || method.account_number;
            method.account_name = accountName || method.account_name;
            method.mobile_number = mobileNumber || method.mobile_number;
            method.additional_info = additionalInfo || method.additional_info;
            if (isActive !== undefined) method.is_active = isActive;

            await opmRepo.save(method);
            return ApiResponse.success(res, method, 'Payment method updated successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // Delete owner payment method
    deleteOwnerPaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const ownerId = (req as any).user?.id;

            const opmRepo = dataSource.getRepository(OwnerPaymentMethod);
            const method = await opmRepo.findOne({ 
                where: { id: id as UUID, owner_id: ownerId as any }
            });

            if (!method) {
                return ApiResponse.error(res, 'Payment method not found', 404);
            }

            await opmRepo.remove(method);
            return ApiResponse.success(res, null, 'Payment method deleted successfully');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };

    // Get payment methods for a specific building (for tenants)
    getPaymentMethodsForBuilding = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { buildingId } = req.params;
            const { Building } = await import('../Entities/building');
            const buildingRepo = dataSource.getRepository(Building);
            
            const building = await buildingRepo.findOne({ where: { id: buildingId as UUID } });
            if (!building) {
                return ApiResponse.error(res, 'Building not found', 404);
            }

            const opmRepo = dataSource.getRepository(OwnerPaymentMethod);
            const pmRepo = dataSource.getRepository(PaymentMethod);

            const ownerMethods = await opmRepo.find({ 
                where: { owner_id: building.owner_id as any, is_active: true }
            });

            const methodsWithDetails = await Promise.all(ownerMethods.map(async (om) => {
                const pm = await pmRepo.findOne({ where: { id: om.payment_method_id as any } });
                return {
                    id: om.id,
                    paymentMethodName: pm?.name,
                    paymentMethodType: pm?.type,
                    bankName: pm?.bank_name,
                    accountNumber: om.account_number,
                    accountName: om.account_name,
                    mobileNumber: om.mobile_number,
                    additionalInfo: om.additional_info
                };
            }));

            return ApiResponse.success(res, methodsWithDetails);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    };
}

export default new OwnerPaymentMethodController();
