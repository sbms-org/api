import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BaseEntity } from 'typeorm';
import { UUID } from 'crypto';

export type PaymentMethodType = 'BANK' | 'MOBILE_MONEY' | 'CASH';

@Entity()
export class PaymentMethod extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ['BANK', 'MOBILE_MONEY', 'CASH'] })
  type: PaymentMethodType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_number?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider?: string; // For mobile money

  @Column({ type: 'varchar', length: 255, nullable: true })
  account_number_hint?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  account_name_hint?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mobile_number_hint?: string;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
