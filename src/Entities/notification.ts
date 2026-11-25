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
import { User } from './user';
import { UUID } from 'crypto';

export type NotificationType =
  | 'booking_requested'
  | 'booking_updated'
  | 'provider_verification'
  | 'work_post_update'
  | 'issue_update'
  | 'general'
  | 'welcome';

@Entity({ name: 'notifications' })
export class Notification extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 255, nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  message: string;

  @Column({
    type: 'enum',
    enum: ['booking_requested', 'booking_updated', 'provider_verification', 'work_post_update', 'issue_update', 'general', 'welcome'],
    enumName: 'notifications_type_enum',
    default: 'general',
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  related_entity_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  related_entity_id: string;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  user_id: UUID;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  public updated_at: Date;
}