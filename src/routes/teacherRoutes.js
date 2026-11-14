/**
 * Teacher Routes - Ghani University Faculty Portal
 */

const express = require('express');
const router = express.Router();

const teacherAuthController = require('../controllers/teacherAuthController');
const teacherPortalController = require('../controllers/teacherPortalController');
const { requireTeacherAuth, loginRateLimiter } = require('../middleware/auth');

// Authentication
router.post('/login', loginRateLimiter, teacherAuthController.login);
router.post('/logout', teacherAuthController.logout);
router.get('/me', teacherAuthController.getProfile);

// Portal Data & Actions (Protected)
router.use(requireTeacherAuth);

// Courses & Enrolled Students
router.get('/courses', teacherPortalController.getCourses);
router.get('/courses/:code/students', teacherPortalController.getCourseStudents);

// Course Materials, Assignments & Quizzes
router.get('/materials', teacherPortalController.getMaterials);
router.post('/materials', teacherPortalController.createMaterial);
router.delete('/materials/:id', teacherPortalController.deleteMaterial);

// Submissions & Grading
router.get('/materials/:materialId/submissions', teacherPortalController.getSubmissions);
router.post('/submissions/:id/grade', teacherPortalController.gradeSubmission);

// Meeting Requests
router.get('/meetings', teacherPortalController.getMeetingRequests);
router.patch('/meetings/:id', teacherPortalController.updateMeetingRequest);

module.exports = router;
