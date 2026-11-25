import { UUID } from 'node:crypto';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  CreateDateColumn,
} from 'typeorm';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout';

@Entity()
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('uuid')
  user_id: UUID;

  @Column({
    type: 'enum',
    enum: ['create', 'update', 'delete', 'login', 'logout'],
    nullable: false,
  })
  action: AuditAction;

  @Column({ type: 'varchar', length: 255, nullable: false })
  entity: string; // e.g., 'User', 'Building'

  @Column('uuid')
  entity_id?: UUID;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address?: string;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  public created_at: Date;
}