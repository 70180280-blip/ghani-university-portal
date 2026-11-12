/**
 * Database Reset Script - Clears all student data, results, attendance, uploads
 * Leaves academic programs, courses, and admin credentials intact.
 */

const db = require('./pool');

async function clearData() {
  console.log('[Clear Data] Resetting student and academic records...');
  await db.initDatabase();

  // Try adding father_phone column to students table if missing
  try {
    await db.query('ALTER TABLE students ADD COLUMN father_phone VARCHAR(32) NULL');
    console.log('[Clear Data] Added father_phone column to students table.');
  } catch (e) {
    // Column already exists or table will be fresh
  }

  // Delete dependent tables first
  const tables = [
    'results',
    'attendance',
    'enrollments',
    'semesters',
    'uploads',
    'ai_cache',
    'audit_log',
    'timetable',
    'exam_schedule',
    'students'
  ];

  for (const table of tables) {
    try {
      await db.query(`DELETE FROM ${table}`);
      console.log(`[Clear Data] Cleared table: ${table}`);
    } catch (err) {
      console.warn(`[Clear Data] Notice on ${table}:`, err.message);
    }
  }

  // Ensure default admin user exists
  const bcrypt = require('bcryptjs');
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const rawAdminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedAdminPass = rawAdminPass.startsWith('$2') 
    ? rawAdminPass 
    : bcrypt.hashSync(rawAdminPass, 10);

  const [existingAdmin] = await db.query('SELECT id FROM admins WHERE username = ?', [adminUsername]);
  if (existingAdmin.length === 0) {
    await db.query(`
      INSERT INTO admins (username, password_hash, role)
      VALUES (?, ?, 'SuperAdmin')
    `, [adminUsername, hashedAdminPass]);
  }

  console.log('[Clear Data] All student and performance data successfully cleared! Database is completely clean and ready for new files.');
}

if (require.main === module) {
  clearData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Clear Data] Error:', err);
      process.exit(1);
    });
}

module.exports = clearData;

