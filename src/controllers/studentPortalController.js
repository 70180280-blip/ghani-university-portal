/**
 * Student Portal Controller
 * 
 * Handles all academic modules for authenticated students:
 * - Live Dashboard Tiles & Counters
 * - My Results (detailed breakdowns & SGPA chart)
 * - Attendance Report (course breakdown, monthly chart, calendar drilldown)
 * - Interim Transcript (web view & PDF generation)
 * - Registered Courses
 * - My Timetable (today's events live counter)
 * - Degree Audit
 * - Personal Details
 * - Admit Card (web view & PDF generation)
 */

const db = require('../db/pool');
const universityConfig = require('../../config/university');
const {
  calculateSemesterGPA,
  calculateCumulativeGPA,
  calculateAttendanceMetrics,
  calculateAbsencesAllowed
} = require('../utils/calculations');
const pdfService = require('../services/pdfService');

/**
 * Get Student Academic History with pre-computed semester & cumulative GPA
 */
async function getStudentAcademicHistory(studentId) {
  // Query all results ordered by semester
  const [results] = await db.query(`
    SELECT r.*, c.title as course_title, c.credit_hours, c.lecture_hours, c.lab_hours, c.department
    FROM results r
    JOIN courses c ON r.course_code = c.code
    WHERE r.student_id = ?
    ORDER BY r.semester_number ASC, r.course_code ASC
  `, [studentId]);

  // Group by semester
  const semesterMap = new Map();
  for (const r of results) {
    const semNum = r.semester_number;
    if (!semesterMap.has(semNum)) {
      semesterMap.set(semNum, []);
    }
    semesterMap.get(semNum).push({
      courseCode: r.course_code,
      title: r.course_title,
      creditHours: r.credit_hours,
      grade: r.grade,
      gradePoint: Number(r.grade_point),
      marksObtained: Number(r.total_obtained),
      totalMarks: Number(r.total_max),
      assignmentMarks: Number(r.assignment_marks),
      quizMarks: Number(r.quiz_marks),
      midMarks: Number(r.mid_marks),
      finalMarks: Number(r.final_marks),
      percentage: Number(r.percentage),
      isPassed: Boolean(r.is_passed)
    });
  }

  // Calculate SGPA and running CGPA for each semester
  const semesterList = [];
  const cumulativeSemestersSoFar = [];

  for (const [semNum, courses] of semesterMap.entries()) {
    const semGPA = calculateSemesterGPA(courses);
    cumulativeSemestersSoFar.push({ semesterNumber: semNum, courses });
    const cumStats = calculateCumulativeGPA(cumulativeSemestersSoFar);

    semesterList.push({
      semester_number: semNum,
      courses,
      total_ch: semGPA.totalCH,
      earned_ch: semGPA.earnedCH,
      sgpa: semGPA.sgpa,
      cgpa: cumStats.cgpa,
      percentage: semGPA.percentage,
      total_obtained: semGPA.totalObtained,
      total_max: semGPA.totalMaxMarks
    });
  }

  const overallStats = calculateCumulativeGPA(cumulativeSemestersSoFar);

  return {
    semesterList,
    overallStats
  };
}

/**
 * Dashboard Tiles Data
 */
async function getDashboardData(req, res) {
  try {
    const student = req.session.student;
    const studentId = student.id;

    // 1. Academic History
    const { semesterList, overallStats } = await getStudentAcademicHistory(studentId);
    const completedSemesters = semesterList.filter(s => s.semester_number < student.current_semester);
    const latestSem = completedSemesters[completedSemesters.length - 1] || { sgpa: 0 };

    // 2. Attendance Summary
    const [attRows] = await db.query(`
      SELECT status, course_code, lecture_date
      FROM attendance
      WHERE student_id = ?
    `, [studentId]);

    const overallAtt = calculateAttendanceMetrics(attRows);

    // Group attendance per course in current semester
    const courseAttMap = new Map();
    for (const r of attRows) {
      if (!courseAttMap.has(r.course_code)) courseAttMap.set(r.course_code, []);
      courseAttMap.get(r.course_code).push(r);
    }

    let atRiskCount = 0;
    for (const [code, records] of courseAttMap.entries()) {
      const stats = calculateAttendanceMetrics(records);
      if (stats.isAtRisk) atRiskCount++;
    }

    // 3. Registered Courses
    let [registeredCourses] = await db.query(`
      SELECT e.*, c.title, c.credit_hours, c.lecture_hours, c.lab_hours
      FROM enrollments e
      JOIN courses c ON e.course_code = c.code
      WHERE e.student_id = ? AND e.semester_number = ?
    `, [studentId, student.current_semester]);

    if (!registeredCourses || registeredCourses.length === 0) {
      const [anyEnrollments] = await db.query(`
        SELECT e.*, c.title, c.credit_hours, c.lecture_hours, c.lab_hours
        FROM enrollments e
        JOIN courses c ON e.course_code = c.code
        WHERE e.student_id = ?
        ORDER BY e.semester_number DESC
      `, [studentId]);
      if (anyEnrollments.length > 0) {
        registeredCourses = anyEnrollments;
      } else {
        const [defaultCourses] = await db.query(`
          SELECT code as course_code, title, credit_hours, lecture_hours, lab_hours, department, prerequisite
          FROM courses
          LIMIT 5
        `);
        registeredCourses = defaultCourses;
      }
    }

    // 4. Timetable for Today
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];

    const [todayClasses] = await db.query(`
      SELECT * FROM timetable
      WHERE program_code = ? AND semester_number = ? AND day_of_week = ?
      ORDER BY start_time ASC
    `, [student.program_code, student.current_semester, currentDay]);

    // 5. Degree Audit calculations
    const totalRequiredCH = student.total_ch_required || 130;
    const earnedCH = overallStats.earnedCH || 0;
    const remainingCH = Math.max(0, totalRequiredCH - earnedCH);
    const degreeProgressPct = Math.round((earnedCH / totalRequiredCH) * 100);

    return res.json({
      success: true,
      student: {
        ...student,
        current_class: `${student.program_code} - Semester ${student.current_semester}`,
        cgpa: overallStats.cgpa,
        earned_ch: earnedCH,
        overall_percentage: overallStats.overallPercentage
      },
      tiles: {
        results: {
          myResults: {
            title: 'My Results',
            countText: `${semesterList.length} Semesters`,
            subText: `Latest SGPA: ${latestSem.sgpa.toFixed(2)} | CGPA: ${overallStats.cgpa.toFixed(2)}`,
            icon: 'award'
          },
          degreeAudit: {
            title: 'Degree Audit',
            countText: `${earnedCH} / ${totalRequiredCH} CH`,
            subText: `${degreeProgressPct}% Degree Completed (${remainingCH} CH Left)`,
            icon: 'check-circle'
          }
        },
        academics: {
          registeredCourses: {
            title: 'Registered Courses',
            countText: `${registeredCourses.length} Courses`,
            subText: `Semester ${student.current_semester} Registered Load`,
            icon: 'book-open'
          },
          timetable: {
            title: 'My Timetable',
            countText: `${todayClasses.length} Classes Today`,
            subText: todayClasses.length > 0 ? `Next: ${todayClasses[0].course_code} at ${todayClasses[0].start_time.slice(0, 5)}` : 'No more lectures today',
            icon: 'calendar'
          },
          personalDetails: {
            title: 'My Personal Details',
            countText: 'Active Student',
            subText: `${student.program_code} | Batch ${student.batch}`,
            icon: 'user'
          }
        },
        administration: {
          attendance: {
            title: 'Attendance Report',
            countText: `${overallAtt.percentage}% Overall`,
            subText: atRiskCount > 0 ? `Warning: ${atRiskCount} Course(s) Below 75%` : 'All Courses Above 75% Threshold',
            isWarning: atRiskCount > 0 || overallAtt.isAtRisk,
            icon: 'clock'
          },
          transcript: {
            title: 'Interim Transcript',
            countText: 'Verified Record',
            subText: 'Official Printable Transcript PDF',
            icon: 'file-text'
          },
          admitCard: {
            title: 'Admit Card',
            countText: 'Exam Hall Pass',
            subText: 'Spring 2024 End-Semester Slip',
            icon: 'credit-card'
          }
        },
        ai: {
          assistant: {
            title: 'AI Study Assistant',
            countText: 'Online 24/7',
            subText: 'Ask about grades, attendance & study advice',
            icon: 'message-square'
          },
          insights: {
            title: 'AI Performance Insights',
            countText: overallStats.cgpa >= 3.65 ? "Dean's List" : (overallStats.cgpa < 2.0 ? 'At Risk' : 'Good Standing'),
            subText: 'Personalized GPA trends & study suggestions',
            icon: 'trending-up'
          },
          simulator: {
            title: 'What-If Simulator',
            countText: 'CGPA Predictor',
            subText: 'Simulate grades for upcoming final exams',
            icon: 'sliders'
          }
        }
      }
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching dashboard data:', err);
    return res.status(500).json({ success: false, error: 'Failed to load student dashboard.' });
  }
}

/**
 * 1. My Results Module
 */
async function getMyResults(req, res) {
  try {
    const student = req.session.student;
    const studentId = student.id;
    const { semesterList, overallStats } = await getStudentAcademicHistory(studentId);

    // Extract batch year
    const match = String(student.batch || '').match(/\b(20\d\d)\b/);
    const startYear = match ? parseInt(match[1], 10) : 2024;

    // Attach academic year and session term to each semester
    const enrichedSemesters = semesterList.map(s => {
      const sem = parseInt(s.semester_number, 10) || 1;
      let yr = startYear;
      let term = 'Fall';
      if (sem === 1) { yr = startYear; term = 'Fall'; }
      else if (sem === 2) { yr = startYear + 1; term = 'Spring'; }
      else if (sem === 3) { yr = startYear + 1; term = 'Fall'; }
      else if (sem === 4) { yr = startYear + 2; term = 'Spring'; }
      else if (sem === 5) { yr = startYear + 2; term = 'Fall'; }
      else if (sem === 6) { yr = startYear + 3; term = 'Spring'; }
      else if (sem === 7) { yr = startYear + 3; term = 'Fall'; }
      else if (sem === 8) { yr = startYear + 4; term = 'Spring'; }
      else {
        yr = startYear + Math.floor((sem - 1) / 2);
        term = sem % 2 === 1 ? 'Fall' : 'Spring';
      }
      return { ...s, academic_year: yr, term };
    });

    // Chart.js data for Semester SGPA bar chart
    const chartLabels = enrichedSemesters.map(s => `Sem ${s.semester_number} (${s.term} ${s.academic_year})`);
    const chartData = enrichedSemesters.map(s => s.sgpa);

    return res.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        registration_no: student.registration_no,
        batch: student.batch,
        batchYear: startYear,
        current_semester: student.current_semester
      },
      semesters: enrichedSemesters,
      overallStats,
      chart: {
        labels: chartLabels,
        data: chartData
      }
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching results:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve academic results.' });
  }
}

/**
 * 2. Attendance Report Module
 */
async function getAttendanceReport(req, res) {
  try {
    const studentId = req.session.student.id;

    // Fetch all attendance records with course details
    const [records] = await db.query(`
      SELECT a.*, c.title as course_title, c.credit_hours
      FROM attendance a
      JOIN courses c ON a.course_code = c.code
      WHERE a.student_id = ?
      ORDER BY a.lecture_date DESC
    `, [studentId]);

    // Group by course
    const courseMap = new Map();
    // Group by month
    const monthMap = new Map();

    for (const r of records) {
      // Course grouping
      if (!courseMap.has(r.course_code)) {
        courseMap.set(r.course_code, {
          course_code: r.course_code,
          course_title: r.course_title,
          credit_hours: r.credit_hours,
          records: []
        });
      }
      courseMap.get(r.course_code).records.push(r);

      // Month grouping (YYYY-MM)
      const dateStr = new Date(r.lecture_date).toISOString().split('T')[0];
      const monthKey = dateStr.slice(0, 7); // e.g. "2026-03"
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
      }
      monthMap.get(monthKey).push({ ...r, dateStr });
    }

    // Process per-course statistics
    const courseBreakdown = [];
    let totalPresent = 0;
    let totalConducted = 0;

    for (const [code, item] of courseMap.entries()) {
      const metrics = calculateAttendanceMetrics(item.records);
      const absenceStats = calculateAbsencesAllowed(metrics.present, metrics.total, 32);

      totalPresent += metrics.present;
      totalConducted += metrics.total;

      courseBreakdown.push({
        course_code: item.course_code,
        course_title: item.course_title,
        credit_hours: item.credit_hours,
        total: metrics.total,
        present: metrics.present,
        absent: metrics.absent,
        leave: metrics.leave,
        percentage: metrics.percentage,
        isAtRisk: metrics.isAtRisk,
        absencesAllowedNow: absenceStats.consecutiveAllowedNow,
        semesterAbsencesAllowed: absenceStats.totalRemainingInSemester
      });
    }

    // Monthly Chart Data
    const sortedMonths = Array.from(monthMap.keys()).sort();
    const monthLabels = [];
    const monthPercentages = [];

    for (const m of sortedMonths) {
      const monthRecs = monthMap.get(m);
      const mMetrics = calculateAttendanceMetrics(monthRecs);
      // Format label as "Mar 2026"
      const [year, month] = m.split('-');
      const d = new Date(year, parseInt(month, 10) - 1, 1);
      const monthName = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthLabels.push(monthName);
      monthPercentages.push(mMetrics.percentage);
    }

    const overallPct = totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 10000) / 100 : 100;

    return res.json({
      success: true,
      overall: {
        total: totalConducted,
        present: totalPresent,
        absent: totalConducted - totalPresent,
        percentage: overallPct,
        isAtRisk: overallPct < (universityConfig.minimumAttendance || 75),
        minimumAttendanceRequired: universityConfig.minimumAttendance || 75
      },
      courses: courseBreakdown,
      monthlyChart: {
        labels: monthLabels,
        data: monthPercentages
      },
      calendarRecords: records.map(r => ({
        id: r.id,
        course_code: r.course_code,
        course_title: r.course_title,
        date: new Date(r.lecture_date).toISOString().split('T')[0],
        status: r.status,
        remarks: r.remarks
      }))
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching attendance:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve attendance report.' });
  }
}

/**
 * 3. Interim Transcript Module
 */
async function getInterimTranscript(req, res) {
  try {
    const student = req.session.student;
    const { semesterList, overallStats } = await getStudentAcademicHistory(student.id);

    return res.json({
      success: true,
      university: {
        name: universityConfig.name,
        shortName: universityConfig.shortName,
        city: universityConfig.city,
        address: universityConfig.address,
        phone: universityConfig.phone,
        email: universityConfig.email,
        website: universityConfig.website
      },
      student,
      semesters: semesterList,
      overallStats,
      gradingScale: universityConfig.gradingScale
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching transcript:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate transcript data.' });
  }
}

/**
 * Download Transcript as PDF
 */
async function downloadTranscriptPDF(req, res) {
  try {
    const student = req.session.student;
    const { semesterList, overallStats } = await getStudentAcademicHistory(student.id);

    const pdfBuffer = await pdfService.generateInterimTranscriptPDF(student, semesterList, overallStats);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Interim_Transcript_${student.registration_no}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[Student Portal] PDF transcript error:', err);
    return res.status(500).send('Error generating transcript PDF.');
  }
}

/**
 * 4. Registered Courses Module
 */
async function getRegisteredCourses(req, res) {
  try {
    const student = req.session.student;
    let [courses] = await db.query(`
      SELECT e.*, c.title, c.credit_hours, c.lecture_hours, c.lab_hours, c.department, c.prerequisite
      FROM enrollments e
      JOIN courses c ON e.course_code = c.code
      WHERE e.student_id = ? AND e.semester_number = ?
    `, [student.id, student.current_semester]);

    if (!courses || courses.length === 0) {
      const [anyEnrollments] = await db.query(`
        SELECT e.*, c.title, c.credit_hours, c.lecture_hours, c.lab_hours, c.department, c.prerequisite
        FROM enrollments e
        JOIN courses c ON e.course_code = c.code
        WHERE e.student_id = ?
        ORDER BY e.semester_number DESC
      `, [student.id]);
      if (anyEnrollments.length > 0) {
        courses = anyEnrollments;
      } else {
        const [defaultCourses] = await db.query(`
          SELECT code as course_code, title, credit_hours, lecture_hours, lab_hours, department, prerequisite,
                 'Faculty Member' as teacher_name, 'A' as section, 'Registered' as status
          FROM courses
          LIMIT 5
        `);
        courses = defaultCourses;
      }
    }

    return res.json({
      success: true,
      currentSemester: student.current_semester,
      courses
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching registered courses:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve registered courses.' });
  }
}

/**
 * 5. My Timetable Module
 */
async function getMyTimetable(req, res) {
  try {
    const student = req.session.student;

    const [timetable] = await db.query(`
      SELECT * FROM timetable
      WHERE program_code = ? AND semester_number = ?
      ORDER BY 
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          ELSE 7
        END, start_time ASC
    `, [student.program_code, student.current_semester]);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];

    const todayEvents = timetable.filter(t => t.day_of_week === currentDay);

    return res.json({
      success: true,
      currentDay,
      todayEventsCount: todayEvents.length,
      todayEvents,
      weeklySchedule: timetable
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching timetable:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve timetable.' });
  }
}

/**
 * 6. Degree Audit Module
 */
async function getDegreeAudit(req, res) {
  try {
    const student = req.session.student;
    const { semesterList, overallStats } = await getStudentAcademicHistory(student.id);

    const totalRequiredCH = student.total_ch_required || 130;
    const earnedCH = overallStats.earnedCH || 0;
    const remainingCH = Math.max(0, totalRequiredCH - earnedCH);
    const progressPct = Math.round((earnedCH / totalRequiredCH) * 100);

    // List completed courses
    const completedCourses = [];
    for (const sem of semesterList) {
      for (const c of sem.courses) {
        if (c.isPassed) {
          completedCourses.push({
            code: c.courseCode,
            title: c.title,
            creditHours: c.creditHours,
            grade: c.grade,
            semester: sem.semester_number
          });
        }
      }
    }

    // Pending courses from university catalog for this program
    const [allProgramCourses] = await db.query('SELECT * FROM courses ORDER BY code ASC');
    const completedCodes = new Set(completedCourses.map(c => c.code.toUpperCase()));
    const pendingCourses = allProgramCourses.filter(c => !completedCodes.has(c.code.toUpperCase()));

    return res.json({
      success: true,
      audit: {
        totalRequiredCH,
        earnedCH,
        remainingCH,
        progressPct,
        currentCGPA: overallStats.cgpa,
        minimumGraduationCGPA: 2.00,
        completedCourses,
        pendingCourses
      }
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching degree audit:', err);
    return res.status(500).json({ success: false, error: 'Failed to calculate degree audit.' });
  }
}

/**
 * 7. Personal Details Module
 */
async function getPersonalDetails(req, res) {
  try {
    const studentId = req.session.student.id;
    const [rows] = await db.query(`
      SELECT s.*, p.name as program_name, p.faculty, p.department
      FROM students s
      JOIN programs p ON s.program_code = p.code
      WHERE s.id = ?
    `, [studentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Student record not found.' });
    }

    const s = rows[0];
    return res.json({
      success: true,
      profile: {
        registration_no: s.registration_no,
        name: s.name,
        father_name: s.father_name,
        email: s.email,
        phone: s.phone,
        father_phone: s.father_phone,
        program_code: s.program_code,
        program_name: s.program_name,
        faculty: s.faculty,
        department: s.department,
        batch: s.batch,
        current_semester: s.current_semester,
        status: s.status,
        dob: s.dob ? new Date(s.dob).toISOString().split('T')[0] : 'N/A',
        address: s.address || 'N/A'
      }
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching profile:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve student profile.' });
  }
}

/**
 * 8. Admit Card Module
 */
async function getAdmitCard(req, res) {
  try {
    const student = req.session.student;

    const [schedule] = await db.query(`
      SELECT es.*, c.title as course_title, c.credit_hours
      FROM exam_schedule es
      JOIN courses c ON es.course_code = c.code
      WHERE es.program_code = ? AND es.semester_number = ?
      ORDER BY es.exam_date ASC, es.start_time ASC
    `, [student.program_code, student.current_semester]);

    return res.json({
      success: true,
      student,
      examSchedule: schedule,
      examCenter: 'Main Academic Block, Sheikhupura Campus'
    });
  } catch (err) {
    console.error('[Student Portal] Error fetching admit card:', err);
    return res.status(500).json({ success: false, error: 'Failed to load admit card details.' });
  }
}

/**
 * Download Admit Card as PDF
 */
async function downloadAdmitCardPDF(req, res) {
  try {
    const student = req.session.student;

    const [schedule] = await db.query(`
      SELECT es.*, c.title as course_title, c.credit_hours
      FROM exam_schedule es
      JOIN courses c ON es.course_code = c.code
      WHERE es.program_code = ? AND es.semester_number = ?
      ORDER BY es.exam_date ASC, es.start_time ASC
    `, [student.program_code, student.current_semester]);

    const pdfBuffer = await pdfService.generateAdmitCardPDF(student, [], schedule);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Admit_Card_${student.registration_no}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[Student Portal] Error generating admit card PDF:', err);
    return res.status(500).send('Error generating admit card PDF.');
  }
}

module.exports = {
  getStudentAcademicHistory,
  getDashboardData,
  getMyResults,
  getAttendanceReport,
  getInterimTranscript,
  downloadTranscriptPDF,
  getRegisteredCourses,
  getMyTimetable,
  getDegreeAudit,
  getPersonalDetails,
  getAdmitCard,
  downloadAdmitCardPDF
};

