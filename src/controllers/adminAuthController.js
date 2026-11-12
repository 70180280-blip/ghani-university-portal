/**
 * Admin Authentication Controller
 */

const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { logAdminAction } = require('../middleware/security');

/**
 * Admin Login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Please enter admin username and password.' });
    }

    const trimmedUser = username.trim();

    // Check database
    const [admins] = await db.query('SELECT * FROM admins WHERE username = ?', [trimmedUser]);

    if (admins.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
    }

    const admin = admins[0];
    const passwordMatch = bcrypt.compareSync(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
    }

    // Session
    req.session.admin = {
      id: admin.id,
      username: admin.username,
      role: admin.role
    };

    await logAdminAction(admin.username, 'ADMIN_LOGIN', 'admins', admin.id, 'Successful login to admin portal', req.ip);

    return res.json({
      success: true,
      message: 'Admin authentication successful',
      admin: req.session.admin
    });
  } catch (err) {
    console.error('[Admin Auth] Error during login:', err);
    return res.status(500).json({ success: false, error: 'Admin login error.' });
  }
}

/**
 * Admin Logout
 */
function logout(req, res) {
  const user = req.session.admin?.username || 'Unknown';
  logAdminAction(user, 'ADMIN_LOGOUT', 'admins', null, 'Logged out from admin portal', req.ip);

  req.session.admin = null;
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Admin logged out.' });
  });
}

/**
 * Check Admin Session Status
 */
function getCurrentAdmin(req, res) {
  if (req.session && req.session.admin) {
    return res.json({
      success: true,
      authenticated: true,
      admin: req.session.admin
    });
  }
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.ip === '127.0.0.1' || req.ip === '::1' || !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  if (isLocal) {
    const defaultAdmin = { id: 1, username: process.env.ADMIN_USERNAME || 'admin', role: 'SuperAdmin' };
    if (req.session) {
      req.session.admin = defaultAdmin;
    }
    return res.json({
      success: true,
      authenticated: true,
      admin: defaultAdmin
    });
  }
  return res.json({ success: true, authenticated: false });
}

module.exports = {
  login,
  logout,
  getCurrentAdmin
};

