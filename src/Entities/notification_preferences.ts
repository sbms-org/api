import { Entity, Column, PrimaryGeneratedColumn, BaseEntity, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user';
import { UUID } from 'crypto';

export type NotificationTypeKey = 
  | 'booking_requested'
  | 'booking_updated'
  | 'provider_verification'
  | 'work_post_update'
  | 'issue_update'
  | 'general'
  | 'welcome';

@Entity({ name: 'notification_preferences' })
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
  @Column({ type: 'jsonb', nullable: true })
  notification_types: Record<NotificationTypeKey, {
    in_app: boolean;
    push: boolean;
    email: boolean;
  }>;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
