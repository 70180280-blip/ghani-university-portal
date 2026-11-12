/**
 * Admin Portal Controller
 * 
 * Implements:
 * - Dashboard stats & live counts
 * - AI File Ingestion (PDF, Excel, PPTX) with prompt injection defense
 * - Preview, validation, flag impossible values & confirmation
 * - Manual inline editing of students, marks, and attendance
 * - Delete upload & rollback
 * - Export students, results, attendance to Excel
 * - AI Admin Search (Safe parameterized queries)
 * - AI At-Risk Student Report
 * - Audit logging
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const db = require('../db/pool');
const { parseUploadedFile } = require('../services/fileParserService');
const aiService = require('../services/aiService');
const { logAdminAction } = require('../middleware/security');
const {
  calculateSubjectPercentage,
  getGradeAndPoints,
  calculateAttendanceMetrics,
  calculateSemesterGPA,
  calculateCumulativeGPA,
  normalizeRegNo,
  normalizeName
} = require('../utils/calculations');

/**
 * 1. Admin Dashboard Stats
 */
async function getDashboardStats(req, res) {
  try {
    const [studentsCount] = await db.query('SELECT COUNT(*) as c FROM students');
    const [uploadsCount] = await db.query('SELECT COUNT(*) as c FROM uploads');
    const [coursesCount] = await db.query('SELECT COUNT(*) as c FROM courses');

    // Fast memory aggregation instead of 400+ remote DB roundtrips
    const [students] = await db.query('SELECT id FROM students');
    const [failedRows] = await db.query("SELECT DISTINCT student_id FROM results WHERE grade = 'F'");
    const failSet = new Set(failedRows.map(r => r.student_id));

    const [attRows] = await db.query("SELECT student_id, status FROM attendance");
    const attMap = new Map();
    for (const a of attRows) {
      if (!attMap.has(a.student_id)) attMap.set(a.student_id, { total: 0, present: 0 });
      const entry = attMap.get(a.student_id);
      entry.total++;
      if (a.status === 'present') entry.present++;
    }

    const [allResults] = await db.query("SELECT student_id, grade_point, total_obtained, total_max FROM results");
    const gpaMap = new Map();
    for (const r of allResults) {
      if (!gpaMap.has(r.student_id)) gpaMap.set(r.student_id, []);
      gpaMap.get(r.student_id).push({
        creditHours: 3,
        gradePoint: Number(r.grade_point),
        marksObtained: Number(r.total_obtained),
        totalMarks: Number(r.total_max)
      });
    }

    let atRiskCount = 0;
    for (const s of students) {
      if (failSet.has(s.id)) {
        atRiskCount++;
        continue;
      }
      const att = attMap.get(s.id);
      if (att && att.total > 0 && ((att.present / att.total) * 100) < 75) {
        atRiskCount++;
        continue;
      }
      const resCourses = gpaMap.get(s.id);
      if (resCourses && resCourses.length > 0) {
        const gpa = calculateSemesterGPA(resCourses);
        if (gpa.totalCH > 0 && gpa.sgpa < 2.0) {
          atRiskCount++;
        }
      }
    }

    // Recent Uploads
    const [recentUploads] = await db.query('SELECT * FROM uploads ORDER BY created_at DESC LIMIT 5');

    // Recent Audit Logs
    const [recentLogs] = await db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10');

    return res.json({
      success: true,
      counts: {
        students: studentsCount[0].c,
        uploads: uploadsCount[0].c,
        courses: coursesCount[0].c,
        atRiskStudents: atRiskCount
      },
      recentUploads,
      recentLogs
    });
  } catch (err) {
    console.error('[Admin Portal] Error loading stats:', err);
    return res.status(500).json({ success: false, error: 'Failed to load admin stats.' });
  }
}

/**
 * 2. Upload File and Generate AI Preview
 */
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { instruction } = req.body;
    const adminUser = req.session.admin?.username || 'admin';
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // 1. Extract raw text from file
    const parsedFile = await parseUploadedFile(filePath, originalName, mimeType);

    // 2. Fetch active students and courses for mapping
    const [students] = await db.query('SELECT id, registration_no, name, father_name FROM students');
    const [courses] = await db.query('SELECT code, title FROM courses');

    // 3. AI extraction & normalization
    const aiExtracted = await aiService.parseAdminUpload(parsedFile.text, instruction, students, courses);

    // 4. Validate records, detect impossible values, and flag anomalies
    const validatedRecords = (aiExtracted.records || []).map(r => {
      const flags = [...(r.flags || [])];
      let needsReview = false;

      // Total marks checks
      if (r.total_obtained > (r.total_max || 100)) {
        flags.push(`Impossible value: Obtained marks (${r.total_obtained}) exceed max marks (${r.total_max || 100})`);
      }
      if (r.total_obtained < 0 || r.mid_marks < 0 || r.final_marks < 0) {
        flags.push('Impossible value: Negative marks detected');
      }

      // Attendance checks
      if (r.attendance_present > r.attendance_held) {
        flags.push(`Impossible value: Present classes (${r.attendance_present}) exceed total held (${r.attendance_held})`);
      }

      // Student identity rule: Registration Number is the ONLY unique identifier
      const normReg = normalizeRegNo(r.registration_no);
      let matchedStudent = null;

      if (normReg) {
        // Strict match by registration number - NEVER merge by name when reg numbers differ
        matchedStudent = students.find(s => normalizeRegNo(s.registration_no) === normReg);
        if (!matchedStudent) {
          flags.push('Unmatched Student: Registration number not found in database. Student will be created upon confirmation.');
        }
      } else {
        // Row has NO registration number: match by name + father name ONLY when exactly one match
        const normSName = normalizeName(r.student_name || r.name);
        const normFName = normalizeName(r.father_name);

        const nameMatches = students.filter(s =>
          normalizeName(s.name) === normSName && normalizeName(s.father_name) === normFName
        );

        if (nameMatches.length === 1) {
          matchedStudent = nameMatches[0];
          r.registration_no = matchedStudent.registration_no;
        } else if (nameMatches.length === 0) {
          needsReview = true;
          flags.push('Needs Review: No registration number provided and no matching student found.');
        } else {
          needsReview = true;
          flags.push(`Needs Review: Ambiguous student - ${nameMatches.length} students share the name "${r.student_name || r.name}" and father name "${r.father_name}". Please choose or enter registration number.`);
        }
      }

      return {
        ...r,
        registration_no: normReg || r.registration_no || '',
        student_id: matchedStudent ? matchedStudent.id : null,
        flags,
        needsReview,
        hasErrors: flags.some(f => f.includes('Impossible'))
      };
    });

    // 4b. Detect students sharing same name & father name with differing registration numbers (Rule 5)
    const nameGroups = new Map();
    for (const r of validatedRecords) {
      const sName = normalizeName(r.student_name || r.name);
      const fName = normalizeName(r.father_name);
      if (!sName || !fName) continue;
      const key = `${sName}:::${fName}`;
      if (!nameGroups.has(key)) {
        nameGroups.set(key, new Set());
      }
      const reg = normalizeRegNo(r.registration_no);
      if (reg) {
        nameGroups.get(key).add(reg);
      }
    }

    let sharedCount = 0;
    for (const [key, regSet] of nameGroups.entries()) {
      if (regSet.size > 1) {
        sharedCount += regSet.size;
      }
    }

    const previewWarnings = [];
    if (sharedCount > 0) {
      previewWarnings.push(`${sharedCount} students share the same name and father name; they will be kept as separate students because their registration numbers differ.`);
    }

    // 5. Store upload record in DB with status 'preview'
    const [insRes] = await db.query(`
      INSERT INTO uploads (original_filename, stored_filename, file_type, instruction, detected_type, record_count, status, extracted_json, admin_username)
      VALUES (?, ?, ?, ?, ?, ?, 'preview', ?, ?)
    `, [
      originalName,
      req.file.filename,
      parsedFile.fileType,
      instruction || '',
      aiExtracted.detected_type || 'marks',
      validatedRecords.length,
      JSON.stringify({ ...aiExtracted, records: validatedRecords, warnings: previewWarnings }),
      adminUser
    ]);

    const uploadId = insRes.insertId;

    await logAdminAction(adminUser, 'UPLOAD_PREVIEW', 'uploads', uploadId, `Uploaded ${originalName} with ${validatedRecords.length} records parsed for preview`, req.ip);

    return res.json({
      success: true,
      uploadId,
      filename: originalName,
      fileType: parsedFile.fileType,
      detectedType: aiExtracted.detected_type || 'marks',
      summary: aiExtracted.summary,
      courseCode: aiExtracted.course_code,
      warnings: previewWarnings,
      records: validatedRecords
    });
  } catch (err) {
    console.error('[Admin Portal] Error in upload:', err);
    return res.status(500).json({ success: false, error: err.message || 'File processing failed.' });
  }
}

/**
 * 3. Confirm and Save Uploaded Preview Data
 */
async function confirmUpload(req, res) {
  try {
    const { uploadId, records, detectedType, courseCode, semesterNumber } = req.body;
    const adminUser = req.session.admin?.username || 'admin';

    const [uploads] = await db.query('SELECT * FROM uploads WHERE id = ?', [uploadId]);
    if (uploads.length === 0) {
      return res.status(404).json({ success: false, error: 'Upload batch not found.' });
    }

    const type = detectedType || uploads[0].detected_type || 'marks';
    const course = courseCode || 'CS401';
    const semNum = Number(semesterNumber) || 4;

    let savedCount = 0;
    const recordsList = Array.isArray(records) ? records : (records && Array.isArray(records.records) ? records.records : []);

    for (const r of recordsList) {
      let studentId = r.student_id;

      // 1. If upload is student list / enrollment
      if (type === 'students' || type === 'student_list') {
        let regNo = normalizeRegNo(r.registration_no);
        const sName = (r.student_name || r.name || '').trim();
        const fName = (r.father_name || '').trim();
        const phone = (r.phone || r.student_phone || '').trim();
        const fatherPhone = (r.father_phone || r.guardian_phone || '').trim();
        const prog = r.program_code || 'BSCS';
        const batch = r.batch || 'Fall 2024';
        const sem = Number(r.current_semester) || 1;

        if (!regNo) {
          const normS = normalizeName(sName);
          const normF = normalizeName(fName);
          const [matches] = await db.query(
            'SELECT registration_no FROM students WHERE LOWER(TRIM(name)) = ? AND LOWER(TRIM(father_name)) = ?',
            [normS, normF]
          );
          if (matches.length === 1) {
            regNo = matches[0].registration_no;
          } else {
            // Cannot auto-merge ambiguous student without registration number
            continue;
          }
        }

        const [existing] = await db.query('SELECT id FROM students WHERE UPPER(TRIM(registration_no)) = ?', [regNo]);
        if (existing.length > 0) {
          await db.query(`
            UPDATE students
            SET name = ?, father_name = ?, phone = ?, father_phone = ?, program_code = ?, batch = ?, current_semester = ?, updated_at = NOW()
            WHERE id = ?
          `, [sName, fName, phone, fatherPhone, prog, batch, sem, existing[0].id]);
        } else {
          await db.query(`
            INSERT INTO students (registration_no, name, father_name, phone, father_phone, program_code, batch, current_semester, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
          `, [regNo, sName, fName, phone, fatherPhone, prog, batch, sem]);
        }
        savedCount++;
        continue;
      }

      // 2. Create student if missing for marks/attendance
      if (!studentId) {
        let regNo = normalizeRegNo(r.registration_no);
        if (!regNo) {
          const normS = normalizeName(r.student_name || r.name);
          const normF = normalizeName(r.father_name);
          const [matches] = await db.query(
            'SELECT id, registration_no FROM students WHERE LOWER(TRIM(name)) = ? AND LOWER(TRIM(father_name)) = ?',
            [normS, normF]
          );
          if (matches.length === 1) {
            studentId = matches[0].id;
          }
        } else {
          const [existing] = await db.query('SELECT id FROM students WHERE UPPER(TRIM(registration_no)) = ?', [regNo]);
          if (existing.length > 0) {
            studentId = existing[0].id;
          } else {
            const [newStudent] = await db.query(`
              INSERT INTO students (registration_no, name, father_name, phone, father_phone, program_code, batch, current_semester, status)
              VALUES (?, ?, ?, ?, ?, 'BSCS', 'Fall 2024', ?, 'Active')
            `, [
              regNo,
              r.student_name || 'New Student',
              r.father_name || 'Guardian',
              r.phone || '',
              r.father_phone || '',
              semNum
            ]);
            studentId = newStudent.insertId;
          }
        }
      }

      // 3. Save according to detected type
      if (type === 'attendance') {
        const held = Number(r.attendance_held) || 28;
        const present = Number(r.attendance_present) || 0;

        // Insert or update attendance records
        // Insert a summary lecture or update
        await db.query(`
          INSERT INTO attendance (student_id, course_code, lecture_date, status, remarks, upload_id)
          VALUES (?, ?, CURDATE(), ?, ?, ?)
        `, [
          studentId,
          r.course_code || course,
          present >= held * 0.75 ? 'present' : 'absent',
          `Imported batch: ${present}/${held} sessions attended`,
          uploadId
        ]);
        savedCount++;
      } else {
        // Marks (Results)
        const totalMax = Number(r.total_max) || 100;
        const totalObt = Number(r.total_obtained) || 0;
        const percentage = calculateSubjectPercentage(totalObt, totalMax);
        const { grade, gradePoint } = getGradeAndPoints(percentage);
        const isPassed = gradePoint > 0 ? 1 : 0;

        await db.query(`
          INSERT INTO results (
            student_id, course_code, semester_number,
            assignment_marks, quiz_marks, mid_marks, final_marks,
            total_obtained, total_max, percentage, grade, grade_point, is_passed, upload_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            assignment_marks = VALUES(assignment_marks),
            quiz_marks = VALUES(quiz_marks),
            mid_marks = VALUES(mid_marks),
            final_marks = VALUES(final_marks),
            total_obtained = VALUES(total_obtained),
            percentage = VALUES(percentage),
            grade = VALUES(grade),
            grade_point = VALUES(grade_point),
            is_passed = VALUES(is_passed),
            upload_id = VALUES(upload_id)
        `.replace('ON DUPLICATE KEY UPDATE', '--'), [
          studentId,
          r.course_code || course,
          semNum,
          Number(r.assignment_marks) || 0,
          Number(r.quiz_marks) || 0,
          Number(r.mid_marks) || 0,
          Number(r.final_marks) || 0,
          totalObt,
          totalMax,
          percentage,
          grade,
          gradePoint,
          isPassed,
          uploadId
        ]);
        savedCount++;
      }
    }

    // Update upload status to 'confirmed'
    await db.query('UPDATE uploads SET status = ?, record_count = ? WHERE id = ?', ['confirmed', savedCount, uploadId]);

    await logAdminAction(adminUser, 'CONFIRM_UPLOAD', 'uploads', uploadId, `Confirmed upload #${uploadId}: ${savedCount} records committed to database`, req.ip);

    return res.json({
      success: true,
      savedCount,
      message: `Successfully confirmed and stored ${savedCount} records in the university database.`
    });
  } catch (err) {
    console.error('[Admin Portal] Error confirming upload:', err);
    return res.status(500).json({ success: false, error: 'Failed to confirm and commit data.' });
  }
}

/**
 * 4. Delete Upload and Rollback Stored Data
 */
async function deleteUpload(req, res) {
  try {
    const { id } = req.params;
    const adminUser = req.session.admin?.username || 'admin';

    // Remove results created by this upload
    await db.query('DELETE FROM results WHERE upload_id = ?', [id]);
    // Remove attendance created by this upload
    await db.query('DELETE FROM attendance WHERE upload_id = ?', [id]);

    // Update upload status
    await db.query('UPDATE uploads SET status = ? WHERE id = ?', ['deleted', id]);

    await logAdminAction(adminUser, 'DELETE_UPLOAD', 'uploads', id, `Deleted upload #${id} and purged associated result/attendance records`, req.ip);

    return res.json({ success: true, message: `Upload #${id} and its associated records have been removed.` });
  } catch (err) {
    console.error('[Admin Portal] Delete upload error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete upload.' });
  }
}

/**
 * 5. Get Upload History
 */
async function getUploadHistory(req, res) {
  try {
    const [uploads] = await db.query('SELECT * FROM uploads ORDER BY created_at DESC');
    return res.json({ success: true, uploads });
  } catch (err) {
    console.error('[Admin Portal] Error fetching upload history:', err);
    return res.status(500).json({ success: false, error: 'Failed to load upload history.' });
  }
}

/**
 * 6. Get All Students for Management & Editing
 */
async function getAllStudents(req, res) {
  try {
    const [students] = await db.query(`
      SELECT s.*, p.name as program_name
      FROM students s
      LEFT JOIN programs p ON s.program_code = p.code
      ORDER BY s.registration_no ASC
    `);
    return res.json({ success: true, students });
  } catch (err) {
    console.error('[Admin Portal] Error loading students:', err);
    return res.status(500).json({ success: false, error: 'Failed to load students.' });
  }
}

async function getAllCourses(req, res) {
  try {
    const [courses] = await db.query('SELECT * FROM courses ORDER BY code ASC');
    return res.json({ success: true, courses });
  } catch (err) {
    console.error('[Admin Portal] Error loading courses:', err);
    return res.status(500).json({ success: false, error: 'Failed to load courses.' });
  }
}

/**
 * 7. Manual Inline Edit: Student
 */
async function updateStudent(req, res) {
  try {
    const { id } = req.params;
    const { name, father_name, email, phone, father_phone, current_semester, status, address } = req.body;
    const adminUser = req.session.admin?.username || 'admin';

    await db.query(`
      UPDATE students
      SET name = ?, father_name = ?, email = ?, phone = ?, father_phone = ?, current_semester = ?, status = ?, address = ?
      WHERE id = ?
    `, [name, father_name, email, phone, father_phone || null, current_semester, status, address, id]);

    await logAdminAction(adminUser, 'UPDATE_STUDENT', 'students', id, `Updated student profile: ${name} (${id})`, req.ip);

    return res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update student.' });
  }
}

/**
 * 8. Manual Inline Edit: Result Record
 */
async function updateResult(req, res) {
  try {
    const { id } = req.params;
    const { assignment_marks, quiz_marks, mid_marks, final_marks } = req.body;
    const adminUser = req.session.admin?.username || 'admin';

    const assign = Number(assignment_marks) || 0;
    const quiz = Number(quiz_marks) || 0;
    const mid = Number(mid_marks) || 0;
    const finalExam = Number(final_marks) || 0;
    const totalObtained = assign + quiz + mid + finalExam;
    const totalMax = 100;

    const percentage = calculateSubjectPercentage(totalObtained, totalMax);
    const { grade, gradePoint } = getGradeAndPoints(percentage);
    const isPassed = gradePoint > 0 ? 1 : 0;

    await db.query(`
      UPDATE results
      SET assignment_marks = ?, quiz_marks = ?, mid_marks = ?, final_marks = ?,
          total_obtained = ?, percentage = ?, grade = ?, grade_point = ?, is_passed = ?
      WHERE id = ?
    `, [assign, quiz, mid, finalExam, totalObtained, percentage, grade, gradePoint, isPassed, id]);

    await logAdminAction(adminUser, 'UPDATE_RESULT', 'results', id, `Updated marks for result record #${id} to ${totalObtained} (${grade})`, req.ip);

    return res.json({
      success: true,
      message: 'Result updated and recalculated successfully.',
      result: { totalObtained, percentage, grade, gradePoint, isPassed }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update result.' });
  }
}

/**
 * 9. Export Data to Excel
 */
async function exportDataToExcel(req, res) {
  try {
    const { type } = req.query; // 'students', 'results', 'attendance'

    let data = [];
    let sheetName = 'Export';
    let filename = `GTIU_${type || 'Export'}_${Date.now()}.xlsx`;

    if (type === 'students') {
      sheetName = 'Students Registry';
      const [rows] = await db.query('SELECT registration_no, name, father_name, phone as student_contact, father_phone as father_contact, email, program_code, batch, current_semester, status FROM students');
      data = rows;
    } else if (type === 'results') {
      sheetName = 'Results';
      const [rows] = await db.query(`
        SELECT s.registration_no, s.name, r.course_code, r.semester_number,
               r.assignment_marks, r.quiz_marks, r.mid_marks, r.final_marks,
               r.total_obtained, r.total_max, r.percentage, r.grade, r.grade_point
        FROM results r
        JOIN students s ON r.student_id = s.id
        ORDER BY s.registration_no ASC, r.semester_number ASC
      `);
      data = rows;
    } else if (type === 'attendance') {
      sheetName = 'Attendance Summary';
      const [rows] = await db.query(`
        SELECT s.registration_no, s.name, a.course_code,
               COUNT(*) as total_classes,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
               ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 1) as attendance_pct
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        GROUP BY s.registration_no, s.name, a.course_code
      `);
      data = rows;
    } else {
      return res.status(400).send('Invalid export type specified.');
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[Admin Portal] Export error:', err);
    return res.status(500).send('Failed to export data to Excel.');
  }
}

/**
 * 10. Safe AI Admin Search (Parameterized Whitelist Queries)
 */
async function aiSearch(req, res) {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Please enter a search query.' });
    }

    // Convert query to safe parameterized SQL via AI service
    const translated = await aiService.translateAdminNaturalSearch(query.trim());

    // Execute the safe query
    const [rows] = await db.query(translated.sql, translated.params || []);

    return res.json({
      success: true,
      query: query.trim(),
      explanation: translated.explanation,
      rowCount: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[Admin Portal] AI Search error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process AI search.' });
  }
}

/**
 * 11. AI At-Risk Student Report
 */
async function getAtRiskReport(req, res) {
  try {
    const [students] = await db.query('SELECT * FROM students ORDER BY registration_no ASC');
    const flaggedList = [];

    // Batch query for fails
    const [failedRows] = await db.query("SELECT student_id, course_code FROM results WHERE grade = 'F'");
    const failMap = new Map();
    for (const f of failedRows) {
      if (!failMap.has(f.student_id)) failMap.set(f.student_id, []);
      failMap.get(f.student_id).push(f.course_code);
    }

    // Batch query for attendance
    const [attRows] = await db.query("SELECT student_id, status FROM attendance");
    const attMap = new Map();
    for (const a of attRows) {
      if (!attMap.has(a.student_id)) attMap.set(a.student_id, []);
      attMap.get(a.student_id).push(a);
    }

    // Batch query for results
    const [results] = await db.query("SELECT student_id, grade_point, total_obtained, total_max FROM results");
    const resMap = new Map();
    for (const r of results) {
      if (!resMap.has(r.student_id)) resMap.set(r.student_id, []);
      resMap.get(r.student_id).push({
        creditHours: 3,
        gradePoint: Number(r.grade_point),
        marksObtained: Number(r.total_obtained),
        totalMarks: Number(r.total_max)
      });
    }

    for (const s of students) {
      const failedCourses = failMap.get(s.id) || [];
      const studentAttRows = attMap.get(s.id) || [];
      const attMetrics = calculateAttendanceMetrics(studentAttRows);
      const studentCourses = resMap.get(s.id) || [];
      const gpaStats = calculateSemesterGPA(studentCourses);

      const hasLowCGPA = gpaStats.totalCH > 0 && gpaStats.sgpa < 2.0;
      const hasLowAttendance = attMetrics.total > 0 && attMetrics.isAtRisk;
      const hasFails = failedCourses.length > 0;

      if (hasLowCGPA || hasLowAttendance || hasFails) {
        flaggedList.push({
          student_id: s.id,
          registration_no: s.registration_no,
          name: s.name,
          father_name: s.father_name,
          program_code: s.program_code,
          cgpa: gpaStats.sgpa,
          attendance_pct: attMetrics.percentage,
          failed_courses: failedCourses,
          risk_factors: [
            ...(hasLowCGPA ? ['CGPA below 2.0 (Probation Risk)'] : []),
            ...(hasLowAttendance ? [`Attendance below 75% (${attMetrics.percentage}%)`] : []),
            ...(hasFails ? [`Failed courses: ${failedCourses.join(', ')}`] : [])
          ]
        });
      }
    }

    // Generate AI Summary of at-risk students for the Administration
    const aiSummary = await aiService.generateAtRiskSummary(flaggedList);

    return res.json({
      success: true,
      totalFlagged: flaggedList.length,
      students: flaggedList,
      aiSummary
    });
  } catch (err) {
    console.error('[Admin Portal] Error generating at-risk report:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate at-risk report.' });
  }
}

/**
 * 12. Audit Log Viewer
 */
async function getAuditLogs(req, res) {
  try {
    const [logs] = await db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50');
    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load audit logs.' });
  }
}

/**
 * 13. Delete Single Student and Cascaded Academic Records
 */
async function deleteStudent(req, res) {
  try {
    const { id } = req.params;
    const adminUser = req.session.admin?.username || 'admin';

    const [students] = await db.query('SELECT name, registration_no FROM students WHERE id = ?', [id]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const s = students[0];

    // Delete child records first
    await db.query('DELETE FROM results WHERE student_id = ?', [id]);
    await db.query('DELETE FROM attendance WHERE student_id = ?', [id]);
    await db.query('DELETE FROM enrollments WHERE student_id = ?', [id]);
    await db.query('DELETE FROM ai_cache WHERE student_id = ?', [id]);
    await db.query('DELETE FROM students WHERE id = ?', [id]);

    await logAdminAction(adminUser, 'DELETE_STUDENT', 'students', id, `Deleted student ${s.name} (${s.registration_no}) and all associated records`, req.ip);

    return res.json({ success: true, message: `Student ${s.name} (${s.registration_no}) deleted successfully.` });
  } catch (err) {
    console.error('[Admin Portal] Error deleting student:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete student.' });
  }
}

/**
 * 14. Delete All Students and Performance Data
 */
async function deleteAllStudents(req, res) {
  try {
    const adminUser = req.session.admin?.username || 'admin';

    await db.query('DELETE FROM results');
    await db.query('DELETE FROM attendance');
    await db.query('DELETE FROM enrollments');
    await db.query('DELETE FROM semesters');
    await db.query('DELETE FROM ai_cache');
    await db.query('DELETE FROM students');

    await logAdminAction(adminUser, 'DELETE_ALL_STUDENTS', 'students', null, 'Deleted all students and related records', req.ip);

    return res.json({ success: true, message: 'All student records have been permanently cleared.' });
  } catch (err) {
    console.error('[Admin Portal] Error deleting all students:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete all students.' });
  }
}

/**
 * 15. Category-wise or Full Database Purge
 */
async function clearDatabaseCategory(req, res) {
  try {
    const { category } = req.body;
    const adminUser = req.session.admin?.username || 'admin';

    if (category === 'students') {
      await db.query('DELETE FROM results');
      await db.query('DELETE FROM attendance');
      await db.query('DELETE FROM enrollments');
      await db.query('DELETE FROM semesters');
      await db.query('DELETE FROM ai_cache');
      await db.query('DELETE FROM students');
    } else if (category === 'uploads') {
      await db.query('DELETE FROM results WHERE upload_id IS NOT NULL');
      await db.query('DELETE FROM attendance WHERE upload_id IS NOT NULL');
      await db.query('DELETE FROM uploads');
    } else if (category === 'schedules') {
      await db.query('DELETE FROM timetable');
      await db.query('DELETE FROM exam_schedule');
    } else if (category === 'all') {
      await db.query('DELETE FROM results');
      await db.query('DELETE FROM attendance');
      await db.query('DELETE FROM enrollments');
      await db.query('DELETE FROM semesters');
      await db.query('DELETE FROM ai_cache');
      await db.query('DELETE FROM students');
      await db.query('DELETE FROM uploads');
      await db.query('DELETE FROM timetable');
      await db.query('DELETE FROM exam_schedule');
    } else {
      return res.status(400).json({ success: false, error: 'Invalid category specified.' });
    }

    await logAdminAction(adminUser, 'CLEAR_DATABASE', category, null, `Purged database category: ${category}`, req.ip);

    return res.json({ success: true, message: `Category '${category}' data was successfully purged.` });
  } catch (err) {
    console.error('[Admin Portal] Clear category error:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear category.' });
  }
}

/**
 * 16. Get Database Connection Status & Diagnostics
 */
async function getDbStatus(req, res) {
  try {
    const info = db.getConnectionInfo();
    const [[sCount]] = await db.query('SELECT COUNT(*) as c FROM students');
    const [[rCount]] = await db.query('SELECT COUNT(*) as c FROM results');
    const [[aCount]] = await db.query('SELECT COUNT(*) as c FROM attendance');
    const [[uCount]] = await db.query('SELECT COUNT(*) as c FROM uploads');
    return res.json({
      success: true,
      ...info,
      counts: {
        students: sCount?.c || 0,
        results: rCount?.c || 0,
        attendance: aCount?.c || 0,
        uploads: uCount?.c || 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 17. Retry MySQL Connection with fresh .env credentials
 */
async function retryDbConnection(req, res) {
  try {
    const pool = await db.tryConnectMySQL(true);
    const info = db.getConnectionInfo();
    if (pool) {
      return res.json({ success: true, message: 'Successfully connected directly to MySQL!', ...info });
    } else {
      return res.json({ success: false, error: info.lastError || 'Could not connect to MySQL server.', ...info });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDashboardStats,
  uploadFile,
  confirmUpload,
  deleteUpload,
  getUploadHistory,
  getAllStudents,
  getAllCourses,
  updateStudent,
  deleteStudent,
  deleteAllStudents,
  clearDatabaseCategory,
  updateResult,
  exportDataToExcel,
  aiSearch,
  getAtRiskReport,
  getAuditLogs,
  getDbStatus,
  retryDbConnection
};

