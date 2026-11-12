/**
 * Student Routes
 */

const express = require('express');
const router = express.Router();
const studentAuthController = require('../controllers/studentAuthController');
const studentPortalController = require('../controllers/studentPortalController');
const studentAiController = require('../controllers/studentAiController');
const { requireStudentAuth, loginRateLimiter, aiRateLimiter } = require('../middleware/auth');

// Public auth endpoints
router.post('/login', loginRateLimiter, studentAuthController.login);
router.post('/logout', studentAuthController.logout);
router.get('/me', studentAuthController.getCurrentStudent);

// Protected academic endpoints
router.use(requireStudentAuth);

router.get('/dashboard', studentPortalController.getDashboardData);
router.get('/results', studentPortalController.getMyResults);
router.get('/attendance', studentPortalController.getAttendanceReport);
router.get('/transcript', studentPortalController.getInterimTranscript);
router.get('/transcript/pdf', studentPortalController.downloadTranscriptPDF);
router.get('/registered-courses', studentPortalController.getRegisteredCourses);
router.get('/courses', studentPortalController.getRegisteredCourses);
router.get('/timetable', studentPortalController.getMyTimetable);
router.get('/degree-audit', studentPortalController.getDegreeAudit);
router.get('/personal-details', studentPortalController.getPersonalDetails);
router.get('/details', studentPortalController.getPersonalDetails);
router.get('/admit-card', studentPortalController.getAdmitCard);
router.get('/admit-card/pdf', studentPortalController.downloadAdmitCardPDF);

// Protected AI endpoints (with rate limiting)
router.post('/ai/chat', aiRateLimiter, studentAiController.chat);
router.get('/ai/insights', studentAiController.getInsights);
router.post('/ai/what-if', studentAiController.simulateWhatIf);
router.get('/ai/attendance-alert', studentAiController.getSmartAttendanceAlert);

module.exports = router;

