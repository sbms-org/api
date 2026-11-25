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
  @PrimaryColumn({ type: 'uuid' })
    id: string = randomUUID()

  @CreateDateColumn({ type: 'timestamptz', precision: 6 })
    createdAt: Date
}

@Entity({ name: 'sbms_provider_profiles' })
export class ProviderProfile extends SbmsEntity {
  @Column({ type: 'uuid', unique: true })
    userId: string

  @Column({ type: 'varchar', length: 120 })
    category: string

  @Column({ type: 'text', nullable: true })
    bio?: string

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    latitude: number

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    longitude: number

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
    location: { type: 'Point'; coordinates: [number, number] }

  @Column({ type: 'integer', default: 25 })
    serviceRadiusKm: number

  @Column({ type: 'integer', default: 0 })
    travelBufferMinutes: number

  @Column({ type: 'jsonb' })
    meetingModes: string[]

  @Column({
    type: 'enum',
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    enumName: 'sbms_provider_profiles_verificationStatus_enum',
    default: 'PENDING',
  })
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'

  @UpdateDateColumn({ type: 'timestamptz', precision: 6 })
    updatedAt: Date
}

@Entity({ name: 'sbms_services' })
export class ProviderService extends SbmsEntity {
  @Column({ type: 'uuid' })
    providerId: string

  @Column({ type: 'varchar', length: 150 })
    title: string

  @Column({ type: 'varchar', length: 120 })
    category: string

  @Column({ type: 'text', nullable: true })
    description?: string

  @Column({ type: 'integer' })
    priceMinor: number

  @Column({ type: 'integer' })
    durationMinutes: number

  @Column({ type: 'jsonb' })
    meetingModes: string[]

  @Column({ type: 'boolean', default: true })
    isActive: boolean
}

@Entity({ name: 'sbms_bookings' })
export class SbmsBooking extends SbmsEntity {
  @Column({ type: 'uuid' })
    clientId: string

  @Column({ type: 'uuid' })
    providerId: string

  @Column({ type: 'uuid' })
    serviceId: string

  @Column({ type: 'uuid', nullable: true })
    sourcePostId?: string

  @Column({ type: 'timestamptz', precision: 6 })
    startsAt: Date

  @Column({ type: 'timestamptz', precision: 6 })
    endsAt: Date

  @Column({
    type: 'enum',
    enum: ['provider_comes', 'client_goes', 'third_location'],
    enumName: 'sbms_bookings_mode_enum',
  })
    mode: 'provider_comes' | 'client_goes' | 'third_location'

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    latitude: number

  @Column({ type: 'decimal', precision: 10, scale: 7 })
    longitude: number

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
    location: { type: 'Point'; coordinates: [number, number] }

  @Column({ type: 'varchar', length: 200, nullable: true })
    landmark?: string

  @Column({ type: 'integer' })
    priceMinor: number

  @Column({ type: 'timestamptz', nullable: true })
    completedAt?: Date

  @Column({
    type: 'enum',
    enum: ['REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'],
    enumName: 'sbms_bookings_status_enum',
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
  @Column({ type: 'uuid' })
    providerId: string

  @Column({ type: 'uuid', nullable: true })
    bookingId?: string

  @Column({ type: 'uuid', nullable: true })
    serviceId?: string

  @Column({ type: 'enum', enum: ['verified_job', 'sample'], enumName: 'sbms_work_posts_type_enum' })
    type: 'verified_job' | 'sample'

  @Column({ type: 'varchar', length: 500, nullable: true })
    caption?: string

  @Column({ type: 'varchar', length: 100, nullable: true })
    area?: string

  @Column({ type: 'jsonb' })
    media: SbmsMediaItem[]

  @Column({ type: 'integer', default: 1 })
    mediaVersion: number

  @Column({
    type: 'enum',
    enum: ['PENDING_CONSENT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'CONSENT_EXPIRED'],
    enumName: 'sbms_work_posts_status_enum',
    default: 'PENDING_CONSENT',
  })
    status: 'PENDING_CONSENT' | 'PENDING_MODERATION' | 'PUBLISHED' | 'REJECTED' | 'CONSENT_EXPIRED'

  @Column({ type: 'timestamptz', nullable: true })
    publishedAt?: Date
}

@Entity({ name: 'sbms_post_consents' })
export class PostConsent extends SbmsEntity {
  @Column({ type: 'uuid' })
    postId: string

  @Column({ type: 'uuid' })
    clientId: string

  @Column({ type: 'integer' })
    mediaVersion: number

  @Column({ type: 'boolean' })
    allowed: boolean

  @Column({ type: 'jsonb', nullable: true })
    limitations?: string[]
}

@Entity({ name: 'sbms_issues' })
export class SbmsIssue extends SbmsEntity {
  @Column({ type: 'uuid' })
    reporterId: string

  @Column({
    type: 'enum',
    enum: ['BOOKING', 'PLATFORM', 'USER', 'LISTING', 'POST', 'SAFETY'],
    enumName: 'sbms_issues_type_enum',
  })
    type: 'BOOKING' | 'PLATFORM' | 'USER' | 'LISTING' | 'POST' | 'SAFETY'

  @Column({ type: 'uuid', nullable: true })
    bookingId?: string

  @Column({ type: 'uuid', nullable: true })
    relatedId?: string

  @Column({ type: 'varchar', length: 200 })
    subject: string

  @Column({ type: 'text' })
    description: string

  @Column({
    type: 'enum',
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    enumName: 'sbms_issues_status_enum',
    default: 'OPEN',
  })
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
}

@Entity({ name: 'sbms_audit_events' })
export class SbmsAuditEvent extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
    id: string = randomUUID()

  @Column({ type: 'uuid', nullable: true })
    userId?: string

  @Column({ type: 'varchar', length: 100 })
    action: string

  @Column({ type: 'varchar', length: 80 })
    entity: string

  @Column({ type: 'uuid', nullable: true })
    entityId?: string

  @Column({ type: 'text', nullable: true })
    details?: string

  @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress?: string

  @CreateDateColumn({ type: 'timestamptz', precision: 6 })
    createdAt: Date
}
