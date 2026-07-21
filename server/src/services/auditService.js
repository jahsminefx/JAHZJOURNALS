const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Logs an administrative action.
 * @param {Object} params
 * @param {string} params.adminId - ID of the admin performing the action
 * @param {string} params.action - The action being performed (e.g., 'UPDATE_ROLE', 'GRANT_PROMOTION')
 * @param {string} params.resource - The affected resource type (e.g., 'User', 'Subscription')
 * @param {string} params.resourceId - The ID of the affected resource
 * @param {string|null} params.oldValue - The state before the action (JSON string recommended)
 * @param {string|null} params.newValue - The state after the action (JSON string recommended)
 * @param {string|null} params.ipAddress - The IP address of the requester
 */
const logAudit = async ({ adminId, action, resource, resourceId, oldValue, newValue, ipAddress }) => {
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        resource,
        resourceId,
        oldValue: oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : null,
        newValue: newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null,
        ipAddress,
      }
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Deliberately not throwing to prevent breaking the main transaction, but it should be noted.
  }
};

module.exports = {
  logAudit
};
