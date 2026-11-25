import { Entity, Column, PrimaryGeneratedColumn, BaseEntity, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user';
import { UUID } from 'crypto';

export type NotificationTypeKey = 
  | 'tenant_assignment'
  | 'tenant_assigned'
  | 'payment_due'
  | 'payment_overdue'
  | 'receipt_uploaded'
  | 'receipt_approved'
  | 'receipt_rejected'
  | 'lease_expiring'
  | 'lease_update'
  | 'maintenance_request'
  | 'maintenance_scheduled'
  | 'tenant_message'
  | 'owner_message'
  | 'building_announcement'
  | 'welcome';

@Entity()
export class NotificationPreferences extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ unique: true })
  user_id: UUID;

  // Global toggles
  @Column({ type: 'boolean', default: true })
  in_app_enabled: boolean;

  @Column({ type: 'boolean', default: true })
  push_enabled: boolean;

  @Column({ type: 'boolean', default: false })
  email_enabled: boolean;

  // Per-notification-type settings (JSON)
  @Column({ type: 'json', nullable: true })
  notification_types: Record<NotificationTypeKey, {
    in_app: boolean;
    push: boolean;
    email: boolean;
  }>;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
