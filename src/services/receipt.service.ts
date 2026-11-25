import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { Receipt } from '../Entities/receipt';
import { Payment } from '../Entities/payment';
import { Unit } from '../Entities/unit';
import { User } from '../Entities/user';
import { UUID } from 'crypto';
import { pushNotificationService } from './push-notification.service';
import moment from 'moment';

export class ReceiptService {
    private receiptRepository: Repository<Receipt>;
    private paymentRepository: Repository<Payment>;
    private unitRepository: Repository<Unit>;
    private userRepository: Repository<User>;

    constructor() {
        this.receiptRepository = dataSource.getRepository(Receipt);
        this.paymentRepository = dataSource.getRepository(Payment);
        this.unitRepository = dataSource.getRepository(Unit);
        this.userRepository = dataSource.getRepository(User);
    }

    async uploadReceipt(tenantId: UUID, unitId: UUID, receiptUrl: string, paymentMethodId?: string, notes?: string): Promise<Receipt> {
        const unit = await this.unitRepository.findOne({
            where: { id: unitId },
            relations: ['building', 'building.owner', 'tenant']
        });
        if (!unit) throw new Error('Unit not found');

        const receipt = this.receiptRepository.create({
            tenant_id: tenantId,
            unit_id: unitId,
            receipt_url: receiptUrl,
            owner_payment_method_id: paymentMethodId,
            notes,
            status: 'PENDING',
        });

        const savedReceipt = await this.receiptRepository.save(receipt);

        // Send push notification to owner
        const tenant = await this.userRepository.findOne({ where: { id: tenantId } });
        await pushNotificationService.notifyOwnerReceiptUploaded(
            unit.building.owner.id,
            tenant?.fullname || 'Tenant',
            unit.unit_number,
            unit.building.name,
            savedReceipt.id,
            unit.rent_amount || 0
        );

        return savedReceipt;
    }

    async getPendingReceiptsForOwner(ownerId: UUID): Promise<Receipt[]> {
        return this.receiptRepository.createQueryBuilder('receipt')
            .leftJoinAndSelect('receipt.unit', 'unit')
            .leftJoinAndSelect('unit.building', 'building')
            .leftJoinAndSelect('receipt.tenant', 'tenant')
            .where('building.owner_id = :ownerId', { ownerId })
            .andWhere('receipt.status = :status', { status: 'PENDING' })
            .orderBy('receipt.created_at', 'DESC')
            .getMany();
    }

    async getPendingReceiptsForBuildings(buildingIds: UUID[], currentMonthOnly: boolean = false): Promise<Receipt[]> {
        const query = this.receiptRepository.createQueryBuilder('receipt')
            .leftJoinAndSelect('receipt.unit', 'unit')
            .leftJoinAndSelect('unit.building', 'building')
            .leftJoinAndSelect('receipt.tenant', 'tenant')
            .where('building.id IN (:...buildingIds)', { buildingIds })
            .andWhere('receipt.status = :status', { status: 'PENDING' });

        if (currentMonthOnly) {
            const startOfMonth = moment().startOf('month').toDate();
            query.andWhere('receipt.created_at >= :startOfMonth', { startOfMonth });
        }

        return query.orderBy('receipt.created_at', 'DESC').getMany();
    }

    async acceptReceipt(receiptId: UUID, notes?: string): Promise<Receipt> {
        const receipt = await this.receiptRepository.findOne({
            where: { id: receiptId },
            relations: ['unit', 'tenant', 'unit.building']
        });
        if (!receipt) throw new Error('Receipt not found');

        receipt.status = 'ACCEPTED';
        if (notes) receipt.notes = notes;
        await this.receiptRepository.save(receipt);

        // Create Payment record
        const payment = this.paymentRepository.create({
            amount: receipt.unit.rent_amount,
            due_date: receipt.unit.next_rent_due_date || new Date(),
            paid_date: new Date(),
            status: 'paid',
            tenant_id: receipt.tenant_id,
            unit_id: receipt.unit_id,
            receipt_file_path: receipt.receipt_url,
            receipt_status: 'approved',
            notes: receipt.notes,
        });
        await this.paymentRepository.save(payment);

        // Extend nextRentDueDate
        const unit = receipt.unit;
        const cycle = unit.payment_cycle_months || 3;
        const currentDueDate = unit.next_rent_due_date ? moment(unit.next_rent_due_date) : moment();
        unit.next_rent_due_date = currentDueDate.add(cycle, 'months').toDate();
        await this.unitRepository.save(unit);

        // Send push notification to tenant
        await pushNotificationService.notifyTenantReceiptApproved(
            receipt.tenant_id,
            unit.unit_number,
            unit.building.name,
            receipt.unit.rent_amount || 0,
            receiptId
        );

        return receipt;
    }

    async rejectReceipt(receiptId: UUID, reason: string): Promise<Receipt> {
        const receipt = await this.receiptRepository.findOne({
            where: { id: receiptId },
            relations: ['unit', 'unit.building']
        });
        if (!receipt) throw new Error('Receipt not found');

        receipt.status = 'REJECTED';
        receipt.notes = reason;
        await this.receiptRepository.save(receipt);

        // Send push notification to tenant
        await pushNotificationService.notifyTenantReceiptRejected(
            receipt.tenant_id,
            receipt.unit.unit_number,
            receipt.unit.building.name,
            receipt.unit.rent_amount || 0,
            reason,
            receiptId
        );

        return receipt;
    }
}
