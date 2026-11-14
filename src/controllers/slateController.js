/**
 * Slate Core Communication Controller - Ghani University Slate
 * Unified real-time communication engine for Students, Teachers & Admin
 */

const db = require('../db/pool');
const path = require('path');
const fs = require('fs');

/**
 * Determine currently authenticated user and role
 */
function getSlateUser(req) {
  if (req.session && req.session.student) {
    return {
      type: 'student',
      id: req.session.student.id,
      name: req.session.student.name,
      registration_no: req.session.student.registration_no,
      email: req.session.student.email,
      program_code: req.session.student.program_code,
      role: 'Student'
    };
  }
  if (req.session && req.session.teacher) {
    return {
      type: 'teacher',
      id: req.session.teacher.id,
      name: req.session.teacher.name,
      teacher_id: req.session.teacher.teacher_id,
      email: req.session.teacher.email,
      department: req.session.teacher.department,
      designation: req.session.teacher.designation,
      role: 'Faculty'
    };
  }
  if (req.session && req.session.admin) {
    return {
      type: 'admin',
      id: req.session.admin.id || 1,
      name: req.session.admin.username || 'Administrator',
      role: 'Administrator'
    };
  }
  return null;
}

/**
 * 1. Get Current Slate Profile & Stats
 */
async function getMe(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated on Slate.' });
    }

    // Unread notification count
    const [[notifCount]] = await db.query(
      `SELECT COUNT(*) as count FROM slate_notifications WHERE user_type = ? AND user_id = ? AND is_read = 0`,
      [user.type, user.id]
    );

    return res.json({
      success: true,
      user,
      unreadNotifications: notifCount?.count || 0
    });
  } catch (err) {
    console.error('[Slate] Error in getMe:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve slate profile.' });
  }
}

/**
 * 2. Get Conversations (Direct chats + Course Channels)
 */
async function getConversations(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    let convQuery = '';
    let params = [];

    if (user.type === 'admin') {
      // Admin sees all active conversations
      convQuery = `
        SELECT c.*,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c
        ORDER BY c.updated_at DESC LIMIT 50
      `;
    } else {
      convQuery = `
        SELECT c.*, cp.last_read_at, cp.is_pinned,
               (SELECT COUNT(*) FROM messages m 
                WHERE m.conversation_id = c.id 
                  AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
                  AND NOT (m.sender_type = ? AND m.sender_id = ?)
               ) as unread_count
        FROM conversation_participants cp
        JOIN conversations c ON cp.conversation_id = c.id
        WHERE cp.user_type = ? AND cp.user_id = ?
        ORDER BY c.updated_at DESC
      `;
      params = [user.type, user.id, user.type, user.id];
    }

    const [conversations] = await db.query(convQuery, params);

    // Enhance conversations with participant names & course details
    for (const conv of conversations) {
      if (conv.type === 'direct') {
        const [participants] = await db.query(
          `SELECT cp.user_type, cp.user_id,
                  CASE 
                    WHEN cp.user_type = 'student' THEN (SELECT name FROM students WHERE id = cp.user_id)
                    WHEN cp.user_type = 'teacher' THEN (SELECT name FROM teachers WHERE id = cp.user_id)
                    ELSE 'Admin'
                  END as participant_name,
                  CASE 
                    WHEN cp.user_type = 'student' THEN (SELECT registration_no FROM students WHERE id = cp.user_id)
                    WHEN cp.user_type = 'teacher' THEN (SELECT designation FROM teachers WHERE id = cp.user_id)
                    ELSE 'Administrator'
                  END as participant_badge
           FROM conversation_participants cp
           WHERE cp.conversation_id = ? AND NOT (cp.user_type = ? AND cp.user_id = ?)`,
          [conv.id, user.type, user.id]
        );
        if (participants.length > 0) {
          conv.title = participants[0].participant_name || 'Ghani University Contact';
          conv.participant_name = participants[0].participant_name;
          conv.participant_badge = participants[0].participant_badge;
          conv.participant_type = participants[0].user_type;
          conv.participant_id = participants[0].user_id;
        }
      }
    }

    return res.json({ success: true, conversations });
  } catch (err) {
    console.error('[Slate] Error getting conversations:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve conversations.' });
  }
}

/**
 * 3. Start or Retrieve a Direct 1-on-1 Conversation
 */
async function startDirectConversation(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const { target_type, target_id, course_code } = req.body;
    if (!target_type || !target_id) {
      return res.status(400).json({ success: false, error: 'Target recipient required.' });
    }

    const tId = parseInt(target_id, 10);

    // Check if direct conversation already exists between these two users
    const [existing] = await db.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants p1 ON c.id = p1.conversation_id AND p1.user_type = ? AND p1.user_id = ?
       JOIN conversation_participants p2 ON c.id = p2.conversation_id AND p2.user_type = ? AND p2.user_id = ?
       WHERE c.type = 'direct' LIMIT 1`,
      [user.type, user.id, target_type, tId]
    );

    if (existing.length > 0) {
      return res.json({ success: true, conversationId: existing[0].id, isExisting: true });
    }

    // Get target name for initial conversation title
    let targetName = 'Academic Contact';
    if (target_type === 'teacher') {
      const [t] = await db.query('SELECT name FROM teachers WHERE id = ?', [tId]);
      if (t.length > 0) targetName = t[0].name;
    } else if (target_type === 'student') {
      const [s] = await db.query('SELECT name FROM students WHERE id = ?', [tId]);
      if (s.length > 0) targetName = s[0].name;
    }

    // Create new conversation
    const [convResult] = await db.query(
      `INSERT INTO conversations (type, course_code, title, last_message_text, last_message_at)
       VALUES ('direct', ?, ?, 'Conversation started', NOW())`,
      [course_code || null, targetName]
    );
    const newConvId = convResult.insertId;

    // Add current user
    await db.query(
      `INSERT INTO conversation_participants (conversation_id, user_type, user_id, last_read_at)
       VALUES (?, ?, ?, NOW())`,
      [newConvId, user.type, user.id]
    );

    // Add target user
    await db.query(
      `INSERT INTO conversation_participants (conversation_id, user_type, user_id, last_read_at)
       VALUES (?, ?, ?, NULL)`,
      [newConvId, target_type, tId]
    );

    return res.json({ success: true, conversationId: newConvId, isExisting: false });
  } catch (err) {
    console.error('[Slate] Error starting conversation:', err);
    return res.status(500).json({ success: false, error: 'Failed to start conversation.' });
  }
}

/**
 * 4. Get Messages for a specific conversation
 */
async function getMessages(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const { conversationId } = req.params;
    const convId = parseInt(conversationId, 10);

    // Fetch conversation details
    const [convs] = await db.query('SELECT * FROM conversations WHERE id = ?', [convId]);
    if (convs.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    const conversation = convs[0];

    // Fetch messages
    const [messages] = await db.query(
      `SELECT m.* 
       FROM messages m
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC LIMIT 150`,
      [convId]
    );

    // Mark as read for this user
    await db.query(
      `UPDATE conversation_participants 
       SET last_read_at = NOW() 
       WHERE conversation_id = ? AND user_type = ? AND user_id = ?`,
      [convId, user.type, user.id]
    );

    return res.json({
      success: true,
      conversation,
      messages,
      currentUser: user
    });
  } catch (err) {
    console.error('[Slate] Error getting messages:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve messages.' });
  }
}

/**
 * 5. Send Message in a conversation
 */
async function sendMessage(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const { conversationId } = req.params;
    const { content, message_type, file_url, file_name, file_size, reply_to_id } = req.body;

    if (!content && !file_url) {
      return res.status(400).json({ success: false, error: 'Message content or attachment is required.' });
    }

    const convId = parseInt(conversationId, 10);

    const [msgResult] = await db.query(
      `INSERT INTO messages 
        (conversation_id, sender_type, sender_id, sender_name, content, message_type, file_url, file_name, file_size, reply_to_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        convId,
        user.type,
        user.id,
        user.name,
        content || (file_name ? `Shared file: ${file_name}` : 'Shared media'),
        message_type || (file_url ? 'file' : 'text'),
        file_url || null,
        file_name || null,
        file_size || null,
        reply_to_id || null
      ]
    );

    const previewSnippet = content ? (content.length > 60 ? content.slice(0, 57) + '...' : content) : (file_name || 'Attachment');

    // Update conversation timestamp and last message
    await db.query(
      `UPDATE conversations 
       SET last_message_text = ?, last_message_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [previewSnippet, convId]
    );

    // Update sender's last_read_at
    await db.query(
      `UPDATE conversation_participants 
       SET last_read_at = NOW() 
       WHERE conversation_id = ? AND user_type = ? AND user_id = ?`,
      [convId, user.type, user.id]
    );

    // Create notifications for other participants
    const [recipients] = await db.query(
      `SELECT user_type, user_id FROM conversation_participants 
       WHERE conversation_id = ? AND NOT (user_type = ? AND user_id = ?)`,
      [convId, user.type, user.id]
    );

    for (const r of recipients) {
      await db.query(
        `INSERT INTO slate_notifications (user_type, user_id, title, message, link)
         VALUES (?, ?, ?, ?, ?)`,
        [
          r.user_type,
          r.user_id,
          `New message from ${user.name}`,
          previewSnippet,
          `/slate?conversationId=${convId}`
        ]
      );
    }

    const [newMessage] = await db.query('SELECT * FROM messages WHERE id = ?', [msgResult.insertId]);

    return res.json({
      success: true,
      message: newMessage[0]
    });
  } catch (err) {
    console.error('[Slate] Error sending message:', err);
    return res.status(500).json({ success: false, error: 'Failed to send message.' });
  }
}

/**
 * 6. Get Course Channels (General, Q&A, Announcements, Study Material, Assignment Discussion)
 */
async function getCourseChannels(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    let courses = [];
    if (user.type === 'student') {
      // Find courses student is enrolled in
      const [enrolled] = await db.query(
        `SELECT DISTINCT e.course_code, c.title as course_title, c.credit_hours, c.department,
                t.id as teacher_id, t.name as teacher_name, t.email as teacher_email, t.designation as teacher_designation
         FROM enrollments e
         JOIN courses c ON e.course_code = c.code
         LEFT JOIN teacher_course_assignments tca ON e.course_code = tca.course_code
         LEFT JOIN teachers t ON tca.teacher_id = t.id
         WHERE e.student_id = ?
         ORDER BY e.course_code ASC`,
        [user.id]
      );
      courses = enrolled;
    } else if (user.type === 'teacher') {
      // Find courses teacher is assigned to
      const [assigned] = await db.query(
        `SELECT DISTINCT tca.course_code, c.title as course_title, c.credit_hours, c.department,
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_code = tca.course_code) as enrolled_count
         FROM teacher_course_assignments tca
         JOIN courses c ON tca.course_code = c.code
         WHERE tca.teacher_id = ?
         ORDER BY tca.course_code ASC`,
        [user.id]
      );
      courses = assigned;
    } else {
      // Admin sees all courses
      const [allCourses] = await db.query(`SELECT code as course_code, title as course_title, department FROM courses LIMIT 30`);
      courses = allCourses;
    }

    // Auto-ensure course group conversation exists for each course
    for (const course of courses) {
      const [existingConv] = await db.query(
        `SELECT id FROM conversations WHERE type = 'course_group' AND course_code = ? LIMIT 1`,
        [course.course_code]
      );

      if (existingConv.length === 0) {
        const [newConv] = await db.query(
          `INSERT INTO conversations (type, course_code, title, last_message_text, last_message_at)
           VALUES ('course_group', ?, ?, 'Welcome to the course communication slate.', NOW())`,
          [course.course_code, `${course.course_code} - ${course.course_title}`]
        );
        course.conversation_id = newConv.insertId;
      } else {
        course.conversation_id = existingConv[0].id;
      }

      // Ensure user is in participants of this course group
      const [part] = await db.query(
        `SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_type = ? AND user_id = ?`,
        [course.conversation_id, user.type, user.id]
      );
      if (part.length === 0) {
        await db.query(
          `INSERT INTO conversation_participants (conversation_id, user_type, user_id, last_read_at)
           VALUES (?, ?, ?, NOW())`,
          [course.conversation_id, user.type, user.id]
        );
      }
    }

    return res.json({ success: true, courses });
  } catch (err) {
    console.error('[Slate] Error getting course channels:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve course channels.' });
  }
}

/**
 * 7. Get Announcements
 */
async function getAnnouncements(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const { course_code } = req.query;
    let query = `
      SELECT a.*, t.name as teacher_name, t.designation as teacher_designation, c.title as course_title
      FROM announcements a
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN courses c ON a.course_code = c.code
      WHERE 1=1
    `;
    const params = [];

    if (course_code) {
      query += ` AND (a.course_code = ? OR a.target_type = 'all')`;
      params.push(course_code);
    }

    query += ` ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT 50`;

    const [announcements] = await db.query(query, params);
    return res.json({ success: true, announcements });
  } catch (err) {
    console.error('[Slate] Error getting announcements:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve announcements.' });
  }
}

/**
 * 8. Create Announcement (Teachers / Admins)
 */
async function createAnnouncement(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user || user.type === 'student') {
      return res.status(403).json({ success: false, error: 'Only faculty and administrators can publish announcements.' });
    }

    const { course_code, title, content, target_type, file_url, file_name, is_pinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Announcement title and content are required.' });
    }

    const teacherId = user.type === 'teacher' ? user.id : 1;

    const [result] = await db.query(
      `INSERT INTO announcements (teacher_id, course_code, title, content, target_type, file_url, file_name, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teacherId,
        course_code || null,
        title,
        content,
        target_type || (course_code ? 'course' : 'all'),
        file_url || null,
        file_name || null,
        is_pinned ? 1 : 0
      ]
    );

    // Create notifications for enrolled students
    let studentIds = [];
    if (course_code) {
      const [rows] = await db.query('SELECT student_id FROM enrollments WHERE course_code = ?', [course_code]);
      studentIds = rows.map(r => r.student_id);
    } else {
      const [rows] = await db.query('SELECT id as student_id FROM students WHERE status = "Active"');
      studentIds = rows.map(r => r.student_id);
    }

    for (const sid of studentIds) {
      await db.query(
        `INSERT INTO slate_notifications (user_type, user_id, title, message, link)
         VALUES ('student', ?, ?, ?, ?)`,
        [
          sid,
          `Announcement: ${title}`,
          content.length > 80 ? content.slice(0, 77) + '...' : content,
          `/slate?tab=announcements`
        ]
      );
    }

    return res.json({
      success: true,
      message: 'Announcement published successfully on Slate.',
      announcementId: result.insertId
    });
  } catch (err) {
    console.error('[Slate] Error creating announcement:', err);
    return res.status(500).json({ success: false, error: 'Failed to publish announcement.' });
  }
}

/**
 * 9. Get Course Materials & Assignments (Student & Teacher view)
 */
async function getMaterials(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const { course_code } = req.query;
    let query = `
      SELECT cm.*, c.title as course_title, t.name as teacher_name, t.designation as teacher_designation
      FROM course_materials cm
      LEFT JOIN courses c ON cm.course_code = c.code
      LEFT JOIN teachers t ON cm.teacher_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (course_code) {
      query += ` AND cm.course_code = ?`;
      params.push(course_code);
    }

    query += ` ORDER BY cm.created_at DESC`;

    const [materials] = await db.query(query, params);

    // If student, check if they have submitted for each material
    if (user.type === 'student') {
      for (const m of materials) {
        const [sub] = await db.query(
          `SELECT id, status, marks_obtained, teacher_feedback, submitted_at, file_url, file_name 
           FROM assignment_submissions 
           WHERE material_id = ? AND student_id = ? LIMIT 1`,
          [m.id, user.id]
        );
        m.submission = sub.length > 0 ? sub[0] : null;
      }
    }

    return res.json({ success: true, materials });
  } catch (err) {
    console.error('[Slate] Error getting materials:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve materials.' });
  }
}

/**
 * 10. Student Submit Completed Assignment / Quiz
 */
async function submitAssignment(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user || user.type !== 'student') {
      return res.status(403).json({ success: false, error: 'Only enrolled students can submit assignments.' });
    }

    const { material_id, file_url, file_name, student_comment } = req.body;

    if (!material_id || !file_url) {
      return res.status(400).json({ success: false, error: 'Material ID and solution file are required.' });
    }

    const mId = parseInt(material_id, 10);

    // Check material exists
    const [mat] = await db.query(
      `SELECT cm.*, t.name as teacher_name 
       FROM course_materials cm 
       LEFT JOIN teachers t ON cm.teacher_id = t.id 
       WHERE cm.id = ?`,
      [mId]
    );

    if (mat.length === 0) {
      return res.status(404).json({ success: false, error: 'Assignment material not found.' });
    }

    // Check if already submitted -> update, otherwise insert
    const [existing] = await db.query(
      `SELECT id FROM assignment_submissions WHERE material_id = ? AND student_id = ?`,
      [mId, user.id]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE assignment_submissions 
         SET file_url = ?, file_name = ?, student_comment = ?, status = 'submitted', submitted_at = NOW() 
         WHERE id = ?`,
        [file_url, file_name || 'solution_file', student_comment || '', existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO assignment_submissions 
          (material_id, student_id, file_url, file_name, student_comment, status)
         VALUES (?, ?, ?, ?, ?, 'submitted')`,
        [mId, user.id, file_url, file_name || 'solution_file', student_comment || '']
      );
    }

    // Notify teacher
    await db.query(
      `INSERT INTO slate_notifications (user_type, user_id, title, message, link)
       VALUES ('teacher', ?, ?, ?, ?)`,
      [
        mat[0].teacher_id,
        `Assignment Submitted by ${user.name}`,
        `${user.name} (${user.registration_no}) submitted work for ${mat[0].title} in ${mat[0].course_code}.`,
        `/teacher?tab=submissions&materialId=${mId}`
      ]
    );

    return res.json({
      success: true,
      message: 'Assignment submitted successfully to your course teacher!'
    });
  } catch (err) {
    console.error('[Slate] Error submitting assignment:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit assignment.' });
  }
}

/**
 * 11. Request Meeting with Teacher
 */
async function requestMeeting(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user || user.type !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can initiate meeting requests.' });
    }

    const { teacher_id, course_code, purpose, preferred_datetime, meeting_mode } = req.body;

    if (!teacher_id || !purpose || !preferred_datetime) {
      return res.status(400).json({ success: false, error: 'Teacher, meeting purpose, and preferred date/time are required.' });
    }

    const tId = parseInt(teacher_id, 10);

    const [result] = await db.query(
      `INSERT INTO meeting_requests 
        (student_id, teacher_id, course_code, purpose, preferred_datetime, meeting_mode, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        user.id,
        tId,
        course_code || null,
        purpose,
        new Date(preferred_datetime),
        meeting_mode || 'in_person'
      ]
    );

    // Notify teacher
    await db.query(
      `INSERT INTO slate_notifications (user_type, user_id, title, message, link)
       VALUES ('teacher', ?, ?, ?, ?)`,
      [
        tId,
        `Meeting Request from ${user.name}`,
        `${user.name} (${user.registration_no}) requested a meeting regarding: "${purpose}". Time: ${new Date(preferred_datetime).toLocaleString()}`,
        `/teacher?tab=meetings`
      ]
    );

    return res.json({
      success: true,
      message: 'Meeting request sent to your teacher successfully.',
      requestId: result.insertId
    });
  } catch (err) {
    console.error('[Slate] Error requesting meeting:', err);
    return res.status(500).json({ success: false, error: 'Failed to send meeting request.' });
  }
}

/**
 * 12. Get User Meetings
 */
async function getMeetings(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    let query = '';
    let params = [];

    if (user.type === 'student') {
      query = `
        SELECT mr.*, t.name as teacher_name, t.email as teacher_email, t.office_room, t.designation as teacher_designation,
               c.title as course_title
        FROM meeting_requests mr
        JOIN teachers t ON mr.teacher_id = t.id
        LEFT JOIN courses c ON mr.course_code = c.code
        WHERE mr.student_id = ?
        ORDER BY mr.preferred_datetime DESC
      `;
      params = [user.id];
    } else if (user.type === 'teacher') {
      query = `
        SELECT mr.*, s.name as student_name, s.registration_no, s.email as student_email, s.phone as student_phone,
               c.title as course_title
        FROM meeting_requests mr
        JOIN students s ON mr.student_id = s.id
        LEFT JOIN courses c ON mr.course_code = c.code
        WHERE mr.teacher_id = ?
        ORDER BY mr.preferred_datetime DESC
      `;
      params = [user.id];
    } else {
      query = `
        SELECT mr.*, s.name as student_name, t.name as teacher_name
        FROM meeting_requests mr
        JOIN students s ON mr.student_id = s.id
        JOIN teachers t ON mr.teacher_id = t.id
        ORDER BY mr.created_at DESC LIMIT 50
      `;
    }

    const [meetings] = await db.query(query, params);
    return res.json({ success: true, meetings });
  } catch (err) {
    console.error('[Slate] Error getting meetings:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve meetings.' });
  }
}

/**
 * 13. Get Notifications
 */
async function getNotifications(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const [notifications] = await db.query(
      `SELECT * FROM slate_notifications 
       WHERE user_type = ? AND user_id = ?
       ORDER BY created_at DESC LIMIT 40`,
      [user.type, user.id]
    );

    return res.json({ success: true, notifications });
  } catch (err) {
    console.error('[Slate] Error getting notifications:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve notifications.' });
  }
}

/**
 * 14. Mark Notifications Read
 */
async function markNotificationsRead(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    await db.query(
      `UPDATE slate_notifications SET is_read = 1 WHERE user_type = ? AND user_id = ?`,
      [user.type, user.id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[Slate] Error marking notifications read:', err);
    return res.status(500).json({ success: false, error: 'Failed to update notifications.' });
  }
}

/**
 * 15. Report Inappropriate Message
 */
async function reportMessage(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const { messageId } = req.params;
    const { reason } = req.body;

    const mId = parseInt(messageId, 10);
    await db.query(
      `INSERT INTO message_reports (message_id, reported_by_type, reported_by_id, reason)
       VALUES (?, ?, ?, ?)`,
      [mId, user.type, user.id, reason || 'Flagged inappropriate content']
    );

    return res.json({ success: true, message: 'Message report submitted to University Administration for review.' });
  } catch (err) {
    console.error('[Slate] Error reporting message:', err);
    return res.status(500).json({ success: false, error: 'Failed to report message.' });
  }
}

/**
 * 16. Pin / Unpin Message
 */
async function togglePinMessage(req, res) {
  try {
    const user = getSlateUser(req);
    if (!user || user.type === 'student') {
      return res.status(403).json({ success: false, error: 'Only faculty or admins can pin messages.' });
    }

    const { messageId } = req.params;
    const mId = parseInt(messageId, 10);

    const [msg] = await db.query('SELECT is_pinned FROM messages WHERE id = ?', [mId]);
    if (msg.length === 0) return res.status(404).json({ success: false, error: 'Message not found.' });

    const newPinned = msg[0].is_pinned ? 0 : 1;
    await db.query('UPDATE messages SET is_pinned = ? WHERE id = ?', [newPinned, mId]);

    return res.json({ success: true, is_pinned: newPinned });
  } catch (err) {
    console.error('[Slate] Error toggling pin:', err);
    return res.status(500).json({ success: false, error: 'Failed to toggle pin.' });
  }
}

/**
 * 17. Upload File Attachment for Chat or Assignment
 */
async function handleFileUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const file = req.file;
    // Generate accessible relative URL
    // In serverless / express, the file is saved to public/uploads or tmp
    const relativeUrl = `/uploads/slate/${file.filename}`;

    return res.json({
      success: true,
      file_url: relativeUrl,
      file_name: file.originalname,
      file_size: `${(file.size / 1024).toFixed(1)} KB`,
      mimetype: file.mimetype
    });
  } catch (err) {
    console.error('[Slate] Upload error:', err);
    return res.status(500).json({ success: false, error: 'File upload failed.' });
  }
}

module.exports = {
  getMe,
  getConversations,
  startDirectConversation,
  getMessages,
  sendMessage,
  getCourseChannels,
  getAnnouncements,
  createAnnouncement,
  getMaterials,
  submitAssignment,
  requestMeeting,
  getMeetings,
  getNotifications,
  markNotificationsRead,
  reportMessage,
  togglePinMessage,
  handleFileUpload
};
