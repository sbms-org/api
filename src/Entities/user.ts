import { UUID } from 'crypto';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRoleType = 'client' | 'individual_provider' | 'company_staff' | 'broker' | 'support_agent' | 'admin';

@Entity({ name: 'users' })
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
    enum: ['client', 'individual_provider', 'company_staff', 'broker', 'support_agent', 'admin'],
    enumName: 'users_role_enum',
  })
  role: UserRoleType;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED'],
    enumName: 'users_status_enum',
    default: 'ACTIVE',
    nullable: true
  })
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

  @Column({ type: 'varchar', length: 6, nullable: true })
  otp_code?: string;

  @Column({ type: 'timestamptz', nullable: true })
  otp_expires?: Date;

  @Column({ type: 'enum', enum: ['male', 'female', 'other'], enumName: 'users_gender_enum', nullable: true })
  gender?: 'male' | 'female' | 'other';

  @Column({ type: 'varchar', length: 255, nullable: true })
  street_address?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city?: string;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public created_at: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updated_at: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fcm_token?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notification_email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_id?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_platform?: string;

}
