import { NextFunction, Request, Response, Router } from 'express'
import jwt from 'jwt-simple'
import moment from 'moment'
import { authMiddleware } from '../middlewares/auth'
import { roleMiddleware } from '../middlewares/role.middleware'
import { ApiResponse } from '../utils/ApiResponse'
import { canTransitionBooking, distanceKm } from '../utils/sbms.rules'
import {
  appendDemoAudit,
  DemoBooking,
  DemoData,
  DemoIssue,
  DemoPost,
  DemoProvider,
  DemoUser,
  demoState,
  demoUserByMobile,
  isDemoDataActive,
  markDemoResponse,
  newDemoId,
} from '../services/sbms-demo-store'

const demoRouter = Router()
const modeValues = ['provider_comes', 'client_goes', 'third_location']
const userOf = (req: Request): DemoUser | undefined => (req as any).user as DemoUser | undefined
const data = (): DemoData => demoState()
const now = (): string => new Date().toISOString()
const invalid = (message: string, status = 400): Error & { status: number } =>
  Object.assign(new Error(message), { status })
const requiredUser = (req: Request): DemoUser => {
  const user = userOf(req)
  if (!user) throw invalid('Authentication is required', 401)
  if (user.status !== 'ACTIVE') throw invalid('Account is not active', 403)
  return user
}
const ownProvider = (userId: string): DemoProvider | undefined =>
  data().providers.find((provider) => provider.userId === userId)
const ownedBooking = (booking: DemoBooking, user: DemoUser): boolean =>
  booking.clientId === user.id || ownProvider(user.id)?.id === booking.providerId

const demoOnly = (handler: (req: Request, res: Response) => unknown | Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await isDemoDataActive())) return next()
      markDemoResponse(res)
      return await handler(req, res)
    } catch (error) {
      return next(error)
    }
  }

const paginate = (rows: unknown[], req: Request): { items: unknown[]; total: number; limit: number; offset: number } => {
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit)
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw invalid('limit must be 1–100 and offset must be a non-negative integer')
  }
  return { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset }
}

const providerResponse = (provider: DemoProvider, distance?: number) => {
  const owner = data().users.find((user) => user.id === provider.userId)
  return {
    ...provider,
    displayName: owner?.fullname ?? 'Service provider',
    latitude: Number(provider.latitude.toFixed(3)),
    longitude: Number(provider.longitude.toFixed(3)),
    ...(distance === undefined ? {} : { distanceKm: Number(distance.toFixed(2)) }),
    services: data().services.filter((service) => service.providerId === provider.id && service.isActive),
  }
}

demoRouter.get('/auth/demo-users', async (_req, res, next) => {
  try {
    if (!(await isDemoDataActive())) return ApiResponse.success(res, { demoMode: false, users: [] })
    markDemoResponse(res)
    return ApiResponse.success(res, {
      demoMode: true,
      otp: '123456',
      users: data().users.map(({ id, fullname, mobile, role }) => ({ id, fullname, mobile, role })),
    })
  } catch (error) {
    return next(error)
  }
})

demoRouter.post('/auth/send-otp', demoOnly((req, res) => {
  if (typeof req.body?.mobile !== 'string') throw invalid('Mobile number is required')
  const user = demoUserByMobile(req.body.mobile)
  if (!user) throw invalid('Phone number is not a demo account', 404)
  return ApiResponse.success(res, { message: 'Demo verification code: 123456' }, 'OTP sent successfully')
}))

demoRouter.post('/auth/verify-otp', demoOnly((req, res) => {
  const { mobile, otp } = req.body ?? {}
  if (typeof mobile !== 'string' || typeof otp !== 'string') throw invalid('Mobile and OTP are required')
  const user = demoUserByMobile(mobile)
  if (!user || otp !== '123456') throw invalid('Invalid demo OTP or phone number', 400)
  const expires = moment().utc().add({ minutes: 60 * 24 * 7 }).unix()
  const token = jwt.encode({ exp: expires, user: user.id, demo: true }, process.env.JWT_SECRET as string)
  return ApiResponse.success(res, {
    token,
    expiresAt: moment.unix(expires).utc().toISOString(),
    user: { id: user.id, mobile: user.mobile, role: user.role, name: user.fullname },
  }, 'Demo login successful')
}))

demoRouter.post('/auth/register', demoOnly((req, res) => {
  const { fullname, mobile } = req.body ?? {}
  if (typeof fullname !== 'string' || !fullname.trim() || typeof mobile !== 'string' || !mobile.trim()) {
    throw invalid('fullname and mobile are required')
  }
  if (demoUserByMobile(mobile)) throw invalid('Phone number already registered', 409)
  const user: DemoUser = {
    id: newDemoId(), fullname: fullname.trim(), mobile: mobile.trim(), email: '',
    role: 'client', status: 'ACTIVE', city: '', created_at: now(),
  }
  data().users.push(user)
  return ApiResponse.success(res, { message: 'Demo registration successful; use OTP 123456' }, 'Registration initiated', 201)
}))

demoRouter.get('/providers/nearby', demoOnly((req, res) => {
  const latitude = Number(req.query.latitude)
  const longitude = Number(req.query.longitude)
  const radiusKm = req.query.radiusKm === undefined ? 25 : Number(req.query.radiusKm)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw invalid('latitude and longitude query parameters are required and must be valid coordinates')
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) throw invalid('radiusKm must be greater than 0 and at most 500')
  const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : undefined
  const meetingMode = typeof req.query.meetingMode === 'string' ? req.query.meetingMode : undefined
  if (meetingMode && !modeValues.includes(meetingMode)) throw invalid('meetingMode is not supported')
  const results = data().providers
    .filter((provider) => provider.verificationStatus === 'VERIFIED')
    .map((provider) => {
      const owner = data().users.find((user) => user.id === provider.userId && user.status === 'ACTIVE')
      const distance = distanceKm(latitude, longitude, provider.latitude, provider.longitude)
      const services = data().services.filter((service) =>
        service.providerId === provider.id && service.isActive &&
        (!category || service.category.toLowerCase() === category) &&
        (!meetingMode || service.meetingModes.includes(meetingMode)))
      if (!owner || distance > Math.min(radiusKm, provider.serviceRadiusKm) ||
          (meetingMode && !provider.meetingModes.includes(meetingMode)) ||
          ((category || meetingMode) && services.length === 0)) return null
      return { ...providerResponse(provider, distance), services }
    })
    .filter((provider): provider is NonNullable<typeof provider> => provider !== null)
    .sort((left, right) => (left.distanceKm ?? 0) - (right.distanceKm ?? 0))
  return ApiResponse.success(res, results)
}))

demoRouter.get('/providers/me', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const provider = ownProvider(user.id)
  return ApiResponse.success(res, provider ? providerResponse(provider) : null)
}))

demoRouter.get('/providers/:id', demoOnly((req, res) => {
  const provider = data().providers.find((item) =>
    (item.id === req.params.id || item.userId === req.params.id) &&
    item.verificationStatus === 'VERIFIED')
  if (!provider) throw invalid('Verified provider not found', 404)
  return ApiResponse.success(res, providerResponse(provider))
}))

demoRouter.post('/providers', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  if (!['individual_provider', 'company_staff'].includes(user.role)) throw invalid('Only providers can create a provider profile', 403)
  if (ownProvider(user.id)) throw invalid('Provider profile already exists', 409)
  const { category, bio, latitude, longitude, serviceRadiusKm = 25, travelBufferMinutes = 0, meetingModes } = req.body
  if (typeof category !== 'string' || !category.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw invalid('category, latitude, and longitude are required')
  }
  if (!Array.isArray(meetingModes) || meetingModes.length === 0 || meetingModes.some((mode: string) => !modeValues.includes(mode))) {
    throw invalid('meetingModes must contain one or more supported meeting modes')
  }
  const provider: DemoProvider = {
    id: newDemoId(), userId: user.id, category: category.trim(), bio,
    latitude: Number(latitude), longitude: Number(longitude),
    serviceRadiusKm: Number(serviceRadiusKm), travelBufferMinutes: Number(travelBufferMinutes),
    meetingModes: [...new Set(meetingModes)], verificationStatus: 'PENDING', createdAt: now(),
  }
  data().providers.push(provider)
  appendDemoAudit(user.id, 'provider.created', 'provider_profile', provider.id, undefined, req.ip)
  return ApiResponse.success(res, provider, 'Demo provider profile submitted for verification', 201)
}))

demoRouter.patch('/providers/me', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const provider = ownProvider(user.id)
  if (!provider) throw invalid('Provider profile not found', 404)
  const { category, bio, latitude, longitude, serviceRadiusKm, travelBufferMinutes, meetingModes } = req.body
  if (category !== undefined) provider.category = String(category)
  if (bio !== undefined) provider.bio = String(bio)
  if (latitude !== undefined) provider.latitude = Number(latitude)
  if (longitude !== undefined) provider.longitude = Number(longitude)
  if (serviceRadiusKm !== undefined) provider.serviceRadiusKm = Number(serviceRadiusKm)
  if (travelBufferMinutes !== undefined) provider.travelBufferMinutes = Number(travelBufferMinutes)
  if (meetingModes !== undefined) provider.meetingModes = meetingModes
  return ApiResponse.success(res, provider)
}))

demoRouter.post('/providers/me/services', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const provider = ownProvider(user.id)
  if (!provider) throw invalid('Provider profile not found', 404)
  const { title, category, description, priceMinor, durationMinutes, meetingModes } = req.body
  if (typeof title !== 'string' || !title.trim() || typeof category !== 'string' || !category.trim() ||
      !Number.isSafeInteger(priceMinor) || priceMinor < 0 ||
      !Number.isInteger(durationMinutes) || durationMinutes < 1 ||
      !Array.isArray(meetingModes) || meetingModes.length === 0 ||
      meetingModes.some((mode: string) => !provider.meetingModes.includes(mode))) {
    throw invalid('Valid service details and supported meeting modes are required')
  }
  const service = {
    id: newDemoId(), providerId: provider.id, title: title.trim(), category: category.trim(),
    description, priceMinor, durationMinutes, meetingModes, isActive: true, createdAt: now(),
  }
  data().services.push(service)
  appendDemoAudit(user.id, 'service.created', 'service', service.id, undefined, req.ip)
  return ApiResponse.success(res, service, 'Demo service created', 201)
}))

demoRouter.get('/work-posts/feed', demoOnly((req, res) => {
  const posts = data().workPosts
    .filter((post) => post.status === 'PUBLISHED')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((post) => {
      const provider = data().providers.find((item) => item.id === post.providerId)
      const providerOwner = data().users.find((item) => item.id === provider?.userId)
      const service = data().services.find((item) => item.id === post.serviceId)
      return {
        ...post,
        provider: provider ? providerResponse(provider) : undefined,
        providerName: providerOwner?.fullname,
        service,
        serviceTitle: service?.title,
      }
    })
  return ApiResponse.success(res, paginate(posts, req))
}))

demoRouter.get('/work-posts/consent-requests', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const bookings = data().bookings.filter((booking) => booking.clientId === user.id)
  const bookingIds = new Set(bookings.map((booking) => booking.id))
  const requests = data().workPosts
    .filter((post) => post.type === 'verified_job' &&
      post.status === 'PENDING_CONSENT' &&
      post.bookingId !== undefined &&
      bookingIds.has(post.bookingId))
    .map((post) => {
      const provider = data().providers.find((item) => item.id === post.providerId)
      const owner = data().users.find((item) => item.id === provider?.userId)
      return { ...post, providerName: owner?.fullname }
    })
  return ApiResponse.success(res, requests)
}))

demoRouter.post('/work-posts', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const provider = ownProvider(user.id)
  if (!provider) throw invalid('Provider profile not found', 404)
  const { bookingId, serviceId, caption, area, media } = req.body
  if (!Array.isArray(media) || media.length < 1 || media.length > 10 ||
      !media.some((item: { type?: string }) => item?.type === 'photo') ||
      media.some((item: { url?: string; type?: string }) =>
        !['photo', 'video'].includes(item?.type ?? '') ||
        typeof item?.url !== 'string' || !/^https?:\/\//i.test(item.url))) {
    throw invalid('media requires valid photo or video URLs and at least one photo')
  }
  let booking: DemoBooking | undefined
  if (bookingId !== undefined) {
    booking = data().bookings.find((item) =>
      item.id === bookingId && item.providerId === provider.id && item.status === 'COMPLETED')
    if (!booking?.completedAt) throw invalid('verified_job posts require a completed booking belonging to this provider')
  }
  if (serviceId !== undefined && !data().services.some((item) => item.id === serviceId && item.providerId === provider.id)) {
    throw invalid('Service not found for this provider', 404)
  }
  const post: DemoPost = {
    id: newDemoId(), providerId: provider.id, bookingId, serviceId,
    type: booking ? 'verified_job' : 'sample', caption, area, media, mediaVersion: 1,
    status: booking ? 'PENDING_CONSENT' : 'PUBLISHED', createdAt: now(),
    ...(!booking ? { publishedAt: now() } : {}),
  }
  data().workPosts.unshift(post)
  appendDemoAudit(user.id, 'work_post.created', 'work_post', post.id, { type: post.type }, req.ip)
  return ApiResponse.success(res, post, booking ? 'Demo post created; client consent is required' : 'Demo portfolio sample published', 201)
}))

demoRouter.get('/work-posts/:id/consent', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const post = data().workPosts.find((item) => item.id === req.params.id && item.type === 'verified_job')
  const booking = data().bookings.find((item) => item.id === post?.bookingId)
  if (!post || !booking) throw invalid('Consent request not found', 404)
  if (booking.clientId !== user.id) throw invalid('Only the booking client can view this consent request', 403)
  return ApiResponse.success(res, {
    id: post.id, bookingId: post.bookingId, type: post.type, caption: post.caption,
    media: post.media, mediaVersion: post.mediaVersion, status: post.status,
  })
}))

demoRouter.post('/work-posts/:id/consent', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const post = data().workPosts.find((item) => item.id === req.params.id && item.type === 'verified_job')
  const booking = data().bookings.find((item) => item.id === post?.bookingId)
  if (!post || !booking) throw invalid('Verified-job post not found', 404)
  if (booking.clientId !== user.id) throw invalid('Only the booking client can grant or withdraw consent', 403)
  const { allowed, limitations = [] } = req.body
  if (typeof allowed !== 'boolean' || !Array.isArray(limitations) || limitations.length > 10 ||
      limitations.some((item: unknown) => typeof item !== 'string' || item.length > 100)) {
    throw invalid('allowed must be boolean and limitations must contain at most 10 short strings')
  }
  const consent = { id: newDemoId(), postId: post.id, clientId: user.id, mediaVersion: post.mediaVersion, allowed, limitations, createdAt: now() }
  data().consents.push(consent)
  post.status = allowed ? 'PENDING_MODERATION' : 'PENDING_CONSENT'
  post.publishedAt = undefined
  appendDemoAudit(user.id, allowed ? 'work_post.consent_granted' : 'work_post.consent_withdrawn', 'work_post', post.id, undefined, req.ip)
  return ApiResponse.success(res, { post, consent }, allowed ? 'Demo consent recorded; post awaits moderation' : 'Demo consent withdrawal recorded')
}))

demoRouter.get('/bookings', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const providerIds = data().providers.filter((provider) => provider.userId === user.id).map((provider) => provider.id)
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  if (status && !['REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'].includes(status)) throw invalid('status is not supported')
  const bookings = data().bookings.filter((booking) =>
    (booking.clientId === user.id || providerIds.includes(booking.providerId)) &&
    (!status || booking.status === status))
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt))
    .map((booking) => {
      const provider = data().providers.find((item) => item.id === booking.providerId)
      const service = data().services.find((item) => item.id === booking.serviceId)
      const providerOwner = data().users.find((item) => item.id === provider?.userId)
      const client = data().users.find((item) => item.id === booking.clientId)
      const names = {
        providerName: providerOwner?.fullname,
        clientName: client?.fullname,
        serviceName: service?.title,
      }
      return booking.status === 'REQUESTED'
        ? { ...booking, ...names, latitude: null, longitude: null, landmark: null }
        : { ...booking, ...names }
    })
  return ApiResponse.success(res, bookings)
}))

demoRouter.post('/bookings', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const { providerId, serviceId, sourcePostId, startsAt, endsAt, mode, latitude, longitude, landmark } = req.body
  const provider = data().providers.find((item) => item.id === providerId && item.verificationStatus === 'VERIFIED')
  const service = data().services.find((item) => item.id === serviceId && item.providerId === providerId && item.isActive)
  if (!provider || !service) throw invalid('Verified provider and active service are required', 404)
  if (provider.userId === user.id) throw invalid('Providers cannot book their own services')
  if (!modeValues.includes(mode)) throw invalid('mode must be exactly one supported meeting mode')
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() ||
      end <= start || end.getTime() - start.getTime() !== service.durationMinutes * 60_000) {
    throw invalid('A future start and end time matching the service duration are required')
  }
  if (!provider.meetingModes.includes(mode) || !service.meetingModes.includes(mode)) throw invalid('Meeting mode is not supported by this service')
  if (mode !== 'client_goes' && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    throw invalid('Meeting coordinates are required')
  }
  if (sourcePostId && !data().workPosts.some((post) => post.id === sourcePostId && post.providerId === provider.id && post.status === 'PUBLISHED')) {
    throw invalid('Published source post not found for this provider', 404)
  }
  const overlap = data().bookings.some((booking) =>
    booking.providerId === provider.id && ['REQUESTED', 'CONFIRMED'].includes(booking.status) &&
    start.getTime() < new Date(booking.endsAt).getTime() + provider.travelBufferMinutes * 60_000 &&
    end.getTime() > new Date(booking.startsAt).getTime() - provider.travelBufferMinutes * 60_000)
  if (overlap) throw invalid('Provider already has an active booking in this time range', 409)
  const booking: DemoBooking = {
    id: newDemoId(), clientId: user.id, providerId: provider.id, serviceId: service.id, sourcePostId,
    startsAt: start.toISOString(), endsAt: end.toISOString(), mode,
    latitude: mode === 'client_goes' ? provider.latitude : Number(latitude),
    longitude: mode === 'client_goes' ? provider.longitude : Number(longitude),
    landmark, priceMinor: service.priceMinor, status: 'REQUESTED', createdAt: now(),
  }
  data().bookings.unshift(booking)
  appendDemoAudit(user.id, 'booking.requested', 'booking', booking.id, undefined, req.ip)
  const visible = mode === 'client_goes' ? { ...booking, latitude: null, longitude: null } : booking
  return ApiResponse.success(res, visible, 'Demo booking requested', 201)
}))

demoRouter.patch('/bookings/:id/status', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const booking = data().bookings.find((item) => item.id === req.params.id)
  if (!booking) throw invalid('Booking not found', 404)
  const providerOwner = ownProvider(user.id)?.id === booking.providerId
  const isClient = booking.clientId === user.id
  if (!providerOwner && !isClient) throw invalid('Only a booking participant can change its status', 403)
  const status = req.body?.status
  if (!canTransitionBooking(booking.status, status)) throw invalid(`Cannot transition booking from ${booking.status} to ${status}`)
  if (['CONFIRMED', 'DECLINED'].includes(status) && !providerOwner) throw invalid('Only the provider can confirm or decline a booking', 403)
  const previousStatus = booking.status
  booking.status = status
  if (status === 'COMPLETED') booking.completedAt = now()
  appendDemoAudit(user.id, `booking.${String(status).toLowerCase()}`, 'booking', booking.id, { previousStatus }, req.ip)
  return ApiResponse.success(res, booking)
}))

demoRouter.post('/issues', authMiddleware, demoOnly((req, res) => {
  const user = requiredUser(req)
  const { type, bookingId, relatedId, subject, description } = req.body
  if (!['BOOKING', 'PLATFORM', 'USER', 'LISTING', 'POST', 'SAFETY'].includes(type)) throw invalid('type is not supported')
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 ||
      typeof description !== 'string' || !description.trim() || description.length > 10000) {
    throw invalid('subject and description are required')
  }
  if (bookingId) {
    const booking = data().bookings.find((item) => item.id === bookingId)
    if (!booking) throw invalid('Booking not found', 404)
    if (!ownedBooking(booking, user)) throw invalid('Only booking participants can report a booking', 403)
  } else if (type === 'BOOKING') throw invalid('bookingId is required for BOOKING issues')
  const issue: DemoIssue = {
    id: newDemoId(), reporterId: user.id, type, bookingId, relatedId,
    subject: subject.trim(), description: description.trim(), status: 'OPEN', createdAt: now(),
  }
  data().issues.unshift(issue)
  appendDemoAudit(user.id, 'issue.created', 'issue', issue.id, { type }, req.ip)
  return ApiResponse.success(res, issue, 'Demo issue submitted', 201)
}))

demoRouter.use('/admin', authMiddleware, roleMiddleware(['admin']))

demoRouter.get('/admin/users', demoOnly((req, res) => {
  const role = req.query.role
  const status = req.query.status
  const users = data().users.filter((user) =>
    (!role || user.role === role) && (!status || user.status === status))
  return ApiResponse.success(res, users)
}))

demoRouter.patch('/admin/users/:id', demoOnly((req, res) => {
  const user = data().users.find((item) => item.id === req.params.id)
  if (!user) throw invalid('User not found', 404)
  const { role, status } = req.body
  if (role !== undefined && !['client', 'individual_provider', 'company_staff', 'broker', 'support_agent', 'admin'].includes(role)) {
    throw invalid('Unsupported role')
  }
  if (status !== undefined && !['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(status)) throw invalid('Unsupported status')
  if (role !== undefined) user.role = role
  if (status !== undefined) user.status = status
  appendDemoAudit(userOf(req)?.id, 'user.updated', 'user', user.id, { role, status }, req.ip)
  return ApiResponse.success(res, user)
}))

demoRouter.get('/admin/providers/verification', demoOnly((_req, res) =>
  ApiResponse.success(res, data().providers.filter((provider) => provider.verificationStatus === 'PENDING')
    .map((provider) => ({ ...provider, name: data().users.find((user) => user.id === provider.userId)?.fullname })))))

demoRouter.patch('/admin/providers/verification', demoOnly((req, res) => {
  const id = req.body?.providerId ?? req.body?.id
  const provider = data().providers.find((item) => item.id === id)
  const status = req.body?.status
  if (!provider) throw invalid('Provider not found', 404)
  if (!['VERIFIED', 'REJECTED'].includes(status)) throw invalid('status must be VERIFIED or REJECTED')
  provider.verificationStatus = status
  appendDemoAudit(userOf(req)?.id, `provider.${status.toLowerCase()}`, 'provider_profile', provider.id, undefined, req.ip)
  return ApiResponse.success(res, provider)
}))

demoRouter.get('/admin/work-posts/moderation', demoOnly((_req, res) =>
  ApiResponse.success(res, data().workPosts.filter((post) => ['PENDING_CONSENT', 'PENDING_MODERATION'].includes(post.status))
    .map((post) => ({
      ...post,
      providerName: data().users.find((user) => user.id === data().providers.find((provider) => provider.id === post.providerId)?.userId)?.fullname,
      category: data().providers.find((provider) => provider.id === post.providerId)?.category,
    })))))

demoRouter.patch('/admin/work-posts/moderation', demoOnly((req, res) => {
  const post = data().workPosts.find((item) => item.id === (req.body?.postId ?? req.body?.id))
  const status = req.body?.status === 'APPROVED' ? 'PUBLISHED' : req.body?.status
  if (!post) throw invalid('Work post not found', 404)
  if (!['PUBLISHED', 'REJECTED'].includes(status)) throw invalid('status must be PUBLISHED or REJECTED')
  if (status === 'PUBLISHED' && post.type === 'verified_job' &&
      (post.status !== 'PENDING_MODERATION' ||
       !data().consents.some((consent) => consent.postId === post.id && consent.mediaVersion === post.mediaVersion && consent.allowed))) {
    throw invalid('Current client consent is required before publication')
  }
  post.status = status
  post.publishedAt = status === 'PUBLISHED' ? now() : undefined
  appendDemoAudit(userOf(req)?.id, `work_post.${status.toLowerCase()}`, 'work_post', post.id, undefined, req.ip)
  return ApiResponse.success(res, post)
}))

demoRouter.get('/admin/issues', demoOnly((req, res) => {
  const status = req.query.status
  if (status && !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(String(status))) throw invalid('status is not supported')
  return ApiResponse.success(res, data().issues.filter((issue) => !status || issue.status === status)
    .map((issue) => ({ ...issue, title: issue.subject, reporterName: data().users.find((user) => user.id === issue.reporterId)?.fullname })))
}))

demoRouter.patch('/admin/issues', demoOnly((req, res) => {
  const issue = data().issues.find((item) => item.id === (req.body?.issueId ?? req.body?.id))
  const requestedStatus = req.body?.status === 'DISMISSED' ? 'CLOSED' : req.body?.status
  if (!issue) throw invalid('Issue not found', 404)
  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(requestedStatus)) throw invalid('status is not supported')
  const oldStatus = issue.status
  issue.status = requestedStatus
  appendDemoAudit(userOf(req)?.id, 'issue.status_updated', 'issue', issue.id, { oldStatus, status: requestedStatus }, req.ip)
  return ApiResponse.success(res, issue)
}))

demoRouter.get('/admin/reports', demoOnly((_req, res) => {
  const providers = data().providers
  const bookings = data().bookings
  const posts = data().workPosts
  const issues = data().issues
  return ApiResponse.success(res, {
    providers: providers.length,
    verifiedProviders: providers.filter((provider) => provider.verificationStatus === 'VERIFIED').length,
    bookings: bookings.length,
    bookingsByStatus: bookings.reduce<Record<string, number>>((accumulator, booking) => {
      accumulator[booking.status] = (accumulator[booking.status] ?? 0) + 1
      return accumulator
    }, {}),
    issues: issues.length,
    posts: posts.length,
    publishedPosts: posts.filter((post) => post.status === 'PUBLISHED').length,
  })
}))
demoRouter.get('/admin/dashboard', demoOnly((_req, res) => {
  const state = data()
  return ApiResponse.success(res, {
    users: state.users.length,
    providers: state.providers.length,
    pendingVerifications: state.providers.filter((provider) => provider.verificationStatus === 'PENDING').length,
    bookings: state.bookings.length,
    openIssues: state.issues.filter((issue) => issue.status === 'OPEN').length,
  })
}))

demoRouter.get('/admin/activity-logs', demoOnly((req, res) => {
  const { userId, action, entity } = req.query
  const rows = data().auditEvents.filter((event) =>
    (!userId || event.userId === userId) && (!action || event.action === action) &&
    (!entity || event.entity === entity))
  const page = paginate(rows, req)
  return ApiResponse.success(res, { ...page, items: page.items })
}))

demoRouter.get('/admin/settings', demoOnly((_req, res) =>
  ApiResponse.success(res, { items: data().settings })))

demoRouter.patch('/admin/settings', demoOnly((req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw invalid('Settings must be a JSON object')
  const changed: string[] = []
  for (const [group, value] of Object.entries(req.body as Record<string, unknown>)) {
    const entries = value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value as Record<string, unknown>).map(([key, settingValue]) => ({ key, value: settingValue, category: group }))
      : [{ key: group, value, category: 'general' }]
    for (const entry of entries) {
      if (!entry.key.trim() || entry.key.length > 100) throw invalid('Setting keys must be 1–100 characters')
      const current = data().settings.find((setting) => setting.key === entry.key)
      if (current) {
        current.value = entry.value
        current.category = entry.category
        current.updatedAt = now()
      } else {
        data().settings.push({ ...entry, description: 'Simulated SBMS setting', updatedAt: now() })
      }
      changed.push(entry.key)
    }
  }
  appendDemoAudit(userOf(req)?.id, 'settings.updated', 'system_settings', undefined, { keys: changed }, req.ip)
  return ApiResponse.success(res, { updated: changed })
}))

export default demoRouter
