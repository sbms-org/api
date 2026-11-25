import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BaseEntity } from 'typeorm';
import { UUID } from 'crypto';

@Entity()
export class OwnerPaymentMethod extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 36 })
  owner_id: string;

  @Column({ type: 'varchar', length: 36 })
  payment_method_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_number?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  account_name?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile_number?: string;

  @Column({ type: 'text', nullable: true })
  additional_info?: string;

  @Column({ type: 'tinyint', default: 1 })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
