import { NextFunction, Request, Response } from 'express'
import { dataSource } from '../configurations/db.config'
import {
  PostConsent,
  ProviderProfile,
  ProviderService,
  SbmsAuditEvent,
  SbmsBooking,
  SbmsIssue,
  WorkPost,
  SbmsMediaItem,
} from '../Entities/sbms'
import { SystemSettings } from '../Entities/system_settings'
import { User, UserRoleType } from '../Entities/user'
import { ApiResponse } from '../utils/ApiResponse'
import { canTransitionBooking, distanceKm } from '../utils/sbms.rules'
import { In } from 'typeorm'

type MeetingMode = 'provider_comes' | 'client_goes' | 'third_location';
type UserContext = { id: string; role: string };

class HttpError extends Error {
  status: number
  errorCode: string

  constructor (status: number, message: string, errorCode = 'SBMS_REQUEST_ERROR') {
    super(message)
    this.status = status
    this.errorCode = errorCode
  }
}

const modes: MeetingMode[] = ['provider_comes', 'client_goes', 'third_location']
const currentUser = (req: Request): UserContext => (req as any).user as UserContext
function badRequest (message: string): never {
  throw new HttpError(400, message)
}
function notFound (message: string): never {
  throw new HttpError(404, message, 'NOT_FOUND')
}
function forbidden (message: string): never {
  throw new HttpError(403, message, 'FORBIDDEN')
}
function gone (message: string): never {
  throw new HttpError(410, message, 'EXPIRED')
}

const routeId = (req: Request): string => {
  const id = req.params.id
  if (typeof id !== 'string') badRequest('A single route identifier is required')
  return id
}

const latitudeLongitudeValid = (latitude: unknown, longitude: unknown): boolean => {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}

const approximate = (coordinate: number): number => Number(coordinate.toFixed(3))

const parseSettingValue = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const validModes = (value: unknown): value is MeetingMode[] => {
  return Array.isArray(value) && value.length > 0 && value.every((mode) => modes.includes(mode))
}

const parseDate = (value: unknown, field: string): Date => {
  if (typeof value !== 'string') badRequest(`${field} must be an ISO date-time`)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(value as string)) {
    badRequest(`${field} must include an ISO date-time with a timezone`)
  }
  const date = new Date(value as string)
  if (!Number.isFinite(date.getTime())) badRequest(`${field} must be an ISO date-time`)
  return date
}

const getOwnedProfile = async (userId: string): Promise<ProviderProfile> => {
  const profile = await dataSource.getRepository(ProviderProfile).findOneBy({ userId })
  if (!profile) notFound('Provider profile not found')
  return profile
}

const audit = async (req: Request, action: string, entity: string, entityId?: string, details?: unknown) => {
  await dataSource.getRepository(SbmsAuditEvent).save({
    userId: currentUser(req)?.id,
    action,
    entity,
    entityId,
    details: details === undefined ? undefined : JSON.stringify(details),
    ipAddress: req.ip,
  })
}

const run = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as { status?: string } | undefined
      if (user && user.status && user.status !== 'ACTIVE') {
        forbidden('Account is not active')
      }
      await handler(req, res)
    } catch (error) {
      return next(error)
    }
  }

export const ProviderController = {
  create: run(async (req, res) => {
    const user = currentUser(req)
    const { category, bio, latitude, longitude, serviceRadiusKm = 25, travelBufferMinutes = 0, meetingModes } = req.body
    if (typeof category !== 'string' || !category.trim() || category.length > 120) badRequest('category is required (max 120 characters)')
    if (!latitudeLongitudeValid(latitude, longitude)) badRequest('latitude and longitude must be valid coordinates')
    if (bio !== undefined && (typeof bio !== 'string' || bio.length > 5000)) badRequest('bio must be a string of at most 5000 characters')
    if (!Number.isInteger(serviceRadiusKm) || serviceRadiusKm < 1 || serviceRadiusKm > 500) badRequest('serviceRadiusKm must be an integer from 1 to 500')
    if (!Number.isInteger(travelBufferMinutes) || travelBufferMinutes < 0 || travelBufferMinutes > 720) badRequest('travelBufferMinutes must be an integer from 0 to 720')
    if (!validModes(meetingModes)) badRequest('meetingModes must contain one or more supported meeting modes')
    const repository = dataSource.getRepository(ProviderProfile)
    if (await repository.findOneBy({ userId: user.id })) throw new HttpError(409, 'Provider profile already exists', 'CONFLICT')
    const profile = await repository.save(repository.create({
      userId: user.id,
      category: category.trim(),
      bio: typeof bio === 'string' ? bio.trim() : undefined,
      latitude,
      longitude,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      serviceRadiusKm,
      travelBufferMinutes,
      meetingModes: [...new Set(meetingModes)],
    }))
    await audit(req, 'provider.created', 'provider_profile', profile.id)
    return ApiResponse.success(res, profile, 'Provider profile submitted for verification', 201)
  }),

  updateMine: run(async (req, res) => {
    const profile = await getOwnedProfile(currentUser(req).id)
    const { category, bio, latitude, longitude, serviceRadiusKm, travelBufferMinutes, meetingModes } = req.body
    if (category !== undefined) {
      if (typeof category !== 'string' || !category.trim() || category.length > 120) badRequest('category must be 1–120 characters')
      profile.category = category.trim()
    }
    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > 5000) badRequest('bio must be a string of at most 5000 characters')
      profile.bio = bio.trim()
    }
    if (latitude !== undefined || longitude !== undefined) {
      const newLatitude = latitude === undefined ? Number(profile.latitude) : latitude
      const newLongitude = longitude === undefined ? Number(profile.longitude) : longitude
      if (!latitudeLongitudeValid(newLatitude, newLongitude)) badRequest('latitude and longitude must be valid coordinates')
      profile.latitude = newLatitude
      profile.longitude = newLongitude
      profile.location = { type: 'Point', coordinates: [newLongitude, newLatitude] }
    }
    if (serviceRadiusKm !== undefined) {
      if (!Number.isInteger(serviceRadiusKm) || serviceRadiusKm < 1 || serviceRadiusKm > 500) badRequest('serviceRadiusKm must be an integer from 1 to 500')
      profile.serviceRadiusKm = serviceRadiusKm
    }
    if (travelBufferMinutes !== undefined) {
      if (!Number.isInteger(travelBufferMinutes) || travelBufferMinutes < 0 || travelBufferMinutes > 720) badRequest('travelBufferMinutes must be an integer from 0 to 720')
      profile.travelBufferMinutes = travelBufferMinutes
    }
    if (meetingModes !== undefined) {
      if (!validModes(meetingModes)) badRequest('meetingModes must contain one or more supported meeting modes')
      profile.meetingModes = [...new Set(meetingModes)]
    }
    const updated = await dataSource.getRepository(ProviderProfile).save(profile)
    await audit(req, 'provider.updated', 'provider_profile', profile.id)
    return ApiResponse.success(res, updated)
  }),

  createService: run(async (req, res) => {
    const profile = await getOwnedProfile(currentUser(req).id)
    const { title, category, description, priceMinor, durationMinutes, meetingModes } = req.body
    if (typeof title !== 'string' || !title.trim() || title.length > 150) badRequest('title is required (max 150 characters)')
    if (typeof category !== 'string' || !category.trim() || category.length > 120) badRequest('category is required (max 120 characters)')
    if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) badRequest('priceMinor must be a non-negative integer')
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) badRequest('durationMinutes must be between 1 and 1440')
    if (!validModes(meetingModes)) badRequest('meetingModes must contain one or more supported meeting modes')
    if (meetingModes.some((mode) => !profile.meetingModes.includes(mode))) badRequest('Service meeting modes must be supported by the provider profile')
    const service = await dataSource.getRepository(ProviderService).save({
      providerId: profile.id,
      title: title.trim(),
      category: category.trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
      priceMinor,
      durationMinutes,
      meetingModes: [...new Set(meetingModes)],
    })
    await audit(req, 'service.created', 'service', service.id)
    return ApiResponse.success(res, service, 'Service created', 201)
  }),

  getMine: run(async (req, res) => {
    const profile = await dataSource.getRepository(ProviderProfile).findOneBy({
      userId: currentUser(req).id,
    })
    if (!profile) return ApiResponse.success(res, null)
    const owner = await dataSource.getRepository(User).findOneBy({
      id: profile.userId as User['id'],
      status: 'ACTIVE',
    })
    if (!owner) notFound('Provider account is not active')
    const services = await dataSource.getRepository(ProviderService).findBy({
      providerId: profile.id,
      isActive: true,
    })
    return ApiResponse.success(res, {
      id: profile.id,
      userId: profile.userId,
      displayName: owner.fullname,
      category: profile.category,
      bio: profile.bio,
      latitude: approximate(Number(profile.latitude)),
      longitude: approximate(Number(profile.longitude)),
      serviceRadiusKm: profile.serviceRadiusKm,
      travelBufferMinutes: profile.travelBufferMinutes,
      meetingModes: profile.meetingModes,
      verificationStatus: profile.verificationStatus,
      services,
    })
  }),

  nearby: run(async (req, res) => {
    const latitude = Number(req.query.latitude)
    const longitude = Number(req.query.longitude)
    const radiusKm = req.query.radiusKm === undefined ? 25 : Number(req.query.radiusKm)
    if (!latitudeLongitudeValid(latitude, longitude)) badRequest('latitude and longitude query parameters are required and must be valid coordinates')
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) badRequest('radiusKm must be greater than 0 and at most 500')
    const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : undefined
    const meetingMode = typeof req.query.meetingMode === 'string' ? req.query.meetingMode : undefined
    if (meetingMode && !modes.includes(meetingMode as MeetingMode)) badRequest('meetingMode is not supported')
    const profiles = await dataSource.getRepository(ProviderProfile).createQueryBuilder('provider')
      .where('provider.verificationStatus = :status', { status: 'VERIFIED' })
      .andWhere(
        'ST_DWithin(provider.location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography, LEAST(:radiusMeters, provider.serviceRadiusKm * 1000))',
        { longitude, latitude, radiusMeters: radiusKm * 1000 },
      )
      .getMany()
    if (!profiles.length) return ApiResponse.success(res, [])
    const users = await dataSource.getRepository(User).findBy({
      id: In(profiles.map((profile) => profile.userId as User['id'])),
      status: 'ACTIVE',
    })
    const activeUserById = new Map<string, User>(users.map((user) => [String(user.id), user]))
    const candidates = await Promise.all(profiles.map(async (profile) => {
      const owner = activeUserById.get(profile.userId)
      if (!owner) return null
      const distance = distanceKm(latitude, longitude, Number(profile.latitude), Number(profile.longitude))
      if (distance > Math.min(radiusKm, profile.serviceRadiusKm) || (meetingMode && !profile.meetingModes.includes(meetingMode))) return null
      const services = await dataSource.getRepository(ProviderService).findBy({ providerId: profile.id, isActive: true })
      const matchingServices = services.filter((service) =>
        (!category || service.category.toLowerCase() === category) &&
        (!meetingMode || service.meetingModes.includes(meetingMode)))
      if ((category || meetingMode) && matchingServices.length === 0) return null
      return {
        id: profile.id,
        userId: profile.userId,
        displayName: owner.fullname,
        category: profile.category,
        bio: profile.bio,
        latitude: approximate(Number(profile.latitude)),
        longitude: approximate(Number(profile.longitude)),
        serviceRadiusKm: profile.serviceRadiusKm,
        travelBufferMinutes: profile.travelBufferMinutes,
        meetingModes: profile.meetingModes,
        distanceKm: Number(distance.toFixed(2)),
        services: matchingServices,
      }
    }))
    return ApiResponse.success(res, candidates.filter((candidate) => candidate !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm))
  }),

  get: run(async (req, res) => {
    const profile = await dataSource.getRepository(ProviderProfile).findOneBy({
      id: routeId(req),
      verificationStatus: 'VERIFIED',
    })
    if (!profile) notFound('Verified provider not found')
    const owner = await dataSource.getRepository(User).findOneBy({
      id: profile.userId as User['id'],
      status: 'ACTIVE',
    })
    if (!owner) notFound('Verified provider not found')
    const services = await dataSource.getRepository(ProviderService).findBy({ providerId: profile.id, isActive: true })
    return ApiResponse.success(res, {
      id: profile.id,
      userId: profile.userId,
      displayName: owner.fullname,
      category: profile.category,
      bio: profile.bio,
      latitude: approximate(Number(profile.latitude)),
      longitude: approximate(Number(profile.longitude)),
      serviceRadiusKm: profile.serviceRadiusKm,
      travelBufferMinutes: profile.travelBufferMinutes,
      meetingModes: profile.meetingModes,
      services,
    })
  }),
}

export const BookingController = {
  list: run(async (req, res) => {
    const userId = currentUser(req).id
    const ownProfiles = await dataSource.getRepository(ProviderProfile).findBy({ userId })
    const ownProviderIds = ownProfiles.map((profile) => profile.id)
    const builder = dataSource.getRepository(SbmsBooking).createQueryBuilder('booking')
      .where(
        ownProviderIds.length
          ? '(booking.clientId = :userId OR booking.providerId IN (:...providerIds))'
          : 'booking.clientId = :userId',
        ownProviderIds.length ? { userId, providerIds: ownProviderIds } : { userId },
      )
    const status = req.query.status
    if (status !== undefined) {
      if (typeof status !== 'string' || !['REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'].includes(status)) {
        badRequest('status is not supported')
      }
      builder.andWhere('booking.status = :status', { status })
    }
    const bookings = await builder.orderBy('booking.startsAt', 'DESC').getMany()
    return ApiResponse.success(res, bookings.map((booking) => {
      const isClient = booking.clientId === userId
      if (['CONFIRMED', 'COMPLETED'].includes(booking.status)) return booking
      if (isClient && booking.mode !== 'client_goes') return booking
      return { ...booking, latitude: null, longitude: null, landmark: null }
    }))
  }),

  create: run(async (req, res) => {
    const clientId = currentUser(req).id
    const { providerId, serviceId, sourcePostId, startsAt, endsAt, mode, latitude, longitude, landmark } = req.body
    if (typeof providerId !== 'string' || typeof serviceId !== 'string') badRequest('providerId and serviceId are required')
    if (!modes.includes(mode)) badRequest('mode must be exactly one supported meeting mode')
    if (!latitudeLongitudeValid(latitude, longitude)) badRequest('latitude and longitude must be valid coordinates')
    if (landmark !== undefined && (typeof landmark !== 'string' || landmark.length > 200)) badRequest('landmark must be at most 200 characters')
    const start = parseDate(startsAt, 'startsAt')
    const end = parseDate(endsAt, 'endsAt')
    if (start <= new Date() || end <= start) badRequest('startsAt must be in the future and endsAt must be later')
    const booking = await dataSource.transaction(async (manager) => {
      const provider = await manager.getRepository(ProviderProfile).createQueryBuilder('provider')
        .setLock('pessimistic_write')
        .where('provider.id = :providerId', { providerId })
        .getOne()
      if (!provider || provider.verificationStatus !== 'VERIFIED') notFound('Verified provider not found')
      const providerOwner = await manager.getRepository(User).findOneBy({
        id: provider.userId as User['id'],
        status: 'ACTIVE',
      })
      if (!providerOwner) notFound('Verified provider not found')
      if (provider.userId === clientId) badRequest('Providers cannot book their own services')
      const service = await manager.getRepository(ProviderService).findOneBy({ id: serviceId, providerId, isActive: true })
      if (!service) notFound('Active service not found for this provider')
      if (end.getTime() - start.getTime() !== service.durationMinutes * 60_000) {
        badRequest('Booking duration must match the service duration')
      }
      if (!provider.meetingModes.includes(mode) || !service.meetingModes.includes(mode)) {
        badRequest('The selected meeting mode is not supported by this provider and service')
      }
      if (sourcePostId !== undefined) {
        if (typeof sourcePostId !== 'string') badRequest('sourcePostId must be a string')
        const sourcePost = await manager.getRepository(WorkPost).findOneBy({
          id: sourcePostId,
          providerId,
          status: 'PUBLISHED',
        })
        if (!sourcePost) notFound('Published source post not found for this provider')
      }
      const bufferMs = provider.travelBufferMinutes * 60_000
      const bufferedStart = new Date(start.getTime() - bufferMs)
      const bufferedEnd = new Date(end.getTime() + bufferMs)
      const conflict = await manager.getRepository(SbmsBooking).createQueryBuilder('booking')
        .where('booking.providerId = :providerId', { providerId })
        .andWhere('booking.status IN (:...statuses)', { statuses: ['REQUESTED', 'CONFIRMED'] })
        .andWhere('booking.startsAt < :end AND booking.endsAt > :start', { start: bufferedStart, end: bufferedEnd })
        .getOne()
      if (conflict) throw new HttpError(409, 'Provider already has an active booking in this time range', 'BOOKING_CONFLICT')
      const created = await manager.getRepository(SbmsBooking).save(manager.getRepository(SbmsBooking).create({
        clientId,
        providerId,
        serviceId,
        sourcePostId,
        startsAt: start,
        endsAt: end,
        mode,
        latitude: mode === 'client_goes' ? Number(provider.latitude) : latitude,
        longitude: mode === 'client_goes' ? Number(provider.longitude) : longitude,
        location: {
          type: 'Point',
          coordinates: [
            mode === 'client_goes' ? Number(provider.longitude) : longitude,
            mode === 'client_goes' ? Number(provider.latitude) : latitude,
          ],
        },
        landmark: landmark?.trim() || undefined,
        priceMinor: service.priceMinor,
        status: 'REQUESTED',
      }))
      await manager.getRepository(SbmsAuditEvent).save({
        userId: clientId,
        action: 'booking.requested',
        entity: 'booking',
        entityId: created.id,
        ipAddress: req.ip,
      })
      return created
    })
    if (booking.mode === 'client_goes') {
      return ApiResponse.success(res, { ...booking, latitude: null, longitude: null }, 'Booking requested', 201)
    }
    return ApiResponse.success(res, booking, 'Booking requested', 201)
  }),

  updateStatus: run(async (req, res) => {
    const user = currentUser(req)
    const { status } = req.body
    const booking = await dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SbmsBooking)
      const current = await repository.createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id = :id', { id: routeId(req) })
        .getOne()
      if (!current) notFound('Booking not found')
      const ownsProvider = await manager.getRepository(ProviderProfile).existsBy({ id: current.providerId, userId: user.id })
      const isClient = current.clientId === user.id
      if (!ownsProvider && !isClient) forbidden('Only a booking participant can change its status')
      if (!canTransitionBooking(current.status, status)) badRequest(`Cannot transition booking from ${current.status} to ${status}`)
      if ((status === 'CONFIRMED' || status === 'DECLINED') && !ownsProvider) forbidden('Only the provider can confirm or decline a booking')
      const previousStatus = current.status
      current.status = status
      if (status === 'COMPLETED') current.completedAt = new Date()
      await repository.save(current)
      await manager.getRepository(SbmsAuditEvent).save({
        userId: user.id,
        action: `booking.${status.toLowerCase()}`,
        entity: 'booking',
        entityId: current.id,
        details: JSON.stringify({ previousStatus }),
        ipAddress: req.ip,
      })
      return current
    })
    return ApiResponse.success(res, booking)
  }),
}

const validateMedia = (media: unknown): media is SbmsMediaItem[] => {
  if (!Array.isArray(media) || media.length < 1 || media.length > 10) return false
  const photos = media.filter((item) => item?.type === 'photo')
  const videos = media.filter((item) => item?.type === 'video')
  if (photos.length < 1 || videos.length > 3) return false
  return media.every((item) => {
    if (!item || !['photo', 'video'].includes(item.type) || typeof item.url !== 'string' || item.url.length > 2048) return false
    try {
      const url = new URL(item.url)
      if (!['http:', 'https:'].includes(url.protocol)) return false
    } catch {
      return false
    }
    return item.type !== 'video' || (Number.isFinite(item.durationSeconds) && item.durationSeconds! > 0 && item.durationSeconds! <= 60)
  })
}

export const WorkPostController = {
  feed: run(async (req, res) => {
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit)
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
      badRequest('limit must be 1–100 and offset must be a non-negative integer')
    }
    const [posts, total] = await dataSource.getRepository(WorkPost).findAndCount({
      where: { status: 'PUBLISHED' },
      order: { publishedAt: 'DESC' },
      take: limit,
      skip: offset,
    })
    return ApiResponse.success(res, { items: posts, total, limit, offset })
  }),

  consentRequests: run(async (req, res) => {
    const userId = currentUser(req).id
    const bookings = await dataSource.getRepository(SbmsBooking).findBy({ clientId: userId })
    const bookingIds = bookings.map((booking) => booking.id)
    if (!bookingIds.length) return ApiResponse.success(res, [])
    const posts = await dataSource.getRepository(WorkPost).find({
      where: {
        bookingId: In(bookingIds),
        type: 'verified_job',
        status: 'PENDING_CONSENT',
      },
      order: { createdAt: 'DESC' },
    })
    return ApiResponse.success(res, posts)
  }),

  create: run(async (req, res) => {
    const provider = await getOwnedProfile(currentUser(req).id)
    const { bookingId, serviceId, caption, area, media } = req.body
    if (!validateMedia(media)) badRequest('media requires 1–10 valid items, at least one photo, at most three videos, each video up to 60 seconds')
    if (caption !== undefined && (typeof caption !== 'string' || caption.length > 500)) badRequest('caption must be at most 500 characters')
    if (area !== undefined && (typeof area !== 'string' || area.length > 100)) badRequest('area must be at most 100 characters')
    let type: WorkPost['type'] = 'sample'
    let clientId: string | undefined
    if (bookingId !== undefined) {
      if (typeof bookingId !== 'string') badRequest('bookingId must be a string')
      const booking = await dataSource.getRepository(SbmsBooking).findOneBy({ id: bookingId, providerId: provider.id, status: 'COMPLETED' })
      if (!booking?.completedAt) badRequest('verified_job posts require a completed booking belonging to this provider')
      if (booking.completedAt.getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) {
        badRequest('verified_job posts must be created within 30 days of completion')
      }
      type = 'verified_job'
      clientId = booking.clientId
    }
    if (serviceId !== undefined && !(await dataSource.getRepository(ProviderService).existsBy({ id: serviceId, providerId: provider.id }))) {
      notFound('Service not found for this provider')
    }
    const post = await dataSource.getRepository(WorkPost).save({
      providerId: provider.id,
      bookingId,
      serviceId,
      type,
      caption: caption?.trim(),
      area: area?.trim(),
      media,
      mediaVersion: 1,
      status: type === 'sample' ? 'PUBLISHED' : 'PENDING_CONSENT',
      publishedAt: type === 'sample' ? new Date() : undefined,
    })
    await audit(req, 'work_post.created', 'work_post', post.id, { type, consentClientId: clientId })
    return ApiResponse.success(res, post, type === 'sample' ? 'Portfolio sample published' : 'Post created; client consent is required before publication', 201)
  }),

  consentRequest: run(async (req, res) => {
    const userId = currentUser(req).id
    const post = await dataSource.getRepository(WorkPost).findOneBy({ id: routeId(req), type: 'verified_job' })
    if (!post?.bookingId) notFound('Consent request not found')
    if (post.createdAt.getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000) {
      post.status = 'CONSENT_EXPIRED'
      await dataSource.getRepository(WorkPost).save(post)
      await audit(req, 'work_post.consent_expired', 'work_post', post.id)
      gone('Consent request expired after 14 days; create a new post to request consent again')
    }
    const booking = await dataSource.getRepository(SbmsBooking).findOneBy({ id: post.bookingId })
    if (!booking || booking.clientId !== userId) forbidden('Only the booking client can view this consent request')
    return ApiResponse.success(res, {
      id: post.id,
      bookingId: post.bookingId,
      type: post.type,
      caption: post.caption,
      media: post.media,
      mediaVersion: post.mediaVersion,
      status: post.status,
    })
  }),

  consent: run(async (req, res) => {
    const userId = currentUser(req).id
    const { allowed, limitations = [] } = req.body
    if (typeof allowed !== 'boolean') badRequest('allowed must be a boolean')
    if (!Array.isArray(limitations) || limitations.length > 10 || limitations.some((item) => typeof item !== 'string' || item.length > 100)) {
      badRequest('limitations must contain at most 10 strings of up to 100 characters')
    }
    const result = await dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WorkPost)
      const post = await repository.createQueryBuilder('post')
        .setLock('pessimistic_write')
        .where('post.id = :id AND post.type = :type', { id: routeId(req), type: 'verified_job' })
        .getOne()
      if (!post || !post.bookingId) notFound('Verified-job post not found')
      if (post.createdAt.getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000) {
        gone('Consent request expired after 14 days; create a new post to request consent again')
      }
      const booking = await manager.getRepository(SbmsBooking).findOneBy({ id: post.bookingId })
      if (!booking || booking.clientId !== userId) forbidden('Only the booking client can grant or withdraw consent')
      const consent = await manager.getRepository(PostConsent).save({
        postId: post.id,
        clientId: userId,
        mediaVersion: post.mediaVersion,
        allowed,
        limitations,
      })
      post.status = allowed ? 'PENDING_MODERATION' : 'PENDING_CONSENT'
      post.publishedAt = undefined
      await repository.save(post)
      await manager.getRepository(SbmsAuditEvent).save({
        userId,
        action: allowed ? 'work_post.consent_granted' : 'work_post.consent_withdrawn',
        entity: 'work_post',
        entityId: post.id,
        details: JSON.stringify({ mediaVersion: post.mediaVersion }),
        ipAddress: req.ip,
      })
      return { post, consent }
    })
    return ApiResponse.success(res, result, allowed ? 'Consent recorded; post is awaiting moderation' : 'Consent withdrawal recorded; post unpublished')
  }),
}

export const IssueController = {
  create: run(async (req, res) => {
    const userId = currentUser(req).id
    const { type, bookingId, relatedId, subject, description } = req.body
    const validTypes: SbmsIssue['type'][] = ['BOOKING', 'PLATFORM', 'USER', 'LISTING', 'POST', 'SAFETY']
    if (!validTypes.includes(type)) badRequest('type is not supported')
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 200) badRequest('subject is required (max 200 characters)')
    if (typeof description !== 'string' || !description.trim() || description.length > 10000) badRequest('description is required (max 10000 characters)')
    if (bookingId !== undefined) {
      if (typeof bookingId !== 'string') badRequest('bookingId must be a string')
      const booking = await dataSource.getRepository(SbmsBooking).findOneBy({ id: bookingId })
      if (!booking) notFound('Booking not found')
      const isProvider = await dataSource.getRepository(ProviderProfile).existsBy({ id: booking.providerId, userId })
      if (booking.clientId !== userId && !isProvider) forbidden('Only booking participants can report a booking')
    } else if (type === 'BOOKING') badRequest('bookingId is required for BOOKING issues')
    if (relatedId !== undefined && (typeof relatedId !== 'string' || relatedId.length > 36)) badRequest('relatedId must be a UUID string')
    const issue = await dataSource.getRepository(SbmsIssue).save({
      reporterId: userId,
      type,
      bookingId,
      relatedId,
      subject: subject.trim(),
      description: description.trim(),
      status: 'OPEN',
    })
    await audit(req, 'issue.created', 'issue', issue.id, { type })
    return ApiResponse.success(res, issue, 'Issue submitted', 201)
  }),
}

export const AdminSbmsController = {
  listActivityLogs: run(async (req, res) => {
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit)
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
      badRequest('limit must be 1–100 and offset must be a non-negative integer')
    }
    const builder = dataSource.getRepository(SbmsAuditEvent).createQueryBuilder('event')
    if (typeof req.query.userId === 'string') builder.andWhere('event.userId = :userId', { userId: req.query.userId })
    if (typeof req.query.action === 'string') builder.andWhere('event.action = :action', { action: req.query.action })
    if (typeof req.query.entity === 'string') builder.andWhere('event.entity = :entity', { entity: req.query.entity })
    if (req.query.since !== undefined) {
      builder.andWhere('event.createdAt >= :since', { since: parseDate(req.query.since, 'since') })
    }
    if (req.query.until !== undefined) {
      builder.andWhere('event.createdAt <= :until', { until: parseDate(req.query.until, 'until') })
    }
    const [items, total] = await builder
      .orderBy('event.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount()
    return ApiResponse.success(res, { items, total, limit, offset })
  }),

  listUsers: run(async (req, res) => {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const repository = dataSource.getRepository(User)
    const users = await repository.find({
      where: {
        ...(role ? { role: role as User['role'] } : {}),
        ...(status ? { status: status as User['status'] } : {}),
      },
      order: { created_at: 'DESC' },
    })
    return ApiResponse.success(res, users)
  }),

  updateUser: run(async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : ''
    if (!id) badRequest('User id is required')
    const { role, status } = req.body
    const supportedRoles = ['client', 'individual_provider', 'company_staff', 'broker', 'support_agent', 'admin']
    const supportedStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']
    if (role !== undefined && !supportedRoles.includes(role)) badRequest('Unsupported role')
    if (status !== undefined && !supportedStatuses.includes(status)) badRequest('Unsupported status')
    const repository = dataSource.getRepository(User)
    const user = await repository.findOneBy({ id: id as User['id'] })
    if (!user) notFound('User not found')
    if (role !== undefined) user.role = role as UserRoleType
    if (status !== undefined) user.status = status as User['status']
    await repository.save(user)
    await audit(req, 'user.updated', 'user', user.id, { role, status })
    return ApiResponse.success(res, user)
  }),

  listVerifications: run(async (_req, res) => {
    const providers = await dataSource.getRepository(ProviderProfile).find({
      where: { verificationStatus: 'PENDING' },
      order: { createdAt: 'ASC' },
    })
    return ApiResponse.success(res, providers)
  }),

  reviewVerification: run(async (req, res) => {
    const providerId = typeof req.body.providerId === 'string' ? req.body.providerId : req.body.id
    const { status } = req.body
    if (typeof providerId !== 'string' || !['VERIFIED', 'REJECTED'].includes(status)) {
      badRequest('providerId and status (VERIFIED or REJECTED) are required')
    }
    const repository = dataSource.getRepository(ProviderProfile)
    const provider = await repository.findOneBy({ id: providerId })
    if (!provider) notFound('Provider not found')
    provider.verificationStatus = status
    await repository.save(provider)
    await audit(req, `provider.${status.toLowerCase()}`, 'provider_profile', provider.id)
    return ApiResponse.success(res, provider)
  }),

  listModeration: run(async (_req, res) => {
    const posts = await dataSource.getRepository(WorkPost).find({
      where: { status: In(['PENDING_CONSENT', 'PENDING_MODERATION']) },
      order: { createdAt: 'ASC' },
    })
    return ApiResponse.success(res, posts)
  }),

  reviewModeration: run(async (req, res) => {
    const postId = typeof req.body.postId === 'string' ? req.body.postId : req.body.id
    const { status } = req.body
    if (typeof postId !== 'string' || !['PUBLISHED', 'REJECTED'].includes(status)) {
      badRequest('postId and status (PUBLISHED or REJECTED) are required')
    }
    const repository = dataSource.getRepository(WorkPost)
    const post = await repository.findOneBy({ id: postId })
    if (!post) notFound('Work post not found')
    if (status === 'PUBLISHED' && post.type === 'verified_job') {
      if (post.status !== 'PENDING_MODERATION') badRequest('The post is not awaiting moderation')
      const consent = await dataSource.getRepository(PostConsent).findOne({
        where: { postId: post.id, mediaVersion: post.mediaVersion },
        order: { createdAt: 'DESC' },
      })
      if (!consent?.allowed) badRequest('The latest client consent record must grant publication')
    }
    post.status = status
    post.publishedAt = status === 'PUBLISHED' ? new Date() : undefined
    await repository.save(post)
    await audit(req, `work_post.${status.toLowerCase()}`, 'work_post', post.id)
    return ApiResponse.success(res, post)
  }),

  listIssues: run(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const where = status && ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)
      ? { status: status as SbmsIssue['status'] }
      : {}
    if (status && !Object.keys(where).length) badRequest('status is not supported')
    const issues = await dataSource.getRepository(SbmsIssue).find({ where, order: { createdAt: 'DESC' } })
    return ApiResponse.success(res, issues)
  }),

  updateIssue: run(async (req, res) => {
    const issueId = typeof req.body.issueId === 'string' ? req.body.issueId : req.body.id
    const { status } = req.body
    if (typeof issueId !== 'string' || !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      badRequest('issueId and a valid status are required')
    }
    const repository = dataSource.getRepository(SbmsIssue)
    const issue = await repository.findOneBy({ id: issueId })
    if (!issue) notFound('Issue not found')
    const oldStatus = issue.status
    issue.status = status
    await repository.save(issue)
    await audit(req, 'issue.status_updated', 'issue', issue.id, { oldStatus, status })
    return ApiResponse.success(res, issue)
  }),

  reports: run(async (req, res) => {
    const since = typeof req.query.since === 'string' ? parseDate(req.query.since, 'since') : undefined
    const until = typeof req.query.until === 'string' ? parseDate(req.query.until, 'until') : undefined
    if (since && until && since > until) badRequest('since must not be later than until')
    const inRange = (createdAt: Date) => (!since || createdAt >= since) && (!until || createdAt <= until)
    const [providers, bookings, issues, posts] = await Promise.all([
      dataSource.getRepository(ProviderProfile).find(),
      dataSource.getRepository(SbmsBooking).find(),
      dataSource.getRepository(SbmsIssue).find(),
      dataSource.getRepository(WorkPost).find(),
    ])
    return ApiResponse.success(res, {
      providers: providers.filter((item) => inRange(item.createdAt)).length,
      verifiedProviders: providers.filter((item) => item.verificationStatus === 'VERIFIED' && inRange(item.createdAt)).length,
      bookings: bookings.filter((item) => inRange(item.createdAt)).length,
      bookingsByStatus: bookings.filter((item) => inRange(item.createdAt)).reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {}),
      issues: issues.filter((item) => inRange(item.createdAt)).length,
      posts: posts.filter((item) => inRange(item.createdAt)).length,
      publishedPosts: posts.filter((item) => item.status === 'PUBLISHED' && inRange(item.createdAt)).length,
      filters: { since, until },
    })
  }),

  getSettings: run(async (_req, res) => {
    const items = await dataSource.getRepository(SystemSettings).find({
      order: { category: 'ASC', setting_key: 'ASC' },
    })
    return ApiResponse.success(res, {
      items: items.map((item) => ({
        key: item.setting_key,
        value: parseSettingValue(item.setting_value),
        category: item.category || 'general',
        description: item.description,
        updatedAt: item.updated_at,
      })),
    })
  }),

  patchSettings: run(async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) badRequest('Settings must be a JSON object')
    const repository = dataSource.getRepository(SystemSettings)
    const entries: Array<{ key: string; value: unknown; category?: string }> = []
    for (const [group, value] of Object.entries(req.body)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          entries.push({ key, value: nestedValue, category: group })
        }
      } else {
        entries.push({ key: group, value })
      }
    }
    if (!entries.length) badRequest('At least one setting is required')
    const updated: string[] = []
    for (const entry of entries) {
      if (!entry.key.trim() || entry.key.length > 100) badRequest('Setting keys must be 1–100 characters')
      const current = await repository.findOneBy({ setting_key: entry.key })
      const setting = current || repository.create({
        setting_key: entry.key,
        category: entry.category || 'general',
        description: 'SBMS administrator setting',
      })
      setting.setting_value = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
      if (entry.category) setting.category = entry.category
      await repository.save(setting)
      updated.push(entry.key)
    }
    await audit(req, 'settings.updated', 'system_settings', undefined, { keys: updated })
    return ApiResponse.success(res, { updated })
  }),
}
