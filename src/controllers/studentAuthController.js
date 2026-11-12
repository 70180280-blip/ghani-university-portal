/**
 * Student Authentication Controller
 * 
 * Implements:
 * - Login matching: Student Name + Father's Name + Registration Number (trimmed, case-insensitive)
 * - Rate limiting & temporary account lockout after repeated failures
 * - Configurable optional extra verification (DOB or PIN)
 * - Session management
 */

const db = require('../db/pool');
const universityConfig = require('../../config/university');
const { recordFailedLogin, isLoginLocked, clearFailedLogin } = require('../middleware/auth');

/**
 * Handle Student Login
 */
async function login(req, res) {
  try {
    const { name, father_name, registration_no, extra_field } = req.body;

    if (!name || !father_name || !registration_no) {
      return res.status(400).json({
        success: false,
        error: 'Please enter Student Name, Father\'s Name, and Registration Number.'
      });
    }

    const trimmedReg = String(registration_no || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const trimmedName = String(name || '').trim().replace(/\s+/g, ' ');
    const trimmedFather = String(father_name || '').trim().replace(/\s+/g, ' ');

    // Check Lockout
    if (isLoginLocked(trimmedReg)) {
      return res.status(429).json({
        success: false,
        error: 'Account temporarily locked due to multiple failed login attempts. Please try again after 15 minutes.'
      });
    }

    // Query student from database strictly by registration number first
    const [students] = await db.query(`
      SELECT s.*, p.name as program_name, p.total_credit_hours as total_ch_required
      FROM students s
      LEFT JOIN programs p ON s.program_code = p.code
      WHERE UPPER(TRIM(s.registration_no)) = ?
    `, [trimmedReg]);

    if (students.length === 0) {
      console.warn(`[Student Auth] Login failed: Registration number not found [${trimmedReg}]`);
      recordFailedLogin(trimmedReg);
      return res.status(401).json({
        success: false,
        error: 'Invalid student credentials. Please verify your Registration Number, Full Name, and Father\'s Name.'
      });
    }

    const student = students[0];

    // Verify Name and Father's Name (case-insensitive, trimmed, repeated spaces collapsed)
    const normDbName = String(student.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normInputName = trimmedName.toLowerCase();

    const normDbFather = String(student.father_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normInputFather = trimmedFather.toLowerCase();

    const matchName = normDbName === normInputName;
    const matchFather = normDbFather === normInputFather;

    if (!matchName) {
      console.warn(`[Student Auth] Login failed: Name mismatch for registration [${trimmedReg}]`);
      recordFailedLogin(trimmedReg);
      return res.status(401).json({
        success: false,
        error: 'Student credentials do not match our university records. Ensure spelling matches your official admission documents.'
      });
    }

    if (!matchFather) {
      console.warn(`[Student Auth] Login failed: Father name mismatch for registration [${trimmedReg}]`);
      recordFailedLogin(trimmedReg);
      return res.status(401).json({
        success: false,
        error: 'Student credentials do not match our university records. Ensure spelling matches your official admission documents.'
      });
    }

    // Check optional verification field if configured
    const optConfig = universityConfig.optionalLoginVerification;
    if (optConfig && optConfig.enabled) {
      if (optConfig.field === 'dob') {
        const studentDob = student.dob ? new Date(student.dob).toISOString().split('T')[0] : '';
        if (studentDob !== (extra_field || '').trim()) {
          recordFailedLogin(trimmedReg);
          return res.status(401).json({
            success: false,
            error: `Security verification failed: Incorrect ${optConfig.label}.`
          });
        }
      } else if (optConfig.field === 'pin') {
        if ((student.pin || '').trim() !== (extra_field || '').trim()) {
          recordFailedLogin(trimmedReg);
          return res.status(401).json({
            success: false,
            error: `Security verification failed: Incorrect ${optConfig.label}.`
          });
        }
      }
    }

    // Success: clear failed attempts
    clearFailedLogin(trimmedReg);

    // Save session
    req.session.student = {
      id: student.id,
      name: student.name,
      father_name: student.father_name,
      registration_no: student.registration_no,
      program_code: student.program_code,
      program_name: student.program_name,
      batch: student.batch,
      current_semester: student.current_semester,
      total_ch_required: student.total_ch_required,
      status: student.status
    };

    return res.json({
      success: true,
      message: 'Login successful',
      student: req.session.student
    });
  } catch (err) {
    console.error('[Student Auth] Error during login:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
  }
}

/**
 * Handle Student Logout
 */
function logout(req, res) {
  req.session.student = null;
  req.session.destroy((err) => {
    if (err) {
      console.error('[Student Auth] Logout error:', err);
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
}

/**
 * Get Current Logged-in Student Session
 */
function getCurrentStudent(req, res) {
  if (req.session && req.session.student) {
    return res.json({
      success: true,
      authenticated: true,
      student: req.session.student,
      config: {
        universityName: universityConfig.name,
        shortName: universityConfig.shortName,
        portalTitle: universityConfig.portalTitle,
        colors: universityConfig.colors,
        optionalVerification: universityConfig.optionalLoginVerification
      }
    });
  }

  return res.json({
    success: true,
    authenticated: false,
    config: {
      universityName: universityConfig.name,
      shortName: universityConfig.shortName,
      portalTitle: universityConfig.portalTitle,
      colors: universityConfig.colors,
      optionalVerification: universityConfig.optionalLoginVerification
    }
  });
}

module.exports = {
  login,
  logout,
  getCurrentStudent
};

