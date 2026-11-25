import { NextFunction, Request, Response } from 'express';
import { UnitService } from '../services/unit.service';
import { UUID } from 'crypto';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';

export class UnitController {
  private unitService: UnitService;

  constructor() {
    this.unitService = new UnitService();
  }

  createUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buildingId = req.params.buildingId as UUID;
      const unit = await this.unitService.createUnit(buildingId, req.body);
      return ApiResponse.success(res, unit, 'Unit created successfully', 201);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getUnits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buildingId = req.params.buildingId as UUID;
      const units = await this.unitService.getUnitsByBuilding(buildingId);
      return ApiResponse.success(res, units, 'Units retrieved successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as UUID;
      const unit = await this.unitService.getUnitById(id);
      if (!unit) return ApiResponse.error(res, 'Unit not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, unit);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  updateUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as UUID;
      const oldUnit = await this.unitService.getUnitById(id);

      const unit = await this.unitService.updateUnit(id, req.body);
      if (!unit) return ApiResponse.error(res, 'Unit not found', 404, 'NOT_FOUND');

      // If payment cycle changed and there's a tenant, notify them
      if (req.body.payment_cycle_months && oldUnit?.tenant_id && oldUnit.payment_cycle_months !== req.body.payment_cycle_months) {
        const { notificationService } = await import('../services/notification.service');
        await notificationService.sendFromTemplate(
          oldUnit.tenant_id,
          'payment_cycle_changed',
          {
            unit_number: unit.unit_number,
            old_cycle: String(oldUnit.payment_cycle_months),
            new_cycle: String(unit.payment_cycle_months)
          },
          'Unit',
          unit.id
        );
      }

      return ApiResponse.success(res, unit, 'Unit updated successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  deleteUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as UUID;
      const success = await this.unitService.deleteUnit(id);
      if (!success) return ApiResponse.error(res, 'Unit not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, null, 'Unit deleted successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };

  getPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const unitId = req.params.id as UUID;
      const payments = await this.unitService.getPaymentHistory(unitId);
      return ApiResponse.success(res, payments, 'Payment history retrieved successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  };
}