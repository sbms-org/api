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
// import { Tenant } from './tenant';
import { Unit } from './unit';
import { User } from './user';
import { UUID } from 'crypto';

@Entity()
export class TenantAssignment extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  // @ManyToOne(() => Tenant, { nullable: false })
  // @JoinColumn({ name: 'tenant_id' })
  // tenant: Tenant;

  @Column({ name: 'tenant_id' })
  tenant_id: UUID;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'unit_id' })
  unit_id: UUID;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  owner_id: UUID;

  @Column({ type: 'date', nullable: false })
  start_date: Date;

  @Column({ type: 'date', nullable: false })
  end_date: Date;

  @Column({ type: 'int', default: 3 })
  payment_cycle_months: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lease_document_url?: string;

  @Column({ type: 'date', nullable: true })
  first_rent_due_date?: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  public created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  public updated_at: Date;
}
