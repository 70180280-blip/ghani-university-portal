/**
 * Student AI Controller - Powered by Google Gemini API & Deterministic Code Engine
 * 
 * Implements:
 * 1. AI Study Assistant (Natural Language / Roman Urdu Chat)
 * 2. AI Performance Insights (Trends, Strengths, Weaknesses, Cached)
 * 3. What-If Simulator (Deterministic code calculates projections, Gemini advises)
 * 4. Smart Attendance Alert (Code calculates safe margin, Gemini advises)
 */

const { getStudentAcademicHistory } = require('./studentPortalController');
const { calculateAttendanceMetrics, calculateAbsencesAllowed, simulateAcademicPerformance, calculateFinalMarksNeeded } = require('../utils/calculations');
const db = require('../db/pool');
const aiService = require('../services/aiService');

/**
 * Gather complete, sanitized, pre-computed academic context for the logged-in student ONLY
 */
async function buildStudentAcademicContext(student) {
  const { semesterList, overallStats } = await getStudentAcademicHistory(student.id);

  // Fetch attendance records
  const [attRows] = await db.query(`
    SELECT a.*, c.title as course_title
    FROM attendance a
    JOIN courses c ON a.course_code = c.code
    WHERE a.student_id = ?
  `, [student.id]);

  const courseAttMap = new Map();
  for (const r of attRows) {
    if (!courseAttMap.has(r.course_code)) {
      courseAttMap.set(r.course_code, { title: r.course_title, records: [] });
    }
    courseAttMap.get(r.course_code).records.push(r);
  }

  const attendanceSummary = [];
  let weakestCourse = null;
  let strongestCourse = null;
  let minPct = 101;
  let maxPct = -1;

  for (const [code, item] of courseAttMap.entries()) {
    const metrics = calculateAttendanceMetrics(item.records);
    const absence = calculateAbsencesAllowed(metrics.present, metrics.total, 32);
    attendanceSummary.push({
      course_code: code,
      title: item.title,
      total: metrics.total,
      present: metrics.present,
      percentage: metrics.percentage,
      is_at_risk: metrics.isAtRisk,
      absences_allowed: absence.totalRemainingInSemester
    });
  }

  // Find strongest and weakest courses from semester history
  for (const sem of semesterList) {
    for (const c of sem.courses) {
      if (c.percentage < minPct) {
        minPct = c.percentage;
        weakestCourse = { course_code: c.courseCode, title: c.title, percentage: c.percentage, grade: c.grade };
      }
      if (c.percentage > maxPct) {
        maxPct = c.percentage;
        strongestCourse = { course_code: c.courseCode, title: c.title, percentage: c.percentage, grade: c.grade };
      }
    }
  }

  const overallAtt = calculateAttendanceMetrics(attRows);

  return {
    id: student.id,
    name: student.name,
    father_name: student.father_name,
    registration_no: student.registration_no,
    program_code: student.program_code,
    batch: student.batch,
    current_semester: student.current_semester,
    total_ch_required: student.total_ch_required || 130,
    cgpa: overallStats.cgpa,
    earned_ch: overallStats.earnedCH,
    overall_percentage: overallStats.overallPercentage,
    semesters: semesterList.map(s => ({
      semester_number: s.semester_number,
      sgpa: s.sgpa,
      percentage: s.percentage,
      earned_ch: s.earned_ch,
      courses: s.courses.map(c => ({ code: c.courseCode, title: c.title, grade: c.grade, pct: c.percentage }))
    })),
    attendance_overall: overallAtt.percentage,
    attendance_summary: attendanceSummary,
    weakest_course: weakestCourse,
    strongest_course: strongestCourse
  };
}

/**
 * 1. AI Study Assistant Chat
 */
async function chat(req, res) {
  try {
    const student = req.session.student;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Please enter a question.' });
    }

    const studentContext = await buildStudentAcademicContext(student);
    const aiResponse = await aiService.chatWithStudent(studentContext, message.trim());

    return res.json({
      success: true,
      answer: aiResponse.answer,
      reply: aiResponse.answer,
      source: aiResponse.source
    });
  } catch (err) {
    console.error('[Student AI Controller] Chat error:', err);
    return res.status(500).json({
      success: false,
      error: 'AI service encountered an issue. Please try again shortly.'
    });
  }
}

/**
 * 2. AI Performance Insights
 */
async function getInsights(req, res) {
  try {
    const student = req.session.student;
    const studentContext = await buildStudentAcademicContext(student);

    const insights = await aiService.generateStudentInsights(studentContext);

    return res.json({
      success: true,
      insights,
      studentData: {
        cgpa: studentContext.cgpa,
        attendance: studentContext.attendance_overall,
        weakest: studentContext.weakest_course,
        strongest: studentContext.strongest_course
      }
    });
  } catch (err) {
    console.error('[Student AI Controller] Insights error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate academic insights.' });
  }
}

/**
 * 3. What-If Simulator
 */
async function simulateWhatIf(req, res) {
  try {
    const student = req.session.student;
    const rawCourses = req.body.simulatedCourses || req.body.courses;

    if (!rawCourses || !Array.isArray(rawCourses) || rawCourses.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select courses and grades to simulate.' });
    }

    const simulatedCourses = rawCourses.map(c => ({
      courseCode: c.courseCode || c.course_code || 'COURSE',
      creditHours: Number(c.creditHours || c.credit_hours || 3),
      simulatedGrade: c.simulatedGrade || c.expected_grade || c.grade || 'A'
    }));

    const { semesterList } = await getStudentAcademicHistory(student.id);

    // CODE calculates the exact projection deterministically
    const calculated = simulateAcademicPerformance(semesterList, simulatedCourses);

    // Gemini provides explanation and advice based on code calculation
    const explanation = await aiService.explainWhatIf(student.name, calculated);

    return res.json({
      success: true,
      projection: {
        previousCGPA: calculated.previousCGPA,
        simulatedSGPA: calculated.simulatedSGPA,
        projectedCGPA: calculated.projectedCGPA,
        cgpaDifference: calculated.cgpaDifference,
        earnedCH: calculated.earnedCH,
        totalCH: calculated.totalCH
      },
      simulation: calculated, // alias
      aiExplanation: explanation
    });
  } catch (err) {
    console.error('[Student AI Controller] What-If error:', err);
    return res.status(500).json({ success: false, error: 'Simulation calculation error.' });
  }
}

/**
 * 4. Smart Attendance Alert
 */
async function getSmartAttendanceAlert(req, res) {
  try {
    const student = req.session.student;
    const courseCode = req.query.courseCode || req.query.course_code;

    const [attRows] = await db.query(`
      SELECT a.*, c.title as course_title
      FROM attendance a
      JOIN courses c ON a.course_code = c.code
      WHERE a.student_id = ? AND a.course_code = ?
    `, [student.id, courseCode]);

    if (attRows.length === 0) {
      return res.json({
        success: true,
        alert: `No attendance records logged yet for ${courseCode}. Attend all scheduled classes!`,
        absencesAllowed: 8,
        percentage: 100
      });
    }

    const metrics = calculateAttendanceMetrics(attRows);
    const absence = calculateAbsencesAllowed(metrics.present, metrics.total, 32);
    const title = attRows[0].course_title || courseCode;

    const alertText = await aiService.generateAttendanceAlert(
      courseCode,
      title,
      metrics.percentage,
      absence.totalRemainingInSemester
    );

    return res.json({
      success: true,
      courseCode,
      courseTitle: title,
      currentPercentage: metrics.percentage,
      absencesAllowed: absence.totalRemainingInSemester,
      isBelowThreshold: metrics.isAtRisk,
      alertMessage: alertText,
      alert: alertText
    });
  } catch (err) {
    console.error('[Student AI Controller] Attendance alert error:', err);
    return res.status(500).json({ success: false, error: 'Failed to compute attendance alert.' });
  }
}

module.exports = {
  chat,
  getInsights,
  simulateWhatIf,
  getSmartAttendanceAlert
};

