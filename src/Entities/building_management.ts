import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BaseEntity, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user';
import { Building } from './building';
import { UUID } from 'crypto';

@Entity('building_management')
export class BuildingManagement extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: UUID;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'manager_id' })
    manager: User;

    @Column({ name: 'manager_id' })
    manager_id: UUID;

    @ManyToOne(() => Building, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'building_id' })
    building: Building;

    @Column({ name: 'building_id' })
    building_id: UUID;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'owner_id' })
    owner: User;

    @Column({ name: 'owner_id' })
    owner_id: UUID;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: true })
    can_view_dashboard: boolean;

    @Column({ type: 'boolean', default: true })
    can_manage_units: boolean;

    @Column({ type: 'boolean', default: true })
    can_manage_tenants: boolean;

    @Column({ type: 'boolean', default: true })
    can_manage_receipts: boolean;

    @Column({ type: 'boolean', default: true })
    can_export_reports: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
    updated_at: Date;
}
