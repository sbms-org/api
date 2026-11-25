import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    BaseEntity,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user';
import { Unit } from './unit';
import { UUID } from 'crypto';

export type ReceiptStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

@Entity()
export class Receipt extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: UUID;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'tenant_id' })
    tenant: User;

    @Column({ name: 'tenant_id' })
    tenant_id: UUID;

    @ManyToOne(() => Unit, { nullable: false })
    @JoinColumn({ name: 'unit_id' })
    unit: Unit;

    @Column({ name: 'unit_id' })
    unit_id: UUID;

    @Column({ name: 'owner_payment_method_id', type: 'varchar', length: 36, nullable: true })
    owner_payment_method_id?: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    receipt_url: string;

    @Column({
        type: 'enum',
        enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
        default: 'PENDING',
    })
    status: ReceiptStatus;

    @Column({ type: 'text', nullable: true })
    rejection_reason?: string;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @CreateDateColumn({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP(6)',
    })
    public created_at: Date;

    @UpdateDateColumn({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP(6)',
        onUpdate: 'CURRENT_TIMESTAMP(6)',
    })
    public updated_at: Date;
}
