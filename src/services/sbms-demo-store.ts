import { randomUUID } from 'node:crypto'
import demoData from '../data/sbms-demo-data.json'
import { dataSource } from '../configurations/db.config'
import { SbmsBooking, SbmsIssue, WorkPost, ProviderProfile } from '../Entities/sbms'
import logger from '../configurations/logger'
import { Response } from 'express'

export interface DemoUser {
  id: string
  fullname: string
  mobile: string
  email: string
  role: 'client' | 'individual_provider' | 'company_staff' | 'broker' | 'support_agent' | 'admin'
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'TERMINATED'
  city: string
  created_at: string
}

export interface DemoProvider {
  id: string
  userId: string
  category: string
  bio?: string
  latitude: number
  longitude: number
  serviceRadiusKm: number
  travelBufferMinutes: number
  meetingModes: string[]
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  createdAt: string
  [key: string]: unknown
}

export interface DemoService {
  id: string
  providerId: string
  title: string
  category: string
  description?: string
  priceMinor: number
  durationMinutes: number
  meetingModes: string[]
  isActive: boolean
  createdAt: string
  [key: string]: unknown
}

export interface DemoBooking {
  id: string
  clientId: string
  providerId: string
  serviceId: string
  sourcePostId?: string
  startsAt: string
  endsAt: string
  mode: 'provider_comes' | 'client_goes' | 'third_location'
  latitude: number
  longitude: number
  landmark?: string
  priceMinor: number
  completedAt?: string
  status: 'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED'
  createdAt: string
  [key: string]: unknown
}

export interface DemoPost {
  id: string
  providerId: string
  bookingId?: string
  serviceId?: string
  type: 'verified_job' | 'sample'
  caption?: string
  area?: string
  media: Array<{ url: string; type: 'photo' | 'video'; durationSeconds?: number }>
  mediaVersion: number
  status: 'PENDING_CONSENT' | 'PENDING_MODERATION' | 'PUBLISHED' | 'REJECTED' | 'CONSENT_EXPIRED'
  publishedAt?: string
  createdAt: string
  [key: string]: unknown
}

export interface DemoIssue {
  id: string
  reporterId: string
  type: 'BOOKING' | 'PLATFORM' | 'USER' | 'LISTING' | 'POST' | 'SAFETY'
  bookingId?: string
  relatedId?: string
  subject: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  createdAt: string
  [key: string]: unknown
}

export interface DemoConsent {
  id: string
  postId: string
  clientId: string
  mediaVersion: number
  allowed: boolean
  limitations: string[]
  createdAt: string
}

export interface DemoAuditEvent {
  id: string
  userId?: string
  action: string
  entity: string
  entityId?: string
  details?: string
  ipAddress?: string
  createdAt: string
}

export interface DemoSetting {
  key: string
  value: unknown
  category: string
  description?: string
  updatedAt: string
}

export interface DemoData {
  users: DemoUser[]
  providers: DemoProvider[]
  services: DemoService[]
  bookings: DemoBooking[]
  workPosts: DemoPost[]
  consents: DemoConsent[]
  issues: DemoIssue[]
  auditEvents: DemoAuditEvent[]
  settings: DemoSetting[]
}

const state: DemoData = JSON.parse(JSON.stringify(demoData)) as DemoData

const relativeIso = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString()
state.users.forEach((user, index) => {
  user.created_at = relativeIso(-((index + 1) * 86_400_000))
})
state.providers.forEach((provider, index) => {
  provider.createdAt = relativeIso(-((index + 2) * 86_400_000))
})
state.services.forEach((service, index) => {
  service.createdAt = relativeIso(-((index + 2) * 86_400_000))
})
state.bookings.forEach((booking, index) => {
  const service = state.services.find((item) => item.id === booking.serviceId)
  const completed = booking.status === 'COMPLETED'
  const start = Date.now() + (completed ? -3 : (7 + index * 2)) * 86_400_000
  booking.startsAt = new Date(start).toISOString()
  booking.endsAt = new Date(start + (service?.durationMinutes ?? 60) * 60_000).toISOString()
  booking.createdAt = relativeIso(completed ? -4 * 86_400_000 : -86_400_000)
  if (completed) booking.completedAt = booking.endsAt
})
state.workPosts.forEach((post, index) => {
  post.createdAt = relativeIso(-((index + 1) * 86_400_000))
  if (post.status === 'PUBLISHED') post.publishedAt = post.createdAt
})
state.consents.forEach((consent, index) => {
  consent.createdAt = relativeIso(-((index + 8) * 86_400_000))
})
state.issues.forEach((issue, index) => {
  issue.createdAt = relativeIso(-((index + 1) * 86_400_000))
})
state.auditEvents.forEach((event, index) => {
  event.createdAt = relativeIso(-((index + 1) * 60 * 60_000))
})
state.settings.forEach((setting) => {
  setting.updatedAt = relativeIso(-86_400_000)
})
let activeCache: { value: boolean; expiresAt: number } | undefined

export const demoState = (): DemoData => state
export const newDemoId = (): string => randomUUID()
export const demoUserByMobile = (mobile: string): DemoUser | undefined =>
  state.users.find((user) => user.mobile === mobile)
export const demoUserById = (id: string): DemoUser | undefined =>
  state.users.find((user) => user.id === id)

export async function isDemoDataActive (): Promise<boolean> {
  const setting = (process.env.SBMS_DEMO_MODE || 'auto').toLowerCase()
  if (setting === 'always') return true
  if (setting === 'off') return false
  if (setting !== 'auto') {
    logger.warn(`Unsupported SBMS_DEMO_MODE="${setting}"; using auto mode`)
  }
  if (!dataSource.isInitialized) return true
  if (activeCache && activeCache.expiresAt > Date.now()) return activeCache.value
  try {
    const [providerCount, bookingCount, postCount, issueCount] = await Promise.all([
      dataSource.getRepository(ProviderProfile).count(),
      dataSource.getRepository(SbmsBooking).count(),
      dataSource.getRepository(WorkPost).count(),
      dataSource.getRepository(SbmsIssue).count(),
    ])
    activeCache = {
      value: providerCount + bookingCount + postCount + issueCount === 0,
      expiresAt: Date.now() + 5000,
    }
  } catch (error) {
    logger.warn('Database is unavailable for SBMS reads; using the JSON demo dataset', error)
    activeCache = { value: true, expiresAt: Date.now() + 1000 }
  }
  return activeCache.value
}

export function markDemoResponse (res: Response): void {
  res.setHeader('X-SBMS-Data-Source', 'demo')
  res.setHeader('Cache-Control', 'no-store')
}

export function appendDemoAudit (
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  details?: unknown,
  ipAddress?: string,
): DemoAuditEvent {
  const event: DemoAuditEvent = {
    id: newDemoId(),
    userId,
    action,
    entity,
    entityId,
    details: details === undefined ? undefined : JSON.stringify(details),
    ipAddress,
    createdAt: new Date().toISOString(),
  }
  state.auditEvents.unshift(event)
  return event
}
