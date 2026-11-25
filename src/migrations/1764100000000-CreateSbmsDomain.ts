import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateSbmsDomain1764100000000 implements MigrationInterface {
  name = 'CreateSbmsDomain1764100000000'

  public async up (queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis')
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS btree_gist')

    await queryRunner.query(`CREATE TYPE users_role_enum AS ENUM (
      'client', 'individual_provider', 'company_staff', 'broker', 'support_agent', 'admin'
    )`)
    await queryRunner.query(`CREATE TYPE users_status_enum AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED')`)
    await queryRunner.query(`CREATE TYPE users_gender_enum AS ENUM ('male', 'female', 'other')`)
    await queryRunner.query(`CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      fullname varchar(255) NOT NULL,
      mobile varchar(20) UNIQUE,
      email varchar(255) UNIQUE,
      role users_role_enum NOT NULL,
      status users_status_enum DEFAULT 'ACTIVE',
      otp_code varchar(6),
      otp_expires timestamptz,
      gender users_gender_enum,
      street_address varchar(255),
      city varchar(255),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fcm_token varchar(255),
      notification_email varchar(255),
      device_id varchar(255),
      device_platform varchar(50)
    )`)

    await queryRunner.query(`CREATE TABLE system_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      setting_key varchar(100) NOT NULL UNIQUE,
      setting_value text NOT NULL,
      description varchar(255),
      category varchar(50),
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query(`CREATE TABLE notification_preferences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      in_app_enabled boolean NOT NULL DEFAULT true,
      push_enabled boolean NOT NULL DEFAULT true,
      email_enabled boolean NOT NULL DEFAULT false,
      notification_types jsonb,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query(`CREATE TYPE notifications_type_enum AS ENUM (
      'booking_requested', 'booking_updated', 'provider_verification',
      'work_post_update', 'issue_update', 'general', 'welcome'
    )`)
    await queryRunner.query(`CREATE TABLE notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title varchar(255) NOT NULL,
      message text NOT NULL,
      type notifications_type_enum NOT NULL DEFAULT 'general',
      related_entity_type varchar(50),
      related_entity_id varchar(255),
      is_read boolean NOT NULL DEFAULT false,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query('CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC)')

    await queryRunner.query(`CREATE TYPE sbms_provider_profiles_verificationStatus_enum AS ENUM ('PENDING', 'VERIFIED', 'REJECTED')`)
    await queryRunner.query(`CREATE TABLE sbms_provider_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      category varchar(120) NOT NULL,
      bio text,
      latitude numeric(10,7) NOT NULL,
      longitude numeric(10,7) NOT NULL,
      location geography(Point, 4326) NOT NULL,
      "serviceRadiusKm" integer NOT NULL DEFAULT 25 CHECK ("serviceRadiusKm" > 0),
      "travelBufferMinutes" integer NOT NULL DEFAULT 0 CHECK ("travelBufferMinutes" >= 0),
      "meetingModes" jsonb NOT NULL,
      "verificationStatus" sbms_provider_profiles_verificationStatus_enum NOT NULL DEFAULT 'PENDING',
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query('CREATE INDEX idx_sbms_provider_status ON sbms_provider_profiles ("verificationStatus")')
    await queryRunner.query('CREATE INDEX idx_sbms_provider_location ON sbms_provider_profiles USING GIST (location)')

    await queryRunner.query(`CREATE TABLE sbms_services (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "providerId" uuid NOT NULL REFERENCES sbms_provider_profiles(id) ON DELETE CASCADE,
      title varchar(150) NOT NULL,
      category varchar(120) NOT NULL,
      description text,
      "priceMinor" integer NOT NULL CHECK ("priceMinor" >= 0),
      "durationMinutes" integer NOT NULL CHECK ("durationMinutes" > 0),
      "meetingModes" jsonb NOT NULL,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query('CREATE INDEX idx_sbms_service_provider ON sbms_services ("providerId")')
    await queryRunner.query('CREATE INDEX idx_sbms_service_category ON sbms_services (category)')

    await queryRunner.query(`CREATE TYPE sbms_bookings_mode_enum AS ENUM ('provider_comes', 'client_goes', 'third_location')`)
    await queryRunner.query(`CREATE TYPE sbms_bookings_status_enum AS ENUM (
      'REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'
    )`)
    await queryRunner.query(`CREATE TABLE sbms_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "clientId" uuid NOT NULL REFERENCES users(id),
      "providerId" uuid NOT NULL REFERENCES sbms_provider_profiles(id),
      "serviceId" uuid NOT NULL REFERENCES sbms_services(id),
      "sourcePostId" uuid,
      "startsAt" timestamptz NOT NULL,
      "endsAt" timestamptz NOT NULL,
      mode sbms_bookings_mode_enum NOT NULL,
      latitude numeric(10,7) NOT NULL,
      longitude numeric(10,7) NOT NULL,
      location geography(Point, 4326) NOT NULL,
      landmark varchar(200),
      "priceMinor" integer NOT NULL CHECK ("priceMinor" >= 0),
      "completedAt" timestamptz,
      status sbms_bookings_status_enum NOT NULL DEFAULT 'REQUESTED',
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ("endsAt" > "startsAt"),
      CONSTRAINT ex_sbms_provider_booking_overlap EXCLUDE USING gist (
        "providerId" WITH =,
        tstzrange("startsAt", "endsAt", '[)') WITH &&
      ) WHERE (status IN ('REQUESTED', 'CONFIRMED'))
    )`)
    await queryRunner.query('CREATE INDEX idx_sbms_booking_client ON sbms_bookings ("clientId", "createdAt" DESC)')

    await queryRunner.query(`CREATE TYPE sbms_work_posts_type_enum AS ENUM ('verified_job', 'sample')`)
    await queryRunner.query(`CREATE TYPE sbms_work_posts_status_enum AS ENUM (
      'PENDING_CONSENT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'CONSENT_EXPIRED'
    )`)
    await queryRunner.query(`CREATE TABLE sbms_work_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "providerId" uuid NOT NULL REFERENCES sbms_provider_profiles(id),
      "bookingId" uuid REFERENCES sbms_bookings(id),
      "serviceId" uuid REFERENCES sbms_services(id),
      type sbms_work_posts_type_enum NOT NULL,
      caption varchar(500),
      area varchar(100),
      media jsonb NOT NULL,
      "mediaVersion" integer NOT NULL DEFAULT 1 CHECK ("mediaVersion" > 0),
      status sbms_work_posts_status_enum NOT NULL DEFAULT 'PENDING_CONSENT',
      "publishedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query('CREATE INDEX idx_sbms_post_feed ON sbms_work_posts (status, "publishedAt" DESC)')
    await queryRunner.query('CREATE INDEX idx_sbms_post_provider ON sbms_work_posts ("providerId")')

    await queryRunner.query(`CREATE TABLE sbms_post_consents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "postId" uuid NOT NULL REFERENCES sbms_work_posts(id) ON DELETE CASCADE,
      "clientId" uuid NOT NULL REFERENCES users(id),
      "mediaVersion" integer NOT NULL CHECK ("mediaVersion" > 0),
      allowed boolean NOT NULL,
      limitations jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query('CREATE INDEX idx_sbms_consent_post ON sbms_post_consents ("postId", "mediaVersion", "createdAt" DESC)')

    await queryRunner.query(`CREATE TYPE sbms_issues_type_enum AS ENUM ('BOOKING', 'PLATFORM', 'USER', 'LISTING', 'POST', 'SAFETY')`)
    await queryRunner.query(`CREATE TYPE sbms_issues_status_enum AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')`)
    await queryRunner.query(`CREATE TABLE sbms_issues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "reporterId" uuid NOT NULL REFERENCES users(id),
      type sbms_issues_type_enum NOT NULL,
      "bookingId" uuid REFERENCES sbms_bookings(id),
      "relatedId" uuid,
      subject varchar(200) NOT NULL,
      description text NOT NULL,
      status sbms_issues_status_enum NOT NULL DEFAULT 'OPEN',
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query('CREATE INDEX idx_sbms_issue_status ON sbms_issues (status, "createdAt" DESC)')
    await queryRunner.query('CREATE INDEX idx_sbms_issue_reporter ON sbms_issues ("reporterId", "createdAt" DESC)')

    await queryRunner.query(`CREATE TABLE sbms_audit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid REFERENCES users(id) ON DELETE SET NULL,
      action varchar(100) NOT NULL,
      entity varchar(80) NOT NULL,
      "entityId" uuid,
      details text,
      "ipAddress" varchar(45),
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await queryRunner.query('CREATE INDEX idx_sbms_audit_entity ON sbms_audit_events (entity, "entityId", "createdAt" DESC)')
  }

  public async down (queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sbms_audit_events')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_issues')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_post_consents')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_work_posts')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_bookings')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_services')
    await queryRunner.query('DROP TABLE IF EXISTS sbms_provider_profiles')
    await queryRunner.query('DROP TABLE IF EXISTS notifications')
    await queryRunner.query('DROP TABLE IF EXISTS notification_preferences')
    await queryRunner.query('DROP TABLE IF EXISTS system_settings')
    await queryRunner.query('DROP TABLE IF EXISTS users')

    for (const type of [
      'sbms_issues_status_enum',
      'sbms_issues_type_enum',
      'sbms_work_posts_status_enum',
      'sbms_work_posts_type_enum',
      'sbms_bookings_status_enum',
      'sbms_bookings_mode_enum',
      'sbms_provider_profiles_verificationStatus_enum',
      'notifications_type_enum',
      'users_gender_enum',
      'users_status_enum',
      'users_role_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS ${type}`)
    }
  }
}
