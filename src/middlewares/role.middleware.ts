import { Request, Response, NextFunction } from 'express';
import { UserRoleType } from '../Entities/user';

export const roleMiddleware = (allowedRoles: UserRoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return next();
  };
};

/**
 * Higher-level check for building-specific access.
 * Checks if the user is the owner of the building or an assigned manager.
 */
export const buildingAccessMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const buildingId = req.params.buildingId || req.params.id || req.body.buildingId;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === 'admin') return next();

    const { dataSource } = await import('../configurations/db.config');
    const { Building } = await import('../Entities/building');

    if (!buildingId) return next(); // Let the controller handle cases without building scope

    const building = await dataSource.getRepository(Building).findOneBy({ id: buildingId });
    if (!building) return res.status(404).json({ error: 'Building not found' });

    if (user.role === 'owner') {
      if (building.owner_id === user.id) return next();
      return res.status(403).json({ error: 'You do not own this building' });
    }

    if (user.role === 'property_manager') {
      const { BuildingManagement } = await import('../Entities/building_management');
      const management = await dataSource.getRepository(BuildingManagement).findOneBy({
        manager_id: user.id,
        building_id: buildingId,
        is_active: true
      });

      if (management) return next();

      // If the PM is "assigned" to the owner but maybe no specific buildings are linked yet, 
      // do we allow global access? The user said "manage all their buildings or selected specific ones".
      // Let's check managed_by_owner_id as a fallback if no specific assignments exist.
      if (user.managed_by_owner_id === building.owner_id) {
        // If they are assigned to the owner, they can manage ALL unless specific global ones are denied?
        // Let's stick to: if they have ANY assignment in building_management, they only see those.
        // If they have NO assignments but are linked to the owner, they see ALL.
        const hasSpecificAssignments = await dataSource.getRepository(BuildingManagement).countBy({
          manager_id: user.id,
          is_active: true
        });

        if (hasSpecificAssignments === 0) {
          return next();
        }
      }

      return res.status(403).json({ error: 'You are not assigned to manage this building' });
    }

    return res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    return next(error);
  }
};