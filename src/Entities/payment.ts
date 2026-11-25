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

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type ReceiptStatus = 'pending' | 'approved' | 'rejected';

@Entity()
export class Payment extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'date', nullable: false })
  due_date: Date;

  @Column({ type: 'date', nullable: true })
  paid_date?: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending',
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method?: string; // e.g., 'cash', 'online', 'bank_transfer'

  @Column({ type: 'varchar', length: 255, nullable: true })
  transaction_id?: UUID;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Link payment to tenant and unit directly (tenant may have multiple unit assignments)
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

  // Receipt file uploaded by tenant (png/jpg/pdf)
  @Column({ type: 'varchar', length: 255, nullable: true })
  receipt_file_path?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  receipt_status: ReceiptStatus;

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