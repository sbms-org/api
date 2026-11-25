import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, BaseEntity } from 'typeorm';
import { UUID } from 'crypto';

@Entity()
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_id?: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity_id?: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent?: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
