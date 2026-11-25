import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { User } from '../Entities/user';
import { BuildingManagement } from '../Entities/building_management';
import { UUID } from 'crypto';
import logger from '../configurations/logger';

export class PropertyManagerService {
    private userRepository: Repository<User>;
    private managementRepository: Repository<BuildingManagement>;

    constructor() {
        this.userRepository = dataSource.getRepository(User);
        this.managementRepository = dataSource.getRepository(BuildingManagement);
    }

    async registerPropertyManager(ownerId: UUID, fullname: string, mobile: string): Promise<{ mobile: string }> {
        let pm = await this.userRepository.findOneBy({ mobile });

        if (pm && pm.managed_by_owner_id && pm.managed_by_owner_id !== ownerId) {
            throw new Error('Property Manager is already assigned to another owner');
        }

        if (!pm) {
            pm = this.userRepository.create({
                mobile,
                fullname,
                role: 'property_manager',
                managed_by_owner_id: ownerId,
                status: 'PENDING',
                account_status: true,
                otp_code: '123456'
            });
        } else {
            pm.fullname = fullname;
            pm.role = 'property_manager';
            pm.managed_by_owner_id = ownerId;
            pm.status = 'PENDING';
            pm.otp_code = '123456';
        }

        await this.userRepository.save(pm);
        logger.info(`Property Manager ${mobile} registered. Status: PENDING. OTP: 123456`);

        return { mobile };
    }

    async verifyPropertyManager(ownerId: UUID, mobile: string, otp: string): Promise<User> {
        const pm = await this.userRepository.findOneBy({
            mobile,
            otp_code: otp,
            managed_by_owner_id: ownerId as any
        });

        if (!pm) {
            throw new Error('Invalid OTP or Mobile number');
        }

        pm.status = 'ACTIVE';
        pm.account_status = true;
        await this.userRepository.save(pm);

        logger.info(`Property Manager account ${mobile} verified and activated.`);

        return pm;
    }

    async getPropertyManagersByOwner(ownerId: UUID): Promise<User[]> {
        return this.userRepository.find({
            where: {
                managed_by_owner_id: ownerId as any,
                role: 'property_manager'
            },
            order: { created_at: 'DESC' }
        });
    }

    async getPropertyManagerDetails(ownerId: UUID, pmId: UUID): Promise<any> {
        const pm = await this.userRepository.findOneBy({
            id: pmId,
            managed_by_owner_id: ownerId as any,
            role: 'property_manager'
        });

        if (!pm) throw new Error('Property Manager not found');

        const managements = await this.managementRepository.find({
            where: { manager_id: pmId, is_active: true },
            relations: ['building']
        });

        return {
            ...pm,
            assignments: managements.map(m => ({
                buildingId: m.building_id,
                buildingName: m.building.name,
                permissions: {
                    can_view_dashboard: m.can_view_dashboard,
                    can_manage_units: m.can_manage_units,
                    can_manage_tenants: m.can_manage_tenants,
                    can_manage_receipts: m.can_manage_receipts,
                    can_export_reports: m.can_export_reports,
                }
            }))
        };
    }

    async updateAssignments(ownerId: UUID, pmId: UUID, assignments: any[]): Promise<void> {
        const pm = await this.userRepository.findOneBy({
            id: pmId,
            managed_by_owner_id: ownerId as any
        });

        if (!pm) throw new Error('Property Manager not found');

        // Remove old specific assignments
        await this.managementRepository.delete({ manager_id: pmId });

        // Add new assignments
        for (const assignment of assignments) {
            const newMgmt = this.managementRepository.create({
                manager_id: pmId,
                building_id: assignment.buildingId,
                owner_id: ownerId,
                can_view_dashboard: assignment.permissions?.can_view_dashboard ?? true,
                can_manage_units: assignment.permissions?.can_manage_units ?? true,
                can_manage_tenants: assignment.permissions?.can_manage_tenants ?? true,
                can_manage_receipts: assignment.permissions?.can_manage_receipts ?? true,
                can_export_reports: assignment.permissions?.can_export_reports ?? true,
                is_active: true
            });
            await this.managementRepository.save(newMgmt);
        }
    }

    async revokePropertyManager(ownerId: UUID, pmId: UUID): Promise<void> {
        const pm = await this.userRepository.findOneBy({
            id: pmId,
            managed_by_owner_id: ownerId as any
        });

        if (!pm) throw new Error('Property Manager not found');

        pm.managed_by_owner_id = null as any;
        pm.role = 'tenant'; // Reset role or suspend
        pm.status = 'TERMINATED';
        await this.userRepository.save(pm);

        await this.managementRepository.delete({ manager_id: pmId });
    }
}
