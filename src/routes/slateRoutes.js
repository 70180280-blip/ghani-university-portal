/**
 * Slate Routes - Ghani University Student & Teacher Slate
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const slateController = require('../controllers/slateController');
const { requireSlateAuth } = require('../middleware/auth');

// Configure Multer for Slate attachments (images, PDFs, documents, zips)
const slateUploadDir = path.resolve(process.cwd(), 'public', 'uploads', 'slate');
try {
  if (!fs.existsSync(slateUploadDir)) {
    fs.mkdirSync(slateUploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Slate Upload Dir] Directory notice:', e.message);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, slateUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `slate_${Date.now()}_${safeBase}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB
});

// Protect all slate routes
router.use(requireSlateAuth);

// Profile & State
router.get('/me', slateController.getMe);

// Conversations & Messages
router.get('/conversations', slateController.getConversations);
router.post('/conversations', slateController.startDirectConversation);
router.get('/conversations/:conversationId/messages', slateController.getMessages);
router.post('/conversations/:conversationId/messages', slateController.sendMessage);
router.post('/messages/:messageId/pin', slateController.togglePinMessage);
router.post('/messages/:messageId/report', slateController.reportMessage);

// Course Channels
router.get('/course-channels', slateController.getCourseChannels);

// Announcements
router.get('/announcements', slateController.getAnnouncements);
router.post('/announcements', slateController.createAnnouncement);

// Materials & Assignments
router.get('/materials', slateController.getMaterials);
router.post('/materials/submit', slateController.submitAssignment);

// Meetings
router.get('/meetings', slateController.getMeetings);
router.post('/meetings', slateController.requestMeeting);

// Notifications
router.get('/notifications', slateController.getNotifications);
router.post('/notifications/read', slateController.markNotificationsRead);

// File Upload
router.post('/upload', upload.single('file'), slateController.handleFileUpload);

module.exports = router;
