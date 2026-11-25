import { UUID } from 'crypto';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRoleType = 'admin' | 'owner' | 'property_manager' | 'tenant';

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 255, nullable: false })
  fullname: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  mobile?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email?: string;

  @Column({
    type: 'enum',
    enum: ['admin', 'owner', 'property_manager', 'tenant'],
  })
  role: UserRoleType;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED'],
    default: 'ACTIVE',
    nullable: true
  })
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

  @Column({ type: 'varchar', length: 6, nullable: true })
  otp_code?: string;

  @Column({ type: 'datetime', nullable: true })
  otp_expires?: Date;

  @Column({ type: 'enum', enum: ['male', 'female', 'other'], nullable: true })
  gender?: 'male' | 'female' | 'other';

  @Column({ type: 'varchar', length: 255, nullable: true })
  street_address?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city?: string;

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
  account_status?: boolean;

  @Column({ type: 'uuid', nullable: true })
  managed_by_owner_id?: UUID;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fcm_token?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notification_email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_id?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_platform?: string;

}
