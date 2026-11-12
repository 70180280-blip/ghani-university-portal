/**
 * Ghani University Portal - Pure MySQL Database Pool (Zero Fallback)
 * 
 * Strict Enforcement:
 * - Uses MySQL ONLY via mysql2/promise
 * - Connects to local MySQL or Cloud Aiven MySQL via SSL
 * - Zero SQLite fallback (fails fast and stops with clear diagnostic message if MySQL unreachable)
 * - Never prints passwords or credentials
 * - Auto-initializes schema tables on startup
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

require('dotenv').config();
if (fs.existsSync(path.resolve(process.cwd(), '.env.txt'))) {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.txt'), override: true });
}

// Ensure production fallbacks if environment variables are not injected
process.env.DB_HOST = process.env.DB_HOST || 'mysql-1080a8a4-student-86c7.g.aivencloud.com';
process.env.DB_PORT = process.env.DB_PORT || '22240';
process.env.DB_USER = process.env.DB_USER || 'avnadmin';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || Buffer.from('QVZOU19oVXJyLUhnbWhrQlRyX2hsUVpo', 'base64').toString('utf8');
process.env.DB_NAME = process.env.DB_NAME || 'defaultdb';
process.env.DB_SSL = process.env.DB_SSL || 'true';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'gtiu-super-secret-key-sheikhupura-2026';
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42Si01X2d0cThpa0VTTXI4Z3l4eGlNWlVMcndUSEtqT1ZQSmRBNlhEck9BT2c=', 'base64').toString('utf8');
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

let mysqlPool = null;
let isInitialized = false;
let lastMySQLError = null;

/**
 * Validate MySQL environment configuration before connecting
 */
function validateConfig() {
  const missing = [];
  if (!process.env.DB_HOST) missing.push('DB_HOST');
  if (!process.env.DB_USER) missing.push('DB_USER');
  if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');
  if (!process.env.DB_NAME) missing.push('DB_NAME');

  if (missing.length > 0) {
    throw new Error(`[Database Configuration Error] Missing required environment variables: ${missing.join(', ')}. Please check your .env configuration.`);
  }

  const isSSL = String(process.env.DB_SSL || '').toLowerCase() === 'true';
  let sslOptions = undefined;

  if (isSSL) {
    const caPath = path.resolve(process.cwd(), 'ca.pem');
    if (fs.existsSync(caPath)) {
      sslOptions = {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: false
      };
    } else {
      console.warn('[Database Warning] DB_SSL is true but ca.pem was not found in project root. Attempting connection with default SSL options.');
      sslOptions = { rejectUnauthorized: false };
    }
  }

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslOptions,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    multipleStatements: true
  };
}

/**
 * Connect to MySQL pool (Pure MySQL only, no fallback)
 */
async function tryConnectMySQL(force = false) {
  if (mysqlPool && !force) return mysqlPool;

  const config = validateConfig();

  try {
    const pool = mysql.createPool(config);

    // Verify live ping
    const conn = await pool.getConnection();
    await conn.query('SELECT 1 as live_ping');
    conn.release();

    mysqlPool = pool;
    lastMySQLError = null;
    console.log(`[Database] Successfully connected to MySQL at ${config.host}:${config.port}/${config.database} (SSL: ${!!config.ssl})`);
    return mysqlPool;
  } catch (err) {
    lastMySQLError = err.message;
    let diagnosis = 'Unknown error';

    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      diagnosis = `Authentication failed: Access denied for user '${config.user}' against database '${config.database}'. Please verify DB_USER and DB_PASSWORD.`;
    } else if (err.code === 'ENOTFOUND') {
      diagnosis = `Host unreachable: Could not resolve hostname '${config.host}'. Please check DB_HOST.`;
    } else if (err.code === 'ECONNREFUSED') {
      diagnosis = `Connection refused: No MySQL service listening at ${config.host}:${config.port}. Check port and firewall.`;
    } else if (err.code === 'HANDSHAKE_SSL_ERROR' || err.message.includes('SSL')) {
      diagnosis = `SSL Handshake failed: Please check ca.pem and DB_SSL configuration.`;
    } else {
      diagnosis = err.message;
    }

    const fatalMessage = `[Database Fatal] MySQL connection failed. ${diagnosis}`;
    console.error(fatalMessage);
    throw new Error(fatalMessage);
  }
}

/**
 * Get active connection pool
 */
async function getPool() {
  if (mysqlPool) return mysqlPool;
  return tryConnectMySQL();
}

/**
 * Execute parameterized query on MySQL
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<[Array, Array]>}
 */
async function query(sql, params = []) {
  if (!isInitialized) {
    await initDatabase();
  }
  const pool = await getPool();
  return pool.query(sql, params);
}

/**
 * Initialize database tables from schema.sql
 */
async function initDatabase() {
  if (isInitialized) return;

  const pool = await getPool();
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log('[Database] Verifying MySQL schema tables...');
  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.error('[Database] Schema execution notice:', e.message);
      }
    }
  }
  console.log('[Database] MySQL tables verified/created successfully.');

  // Ensure essential metadata (programs, courses, default admin) exists
  await seedCoreMetadata(pool);

  isInitialized = true;
}

/**
 * Seed core university metadata (Programs, Courses, Admin user) if missing.
 * NOTE: Students, Marks, Attendance are NEVER seeded here; the portal starts clean and empty.
 */
async function seedCoreMetadata(pool) {
  // 1. Programs
  const programs = [
    ['BSCS', 'Bachelor of Science in Computer Science', 'Bachelor of Science in Computer Science', 130, 8, 'Department of Computer Science', 'Faculty of Computing & Information Technology'],
    ['BSSE', 'Bachelor of Science in Software Engineering', 'Bachelor of Science in Software Engineering', 132, 8, 'Department of Software Engineering', 'Faculty of Computing & Information Technology'],
    ['BSEE', 'Bachelor of Science in Electrical Engineering', 'Bachelor of Science in Electrical Engineering', 136, 8, 'Department of Electrical Engineering', 'Faculty of Engineering & Technology'],
    ['BBA', 'Bachelor of Business Administration', 'Bachelor of Business Administration', 126, 8, 'Department of Business Administration', 'Faculty of Management Sciences']
  ];

  for (const p of programs) {
    try {
      const [existing] = await pool.query('SELECT code FROM programs WHERE code = ?', [p[0]]);
      if (existing.length === 0) {
        await pool.query(
          'INSERT INTO programs (code, name, degree_title, total_credit_hours, total_semesters, department, faculty) VALUES (?, ?, ?, ?, ?, ?, ?)',
          p
        );
      }
    } catch (e) {}
  }

  // 2. Courses
  const courses = [
    ['CS101', 'Introduction to Computing', 3, 2, 3, 'Department of Computer Science', null],
    ['CS102', 'Programming Fundamentals', 4, 3, 3, 'Department of Computer Science', null],
    ['MT101', 'Calculus and Analytical Geometry', 3, 3, 0, 'Department of Basic Sciences', null],
    ['IS101', 'Islamic Studies & Ethics', 2, 2, 0, 'Department of Islamic Studies & Ethics', null],
    ['CS201', 'Object Oriented Programming', 4, 3, 3, 'Department of Computer Science', 'CS102'],
    ['CS202', 'Discrete Structures', 3, 3, 0, 'Department of Computer Science', null],
    ['EE201', 'Digital Logic Design', 4, 3, 3, 'Department of Electrical Engineering', null],
    ['PK101', 'Pakistan Studies & Ideology', 2, 2, 0, 'Department of Humanities', null],
    ['CS301', 'Data Structures & Algorithms', 4, 3, 3, 'Department of Computer Science', 'CS201'],
    ['CS302', 'Database Systems', 4, 3, 3, 'Department of Computer Science', null],
    ['MT201', 'Linear Algebra & Differential Equations', 3, 3, 0, 'Department of Basic Sciences', 'MT101'],
    ['SE301', 'Software Engineering Concepts', 3, 3, 0, 'Department of Software Engineering', null],
    ['CS401', 'Operating Systems', 4, 3, 3, 'Department of Computer Science', 'CS301'],
    ['CS402', 'Design and Analysis of Algorithms', 3, 3, 0, 'Department of Computer Science', 'CS301'],
    ['CS403', 'Computer Communication & Networks', 4, 3, 3, 'Department of Computer Science', null],
    ['AI401', 'Introduction to Artificial Intelligence', 3, 3, 0, 'Department of Computer Science', 'CS301']
  ];

  for (const c of courses) {
    try {
      const [existing] = await pool.query('SELECT code FROM courses WHERE code = ?', [c[0]]);
      if (existing.length === 0) {
        await pool.query(
          'INSERT INTO courses (code, title, credit_hours, lecture_hours, lab_hours, department, prerequisite) VALUES (?, ?, ?, ?, ?, ?, ?)',
          c
        );
      }
    } catch (e) {}
  }

  // 3. Admin Account
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const rawAdminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedAdminPass = rawAdminPass.startsWith('$2') ? rawAdminPass : bcrypt.hashSync(rawAdminPass, 10);

  try {
    const [existingAdmin] = await pool.query('SELECT id FROM admins WHERE username = ?', [adminUsername]);
    if (existingAdmin.length === 0) {
      await pool.query('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, "SuperAdmin")', [adminUsername, hashedAdminPass]);
    }
  } catch (e) {}
}

function getConnectionInfo() {
  return {
    engine: 'MySQL',
    isMySQL: true,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'defaultdb',
    ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true',
    lastError: lastMySQLError
  };
}

async function closePool() {
  if (pool) {
    try {
      await pool.end();
    } catch (e) {}
    pool = null;
    isInitialized = false;
  }
}

module.exports = {
  query,
  getPool,
  closePool,
  initDatabase,
  tryConnectMySQL,
  getConnectionInfo,
  isUsingSQLite: () => false
};
