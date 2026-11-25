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
import { Building } from './building';
import { User } from './user';
import { UUID } from 'crypto';

export type UnitStatus = 'vacant' | 'occupied' | 'maintenance';

@Entity()
export class Unit extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 50, nullable: false })
  unit_number: string;

  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  unit_code?: string;

  @Column({ type: 'int', nullable: true })
  floor?: number;

  @Column({ type: 'double', precision: 10, scale: 2, nullable: true })
  rent_amount?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size?: string; // e.g., "1000 sq ft"

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ['vacant', 'occupied', 'maintenance'],
    default: 'vacant',
  })
  status: UnitStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: User;

  @Column({ name: 'tenant_id', nullable: true })
  tenant_id: UUID;

  @Column({ type: 'date', nullable: true })
  next_rent_due_date: Date;

  @Column({ type: 'int', default: 3 })
  payment_cycle_months: number;

  @ManyToOne(() => Building, { nullable: false })
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @Column({ name: 'building_id' })
  building_id: UUID;

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

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  get is_rent_due(): boolean {
    if (!this.next_rent_due_date) return false;
    const moment = require('moment');
    return moment().isSameOrAfter(moment(this.next_rent_due_date).startOf('day'));
  }
}