/**
 * Teacher Routes - Ghani University Faculty Portal
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

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

// Student Academic Results & Gradebook
router.post('/courses/:code/grades', teacherPortalController.saveCourseGrades);
router.post('/courses/:code/upload-grades', upload.single('file'), teacherPortalController.uploadCourseGradesFile);

// Student Attendance Register & Upload
router.post('/courses/:code/attendance', teacherPortalController.saveCourseAttendance);
router.post('/courses/:code/upload-attendance', upload.single('file'), teacherPortalController.uploadCourseAttendanceFile);

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
