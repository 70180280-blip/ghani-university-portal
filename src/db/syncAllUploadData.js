/**
 * High-Speed Master Upload Data Ingestion & Synchronization Script
 * 
 * Strictly identifies every student by Registration Number (NEVER by name).
 * Ingests all data across all 5 batches (2022, 2023, 2024, 2025, 2026) from
 * Excel files into MySQL using fast bulk-batch queries:
 * 1. students (Student Registry)
 * 2. semesters (Semester Academic Summary)
 * 3. results (Detailed Course Marks & Component Breakdown)
 * 4. enrollments (Current Registered Load)
 * 5. attendance (Lecture Attendance Audit)
 * 6. timetable (Lecture Schedule)
 * 7. exam_schedule (Admit Card & Exam Schedule)
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pool = require('./pool');

async function bulkInsert(table, columns, rows, chunkSize = 150) {
  if (!rows || rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const values = chunk.flat();
    await pool.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`, values);
  }
  return rows.length;
}

async function bulkUpsertSemesters(rows, chunkSize = 100) {
  if (!rows || rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(', ');
    const values = chunk.flat();
    await pool.query(`
      INSERT INTO semesters (student_id, semester_number, academic_year, term, sgpa, earned_ch, total_ch, total_obtained, total_max, percentage)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        academic_year = VALUES(academic_year),
        term = VALUES(term),
        sgpa = VALUES(sgpa),
        earned_ch = VALUES(earned_ch),
        total_ch = VALUES(total_ch)
    `, values);
  }
  return rows.length;
}

async function syncAllUploadData() {
  console.log('========================================================');
  console.log('🔄 Starting High-Speed Data Sync from Upload Files');
  console.log('   Strict Identifier: Registration Number');
  console.log('========================================================\n');

  // Ensure default BSCS program exists
  await pool.query(`
    INSERT INTO programs (code, name, degree_title, total_credit_hours, total_semesters, department, faculty)
    VALUES ('BSCS', 'BS Computer Science', 'Bachelor of Science in Computer Science', 130, 8, 'Department of Computer Science', 'Faculty of Information Technology')
    ON DUPLICATE KEY UPDATE name=VALUES(name)
  `);

  const batchYears = [2022, 2023, 2024, 2025, 2026];
  const studentIdMap = new Map(); // normalized regNo -> student_id

  // --------------------------------------------------------------------------
  // STEP 1: INGEST / UPSERT STUDENTS (Strictly by Registration Number)
  // --------------------------------------------------------------------------
  console.log('--- STEP 1: Syncing Students Registry ---');
  for (const yr of batchYears) {
    const filePath = path.join(__dirname, '../../data', `GTIU_${yr}_Academic_Details.xlsx`);
    if (!fs.existsSync(filePath)) continue;

    const wb = XLSX.readFile(filePath);
    const profileSheet = wb.Sheets['Student_Profile'];
    if (!profileSheet) continue;

    const rows = XLSX.utils.sheet_to_json(profileSheet);
    for (const r of rows) {
      const rawReg = r['Registration Number'] || r['Registration No'];
      if (!rawReg) continue;
      const regNo = String(rawReg).trim().toUpperCase().replace(/\s+/g, ' ');
      const name = String(r['Student Name'] || r.name || '').trim().replace(/\s+/g, ' ');
      const fatherName = String(r['Father Name'] || r.father_name || '').trim().replace(/\s+/g, ' ');
      const phone = String(r['Student Contact Number'] || r.phone || '').trim();
      const fatherPhone = String(r['Father Contact Number'] || r.father_phone || '').trim();
      const email = String(r['Email (Test)'] || r.email || `${regNo.toLowerCase().replace(/[^a-z0-9]/g, '.')}@gtiu.edu.pk`).trim();
      const dobStr = r['Date of Birth (Test)'] || r.dob || null;
      const dob = dobStr ? new Date(dobStr).toISOString().split('T')[0] : null;
      const programCode = 'BSCS';
      const batchStr = String(r['Batch'] || yr).trim();
      const currentSem = parseInt(r['Current Semester'] || (yr === 2022 ? 8 : yr === 2023 ? 6 : yr === 2024 ? 4 : yr === 2025 ? 2 : 1), 10);
      const status = String(r['Student Status'] || r.status || 'Active').trim();

      await pool.query(`
        INSERT INTO students (registration_no, name, father_name, email, phone, father_phone, program_code, batch, current_semester, status, dob)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          father_name = VALUES(father_name),
          email = VALUES(email),
          phone = VALUES(phone),
          father_phone = VALUES(father_phone),
          program_code = VALUES(program_code),
          batch = VALUES(batch),
          current_semester = VALUES(current_semester),
          status = VALUES(status),
          dob = VALUES(dob)
      `, [regNo, name, fatherName, email, phone, fatherPhone, programCode, batchStr, currentSem, status, dob]);
    }

    // Also check if dedicated Batch_Students.xlsx exists to apply official batch registry records
    const batchFilePath = path.join(__dirname, '../../data', `GTIU_${yr}_Batch_Students.xlsx`);
    if (fs.existsSync(batchFilePath)) {
      const bWb = XLSX.readFile(batchFilePath);
      const bSheet = bWb.Sheets[bWb.SheetNames[0]];
      if (bSheet) {
        const bRows = XLSX.utils.sheet_to_json(bSheet);
        for (const r of bRows) {
          const rawReg = r['Registration Number'] || r['Registration No'];
          if (!rawReg) continue;
          const regNo = String(rawReg).trim().toUpperCase().replace(/\s+/g, ' ');
          const name = String(r['Student Name'] || r.name || '').trim().replace(/\s+/g, ' ');
          const fatherName = String(r['Father Name'] || r.father_name || '').trim().replace(/\s+/g, ' ');
          const phone = String(r['Student Contact Number'] || r.phone || '').trim();
          const fatherPhone = String(r['Father Contact Number'] || r.father_phone || '').trim();

          await pool.query(`
            UPDATE students
            SET name = ?, father_name = ?, phone = COALESCE(NULLIF(?, ''), phone), father_phone = COALESCE(NULLIF(?, ''), father_phone)
            WHERE registration_no = ?
          `, [name, fatherName, phone, fatherPhone, regNo]);
        }
      }
    }
  }

  // Populate studentIdMap from DB
  const [allStudents] = await pool.query('SELECT id, registration_no, name FROM students');
  for (const s of allStudents) {
    studentIdMap.set(s.registration_no.trim().toUpperCase(), s.id);
  }
  console.log(`✓ Synchronized ${allStudents.length} students in database.\n`);

  // --------------------------------------------------------------------------
  // STEP 2: INGEST SEMESTERS (Semester_Results)
  // --------------------------------------------------------------------------
  console.log('--- STEP 2: Syncing Semester Summaries ---');
  const semesterRows = [];

  for (const yr of batchYears) {
    const filePath = path.join(__dirname, '../../data', `GTIU_${yr}_Academic_Details.xlsx`);
    if (!fs.existsSync(filePath)) continue;

    const wb = XLSX.readFile(filePath);
    const semSheet = wb.Sheets['Semester_Results'];
    if (!semSheet) continue;

    const rows = XLSX.utils.sheet_to_json(semSheet);
    for (const r of rows) {
      const rawReg = r['Registration Number'] || r['Registration No'];
      if (!rawReg) continue;
      const regNo = String(rawReg).trim().toUpperCase().replace(/\s+/g, ' ');
      const studentId = studentIdMap.get(regNo);
      if (!studentId) continue;

      const semNum = parseInt(r['Semester'] || 1, 10);
      const sessionStr = String(r['Academic Session'] || '').trim();
      const parts = sessionStr.split(' ');
      let acadYear = parts[0] || String(yr);
      let term = parts[1] || (semNum % 2 === 1 ? 'Fall' : 'Spring');

      const sgpa = parseFloat(r['SGPA'] || 0.00);
      const earnedCH = parseInt(r['Earned CH'] || 0, 10);
      const regCH = parseInt(r['Registered CH'] || earnedCH || 15, 10);

      semesterRows.push([studentId, semNum, acadYear, term, sgpa, earnedCH, regCH, 0, 0, 0]);
    }
  }

  await bulkUpsertSemesters(semesterRows);
  console.log(`✓ Synchronized ${semesterRows.length} semester records.\n`);

  // --------------------------------------------------------------------------
  // STEP 3: INGEST DETAILED RESULTS (Interim_Transcript)
  // --------------------------------------------------------------------------
  console.log('--- STEP 3: Syncing Course Results & Grades ---');
  const studentIds = Array.from(studentIdMap.values());
  if (studentIds.length > 0) {
    await pool.query('DELETE FROM results WHERE student_id IN (?)', [studentIds]);
  }

  const resultRows = [];
  for (const yr of batchYears) {
    const filePath = path.join(__dirname, '../../data', `GTIU_${yr}_Academic_Details.xlsx`);
    if (!fs.existsSync(filePath)) continue;

    const wb = XLSX.readFile(filePath);
    const transSheet = wb.Sheets['Interim_Transcript'];
    if (!transSheet) continue;

    const rows = XLSX.utils.sheet_to_json(transSheet);
    for (const r of rows) {
      const rawReg = r['Registration Number'] || r['Registration No'];
      if (!rawReg) continue;
      const regNo = String(rawReg).trim().toUpperCase().replace(/\s+/g, ' ');
      const studentId = studentIdMap.get(regNo);
      if (!studentId) continue;

      const courseCode = String(r['Course Code'] || '').trim().toUpperCase();
      if (!courseCode) continue;

      const semNum = parseInt(r['Semester'] || 1, 10);
      const totalObtained = parseFloat(r['Marks'] || 0);
      const totalMax = 100.00;
      const pct = totalObtained;
      const grade = String(r['Grade'] || 'F').trim();
      const gradePoint = parseFloat(r['Grade Points'] || 0.00);
      const isPassed = (r['Result'] === 'Pass' || grade !== 'F') ? 1 : 0;

      const assign = Math.round(totalObtained * 0.15);
      const quiz = Math.round(totalObtained * 0.15);
      const mid = Math.round(totalObtained * 0.20);
      const finalMarks = Number((totalObtained - (assign + quiz + mid)).toFixed(2));

      resultRows.push([studentId, courseCode, semNum, assign, quiz, mid, finalMarks, totalObtained, totalMax, pct, grade, gradePoint, isPassed]);
    }
  }

  await bulkInsert('results', [
    'student_id', 'course_code', 'semester_number', 'assignment_marks', 'quiz_marks', 'mid_marks',
    'final_marks', 'total_obtained', 'total_max', 'percentage', 'grade', 'grade_point', 'is_passed'
  ], resultRows);
  console.log(`✓ Synchronized ${resultRows.length} detailed course marks.\n`);

  // --------------------------------------------------------------------------
  // STEP 4: INGEST ACTIVE REGISTERED COURSES (Registered_Courses)
  // --------------------------------------------------------------------------
  console.log('--- STEP 4: Syncing Active Registered Courses Load ---');
  if (studentIds.length > 0) {
    await pool.query('DELETE FROM enrollments WHERE student_id IN (?)', [studentIds]);
  }

  const enrollmentRows = [];
  for (const yr of batchYears) {
    const filePath = path.join(__dirname, '../../data', `GTIU_${yr}_Academic_Details.xlsx`);
    if (!fs.existsSync(filePath)) continue;

    const wb = XLSX.readFile(filePath);
    const regSheet = wb.Sheets['Registered_Courses'];
    if (!regSheet) continue;

    const rows = XLSX.utils.sheet_to_json(regSheet);
    for (const r of rows) {
      const rawReg = r['Registration Number'] || r['Registration No'];
      if (!rawReg) continue;
      const regNo = String(rawReg).trim().toUpperCase().replace(/\s+/g, ' ');
      const studentId = studentIdMap.get(regNo);
      if (!studentId) continue;

      const courseCode = String(r['Course Code'] || '').trim().toUpperCase();
      if (!courseCode) continue;

      const semNum = parseInt(r['Semester'] || 1, 10);
      const teacher = String(r['Instructor'] || 'Faculty Member').trim();
      const section = String(r['Section'] || 'A').trim();
      const status = String(r['Course Status'] || 'Registered').trim();
      const acadYear = '2026';
      const term = 'Spring';

      enrollmentRows.push([studentId, courseCode, semNum, teacher, section, acadYear, term, status]);
    }
  }

  await bulkInsert('enrollments', [
    'student_id', 'course_code', 'semester_number', 'teacher_name', 'section', 'academic_year', 'term', 'status'
  ], enrollmentRows);
  console.log(`✓ Synchronized ${enrollmentRows.length} active course enrollments.\n`);

  // --------------------------------------------------------------------------
  // STEP 5: INGEST ATTENDANCE (Attendance)
  // --------------------------------------------------------------------------
  console.log('--- STEP 5: Syncing Attendance Records ---');
  if (studentIds.length > 0) {
    await pool.query('DELETE FROM attendance WHERE student_id IN (?)', [studentIds]);
  }

  const attendanceRows = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 90);

  for (const yr of batchYears) {
    const filePath = path.join(__dirname, '../../data', `GTIU_${yr}_Academic_Details.xlsx`);
    if (!fs.existsSync(filePath)) continue;

    const wb = XLSX.readFile(filePath);
    const attSheet = wb.Sheets['Attendance'];
    if (!attSheet) continue;

    const rows = XLSX.utils.sheet_to_json(attSheet);
    for (const r of rows) {
      const rawReg = r['Registration Number'] || r['Registration No'];
      if (!rawReg) continue;
      const regNo = String(rawReg).trim().toUpperCase().replace(/\s+/g, ' ');
      const studentId = studentIdMap.get(regNo);
      if (!studentId) continue;

      const courseCode = String(r['Course Code'] || '').trim().toUpperCase();
      if (!courseCode) continue;

      const totalClasses = parseInt(r['Total Classes'] || 32, 10);
      const attendedClasses = parseInt(r['Attended Classes'] || Math.round(totalClasses * 0.85), 10);

      for (let i = 0; i < totalClasses; i++) {
        const lectureDate = new Date(baseDate);
        lectureDate.setDate(lectureDate.getDate() + (i * 2) + (courseCode.charCodeAt(2) % 3));
        const dateStr = lectureDate.toISOString().split('T')[0];
        const isPresent = i < attendedClasses;
        const status = isPresent ? 'present' : 'absent';
        const remarks = isPresent ? 'Regular Class' : 'Unexcused Absence';

        attendanceRows.push([studentId, courseCode, dateStr, status, remarks]);
      }
    }
  }

  await bulkInsert('attendance', [
    'student_id', 'course_code', 'lecture_date', 'status', 'remarks'
  ], attendanceRows, 250);
  console.log(`✓ Synchronized ${attendanceRows.length} attendance log entries.\n`);

  // --------------------------------------------------------------------------
  // STEP 6: INGEST TIMETABLE
  // --------------------------------------------------------------------------
  console.log('--- STEP 6: Syncing Timetable Schedule ---');
  await pool.query('DELETE FROM timetable');

  const seenTimetable = new Set();
  const timetableRows = [];

  for (const yr of batchYears) {
    const filePath = path.join(__dirname, '../../data', `GTIU_${yr}_Academic_Details.xlsx`);
    if (!fs.existsSync(filePath)) continue;

    const wb = XLSX.readFile(filePath);
    const ttSheet = wb.Sheets['Timetable'];
    if (!ttSheet) continue;

    const rows = XLSX.utils.sheet_to_json(ttSheet);
    for (const r of rows) {
      const courseCode = String(r['Course Code'] || '').trim().toUpperCase();
      const semNum = parseInt(r['Semester'] || 1, 10);
      const day = String(r['Day'] || 'Monday').trim();
      const timeStr = String(r['Time'] || '08:30-09:50').trim();
      const times = timeStr.split('-');
      const startTime = times[0] ? times[0].trim() + ':00' : '08:30:00';
      const endTime = times[1] ? times[1].trim() + ':00' : '09:50:00';
      const room = String(r['Room'] || 'LH-1').trim();
      const title = String(r['Course Title'] || 'Course Subject').trim();

      const key = `${semNum}-${day}-${startTime}-${courseCode}`;
      if (seenTimetable.has(key)) continue;
      seenTimetable.add(key);

      timetableRows.push(['BSCS', semNum, 'A', day, startTime, endTime, courseCode, title, 'Department Faculty', room]);
    }
  }

  await bulkInsert('timetable', [
    'program_code', 'semester_number', 'section', 'day_of_week', 'start_time', 'end_time', 'course_code', 'course_title', 'teacher_name', 'room'
  ], timetableRows);
  console.log(`✓ Synchronized ${timetableRows.length} timetable schedule slots.\n`);

  // --------------------------------------------------------------------------
  // STEP 7: INGEST EXAM SCHEDULE / ADMIT CARDS
  // --------------------------------------------------------------------------
  console.log('--- STEP 7: Syncing Exam Schedules ---');
  await pool.query('DELETE FROM exam_schedule');

  const seenExams = new Set();
  const examRows = [];

  for (const yr of batchYears) {
    const filePath = path.join(__dirname, '../../data', `GTIU_${yr}_Academic_Details.xlsx`);
    if (!fs.existsSync(filePath)) continue;

    const wb = XLSX.readFile(filePath);
    const acSheet = wb.Sheets['Admit_Card'];
    if (!acSheet) continue;

    const rows = XLSX.utils.sheet_to_json(acSheet);
    for (const r of rows) {
      const courseCode = String(r['Course Code'] || '').trim().toUpperCase();
      const semNum = parseInt(r['Semester'] || 1, 10);
      const examDateStr = r['Exam Date'] || '2026-12-10';
      const examDate = new Date(examDateStr).toISOString().split('T')[0];
      const room = String(r['Exam Venue'] || 'Examination Hall').trim();
      const title = String(r['Course Title'] || 'Course Subject').trim();

      const key = `${semNum}-${courseCode}`;
      if (seenExams.has(key)) continue;
      seenExams.add(key);

      examRows.push(['BSCS', semNum, courseCode, title, examDate, '09:00:00', '12:00:00', room, 'HALL-A']);
    }
  }

  await bulkInsert('exam_schedule', [
    'program_code', 'semester_number', 'course_code', 'course_title', 'exam_date', 'start_time', 'end_time', 'room', 'seat_no_prefix'
  ], examRows);
  console.log(`✓ Synchronized ${examRows.length} exam schedule records.\n`);

  console.log('========================================================');
  console.log('🎉 Full Database Synchronization Completed Successfully!');
  console.log('   All students and records matched strictly by Registration Number.');
  console.log('========================================================');
}

if (require.main === module) {
  syncAllUploadData().then(() => {
    console.log('[Script] Finished cleanly.');
    process.exit(0);
  }).catch(err => {
    console.error('[Script] Fatal sync error:', err);
    process.exit(1);
  });
}

module.exports = syncAllUploadData;
