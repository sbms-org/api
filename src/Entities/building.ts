import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user';
import { Unit } from './unit';
import { UUID } from 'crypto';

@Entity()
export class Building extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  property_type: string;

  @Column({ type: 'text', nullable: true })
  additional_notes?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state_or_province?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'ETHIOPIA' })
  country?: string;

  @Column({ type: 'int', nullable: true })
  total_floors?: number;

  @Column({ type: 'int', nullable: true })
  total_units: number;
 

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'Monthly' })
  payment_cycle: string;

  @Column({ type: 'enum', enum: ['EVEN', 'CUSTOM'], default: 'EVEN' })
  unit_per_floor_distribution: 'EVEN' | 'CUSTOM';

  // When distribution is CUSTOM this can store a JSON array of ints representing units per floor
  @Column({ type: 'text', nullable: true })
  unit_per_floor_distribution_details?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  default_rent_amount: number;

  @Column({
    type: 'enum',
    enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'PENDING_REVIEW',
  })
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'varchar', length: 255, nullable: true })
  property_deed_url?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  certificate_of_title_url?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  business_tin_number_url?: string;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  owner_id: UUID;

  @OneToMany(() => Unit, (unit) => unit.building)
  units: Unit[];

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
}