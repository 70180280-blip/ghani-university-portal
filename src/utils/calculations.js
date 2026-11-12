/**
 * Ghani University Portal - Academic Calculation Engine
 * 
 * STRICT RULE: All calculations (GPA, CGPA, Percentages, Attendance, Projections)
 * are calculated purely in deterministic code, NEVER by AI.
 */

const universityConfig = require('../../config/university');

/**
 * Calculate subject percentage
 * @param {number} obtained 
 * @param {number} total 
 * @returns {number} percentage rounded to 2 decimal places
 */
function calculateSubjectPercentage(obtained, total) {
  if (!total || total <= 0) return 0;
  const pct = (Number(obtained) / Number(total)) * 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Get letter grade and grade points based on percentage
 * @param {number} percentage 
 * @returns {{ grade: string, gradePoint: number, description: string }}
 */
function getGradeAndPoints(percentage) {
  const pct = Number(percentage);
  const scale = universityConfig.gradingScale;
  
  for (const item of scale) {
    if (pct >= item.minMarks) {
      return {
        grade: item.grade,
        gradePoint: item.gradePoint,
        description: item.description
      };
    }
  }
  
  return { grade: 'F', gradePoint: 0.00, description: 'Fail' };
}

/**
 * Calculate SGPA, Earned Credit Hours, and Semester Marks for a single semester
 * @param {Array<{ courseCode: string, creditHours: number, gradePoint: number, marksObtained?: number, totalMarks?: number }>} courses 
 * @returns {{ sgpa: number, totalCH: number, earnedCH: number, totalObtained: number, totalMaxMarks: number, percentage: number }}
 */
function calculateSemesterGPA(courses = []) {
  if (!courses || courses.length === 0) {
    return { sgpa: 0, totalCH: 0, earnedCH: 0, totalObtained: 0, totalMaxMarks: 0, percentage: 0 };
  }

  let totalQualityPoints = 0;
  let totalCH = 0;
  let earnedCH = 0;
  let totalObtained = 0;
  let totalMaxMarks = 0;

  for (const c of courses) {
    const ch = Number(c.creditHours) || 0;
    const gp = Number(c.gradePoint) || 0;
    const obtained = Number(c.marksObtained) || 0;
    const maxMarks = Number(c.totalMarks) || 0;

    totalCH += ch;
    totalQualityPoints += (gp * ch);
    
    // Earned CH counts passed courses (gradePoint > 0.0, i.e., D or above)
    if (gp > 0) {
      earnedCH += ch;
    }

    totalObtained += obtained;
    totalMaxMarks += maxMarks;
  }

  const sgpa = totalCH > 0 ? Math.round((totalQualityPoints / totalCH) * 100) / 100 : 0;
  const percentage = totalMaxMarks > 0 ? Math.round((totalObtained / totalMaxMarks) * 10000) / 100 : 0;

  return {
    sgpa,
    totalCH,
    earnedCH,
    totalObtained,
    totalMaxMarks,
    percentage
  };
}

/**
 * Calculate CGPA across all semesters taking into account repeated courses
 * For repeated courses, the latest attempt replaces previous attempts in CGPA.
 * 
 * @param {Array<{ semesterNumber: number, courses: Array<{ courseCode: string, creditHours: number, gradePoint: number, marksObtained?: number, totalMarks?: number, semesterNumber?: number, attemptDate?: string|Date }> }>} semesterList 
 * @returns {{ cgpa: number, totalCH: number, earnedCH: number, totalObtained: number, totalMaxMarks: number, overallPercentage: number }}
 */
function calculateCumulativeGPA(semesterList = []) {
  if (!semesterList || semesterList.length === 0) {
    return { cgpa: 0, totalCH: 0, earnedCH: 0, totalObtained: 0, totalMaxMarks: 0, overallPercentage: 0 };
  }

  // Flatten all courses while preserving chronological order (by semesterNumber or explicit order)
  const allCourses = [];
  
  // Sort semesters in ascending order
  const sortedSemesters = [...semesterList].sort((a, b) => (Number(a.semesterNumber) || 0) - (Number(b.semesterNumber) || 0));

  for (const sem of sortedSemesters) {
    const semNum = Number(sem.semesterNumber) || 1;
    const courses = sem.courses || [];
    for (const c of courses) {
      allCourses.push({
        ...c,
        semesterNumber: semNum
      });
    }
  }

  // Handle repeated courses: map by courseCode and retain the latest attempt
  const latestCourseMap = new Map();
  for (const course of allCourses) {
    const code = (course.courseCode || course.code || '').trim().toUpperCase();
    if (!code) continue;
    // Overwrite with latest chronological entry
    latestCourseMap.set(code, course);
  }

  let totalQualityPoints = 0;
  let totalCH = 0;
  let earnedCH = 0;
  let totalObtained = 0;
  let totalMaxMarks = 0;

  for (const course of latestCourseMap.values()) {
    const ch = Number(course.creditHours) || 0;
    const gp = Number(course.gradePoint) || 0;
    const obtained = Number(course.marksObtained) || 0;
    const maxMarks = Number(course.totalMarks) || 0;

    totalCH += ch;
    totalQualityPoints += (gp * ch);

    if (gp > 0) {
      earnedCH += ch;
    }

    totalObtained += obtained;
    totalMaxMarks += maxMarks;
  }

  const cgpa = totalCH > 0 ? Math.round((totalQualityPoints / totalCH) * 100) / 100 : 0;
  const overallPercentage = totalMaxMarks > 0 ? Math.round((totalObtained / totalMaxMarks) * 10000) / 100 : 0;

  return {
    cgpa,
    totalCH,
    earnedCH,
    totalObtained,
    totalMaxMarks,
    overallPercentage
  };
}

/**
 * Calculate attendance metrics
 * @param {Array<{ status: 'present'|'absent'|'leave', date?: string, courseCode?: string }>} records 
 * @returns {{ total: number, present: number, absent: number, leave: number, percentage: number, isAtRisk: boolean }}
 */
function calculateAttendanceMetrics(records = []) {
  const total = records.length;
  if (total === 0) {
    return { total: 0, present: 0, absent: 0, leave: 0, percentage: 100, isAtRisk: false };
  }

  let present = 0;
  let absent = 0;
  let leave = 0;

  for (const r of records) {
    const s = (r.status || '').toLowerCase().trim();
    if (s === 'present' || s === 'p') {
      present++;
    } else if (s === 'absent' || s === 'a') {
      absent++;
    } else if (s === 'leave' || s === 'l') {
      leave++;
    }
  }

  // Attendance percentage = present / total classes * 100
  const percentage = Math.round((present / total) * 10000) / 100;
  const minAttendance = universityConfig.minimumAttendance || 75;
  const isAtRisk = percentage < minAttendance;

  return {
    total,
    present,
    absent,
    leave,
    percentage,
    isAtRisk
  };
}

/**
 * Calculate how many classes can still be missed before dropping below 75%
 * 
 * 1) consecutiveAbsencesAllowedNow:
 *    Formula: present / (conducted + x) >= 0.75 => conducted + x <= present / 0.75
 *    x <= floor(present / 0.75) - conducted
 * 
 * 2) semesterAbsencesAllowed:
 *    Based on total anticipated classes in a typical 3-credit course (32 lectures)
 * 
 * @param {number} present 
 * @param {number} totalConducted 
 * @param {number} totalExpectedInSemester 
 * @returns {{ consecutiveAllowedNow: number, totalRemainingInSemester: number, minAttendancePct: number, currentPct: number, isBelowThreshold: boolean }}
 */
function calculateAbsencesAllowed(present, totalConducted, totalExpectedInSemester = 32) {
  present = Number(present) || 0;
  totalConducted = Number(totalConducted) || 0;
  totalExpectedInSemester = Math.max(totalExpectedInSemester, totalConducted);
  
  const minAttendancePct = universityConfig.minimumAttendance || 75;
  const thresholdFraction = minAttendancePct / 100; // 0.75

  const currentPct = totalConducted > 0 
    ? Math.round((present / totalConducted) * 10000) / 100 
    : 100;

  // CRITICAL LOGIC FIX (Ghalti No. 7): If current attendance is below minimum 75%,
  // student CANNOT safely miss ANY classes! Safe leaves MUST be 0.
  if (currentPct < minAttendancePct) {
    return {
      currentPct,
      minAttendancePct,
      isBelowThreshold: true,
      consecutiveAllowedNow: 0,
      totalRemainingInSemester: 0,
      statusMsg: "CRITICAL WARNING: Attendance below 75%. You CANNOT miss any classes!"
    };
  }

  // Max absences allowed consecutively right now without dropping below 75%
  let consecutiveAllowedNow = 0;
  if (totalConducted > 0) {
    const maxConductedForCurrentPresent = Math.floor(present / thresholdFraction);
    consecutiveAllowedNow = Math.max(0, maxConductedForCurrentPresent - totalConducted);
  } else {
    consecutiveAllowedNow = 0;
  }

  // Total absences allowed across entire semester:
  // Must have present >= ceil(totalExpectedInSemester * 0.75)
  // Max total semester absences = totalExpectedInSemester - ceil(totalExpectedInSemester * 0.75)
  const minPresentsRequiredSemester = Math.ceil(totalExpectedInSemester * thresholdFraction);
  const maxSemesterAbsencesAllowed = totalExpectedInSemester - minPresentsRequiredSemester;
  const currentAbsences = totalConducted - present;
  const totalRemainingInSemester = Math.max(0, maxSemesterAbsencesAllowed - currentAbsences);

  return {
    currentPct,
    minAttendancePct,
    isBelowThreshold: currentPct < minAttendancePct,
    consecutiveAllowedNow,
    totalRemainingInSemester
  };
}

/**
 * Calculate marks needed in final exam to achieve a target letter grade
 * 
 * @param {number} currentObtained - Marks obtained so far (Assignment + Quiz + Midterm)
 * @param {number} currentMax - Total marks possible so far (e.g. 50)
 * @param {number} finalMax - Max marks of the final exam (e.g. 50)
 * @param {string} targetGrade - Letter grade, e.g. 'A', 'B+', 'B'
 * @returns {{ targetGrade: string, targetMinMarks: number, marksNeeded: number, isAchievable: boolean, isAlreadyAchieved: boolean, finalMax: number }}
 */
function calculateFinalMarksNeeded(currentObtained, currentMax, finalMax, targetGrade = 'A') {
  currentObtained = Number(currentObtained) || 0;
  currentMax = Number(currentMax) || 0;
  finalMax = Number(finalMax) || 0;
  const totalCourseMax = currentMax + finalMax;

  const targetGradeObj = universityConfig.gradingScale.find(
    g => g.grade.toUpperCase() === targetGrade.toUpperCase()
  );

  if (!targetGradeObj) {
    throw new Error(`Invalid target grade: ${targetGrade}`);
  }

  // Required marks overall = targetMinMarks% of totalCourseMax
  const targetRequiredMarks = (targetGradeObj.minMarks / 100) * totalCourseMax;
  const marksNeeded = Math.round((targetRequiredMarks - currentObtained) * 100) / 100;

  if (marksNeeded <= 0) {
    return {
      targetGrade: targetGradeObj.grade,
      targetMinMarks: targetGradeObj.minMarks,
      marksNeeded: 0,
      isAchievable: true,
      isAlreadyAchieved: true,
      finalMax
    };
  }

  if (marksNeeded > finalMax) {
    return {
      targetGrade: targetGradeObj.grade,
      targetMinMarks: targetGradeObj.minMarks,
      marksNeeded,
      isAchievable: false,
      isAlreadyAchieved: false,
      finalMax
    };
  }

  return {
    targetGrade: targetGradeObj.grade,
    targetMinMarks: targetGradeObj.minMarks,
    marksNeeded,
    isAchievable: true,
    isAlreadyAchieved: false,
    finalMax
  };
}

/**
 * What-If Simulation Calculator
 * Project new SGPA and CGPA given historical semesters and simulated future/current courses
 * 
 * @param {Array} historicalSemesters 
 * @param {Array<{ courseCode: string, creditHours: number, simulatedGrade: string }>} simulatedCourses 
 * @returns {{ simulatedSGPA: number, projectedCGPA: number, previousCGPA: number, totalCH: number, earnedCH: number }}
 */
function simulateAcademicPerformance(historicalSemesters = [], simulatedCourses = []) {
  const previous = calculateCumulativeGPA(historicalSemesters);

  // Convert simulated courses with grades to course objects with gradePoint
  const simCoursesEvaluated = simulatedCourses.map(sc => {
    const scaleItem = universityConfig.gradingScale.find(
      g => g.grade.toUpperCase() === (sc.simulatedGrade || 'F').toUpperCase()
    );
    const gp = scaleItem ? scaleItem.gradePoint : 0;
    return {
      courseCode: sc.courseCode,
      creditHours: Number(sc.creditHours) || 3,
      gradePoint: gp,
      isPassed: gp > 0
    };
  });

  const simSemesterResult = calculateSemesterGPA(simCoursesEvaluated);

  // New simulated semester added to historical list
  const nextSemNumber = (historicalSemesters.length || 0) + 1;
  const extendedSemesters = [
    ...historicalSemesters,
    {
      semesterNumber: nextSemNumber,
      courses: simCoursesEvaluated
    }
  ];

  const projected = calculateCumulativeGPA(extendedSemesters);

  return {
    simulatedSGPA: simSemesterResult.sgpa,
    previousCGPA: previous.cgpa,
    projectedCGPA: projected.cgpa,
    cgpaDifference: Math.round((projected.cgpa - previous.cgpa) * 100) / 100,
    totalCH: projected.totalCH,
    earnedCH: projected.earnedCH
  };
}

/**
 * Normalize Registration Number
 * Trims, converts to uppercase, and collapses repeated whitespace
 * @param {string} regNo
 * @returns {string}
 */
function normalizeRegNo(regNo) {
  if (!regNo) return '';
  return String(regNo).trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Normalize Student / Father Name
 * Trims, converts to lowercase, and collapses repeated whitespace
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

module.exports = {
  calculateSubjectPercentage,
  getGradeAndPoints,
  calculateSemesterGPA,
  calculateCumulativeGPA,
  calculateAttendanceMetrics,
  calculateAbsencesAllowed,
  calculateFinalMarksNeeded,
  simulateAcademicPerformance,
  normalizeRegNo,
  normalizeName
};

