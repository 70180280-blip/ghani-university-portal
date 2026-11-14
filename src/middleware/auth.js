/**
 * Authentication & Rate Limiting Middleware
 */

const rateLimit = require('express-rate-limit');
const db = require('../db/pool');

// Track failed student login attempts in memory for temporary lockout
const failedStudentAttempts = new Map();

/**
 * Record failed student login attempt
 */
function recordFailedLogin(identifier) {
  const key = identifier.toLowerCase().trim();
  const record = failedStudentAttempts.get(key) || { count: 0, lockedUntil: null };
  record.count += 1;

  if (record.count >= 5) {
    // Lock for 15 minutes
    record.lockedUntil = Date.now() + 15 * 60 * 1000;
  }
  failedStudentAttempts.set(key, record);
}

/**
 * Check if identifier is currently locked out
 */
function isLoginLocked(identifier) {
  const key = identifier.toLowerCase().trim();
  const record = failedStudentAttempts.get(key);
  if (!record || !record.lockedUntil) return false;

  if (Date.now() > record.lockedUntil) {
    failedStudentAttempts.delete(key);
    return false;
  }
  return true;
}

/**
 * Clear failed login attempts on successful login
 */
function clearFailedLogin(identifier) {
  const key = identifier.toLowerCase().trim();
  failedStudentAttempts.delete(key);
}

/**
 * Ensure student is authenticated
 */
function requireStudentAuth(req, res, next) {
  if (req.session && req.session.student) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('json')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Please log in as student.' });
  }
  return res.redirect('/login');
}

/**
 * Ensure admin is authenticated
 */
function requireAdminAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  // API requests must ALWAYS receive JSON 401, never HTML 302 redirects
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('json')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin access required or session expired.' });
  }
  return res.redirect('/admin');
}

/**
 * Ensure teacher is authenticated
 */
function requireTeacherAuth(req, res, next) {
  if (req.session && (req.session.teacher || req.session.admin)) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('json')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher access required or session expired.' });
  }
  return res.redirect('/teacher');
}

/**
 * Ensure either student, teacher, or admin is authenticated (for Slate access)
 */
function requireSlateAuth(req, res, next) {
  if (req.session && (req.session.student || req.session.teacher || req.session.admin)) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('json')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Please log in as student, teacher, or admin to access Slate.' });
  }
  return res.redirect('/login');
}

/**
 * Rate Limiter for Login endpoints
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
  message: { success: false, error: 'Too many login attempts. Please wait 15 minutes before trying again.' }
});

/**
 * Rate Limiter for AI endpoints
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
  message: { success: false, error: 'AI rate limit exceeded. Please wait a moment before sending another query.' }
});

module.exports = {
  requireStudentAuth,
  requireAdminAuth,
  requireTeacherAuth,
  requireSlateAuth,
  recordFailedLogin,
  isLoginLocked,
  clearFailedLogin,
  loginRateLimiter,
  aiRateLimiter
};

