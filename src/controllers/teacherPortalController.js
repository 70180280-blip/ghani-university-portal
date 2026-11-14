/**
 * Teacher Portal Controller - Ghani University Slate
 */

const db = require('../db/pool');

/**
 * Helper to get active teacher ID
 */
function getActiveTeacherId(req) {
  if (req.session && req.session.teacher) return req.session.teacher.id;
  // If admin is impersonating a teacher
  if (req.session && req.session.admin && req.query.asTeacherId) {
    return parseInt(req.query.asTeacherId, 10);
  }
  return null;
}

/**
 * Get courses assigned to teacher with student enrollments count
 */
async function getCourses(req, res) {
  try {
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const [courses] = await db.query(
      `SELECT tca.id as assignment_id, tca.course_code, tca.section, tca.academic_year, tca.term,
              c.title as course_title, c.credit_hours, c.lecture_hours, c.lab_hours, c.department,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_code = tca.course_code) as enrolled_count,
              (SELECT COUNT(*) FROM course_materials cm WHERE cm.course_code = tca.course_code AND cm.teacher_id = ?) as materials_count
       FROM teacher_course_assignments tca
       LEFT JOIN courses c ON tca.course_code = c.code
       WHERE tca.teacher_id = ?
       ORDER BY tca.course_code ASC`,
      [teacherId, teacherId]
    );

    return res.json({ success: true, courses });
  } catch (err) {
    console.error('[Teacher Portal] Error getting courses:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve faculty courses.' });
  }
}

/**
 * Get students enrolled in a specific course
 */
async function getCourseStudents(req, res) {
  try {
    const { code } = req.params;
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const [students] = await db.query(
      `SELECT s.id, s.registration_no, s.name, s.father_name, s.email, s.phone, s.program_code, s.batch, s.current_semester,
              e.section, e.status as enrollment_status
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       WHERE e.course_code = ?
       ORDER BY s.registration_no ASC`,
      [code]
    );

    return res.json({ success: true, course_code: code, students });
  } catch (err) {
    console.error('[Teacher Portal] Error getting course students:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve enrolled students.' });
  }
}

/**
 * Get all course materials (assignments, quizzes, notes) uploaded by this teacher
 */
async function getMaterials(req, res) {
  try {
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const { course_code } = req.query;
    let query = `
      SELECT cm.*, c.title as course_title,
             (SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.material_id = cm.id) as submission_count
      FROM course_materials cm
      LEFT JOIN courses c ON cm.course_code = c.code
      WHERE cm.teacher_id = ?
    `;
    const params = [teacherId];

    if (course_code) {
      query += ` AND cm.course_code = ?`;
      params.push(course_code);
    }

    query += ` ORDER BY cm.created_at DESC`;

    const [materials] = await db.query(query, params);
    return res.json({ success: true, materials });
  } catch (err) {
    console.error('[Teacher Portal] Error getting materials:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve materials.' });
  }
}

/**
 * Create a new work / assignment / quiz / lecture note
 */
async function createMaterial(req, res) {
  try {
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const { course_code, title, description, material_type, due_date, total_marks, file_url, file_name } = req.body;

    if (!course_code || !title) {
      return res.status(400).json({ success: false, error: 'Course code and title are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO course_materials 
        (course_code, teacher_id, title, description, material_type, file_url, file_name, due_date, total_marks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course_code,
        teacherId,
        title,
        description || '',
        material_type || 'assignment',
        file_url || null,
        file_name || null,
        due_date ? new Date(due_date) : null,
        parseInt(total_marks, 10) || 10
      ]
    );

    // Notify enrolled students in this course
    const [enrolledStudents] = await db.query(
      `SELECT student_id FROM enrollments WHERE course_code = ?`,
      [course_code]
    );

    const teacherName = req.session.teacher?.name || 'Your Teacher';
    for (const s of enrolledStudents) {
      await db.query(
        `INSERT INTO slate_notifications (user_type, user_id, title, message, link)
         VALUES ('student', ?, ?, ?, ?)`,
        [
          s.student_id,
          `New ${material_type || 'Assignment'}: ${title}`,
          `${teacherName} posted new work in ${course_code}: ${title}. Due date: ${due_date ? new Date(due_date).toLocaleDateString() : 'None'}.`,
          `/slate?tab=materials&course=${course_code}`
        ]
      );
    }

    return res.json({
      success: true,
      message: `${material_type || 'Material'} published successfully on Slate.`,
      materialId: result.insertId
    });
  } catch (err) {
    console.error('[Teacher Portal] Error creating material:', err);
    return res.status(500).json({ success: false, error: 'Failed to create work material.' });
  }
}

/**
 * Delete a course material
 */
async function deleteMaterial(req, res) {
  try {
    const { id } = req.params;
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    await db.query(`DELETE FROM course_materials WHERE id = ? AND teacher_id = ?`, [id, teacherId]);
    return res.json({ success: true, message: 'Material deleted successfully.' });
  } catch (err) {
    console.error('[Teacher Portal] Error deleting material:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete material.' });
  }
}

/**
 * Get submissions for an assignment
 */
async function getSubmissions(req, res) {
  try {
    const { materialId } = req.params;
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const [submissions] = await db.query(
      `SELECT sub.*, s.name as student_name, s.registration_no, s.email as student_email,
              cm.title as material_title, cm.total_marks, cm.course_code
       FROM assignment_submissions sub
       JOIN students s ON sub.student_id = s.id
       JOIN course_materials cm ON sub.material_id = cm.id
       WHERE sub.material_id = ? AND cm.teacher_id = ?
       ORDER BY sub.submitted_at DESC`,
      [materialId, teacherId]
    );

    return res.json({ success: true, submissions });
  } catch (err) {
    console.error('[Teacher Portal] Error getting submissions:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve student submissions.' });
  }
}

/**
 * Grade a student submission
 */
async function gradeSubmission(req, res) {
  try {
    const { id } = req.params;
    const { marks_obtained, teacher_feedback } = req.body;
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const [sub] = await db.query(
      `SELECT sub.*, cm.course_code, cm.title as material_title 
       FROM assignment_submissions sub
       JOIN course_materials cm ON sub.material_id = cm.id
       WHERE sub.id = ? AND cm.teacher_id = ?`,
      [id, teacherId]
    );

    if (sub.length === 0) {
      return res.status(404).json({ success: false, error: 'Submission not found or unauthorized.' });
    }

    const marks = parseFloat(marks_obtained);
    await db.query(
      `UPDATE assignment_submissions
       SET marks_obtained = ?, teacher_feedback = ?, status = 'graded', graded_at = NOW()
       WHERE id = ?`,
      [marks, teacher_feedback || '', id]
    );

    // Notify student
    await db.query(
      `INSERT INTO slate_notifications (user_type, user_id, title, message, link)
       VALUES ('student', ?, ?, ?, ?)`,
      [
        sub[0].student_id,
        `Assignment Graded: ${sub[0].material_title}`,
        `Your work for ${sub[0].material_title} (${sub[0].course_code}) was graded: ${marks} marks. Feedback: "${teacher_feedback || 'Well done.'}"`,
        `/slate?tab=materials&course=${sub[0].course_code}`
      ]
    );

    return res.json({ success: true, message: 'Submission graded successfully!' });
  } catch (err) {
    console.error('[Teacher Portal] Error grading submission:', err);
    return res.status(500).json({ success: false, error: 'Failed to grade submission.' });
  }
}

/**
 * Get meeting requests for this teacher
 */
async function getMeetingRequests(req, res) {
  try {
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const [meetings] = await db.query(
      `SELECT mr.*, s.name as student_name, s.registration_no, s.email as student_email, s.phone as student_phone
       FROM meeting_requests mr
       JOIN students s ON mr.student_id = s.id
       WHERE mr.teacher_id = ?
       ORDER BY mr.preferred_datetime ASC`,
      [teacherId]
    );

    return res.json({ success: true, meetings });
  } catch (err) {
    console.error('[Teacher Portal] Error getting meeting requests:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve meeting requests.' });
  }
}

/**
 * Approve, reject, or reschedule meeting request
 */
async function updateMeetingRequest(req, res) {
  try {
    const { id } = req.params;
    const { status, teacher_notes } = req.body;
    const teacherId = getActiveTeacherId(req);
    if (!teacherId) return res.status(401).json({ success: false, error: 'Unauthorized faculty.' });

    const [mr] = await db.query(
      `SELECT * FROM meeting_requests WHERE id = ? AND teacher_id = ?`,
      [id, teacherId]
    );

    if (mr.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting request not found.' });
    }

    await db.query(
      `UPDATE meeting_requests 
       SET status = ?, teacher_notes = ? 
       WHERE id = ? AND teacher_id = ?`,
      [status || 'approved', teacher_notes || '', id, teacherId]
    );

    // Notify student
    const teacherName = req.session.teacher?.name || 'Your Teacher';
    await db.query(
      `INSERT INTO slate_notifications (user_type, user_id, title, message, link)
       VALUES ('student', ?, ?, ?, ?)`,
      [
        mr[0].student_id,
        `Meeting Request ${status.toUpperCase()}`,
        `Teacher ${teacherName} has ${status} your meeting request ("${mr[0].purpose}"). Note: ${teacher_notes || 'Confirmed.'}`,
        `/slate?tab=meetings`
      ]
    );

    return res.json({ success: true, message: `Meeting request ${status} successfully.` });
  } catch (err) {
    console.error('[Teacher Portal] Error updating meeting request:', err);
    return res.status(500).json({ success: false, error: 'Failed to update meeting request.' });
  }
}

module.exports = {
  getCourses,
  getCourseStudents,
  getMaterials,
  createMaterial,
  deleteMaterial,
  getSubmissions,
  gradeSubmission,
  getMeetingRequests,
  updateMeetingRequest
};
