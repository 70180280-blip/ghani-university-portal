/**
 * Ghani University Portal - Server Entrypoint
 * Ghani Technical & Islamic University, Sheikhupura
 */

// Global Polyfills for Serverless & Cloud runtimes
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
    }
  };
}

const path = require('path');
const fs = require('fs');
require('dotenv').config();
if (fs.existsSync(path.resolve(process.cwd(), '.env.txt'))) {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.txt'), override: true });
}

// Built-in Production Fallbacks for Zero-Config Cloud Deployment
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

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const db = require('./src/db/pool');
const universityConfig = require('./config/university');
const studentRoutes = require('./src/routes/studentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const slateRoutes = require('./src/routes/slateRoutes');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust proxy for reverse proxies, Cloudflare tunnels, and Render deployment
app.set('trust proxy', 1);

// 1. Security Headers with Helmet
// Allow Tailwind CDN, Google Fonts, and Chart.js CDN in CSP, plus inline event handlers (onclick)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. Request Parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 3. Session Management (Signed Cookie Session for 100% 24/7 Cloud & Serverless compatibility)
const cookieSession = require('cookie-session');
app.use(cookieSession({
  name: 'gtiu_sid',
  keys: [process.env.SESSION_SECRET || 'gtiu-super-secret-key-sheikhupura-2026', 'gtiu-backup-secret-key'],
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days persistent
  httpOnly: true,
  sameSite: 'lax',
  secure: false
}));

// 4. Static Assets (Strict No-Cache for live dev/updates)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));
app.use('/sample_uploads', express.static(path.join(__dirname, 'sample_uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// 5. API Routes
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/slate', slateRoutes);

function readViewFile(filename) {
  const candidates = [
    path.join(__dirname, 'views', filename),
    path.join(process.cwd(), 'views', filename),
    path.join(__dirname, '..', 'views', filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return fs.readFileSync(c, 'utf8');
    }
  }
  return `<!DOCTYPE html><html><head><title>Ghani University Portal</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Ghani University Portal</h2><p>Loading application...</p><script>window.location.reload();</script></body></html>`;
}

// 6. View Routes
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(readViewFile('index.html'));
});

app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(readViewFile('admin.html'));
});

app.get('/teacher', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(readViewFile('teacher.html'));
});

app.get('/slate', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(readViewFile('slate.html'));
});

app.get('/login', (req, res) => {
  res.redirect('/');
});

app.get('/admin/login', (req, res) => {
  res.redirect('/admin');
});

// University Configuration Meta Endpoint
app.get('/api/config', (req, res) => {
  res.json({
    name: universityConfig.name,
    shortName: universityConfig.shortName,
    portalTitle: universityConfig.portalTitle,
    city: universityConfig.city,
    colors: universityConfig.colors,
    minimumAttendance: universityConfig.minimumAttendance
  });
});

// 404 Handler
app.use((req, res) => {
  if (req.xhr || req.headers.accept?.includes('json')) {
    res.status(404).json({ success: false, error: 'Endpoint not found.' });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'views', 'index.html'));
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred. Please contact the GTIU IT support desk.'
  });
});

// Initialize database and start listening
async function startServer() {
  try {
    console.log('[Bootstrap] Initializing Ghani University Portal Database...');
    await db.initDatabase();
    
    app.listen(PORT, () => {
      console.log(`========================================================`);
      console.log(`🚀 ${universityConfig.name} - Official Student Portal`);
      console.log(`🌐 Server running at: http://localhost:${PORT}`);
      console.log(`🎓 Student Portal URL: http://localhost:${PORT}/`);
      console.log(`🛡️  Admin ERP URL:     http://localhost:${PORT}/admin`);
      console.log(`========================================================`);
    });
  } catch (err) {
    console.error('[Bootstrap] Failed to initialize database:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;

