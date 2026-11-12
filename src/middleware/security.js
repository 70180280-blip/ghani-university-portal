/**
 * Security & Audit Logging Middleware
 */

const crypto = require('crypto');
const db = require('../db/pool');

/**
 * Generate and verify session-based CSRF token
 */
function csrfProtection(req, res, next) {
  // Ensure session has a token
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  // Expose token to response locals for views
  res.locals.csrfToken = req.session.csrfToken;

  // Safe HTTP methods do not require verification
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Extract token from header or body
  const token = req.headers['x-csrf-token'] || req.body?._csrf || req.query?._csrf;

  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({
      success: false,
      error: 'Security validation failed: Invalid or missing CSRF token. Please refresh the page.'
    });
  }

  next();
}

/**
 * Log Admin Action in database audit_log table
 */
async function logAdminAction(adminUsername, action, targetTable = null, targetId = null, details = '', ipAddress = '') {
  try {
    await db.query(`
      INSERT INTO audit_log (admin_username, action, target_table, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [adminUsername, action, targetTable, targetId, details, ipAddress]);
  } catch (err) {
    console.error('[Audit Log] Failed to write audit record:', err.message);
  }
}

module.exports = {
  csrfProtection,
  logAdminAction
};

