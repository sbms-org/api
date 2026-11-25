import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { Tenant } from '../Entities/tenant';
import { UUID } from 'crypto';

export class TenantService {
  private tenantRepository: Repository<Tenant>;

  constructor() {
    this.tenantRepository = dataSource.getRepository(Tenant);
  }

  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenantRepository.create(data);
    return this.tenantRepository.save(tenant);
  }

  async getTenants(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      where: { is_active: true },
    });
  }

  async getTenantById(id: UUID): Promise<Tenant | null> {
    return this.tenantRepository.findOne({
      where: { id, is_active: true },
    });
  }

  async updateTenant(id: UUID, data: Partial<Tenant>): Promise<Tenant | null> {
    const tenant = await this.getTenantById(id);
    if (!tenant) return null;

    Object.assign(tenant, data);
    return this.tenantRepository.save(tenant);
  }

  async deleteTenant(id: UUID): Promise<boolean> {
    const tenant = await this.getTenantById(id);
    if (!tenant) return false;

    tenant.is_active = false;
    await this.tenantRepository.save(tenant);
    return true;
  }
}