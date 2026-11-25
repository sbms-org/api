import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity } from 'typeorm';
import { UUID } from 'crypto';

export type NotificationTemplateType = 
  | 'payment_due_5days'
  | 'payment_due_today'
  | 'payment_overdue'
  | 'receipt_uploaded'
  | 'receipt_approved'
  | 'receipt_rejected'
  | 'lease_expiring_30days'
  | 'lease_expiring_7days'
  | 'maintenance_scheduled'
  | 'building_approved'
  | 'building_rejected'
  | 'tenant_assigned'
  | 'general';

@Entity('notification_template')
export class NotificationTemplate extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 100, unique: true })
  template_key: NotificationTemplateType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message_template: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  target_role: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  public created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  public updated_at: Date;
}
