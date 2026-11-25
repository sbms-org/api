/* src/configurations/roles.config.ts */

const AccessControl = require('accesscontrol');
const ac = new AccessControl();

export const roles = (function () {
  // Tenant role - limited access
  ac.grant('tenant')
    .readOwn('user')
    .updateOwn('user')
    .readOwn('tenant')
    .readOwn('lease')
    .readOwn('payment')
    .readOwn('notification')
    .readOwn('dashboard');

  // Property Manager role - assigned by owner, limited management access
  ac.grant('property_manager')
    .extend('tenant')
    .readAny('building')  // Can view buildings
    .readAny('unit')      // Can view units
    .readAny('tenant')    // Can view tenants
    .readAny('lease')     // Can view leases
    .readAny('payment')   // Can view payments (with current year restriction in logic)
    .readAny('report')    // Can view reports (current year)
    .updateAny('notification');  // Can manage notifications

  // Owner role - can manage their properties
  ac.grant('owner')
    .extend('property_manager')
    .createAny('building')
    .updateAny('building')
    .deleteAny('building')
    .createAny('unit')
    .updateAny('unit')
    .deleteAny('unit')
    .createAny('tenant')
    .updateAny('tenant')
    .deleteAny('tenant')
    .createAny('lease')
    .updateAny('lease')
    .deleteAny('lease')
    .createAny('payment')
    .updateAny('payment')
    .createAny('user')    // Can create property managers
    .updateAny('user')    // Can update property managers
    .deleteAny('user');   // Can delete property managers

  // Accountant role - read-only financial access (optional)
  ac.grant('accountant')
    .readAny('payment')
    .readAny('report')
    .readAny('building')
    .readAny('tenant');

  // Admin role - full system access
  ac.grant('admin')
    .extend('owner')
    .createAny('user')
    .readAny('user')
    .updateAny('user')
    .deleteAny('user')
    .readAny('auditlog')
    .updateAny('system');

  return ac;
})();
