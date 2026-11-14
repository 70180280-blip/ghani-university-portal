-- Ghani Technical & Islamic University Portal Database Schema
-- Compatible with MySQL 8.0+ and cloud MySQL (Aiven)

CREATE TABLE IF NOT EXISTS programs (
  code VARCHAR(16) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  degree_title VARCHAR(128) NOT NULL,
  total_credit_hours INT NOT NULL DEFAULT 130,
  total_semesters INT NOT NULL DEFAULT 8,
  department VARCHAR(128) NOT NULL,
  faculty VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registration_no VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  father_name VARCHAR(128) NOT NULL,
  email VARCHAR(128) NULL,
  phone VARCHAR(32) NULL,
  father_phone VARCHAR(32) NULL,
  program_code VARCHAR(16) NOT NULL DEFAULT 'BSCS',
  batch VARCHAR(16) NOT NULL DEFAULT 'Fall 2024',
  current_semester INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  dob DATE NULL,
  pin VARCHAR(16) NULL,
  address VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_student_search (name, father_name),
  INDEX idx_student_program (program_code),
  FOREIGN KEY (program_code) REFERENCES programs(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS courses (
  code VARCHAR(16) PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  credit_hours INT NOT NULL DEFAULT 3,
  lecture_hours INT NOT NULL DEFAULT 3,
  lab_hours INT NOT NULL DEFAULT 0,
  department VARCHAR(128) NOT NULL,
  prerequisite VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_code VARCHAR(16) NOT NULL,
  semester_number INT NOT NULL,
  teacher_name VARCHAR(128) NOT NULL,
  section VARCHAR(8) NOT NULL DEFAULT 'A',
  academic_year VARCHAR(16) NOT NULL DEFAULT '2023-2024',
  term VARCHAR(16) NOT NULL DEFAULT 'Spring',
  status VARCHAR(32) NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_enrollment_student (student_id),
  INDEX idx_enrollment_course (course_code),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NULL,
  student_id INT NOT NULL,
  course_code VARCHAR(16) NOT NULL,
  semester_number INT NOT NULL,
  assignment_marks DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  quiz_marks DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  mid_marks DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  final_marks DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  total_obtained DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  total_max DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  grade VARCHAR(4) NOT NULL DEFAULT 'F',
  grade_point DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  is_passed TINYINT(1) NOT NULL DEFAULT 1,
  is_repeated TINYINT(1) NOT NULL DEFAULT 0,
  upload_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_results_student_sem (student_id, semester_number),
  INDEX idx_results_course (course_code),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS semesters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  semester_number INT NOT NULL,
  academic_year VARCHAR(16) NOT NULL,
  term VARCHAR(16) NOT NULL,
  sgpa DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  earned_ch INT NOT NULL DEFAULT 0,
  total_ch INT NOT NULL DEFAULT 0,
  total_obtained DECIMAL(7, 2) NOT NULL DEFAULT 0.00,
  total_max DECIMAL(7, 2) NOT NULL DEFAULT 0.00,
  percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_semesters_student (student_id),
  UNIQUE KEY uq_student_sem (student_id, semester_number),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_code VARCHAR(16) NOT NULL,
  lecture_date DATE NOT NULL,
  status ENUM('present', 'absent', 'leave') NOT NULL DEFAULT 'present',
  remarks VARCHAR(128) NULL,
  upload_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attendance_student_course (student_id, course_code),
  INDEX idx_attendance_date (lecture_date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timetable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_code VARCHAR(16) NOT NULL,
  semester_number INT NOT NULL,
  section VARCHAR(8) NOT NULL DEFAULT 'A',
  day_of_week VARCHAR(16) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  course_code VARCHAR(16) NOT NULL,
  course_title VARCHAR(128) NOT NULL,
  teacher_name VARCHAR(128) NOT NULL,
  room VARCHAR(32) NOT NULL,
  INDEX idx_timetable_lookup (program_code, semester_number, section),
  FOREIGN KEY (program_code) REFERENCES programs(code) ON DELETE CASCADE,
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_code VARCHAR(16) NOT NULL,
  semester_number INT NOT NULL,
  course_code VARCHAR(16) NOT NULL,
  course_title VARCHAR(128) NOT NULL,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(128) NOT NULL,
  seat_no_prefix VARCHAR(32) NULL,
  INDEX idx_exam_lookup (program_code, semester_number),
  FOREIGN KEY (program_code) REFERENCES programs(code) ON DELETE CASCADE,
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(32) NOT NULL,
  instruction TEXT NULL,
  detected_type VARCHAR(64) NULL,
  record_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'preview',
  extracted_json LONGTEXT NULL,
  error_message TEXT NULL,
  admin_username VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_username VARCHAR(64) NOT NULL,
  student_id INT NULL,
  action VARCHAR(64) NOT NULL,
  target_table VARCHAR(64) NULL,
  target_id INT NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at)
);

CREATE TABLE IF NOT EXISTS ai_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cache_key VARCHAR(128) NOT NULL UNIQUE,
  student_id INT NULL,
  feature_type VARCHAR(64) NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL,
  response_content LONGTEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cache_lookup (cache_key, expires_at)
);

-- ============================================================================
-- GHANI UNIVERSITY STUDENT & TEACHER COMMUNICATION SLATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  department VARCHAR(128) NOT NULL DEFAULT 'Computer Science',
  designation VARCHAR(64) NOT NULL DEFAULT 'Assistant Professor',
  phone VARCHAR(32) NULL,
  office_room VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  avatar_url VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teacher_course_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  course_code VARCHAR(16) NOT NULL,
  section VARCHAR(16) NOT NULL DEFAULT 'A',
  academic_year VARCHAR(32) NOT NULL DEFAULT '2026-2027',
  term VARCHAR(16) NOT NULL DEFAULT 'Fall',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  INDEX idx_tca_teacher (teacher_id),
  INDEX idx_tca_course (course_code)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(32) NOT NULL DEFAULT 'direct', -- 'direct' or 'course_group'
  course_code VARCHAR(16) NULL,
  title VARCHAR(128) NULL,
  last_message_text TEXT NULL,
  last_message_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conv_course (course_code)
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  user_type VARCHAR(16) NOT NULL, -- 'student' or 'teacher'
  user_id INT NOT NULL,
  last_read_at TIMESTAMP NULL,
  is_muted TINYINT(1) DEFAULT 0,
  is_archived TINYINT(1) DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_cp_user (user_type, user_id),
  INDEX idx_cp_conv (conversation_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_type VARCHAR(16) NOT NULL, -- 'student' or 'teacher'
  sender_id INT NOT NULL,
  sender_name VARCHAR(128) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(32) NOT NULL DEFAULT 'text', -- 'text', 'file', 'image', 'announcement', 'assignment'
  file_url VARCHAR(255) NULL,
  file_name VARCHAR(255) NULL,
  file_size VARCHAR(32) NULL,
  reply_to_id INT NULL,
  is_pinned TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_msg_conv (conversation_id, created_at)
);

CREATE TABLE IF NOT EXISTS course_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(16) NOT NULL,
  teacher_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  material_type VARCHAR(32) NOT NULL DEFAULT 'assignment', -- 'assignment', 'quiz', 'lecture_note', 'syllabus'
  file_url VARCHAR(255) NULL,
  file_name VARCHAR(255) NULL,
  due_date DATETIME NULL,
  total_marks INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  INDEX idx_cm_course (course_code),
  INDEX idx_cm_teacher (teacher_id)
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  student_id INT NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  student_comment TEXT NULL,
  marks_obtained DECIMAL(5,2) NULL,
  teacher_feedback TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted', -- 'submitted', 'graded', 'returned'
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  graded_at TIMESTAMP NULL,
  FOREIGN KEY (material_id) REFERENCES course_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_as_material (material_id),
  INDEX idx_as_student (student_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  course_code VARCHAR(16) NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_type VARCHAR(32) NOT NULL DEFAULT 'course', -- 'course', 'all', 'individual'
  target_id INT NULL,
  file_url VARCHAR(255) NULL,
  file_name VARCHAR(255) NULL,
  is_pinned TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  INDEX idx_ann_course (course_code)
);

CREATE TABLE IF NOT EXISTS meeting_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  teacher_id INT NOT NULL,
  course_code VARCHAR(16) NULL,
  purpose VARCHAR(255) NOT NULL,
  preferred_datetime DATETIME NOT NULL,
  meeting_mode VARCHAR(32) NOT NULL DEFAULT 'in_person', -- 'in_person' or 'online'
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'rescheduled'
  teacher_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  INDEX idx_mr_student (student_id),
  INDEX idx_mr_teacher (teacher_id)
);

CREATE TABLE IF NOT EXISTS slate_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_type VARCHAR(16) NOT NULL, -- 'student', 'teacher', 'admin'
  user_id INT NOT NULL,
  title VARCHAR(128) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255) NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_type, user_id, is_read)
);

CREATE TABLE IF NOT EXISTS message_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  reported_by_type VARCHAR(16) NOT NULL,
  reported_by_id INT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'dismissed'
  action_taken VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

