/**
 * Teacher Authentication Controller - Ghani University Slate
 */

const db = require('../db/pool');
const bcrypt = require('bcryptjs');

/**
 * Handle Teacher Login
 */
async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your Teacher ID or Official Email, and password.'
      });
    }

    const trimmedIdent = String(identifier || '').trim();

    // Query teacher by email or teacher_id
    const [teachers] = await db.query(
      `SELECT * FROM teachers WHERE LOWER(email) = LOWER(?) OR UPPER(teacher_id) = UPPER(?) LIMIT 1`,
      [trimmedIdent, trimmedIdent]
    );

    if (teachers.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid faculty credentials. Teacher record not found.'
      });
    }

    const teacher = teachers[0];

    if (teacher.status !== 'Active') {
      return res.status(403).json({
        success: false,
        error: 'Your faculty account is currently inactive. Please contact the Registrar Office.'
      });
    }

    // Verify Password
    const passwordMatch = bcrypt.compareSync(password, teacher.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password. Please verify and try again.'
      });
    }

    // Save session
    req.session.teacher = {
      id: teacher.id,
      teacher_id: teacher.teacher_id,
      name: teacher.name,
      email: teacher.email,
      department: teacher.department,
      designation: teacher.designation,
      office_room: teacher.office_room,
      phone: teacher.phone,
      status: teacher.status
    };

    // Fetch assigned courses
    const [assignedCourses] = await db.query(
      `SELECT tca.id as assignment_id, tca.course_code, tca.section, tca.academic_year, tca.term,
              c.title as course_title, c.credit_hours, c.department
       FROM teacher_course_assignments tca
       LEFT JOIN courses c ON tca.course_code = c.code
       WHERE tca.teacher_id = ?
       ORDER BY tca.course_code ASC`,
      [teacher.id]
    );

    return res.json({
      success: true,
      message: `Welcome back, ${teacher.name}!`,
      teacher: req.session.teacher,
      assignedCourses
    });
  } catch (err) {
    console.error('[Teacher Auth] Login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during teacher login.' });
  }
}

/**
 * Handle Teacher Logout
 */
async function logout(req, res) {
  try {
    delete req.session.teacher;
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[Teacher Auth] Logout error:', err);
    return res.status(500).json({ success: false, error: 'Failed to logout.' });
  }
}

/**
 * Get Current Teacher Profile
 */
async function getProfile(req, res) {
  try {
    if (!req.session.teacher) {
      return res.status(401).json({ success: false, error: 'Teacher not logged in.' });
    }

    const teacherId = req.session.teacher.id;
    const [teachers] = await db.query('SELECT id, teacher_id, name, email, department, designation, phone, office_room, status FROM teachers WHERE id = ?', [teacherId]);
    if (teachers.length === 0) {
      return res.status(404).json({ success: false, error: 'Teacher record not found.' });
    }

    const [assignedCourses] = await db.query(
      `SELECT tca.id as assignment_id, tca.course_code, tca.section, tca.academic_year, tca.term,
              c.title as course_title, c.credit_hours, c.department
       FROM teacher_course_assignments tca
       LEFT JOIN courses c ON tca.course_code = c.code
       WHERE tca.teacher_id = ?
       ORDER BY tca.course_code ASC`,
      [teacherId]
    );

    return res.json({
      success: true,
      teacher: teachers[0],
      assignedCourses
    });
  } catch (err) {
    console.error('[Teacher Auth] Profile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve profile.' });
  }
}

module.exports = {
  login,
  logout,
  getProfile
};
