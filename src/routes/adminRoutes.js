/**
 * Admin Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const adminAuthController = require('../controllers/adminAuthController');
const adminPortalController = require('../controllers/adminPortalController');
const { requireAdminAuth, loginRateLimiter } = require('../middleware/auth');

const os = require('os');

// Multer storage configuration (Uses writable OS temp dir for serverless/cloud compatibility)
const uploadDir = path.resolve(os.tmpdir(), 'gtiu_uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Upload Dir] Using fallback for upload directory:', e.message);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `upload_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// Admin Auth
router.post('/login', loginRateLimiter, adminAuthController.login);
router.post('/logout', adminAuthController.logout);
router.get('/me', adminAuthController.getCurrentAdmin);

// DB Status check (accessible to header status indicator)
router.get('/db/status', adminPortalController.getDbStatus);
router.get('/db-status', adminPortalController.getDbStatus);
router.post('/db/retry', adminPortalController.retryDbConnection);

// Protected Admin Endpoints
router.use(requireAdminAuth);

router.get('/stats', adminPortalController.getDashboardStats);
router.post('/upload', upload.single('file'), adminPortalController.uploadFile);
router.post('/upload/confirm', adminPortalController.confirmUpload);
router.delete('/upload/:id', adminPortalController.deleteUpload);
router.get('/upload/history', adminPortalController.getUploadHistory);

router.get('/students', adminPortalController.getAllStudents);
router.get('/courses', adminPortalController.getAllCourses);
router.delete('/courses/:code', adminPortalController.deleteCourse);
router.delete('/courses', adminPortalController.deleteAllCourses);
router.put('/students/:id', adminPortalController.updateStudent);
router.delete('/students/:id', adminPortalController.deleteStudent);
router.delete('/students', adminPortalController.deleteAllStudents);
router.put('/results/:id', adminPortalController.updateResult);

router.post('/clear', adminPortalController.clearDatabaseCategory);
router.get('/db/status', adminPortalController.getDbStatus);
router.get('/db-status', adminPortalController.getDbStatus);
router.post('/db/retry', adminPortalController.retryDbConnection);

router.get('/export', adminPortalController.exportDataToExcel);
router.post('/ai/search', adminPortalController.aiSearch);
router.get('/ai/at-risk', adminPortalController.getAtRiskReport);
router.get('/audit-logs', adminPortalController.getAuditLogs);

module.exports = router;

