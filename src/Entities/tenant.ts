import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UUID } from 'crypto';
import { User } from './user';
import { ManyToOne, JoinColumn } from 'typeorm';

@Entity()
export class Tenant extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 255, nullable: false })
  fullname: string;

  @Column({ type: 'varchar', length: 20, nullable: false, unique: true })
  mobile: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emergency_contact_name?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emergency_contact_mobile?: string;

  // Optional link to a `User` account when a tenant has an app account
  @ManyToOne(() => User, { nullable : true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

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