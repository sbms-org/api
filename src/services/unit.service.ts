import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { Unit } from '../Entities/unit';
import { Building } from '../Entities/building';
import { Payment } from '../Entities/payment';
import { UUID } from 'crypto';

export class UnitService {
  private unitRepository: Repository<Unit>;
  private paymentRepository: Repository<Payment>;

  constructor() {
    this.unitRepository = dataSource.getRepository(Unit);
    this.paymentRepository = dataSource.getRepository(Payment);
  }

  async createUnit(buildingId: UUID, data: Partial<Unit>): Promise<Unit> {
    const building = await dataSource.getRepository(Building).findOneBy({ id: buildingId });
    if (!building) throw new Error('Building not found');

    const unit = this.unitRepository.create({
      ...data,
      building,
    });
    return this.unitRepository.save(unit);
  }

  async getUnitsByBuilding(buildingId: UUID): Promise<Unit[]> {
    return this.unitRepository.find({
      where: { building_id: buildingId, is_active: true },
      relations: ['building'],
    });
  }

  async getUnitById(id: UUID): Promise<Unit | null> {
    return this.unitRepository.findOne({
      where: { id, is_active: true },
      relations: ['building', 'tenant'],
    });
  }

  async updateUnit(id: UUID, data: Partial<Unit>): Promise<Unit | null> {
    const unit = await this.getUnitById(id);
    if (!unit) return null;

    Object.assign(unit, data);
    return this.unitRepository.save(unit);
  }

  async deleteUnit(id: UUID): Promise<boolean> {
    const unit = await this.getUnitById(id);
    if (!unit) return false;

    unit.is_active = false;
    await this.unitRepository.save(unit);
    return true;
  }

  async getPaymentHistory(unitId: UUID): Promise<any[]> {
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.tenant', 'tenant')
      .leftJoinAndSelect('payment.unit', 'unit')
      .leftJoinAndSelect('unit.building', 'building')
      .where('payment.unit_id = :unitId', { unitId })
      .andWhere('payment.status = :status', { status: 'paid' })
      .orderBy('payment.paid_date', 'DESC')
      .getMany();

    return payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      due_date: payment.due_date,
      paid_date: payment.paid_date,
      payment_method: payment.payment_method,
      receipt_url: payment.receipt_file_path,
      notes: payment.notes,
      tenant: {
        id: payment.tenant.id,
        fullname: payment.tenant.fullname,
        mobile: payment.tenant.mobile,
      },
      unit: {
        id: payment.unit.id,
        unit_number: payment.unit.unit_number,
        rent_amount: payment.unit.rent_amount,
        payment_cycle_months: payment.unit.payment_cycle_months,
      },
      building: {
        name: payment.unit.building.name,
      },
    }));
  }
}