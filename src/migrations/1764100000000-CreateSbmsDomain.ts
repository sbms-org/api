import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateSbmsDomain1764100000000 implements MigrationInterface {
  name = 'CreateSbmsDomain1764100000000'

  public async up (queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sbms_provider_profiles (
      id char(36) NOT NULL PRIMARY KEY, userId char(36) NOT NULL UNIQUE,
      category varchar(120) NOT NULL, bio text NULL, latitude decimal(10,7) NOT NULL,
      longitude decimal(10,7) NOT NULL, serviceRadiusKm int unsigned NOT NULL DEFAULT 25,
      travelBufferMinutes int unsigned NOT NULL DEFAULT 0,
      meetingModes json NOT NULL, verificationStatus enum('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX idx_sbms_provider_status (verificationStatus), INDEX idx_sbms_provider_location (latitude, longitude)
    ) ENGINE=InnoDB`)
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sbms_services (
      id char(36) NOT NULL PRIMARY KEY, providerId char(36) NOT NULL, title varchar(150) NOT NULL,
      category varchar(120) NOT NULL, description text NULL, priceMinor int unsigned NOT NULL,
      durationMinutes int unsigned NOT NULL, meetingModes json NOT NULL, isActive boolean NOT NULL DEFAULT true,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX idx_sbms_service_provider (providerId), INDEX idx_sbms_service_category (category)
    ) ENGINE=InnoDB`)
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sbms_bookings (
      id char(36) NOT NULL PRIMARY KEY, clientId char(36) NOT NULL, providerId char(36) NOT NULL,
      serviceId char(36) NOT NULL, sourcePostId char(36) NULL, startsAt datetime(6) NOT NULL, endsAt datetime(6) NOT NULL,
      mode enum('provider_comes','client_goes','third_location') NOT NULL, latitude decimal(10,7) NOT NULL,
      longitude decimal(10,7) NOT NULL, landmark varchar(200) NULL, priceMinor int unsigned NOT NULL, completedAt datetime NULL,
      status enum('REQUESTED','CONFIRMED','DECLINED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'REQUESTED',
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX idx_sbms_booking_provider_time (providerId, startsAt, endsAt, status),
      INDEX idx_sbms_booking_client (clientId, createdAt)
    ) ENGINE=InnoDB`)
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sbms_work_posts (
      id char(36) NOT NULL PRIMARY KEY, providerId char(36) NOT NULL, bookingId char(36) NULL,
      serviceId char(36) NULL, type enum('verified_job','sample') NOT NULL,
      caption varchar(500) NULL, area varchar(100) NULL, media json NOT NULL, mediaVersion int unsigned NOT NULL DEFAULT 1,
      status enum('PENDING_CONSENT','PENDING_MODERATION','PUBLISHED','REJECTED','CONSENT_EXPIRED') NOT NULL DEFAULT 'PENDING_CONSENT',
      publishedAt datetime NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX idx_sbms_post_feed (status, publishedAt), INDEX idx_sbms_post_provider (providerId)
    ) ENGINE=InnoDB`)
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sbms_post_consents (
      id char(36) NOT NULL PRIMARY KEY, postId char(36) NOT NULL, clientId char(36) NOT NULL,
      mediaVersion int unsigned NOT NULL, allowed boolean NOT NULL, limitations json NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX idx_sbms_consent_post (postId, mediaVersion, createdAt)
    ) ENGINE=InnoDB`)
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sbms_issues (
      id char(36) NOT NULL PRIMARY KEY, reporterId char(36) NOT NULL,
      type enum('BOOKING','PLATFORM','USER','LISTING','POST','SAFETY') NOT NULL,
      bookingId char(36) NULL, relatedId char(36) NULL, subject varchar(200) NOT NULL,
      description text NOT NULL, status enum('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX idx_sbms_issue_status (status, createdAt), INDEX idx_sbms_issue_reporter (reporterId, createdAt)
    ) ENGINE=InnoDB`)
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sbms_audit_events (
      id char(36) NOT NULL PRIMARY KEY, userId char(36) NULL, action varchar(100) NOT NULL,
      entity varchar(80) NOT NULL, entityId char(36) NULL, details text NULL,
      ipAddress varchar(45) NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX idx_sbms_audit_entity (entity, entityId, createdAt)
    ) ENGINE=InnoDB`)
  }

  public async down (queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sbms_audit_events')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_issues')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_post_consents')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_work_posts')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_bookings')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_services')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_provider_profiles')
  }
}
