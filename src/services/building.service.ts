import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { Building } from '../Entities/building';
import { User } from '../Entities/user';
import { BuildingManagement } from '../Entities/building_management';
import { UUID } from 'crypto';
import logger from '../configurations/logger';

export class BuildingService {
  private buildingRepository: Repository<Building>;

  constructor() {
    this.buildingRepository = dataSource.getRepository(Building);
  }

  async createBuilding(ownerId: UUID, data: Partial<Building>): Promise<Building> {
    const owner = await dataSource.getRepository(User).findOneBy({ id: ownerId });
    if (!owner) throw new Error('Owner not found');

    const building = this.buildingRepository.create({
      ...data,
      owner,
    });
    return this.buildingRepository.save(building);
  }

  async getBuildingsByOwner(ownerId: UUID): Promise<Building[]> {
    logger.info(`Getting registered buildings under a specific owner with Id ${ownerId} `);
    return this.buildingRepository.find({
      where: { owner_id: ownerId, is_active: true },
    });
  }

  async getBuildingsByManager(managerId: UUID, permission?: keyof BuildingManagement): Promise<Building[]> {
    logger.info(`Getting buildings managed by PM with Id ${managerId}${permission ? ` with permission ${permission}` : ''}`);

    const { BuildingManagement } = await import('../Entities/building_management');
    const managementRepo = dataSource.getRepository(BuildingManagement);

    const where: any = { manager_id: managerId, is_active: true };
    if (permission) {
      where[permission] = true;
    }

    // Check if there are specific assignments
    const specificAssignments = await managementRepo.find({
      where,
      relations: ['building']
    });

    if (specificAssignments.length > 0) {
      return specificAssignments.map(a => a.building);
    }

    // fallback to managed_by_owner_id logic if no specific building assignments
    const manager = await dataSource.getRepository(User).findOneBy({ id: managerId });
    if (manager?.managed_by_owner_id) {
      // If they have NO assignments, they have global permission
      const specificCount = await managementRepo.countBy({ manager_id: managerId, is_active: true });
      if (specificCount === 0) {
        return this.getBuildingsByOwner(manager.managed_by_owner_id);
      }
    }

    return [];
  }

  async approveBuilding(id: UUID, confirmedTotalUnits: number, notes?: string): Promise<Building | null> {
    const building = await this.buildingRepository.findOne({ where: { id } });
    if (!building) return null;

    building.status = 'APPROVED';
    building.total_units = confirmedTotalUnits;
    if (notes) building.additional_notes = `${building.additional_notes || ''}\nApproval Notes: ${notes}`;

    const savedBuilding = await this.buildingRepository.save(building);

    // Automatically create units according to building distribution
    const { UnitService } = await import('./unit.service');
    const unitService = new UnitService();

    // determine payment cycle months (handle common labels)
    let parsedCycleMonths = 3;
    const cycle = (savedBuilding.payment_cycle || '').toString().toLowerCase();
    if (cycle.includes('month') && !cycle.includes('year')) {
      parsedCycleMonths = 1;
    } else if (cycle.includes('quarter') || cycle.includes('3') || cycle.includes('three')) {
      parsedCycleMonths = 3;
    } else if (cycle.includes('year')) {
      parsedCycleMonths = 12;
    }

    // don't duplicate if units already exist
    const existingUnits = await unitService.getUnitsByBuilding(savedBuilding.id);
    if (existingUnits.length >= confirmedTotalUnits) {
      return savedBuilding;
    }

    const floors = savedBuilding.total_floors && savedBuilding.total_floors > 0 ? savedBuilding.total_floors : 1;

    // build distribution array: units per floor starting from ground (index 0)
    const distribution: number[] = [];

    if (savedBuilding.unit_per_floor_distribution === 'CUSTOM' && savedBuilding.unit_per_floor_distribution_details) {
      try {
        const parsed = JSON.parse(savedBuilding.unit_per_floor_distribution_details);
        if (Array.isArray(parsed)) {
          // try to normalize to floors length
          for (let i = 0; i < floors; i++) {
            distribution[i] = Number(parsed[i] || 0);
          }
        }
      } catch (e) {
        // fallthrough to EVEN
      }
    }

    if (distribution.length === 0 || distribution.reduce((s, v) => s + v, 0) !== confirmedTotalUnits) {
      // fallback to EVEN distribution (distribute remainder from ground up)
      const base = Math.floor(confirmedTotalUnits / floors);
      let remainder = confirmedTotalUnits - base * floors;
      for (let f = 0; f < floors; f++) {
        distribution[f] = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
      }
    }

    // helper to make prefix from building name e.g., "Maritime Clean House" -> MCH
    const makePrefix = (name?: string) => {
      if (!name) return 'UNT';
      const parts = name.split(/\s+/).filter(Boolean);
      let prefix = parts.slice(0, 3).map(p => p[0]).join('').toUpperCase();
      if (prefix.length < 3) {
        const first = parts[0] || 'UNIT';
        prefix = (first.substring(0, 3)).toUpperCase();
      }
      return prefix;
    };

    const prefix = makePrefix(savedBuilding.name);

    // create units per floor, starting from ground (floor index 0) upwards
    for (let f = 0; f < distribution.length; f++) {
      const unitsOnFloor = distribution[f] || 0;
      for (let u = 1; u <= unitsOnFloor; u++) {
        // unit number label: Floor {f} - Unit {u}
        const unitNumber = `F${f}-U${u}`;
        // unit code: PREFIX + floorIndex + two-digit unit index (e.g., MCH104)
        const unitIndexPadded = String(u).padStart(2, '0');
        const unitCode = `${prefix}${f}${unitIndexPadded}`;

        await unitService.createUnit(savedBuilding.id, {
          unit_number: unitNumber,
          unit_code: unitCode,
          floor: f,
          status: 'vacant',
          rent_amount: savedBuilding.default_rent_amount,
          payment_cycle_months: parsedCycleMonths,
        });
      }
    }

    return savedBuilding;
  }

  async rejectBuilding(id: UUID, reason: string): Promise<Building | null> {
    const building = await this.buildingRepository.findOne({ where: { id } });
    if (!building) return null;

    building.status = 'REJECTED';
    building.rejection_reason = reason;
    return this.buildingRepository.save(building);
  }

  async getBuildingsByStatus(status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'): Promise<Building[]> {
    return this.buildingRepository.find({
      where: { status },
      relations: ['owner'],
    });
  }

  async getBuildingById(id: UUID, userId?: UUID, role?: string, permission?: keyof BuildingManagement): Promise<Building | null> {
    const where: any = { id };

    if (userId && role === 'owner') {
      where.owner_id = userId;
    }

    const building = await this.buildingRepository.findOne({
      where,
      relations: ['units', 'owner'],
    });

    if (!building) return null;

    if (userId && role === 'property_manager') {
      const { BuildingManagement } = await import('../Entities/building_management');
      const managementRepo = dataSource.getRepository(BuildingManagement);

      const mgmtWhere: any = {
        manager_id: userId,
        building_id: id,
        is_active: true
      };
      if (permission) mgmtWhere[permission] = true;

      // Check specific assignment
      const management = await managementRepo.findOneBy(mgmtWhere);

      if (management) return building;

      // check global owner assignment fallback
      const manager = await dataSource.getRepository(User).findOneBy({ id: userId });
      if (manager?.managed_by_owner_id === building.owner_id) {
        // Only if no specific assignments for OTHER buildings hide this one?
        // Let's stick to the logic: if specific assignments exist, PM is limited to them.
        const specificCount = await managementRepo.countBy({ manager_id: userId, is_active: true });
        if (specificCount === 0) return building;
      }

      return null;
    }

    return building;
  }

  async updateBuilding(id: UUID, ownerId: UUID, data: Partial<Building>): Promise<Building | null> {
    const building = await this.getBuildingById(id, ownerId);
    if (!building) return null;

    Object.assign(building, data);
    return this.buildingRepository.save(building);
  }

  async deleteBuilding(id: UUID, ownerId: UUID): Promise<boolean> {
    const building = await this.getBuildingById(id, ownerId);
    if (!building) return false;

    building.is_active = false;
    await this.buildingRepository.save(building);
    return true;
  }
}