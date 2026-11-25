import { NextFunction, Request, Response } from 'express'
import { BuildingService } from '../services/building.service'
import { UUID } from 'crypto'
import { ApiResponse } from '../utils/ApiResponse'
import logger from '../configurations/logger'

export class BuildingController {
  private buildingService: BuildingService

  constructor() {
    this.buildingService = new BuildingService()
  }

  createBuilding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = (req as any).user?.id || req.body.ownerId;
      const building = await this.buildingService.createBuilding(ownerId, req.body);
      return ApiResponse.success(res, building, 'Building created successfully', 201);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  getBuildings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = (req as any).user?.id || req.query.ownerId;
      const result = await this.buildingService.getBuildingsByOwner(ownerId);
      return ApiResponse.success(res, result, 'Buildings retrieved successfully', 200);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }
  
  getAllBuildings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = (req as any).user?.id || req.query.ownerId;
      const result = await this.buildingService.getBuildingsByOwner(ownerId);
      return ApiResponse.success(res, result, 'Buildings retrieved successfully', 200);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  getBuilding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = (req as any).user?.id || req.query.ownerId;
      const id = req.params.id as UUID;
      const building = await this.buildingService.getBuildingById(id, ownerId as UUID);
      if (!building) {
        return ApiResponse.error(res, 'Building not found', 404, 'NOT_FOUND');
      }
      return ApiResponse.success(res, building);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  updateBuilding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = (req as any).user?.id || req.query.ownerId;
      const id = req.params.id as UUID;
      const building = await this.buildingService.updateBuilding(id, ownerId as UUID, req.body);
      if (!building) {
        return ApiResponse.error(res, 'Building not found', 404, 'NOT_FOUND');
      }
      return ApiResponse.success(res, building, 'Building updated successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  deleteBuilding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = (req as any).user?.id || req.query.ownerId;
      const id = req.params.id as UUID;
      const success = await this.buildingService.deleteBuilding(id, ownerId as UUID);
      if (!success) {
        return ApiResponse.error(res, 'Building not found', 404, 'NOT_FOUND');
      }
      return ApiResponse.success(res, null, 'Building deleted successfully');
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }
}