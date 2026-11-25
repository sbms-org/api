const protectedOperation = (summary: string) => ({
  summary,
  security: [{ bearerAuth: [] }],
  responses: { '200': { description: 'Successful response' }, '401': { description: 'Authentication required' } },
})

export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'ServiceBook Management System API',
    version: '1.0.0',
    description: 'ServiceBook provider discovery, bookings, work-post consent, issues and administration API.',
  },
  servers: [{ url: 'http://localhost:3000/api/v1', description: 'Local API' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      UserRole: {
        type: 'string',
        enum: ['client', 'individual_provider', 'company_staff', 'broker', 'support_agent', 'admin'],
      },
      MeetingMode: {
        type: 'string',
        enum: ['provider_comes', 'client_goes', 'third_location'],
      },
      BookingStatus: {
        type: 'string',
        enum: ['REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'],
      },
      WorkPostStatus: {
        type: 'string',
        enum: ['PENDING_CONSENT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'CONSENT_EXPIRED'],
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {},
        },
      },
    },
  },
  paths: {
    '/health': {
      get: { summary: 'Check API and database availability', responses: { '200': { description: 'Available' }, '503': { description: 'Database unavailable' } } },
    },
    '/auth/register': { post: { summary: 'Register a client account', responses: { '201': { description: 'Account created' } } } },
    '/auth/send-otp': { post: { summary: 'Send a login verification code', responses: { '200': { description: 'Code requested' } } } },
    '/auth/verify-otp': { post: { summary: 'Verify a code and receive a bearer token', responses: { '200': { description: 'Authenticated' } } } },
    '/providers/nearby': {
      get: {
        summary: 'Find verified providers near coordinates',
        parameters: [
          { in: 'query', name: 'latitude', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'longitude', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'radiusKm', schema: { type: 'number', maximum: 500, default: 25 } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
          { in: 'query', name: 'meetingMode', schema: { $ref: '#/components/schemas/MeetingMode' } },
        ],
        responses: { '200': { description: 'Distance-ordered provider list' } },
      },
    },
    '/providers/{id}': {
      get: { summary: 'Get a verified provider and active services', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Provider details' } } },
    },
    '/providers': { post: protectedOperation('Create a provider profile for verification') },
    '/providers/me': { patch: protectedOperation('Update the authenticated provider profile') },
    '/providers/me/services': { post: protectedOperation('Create a provider service') },
    '/work-posts/feed': { get: { summary: 'List published work posts', responses: { '200': { description: 'Published post feed' } } } },
    '/work-posts': {
      post: protectedOperation('Create a sample or verified-job work post'),
    },
    '/work-posts/{id}/consent': {
      get: protectedOperation('Read a work-post consent request'),
      post: protectedOperation('Record or withdraw client consent'),
    },
    '/bookings': {
      get: protectedOperation('List bookings for the authenticated participant'),
      post: protectedOperation('Request a provider booking'),
    },
    '/bookings/{id}/status': { patch: protectedOperation('Update booking status') },
    '/issues': { post: protectedOperation('Report a platform or booking issue') },
    '/admin/users': {
      get: protectedOperation('List SBMS users'),
    },
    '/admin/users/{id}': {
      patch: protectedOperation('Update an SBMS user role or status'),
    },
    '/admin/providers/verification': {
      get: protectedOperation('List providers awaiting verification'),
      patch: protectedOperation('Approve or reject provider verification'),
    },
    '/admin/work-posts/moderation': {
      get: protectedOperation('List work posts awaiting moderation'),
      patch: protectedOperation('Publish or reject a work post'),
    },
    '/admin/issues': {
      get: protectedOperation('List reported issues'),
      patch: protectedOperation('Update issue status'),
    },
    '/admin/reports': { get: protectedOperation('Read SBMS activity aggregates') },
    '/admin/settings': {
      get: protectedOperation('Read SBMS settings'),
      patch: protectedOperation('Update SBMS settings'),
      put: protectedOperation('Update SBMS settings'),
    },
    '/admin/activity-logs': { get: protectedOperation('Read paginated SBMS audit events') },
    '/notification-preferences': { get: protectedOperation('Read notification preferences') },
    '/notification-preferences/global': { put: protectedOperation('Update global notification preferences') },
    '/notification-preferences/types': { put: protectedOperation('Update notification preferences by type') },
    '/user/profile': { get: protectedOperation('Read the authenticated profile') },
    '/user/fcm-token': { put: protectedOperation('Update push-notification device token') },
    '/user/notification-email': { put: protectedOperation('Update notification email') },
    '/files/{path}': { get: protectedOperation('Read an authenticated uploaded file') },
  },
}
