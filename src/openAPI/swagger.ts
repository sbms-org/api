import { responses } from './config';

/* Authentication (OTP via mobile) */
const sendOtp = {
  tags: ['Auth'],
  description: 'Send OTP to a mobile number. Public endpoint.',
  operationId: 'sendOtp',
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            mobile: { type: 'string', example: '+256700000000' },
          },
          required: ['mobile'],
        },
      },
    },
  },
  responses: responses.post,
};

const verifyOtp = {
  tags: ['Auth'],
  description: 'Verify OTP and receive JWT. Public endpoint.',
  operationId: 'verifyOtp',
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            mobile: { type: 'string', example: '+256700000000' },
            otp: { type: 'string', example: '123456' },
          },
          required: ['mobile', 'otp'],
        },
      },
    },
  },
  responses: responses.post,
};

/* Users (admin/owner management) */
const createUser = {
  tags: ['Users'],
  description: 'Create a system user (admin or owner or property_manager).',
  operationId: 'createUser',
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/User' },
      },
    },
  },
  responses: responses.post,
};

const getUsers = {
  tags: ['Users'],
  description: 'List users the caller has access to (admin sees all).',
  operationId: 'getUsers',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'A list of users.',
      content: {
        'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } },
      },
    },
    default: responses.post.default,
  },
};

const getSingleUser = {
  tags: ['Users'],
  description: 'Get a single user by id.',
  operationId: 'getSingleUser',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'Single user.', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } }, default: responses.post.default },
};

const updateUser = {
  tags: ['Users'],
  description: 'Update user by id.',
  operationId: 'updateUser',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
  responses: responses.put,
};

const patchUser = {
  tags: ['Users'],
  description: 'Toggle user active status.',
  operationId: 'patchUser',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { is_active: { type: 'boolean' } } } } } },
  responses: responses.put,
};

const deleteUser = {
  tags: ['Users'],
  description: 'Soft-delete a user by id.',
  operationId: 'deleteUser',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
  responses: responses.delete,
};

/* Buildings (owner) - mounted at /api/v1 */
const getBuildings = {
  tags: ['Buildings'],
  description: "List buildings owned by the caller (owner).",
  operationId: 'getBuildings',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'List of buildings', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Building' } } } } }, default: responses.post.default },
};

const createBuilding = {
  tags: ['Buildings'],
  description: 'Create a new building with documents (owner only). Uses scalable Cloudinary streaming. Note: Expects a multipart form.',
  operationId: 'createBuilding',
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'JSON string of step 1 and 2 text metadata' },
            property_deed: { type: 'string', format: 'binary' },
            certificate_of_title: { type: 'string', format: 'binary' },
            business_tin_number: { type: 'string', format: 'binary' },
          },
          required: ['data', 'property_deed', 'certificate_of_title', 'business_tin_number'],
        },
      },
    },
  },
  responses: responses.post,
};

const getBuilding = {
  tags: ['Buildings'],
  description: 'Get building by id (owner access).',
  operationId: 'getBuilding',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'Building', content: { 'application/json': { schema: { $ref: '#/components/schemas/Building' } } } }, default: responses.post.default },
};

const updateBuilding = {
  tags: ['Buildings'],
  description: 'Update building by id (also resubmit a rejected building with updated info/documents).',
  operationId: 'updateBuilding',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: {
    required: true,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'JSON string of modified text metadata' },
            property_deed: { type: 'string', format: 'binary' },
            certificate_of_title: { type: 'string', format: 'binary' },
            business_tin_number: { type: 'string', format: 'binary' },
          },
        },
      },
    },
  },
  responses: responses.put,
};

const deleteBuilding = {
  tags: ['Buildings'],
  description: 'Delete building by id (soft delete).',
  operationId: 'deleteBuilding',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: responses.delete,
};

/* Units */
const getUnitsByBuilding = {
  tags: ['Units'],
  description: 'List units for a building.',
  operationId: 'getUnitsByBuilding',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'buildingId', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'List of units', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Unit' } } } } }, default: responses.post.default },
};

const createUnit = {
  tags: ['Units'],
  description: 'Create unit in a building.',
  operationId: 'createUnit',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'buildingId', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Unit' } } } },
  responses: responses.post,
};

const getUnit = {
  tags: ['Units'],
  description: 'Get unit by id.',
  operationId: 'getUnit',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'Unit', content: { 'application/json': { schema: { $ref: '#/components/schemas/Unit' } } } }, default: responses.post.default },
};

const updateUnit = {
  tags: ['Units'],
  description: 'Update unit by id.',
  operationId: 'updateUnit',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Unit' } } } },
  responses: responses.put,
};

const deleteUnit = {
  tags: ['Units'],
  description: 'Delete unit by id (soft delete).',
  operationId: 'deleteUnit',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: responses.delete,
};

/* Tenants */
const getTenants = {
  tags: ['Tenants'],
  description: 'List tenants (owner scope).  When invoked by a user with role `tenant` the endpoint returns the units associated with that tenant via `tenant_assignments` instead of the global tenant list.',
  operationId: 'getTenants',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'List of tenants or units (for tenant role)', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Tenant' } } } } }, default: responses.post.default },
};

const createTenant = {
  tags: ['Tenants'],
  description: 'Create a tenant (owner only).',
  operationId: 'createTenant',
  security: [{ bearerAuth: [] }],
  requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Tenant' } } } },
  responses: responses.post,
};

const getTenant = {
  tags: ['Tenants'],
  description: 'Get tenant by id.',
  operationId: 'getTenant',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'Tenant', content: { 'application/json': { schema: { $ref: '#/components/schemas/Tenant' } } } }, default: responses.post.default },
};

const getTenantDetails = {
  tags: ['Owner'],
  description: 'Get aggregated information for a specific tenant (owner/pm scope).',
  operationId: 'getTenantDetails',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'Tenant summary with units', content: { 'application/json': { schema: { type: 'object' } } } }, default: responses.post.default },
};

const updateTenant = {
  tags: ['Tenants'],
  description: 'Update tenant by id.',
  operationId: 'updateTenant',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Tenant' } } } },
  responses: responses.put,
};

const deleteTenant = {
  tags: ['Tenants'],
  description: 'Delete tenant by id (soft delete).',
  operationId: 'deleteTenant',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: responses.delete,
};

/* Owner Mobile Endpoints */
const getOwnerBuildings = {
  tags: ['Owner'],
  description: 'List all my buildings (Owner).',
  security: [{ bearerAuth: [] }],
  responses: responses.get,
};

const assignTenant = {
  tags: ['Owner'],
  description: 'Assign tenant to unit.',
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { tenantId: { type: 'string', format: 'uuid' } },
          required: ['tenantId'],
        },
      },
    },
  },
  responses: responses.post,
};

const getPendingReceipts = {
  tags: ['Owner'],
  description: 'List pending receipts from tenants.',
  security: [{ bearerAuth: [] }],
  responses: responses.get,
};

const acceptReceipt = {
  tags: ['Owner'],
  description: 'Accept rent receipt.',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'receiptId', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { notes: { type: 'string' } },
        },
      },
    },
  },
  responses: responses.post,
};

const rejectReceipt = {
  tags: ['Owner'],
  description: 'Reject rent receipt.',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'receiptId', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    },
  },
  responses: responses.post,
};

const assignPropertyManager = {
  tags: ['Owner'],
  description: 'Assign or create a Property Manager by mobile number.',
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            mobile: { type: 'string' },
            fullname: { type: 'string' },
          },
          required: ['mobile', 'fullname'],
        },
      },
    },
  },
  responses: responses.post,
};

const revokePropertyManager = {
  tags: ['Owner'],
  description: 'Revoke Property Manager access.',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: responses.delete,
};

const exportReports = {
  tags: ['Reports'],
  description: 'Export reports in PDF or Excel.',
  security: [{ bearerAuth: [] }],
  parameters: [
    { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['income', 'overdue'] } },
    { name: 'format', in: 'query', schema: { type: 'string', enum: ['excel', 'pdf'], default: 'excel' } },
  ],
  responses: {
    200: { description: 'Binary file download' },
  },
};

const registerTenant = {
  tags: ['Owner'],
  description: 'Register a new tenant and send OTP.',
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            mobile: { type: 'string' },
            fullname: { type: 'string' },
          },
          required: ['mobile', 'fullname'],
        },
      },
    },
  },
  responses: responses.post,
};

const verifyTenantOtp = {
  tags: ['Owner'],
  description: 'Verify tenant OTP and assign to unit.',
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            mobile: { type: 'string' },
            otp: { type: 'string' },
          },
          required: ['mobile', 'otp'],
        },
      },
    },
  },
  responses: responses.post,
};

/* Tenant (App) Endpoints */
const getMyUnits = {
  tags: ['Tenant App'],
  description: 'Get units rented by the current tenant.',
  security: [{ bearerAuth: [] }],
  responses: responses.get,
};

const uploadReceipt = {
  tags: ['Tenant App'],
  description: 'Upload rent receipt (multipart/form-data supported).',
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: {
            unitId: { type: 'string', format: 'uuid' },
            receipt: { type: 'string', format: 'binary' },
          },
        },
      },
    },
  },
  responses: responses.post,
};

/* Admin Endpoints */
const getPendingBuildings = {
  tags: ['Admin'],
  description: 'List buildings pending review.',
  security: [{ bearerAuth: [] }],
  responses: responses.get,
};

const approveBuilding = {
  tags: ['Admin'],
  description: 'Approve a building and create units.',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            confirmedTotalUnits: { type: 'integer' },
            notes: { type: 'string' },
          },
          required: ['confirmedTotalUnits'],
        },
      },
    },
  },
  responses: responses.post,
};

const getAdminDashboard = {
  tags: ['Admin'],
  description: 'Get global system statistics.',
  security: [{ bearerAuth: [] }],
  responses: responses.get,
};

/* Property Manager Endpoints */
const getPMBuildings = {
  tags: ['Property Manager'],
  description: 'List buildings of assigned owner.',
  security: [{ bearerAuth: [] }],
  responses: responses.get,
};

const getPMPendingReceipts = {
  tags: ['Property Manager'],
  description: 'List pending receipts for assigned properties.',
  security: [{ bearerAuth: [] }],
  responses: responses.get,
};

const updateUnitCycle = {
  tags: ['Property Manager'],
  description: 'Update payment cycle months for a unit.',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { cycleMonths: { type: 'integer', minimum: 1, maximum: 12 } },
          required: ['cycleMonths'],
        },
      },
    },
  },
  responses: responses.put,
};

const getTenantHistory = {
  tags: ['Property Manager'],
  description: 'Get 1-year rental history for a tenant.',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: responses.get,
};

/* File Endpoints */
const serveFile = {
  tags: ['Files'],
  description: 'Retrieve an uploaded file securely.',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'path', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { 200: { description: 'The file content' } },
};

export {
  /* Auth */
  sendOtp,
  verifyOtp,
  /* Users */
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  getUsers,
  getSingleUser,
  /* Buildings */
  getBuildings,
  createBuilding,
  getBuilding,
  updateBuilding,
  deleteBuilding,
  /* Units */
  getUnitsByBuilding,
  createUnit,
  getUnit,
  updateUnit,
  deleteUnit,
  /* Tenants */
  getTenants,
  createTenant,
  getTenant,
  updateTenant,
  deleteTenant,
  /* Owner */
  getOwnerBuildings,
  assignTenant,
  getPendingReceipts,
  acceptReceipt,
  rejectReceipt,
  registerTenant,
  verifyTenantOtp,
  assignPropertyManager,
  revokePropertyManager,
  getTenantDetails,
  /* Results */
  exportReports,
  /* Tenant App */
  getMyUnits,
  uploadReceipt,
  /* Admin */
  getPendingBuildings,
  approveBuilding,
  getAdminDashboard,
  /* Property Manager */
  getPMBuildings,
  getPMPendingReceipts,
  updateUnitCycle,
  getTenantHistory,
  /* Files */
  serveFile,
};
