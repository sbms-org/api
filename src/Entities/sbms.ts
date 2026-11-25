import { randomUUID } from 'node:crypto'
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'

abstract class SbmsEntity extends BaseEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
    id: string = randomUUID()

  @CreateDateColumn({ type: 'datetime', precision: 6 })
    createdAt: Date
}

@Entity({ name: 'sbms_provider_profiles' })
export class ProviderProfile extends SbmsEntity {
  @Column({ type: 'char', length: 36, unique: true })
    userId: string

  @Column({ type: 'varchar', length: 120 })
    category: string

  @Column({ type: 'text', nullable: true })
    bio?: string

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    latitude: number

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    longitude: number

  @Column({ type: 'int', unsigned: true, default: 25 })
    serviceRadiusKm: number

  @Column({ type: 'int', unsigned: true, default: 0 })
    travelBufferMinutes: number

  @Column({ type: 'json' })
    meetingModes: string[]

  @Column({
    type: 'enum',
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING',
  })
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
    updatedAt: Date
}

@Entity({ name: 'sbms_services' })
export class ProviderService extends SbmsEntity {
  @Column({ type: 'char', length: 36 })
    providerId: string

  @Column({ type: 'varchar', length: 150 })
    title: string

  @Column({ type: 'varchar', length: 120 })
    category: string

  @Column({ type: 'text', nullable: true })
    description?: string

  @Column({ type: 'int', unsigned: true })
    priceMinor: number

  @Column({ type: 'int', unsigned: true })
    durationMinutes: number

  @Column({ type: 'json' })
    meetingModes: string[]

  @Column({ type: 'boolean', default: true })
    isActive: boolean
}

@Entity({ name: 'sbms_bookings' })
export class SbmsBooking extends SbmsEntity {
  @Column({ type: 'char', length: 36 })
    clientId: string

  @Column({ type: 'char', length: 36 })
    providerId: string

  @Column({ type: 'char', length: 36 })
    serviceId: string

  @Column({ type: 'char', length: 36, nullable: true })
    sourcePostId?: string

  @Column({ type: 'datetime', precision: 6 })
    startsAt: Date

  @Column({ type: 'datetime', precision: 6 })
    endsAt: Date

  @Column({
    type: 'enum',
    enum: ['provider_comes', 'client_goes', 'third_location'],
  })
    mode: 'provider_comes' | 'client_goes' | 'third_location'

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    latitude: number

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    longitude: number

  @Column({ type: 'varchar', length: 200, nullable: true })
    landmark?: string

  @Column({ type: 'int', unsigned: true })
    priceMinor: number

  @Column({ type: 'datetime', nullable: true })
    completedAt?: Date

  @Column({
    type: 'enum',
    enum: ['REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'],
    default: 'REQUESTED',
  })
    status: 'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED'
}

export interface SbmsMediaItem {
  url: string;
  type: 'photo' | 'video';
  durationSeconds?: number;
}

@Entity({ name: 'sbms_work_posts' })
export class WorkPost extends SbmsEntity {
  @Column({ type: 'char', length: 36 })
    providerId: string

  @Column({ type: 'char', length: 36, nullable: true })
    bookingId?: string

  @Column({ type: 'char', length: 36, nullable: true })
    serviceId?: string

  @Column({ type: 'enum', enum: ['verified_job', 'sample'] })
    type: 'verified_job' | 'sample'

  @Column({ type: 'varchar', length: 500, nullable: true })
    caption?: string

  @Column({ type: 'varchar', length: 100, nullable: true })
    area?: string

  @Column({ type: 'json' })
    media: SbmsMediaItem[]

  @Column({ type: 'int', unsigned: true, default: 1 })
    mediaVersion: number

  @Column({
    type: 'enum',
    enum: ['PENDING_CONSENT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'CONSENT_EXPIRED'],
    default: 'PENDING_CONSENT',
  })
    status: 'PENDING_CONSENT' | 'PENDING_MODERATION' | 'PUBLISHED' | 'REJECTED' | 'CONSENT_EXPIRED'

  @Column({ type: 'datetime', nullable: true })
    publishedAt?: Date
}

@Entity({ name: 'sbms_post_consents' })
export class PostConsent extends SbmsEntity {
  @Column({ type: 'char', length: 36 })
    postId: string

  @Column({ type: 'char', length: 36 })
    clientId: string

  @Column({ type: 'int', unsigned: true })
    mediaVersion: number

  @Column({ type: 'boolean' })
    allowed: boolean

  @Column({ type: 'json', nullable: true })
    limitations?: string[]
}

@Entity({ name: 'sbms_issues' })
export class SbmsIssue extends SbmsEntity {
  @Column({ type: 'char', length: 36 })
    reporterId: string

  @Column({ type: 'enum', enum: ['BOOKING', 'PLATFORM', 'USER', 'LISTING', 'POST', 'SAFETY'] })
    type: 'BOOKING' | 'PLATFORM' | 'USER' | 'LISTING' | 'POST' | 'SAFETY'

  @Column({ type: 'char', length: 36, nullable: true })
    bookingId?: string

  @Column({ type: 'char', length: 36, nullable: true })
    relatedId?: string

  @Column({ type: 'varchar', length: 200 })
    subject: string

  @Column({ type: 'text' })
    description: string

  @Column({
    type: 'enum',
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
  })
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
}

@Entity({ name: 'sbms_audit_events' })
export class SbmsAuditEvent extends BaseEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
    id: string = randomUUID()

  @Column({ type: 'char', length: 36, nullable: true })
    userId?: string

  @Column({ type: 'varchar', length: 100 })
    action: string

  @Column({ type: 'varchar', length: 80 })
    entity: string

  @Column({ type: 'char', length: 36, nullable: true })
    entityId?: string

  @Column({ type: 'text', nullable: true })
    details?: string

  @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress?: string

  @CreateDateColumn({ type: 'datetime', precision: 6 })
    createdAt: Date
}
