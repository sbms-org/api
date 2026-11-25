import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, BaseEntity } from 'typeorm';
import { UUID } from 'crypto';

@Entity({ name: 'system_settings' })
export class SystemSettings extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 100, unique: true })
  setting_key: string;

  @Column({ type: 'text' })
  setting_value: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
