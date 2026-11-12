/**
 * Database Seed Script - Ghani University Portal
 * 
 * Generates dummy data:
 * - 4 academic programs
 * - 16 university courses across faculties
 * - 8 fake students (never real people)
 * - 4 semesters of detailed results with breakdowns
 * - Daily attendance for the past 3 months
 * - Weekly timetable and registered courses
 * - Upcoming examination schedule
 * - Admin credentials
 */

const bcrypt = require('bcryptjs');
const db = require('./pool');
const { calculateSubjectPercentage, getGradeAndPoints, calculateSemesterGPA } = require('../utils/calculations');

async function seed() {
  console.log('[Seed] Starting database seeding...');
  await db.initDatabase();

  // 1. Seed Programs
  console.log('[Seed] Seeding academic programs...');
  const programs = [
    ['BSCS', 'Bachelor of Science in Computer Science', 'Bachelor of Science in Computer Science', 130, 8, 'Department of Computer Science', 'Faculty of Computing & Information Technology'],
    ['BSSE', 'Bachelor of Science in Software Engineering', 'Bachelor of Science in Software Engineering', 132, 8, 'Department of Software Engineering', 'Faculty of Computing & Information Technology'],
    ['BSEE', 'Bachelor of Science in Electrical Engineering', 'Bachelor of Science in Electrical Engineering', 136, 8, 'Department of Electrical Engineering', 'Faculty of Engineering & Technology'],
    ['BBA', 'Bachelor of Business Administration', 'Bachelor of Business Administration', 126, 8, 'Department of Business Administration', 'Faculty of Management Sciences']
  ];

  for (const p of programs) {
    const [existing] = await db.query('SELECT code FROM programs WHERE code = ?', [p[0]]);
    if (existing.length === 0) {
      await db.query(`
        INSERT INTO programs (code, name, degree_title, total_credit_hours, total_semesters, department, faculty)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, p);
    }
  }

  // 2. Seed Courses
  console.log('[Seed] Seeding courses...');
  const courses = [
    // Sem 1
    ['CS101', 'Introduction to Computing', 3, 2, 3, 'Department of Computer Science', null],
    ['CS102', 'Programming Fundamentals', 4, 3, 3, 'Department of Computer Science', null],
    ['MT101', 'Calculus and Analytical Geometry', 3, 3, 0, 'Department of Basic Sciences', null],
    ['IS101', 'Islamic Studies & Ethics', 2, 2, 0, 'Department of Islamic Studies & Ethics', null],
    // Sem 2
    ['CS201', 'Object Oriented Programming', 4, 3, 3, 'Department of Computer Science', 'CS102'],
    ['CS202', 'Discrete Structures', 3, 3, 0, 'Department of Computer Science', null],
    ['EE201', 'Digital Logic Design', 4, 3, 3, 'Department of Electrical Engineering', null],
    ['PK101', 'Pakistan Studies & Ideology', 2, 2, 0, 'Department of Humanities', null],
    // Sem 3
    ['CS301', 'Data Structures & Algorithms', 4, 3, 3, 'Department of Computer Science', 'CS201'],
    ['CS302', 'Database Systems', 4, 3, 3, 'Department of Computer Science', null],
    ['MT201', 'Linear Algebra & Differential Equations', 3, 3, 0, 'Department of Basic Sciences', 'MT101'],
    ['SE301', 'Software Engineering Concepts', 3, 3, 0, 'Department of Software Engineering', null],
    // Sem 4 (Current)
    ['CS401', 'Operating Systems', 4, 3, 3, 'Department of Computer Science', 'CS301'],
    ['CS402', 'Design and Analysis of Algorithms', 3, 3, 0, 'Department of Computer Science', 'CS301'],
    ['CS403', 'Computer Communication & Networks', 4, 3, 3, 'Department of Computer Science', null],
    ['AI401', 'Introduction to Artificial Intelligence', 3, 3, 0, 'Department of Computer Science', 'CS301']
  ];

  for (const c of courses) {
    try {
      await db.query(`
        INSERT INTO courses (code, title, credit_hours, lecture_hours, lab_hours, department, prerequisite)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, c);
    } catch (e) {
      // Course exists
    }
  }

  // 3. Seed Students
  console.log('[Seed] Seeding students...');
  const students = [
    // 1. Ali Khan - High Achiever
    {
      reg: 'GTIU-2022-CS-101',
      name: 'Ali Khan',
      father: 'Ahmed Khan',
      email: 'ali.khan@student.gtiu.edu.pk',
      phone: '+92 300 1234567',
      prog: 'BSCS',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2003-04-15',
      pin: '1234',
      address: 'House 14, Street 3, Civil Lines, Sheikhupura'
    },
    // 2. Fatima Noor - Strong Achiever
    {
      reg: 'GTIU-2022-CS-102',
      name: 'Fatima Noor',
      father: 'Muhammad Noor',
      email: 'fatima.noor@student.gtiu.edu.pk',
      phone: '+92 301 7654321',
      prog: 'BSCS',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2003-08-20',
      pin: '5678',
      address: 'Mohallah Guru Nanak, Housing Colony, Sheikhupura'
    },
    // 3. Usman Tariq - Average / Good Achiever
    {
      reg: 'GTIU-2022-CS-103',
      name: 'Usman Tariq',
      father: 'Tariq Mehmood',
      email: 'usman.tariq@student.gtiu.edu.pk',
      phone: '+92 321 4455667',
      prog: 'BSCS',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2002-11-12',
      pin: '1122',
      address: 'Main Bazar, Bheekhi Road, Sheikhupura'
    },
    // 4. Zainab Bibi - Consistent Performer
    {
      reg: 'GTIU-2022-CS-104',
      name: 'Zainab Bibi',
      father: 'Abdul Rehman',
      email: 'zainab.bibi@student.gtiu.edu.pk',
      phone: '+92 333 9988776',
      prog: 'BSCS',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2003-02-28',
      pin: '3344',
      address: 'Ghang Road, Sheikhupura'
    },
    // 5. Hamza Bilal - At-Risk Student (Low CGPA ~1.85, Low Attendance ~68%)
    {
      reg: 'GTIU-2022-CS-105',
      name: 'Hamza Bilal',
      father: 'Bilal Siddiqui',
      email: 'hamza.bilal@student.gtiu.edu.pk',
      phone: '+92 345 1122334',
      prog: 'BSCS',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2002-09-05',
      pin: '9900',
      address: 'Farooqabad Road, Sheikhupura'
    },
    // 6. Ayesha Malik - BSSE Achiever
    {
      reg: 'GTIU-2022-SE-201',
      name: 'Ayesha Malik',
      father: 'Tariq Malik',
      email: 'ayesha.malik@student.gtiu.edu.pk',
      phone: '+92 302 3344556',
      prog: 'BSSE',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2003-06-18',
      pin: '4455',
      address: 'Shahdara Town, Lahore-Sheikhupura Road'
    },
    // 7. Bilal Hassan - BSSE At-Risk in Attendance (64%)
    {
      reg: 'GTIU-2022-SE-202',
      name: 'Bilal Hassan',
      father: 'Hassan Raza',
      email: 'bilal.hassan@student.gtiu.edu.pk',
      phone: '+92 312 6677889',
      prog: 'BSSE',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2002-05-14',
      pin: '7788',
      address: 'Chowk Yadgar, Sheikhupura'
    },
    // 8. Maryam Jamil - BSEE Student
    {
      reg: 'GTIU-2022-EE-301',
      name: 'Maryam Jamil',
      father: 'Jamil Akhtar',
      email: 'maryam.jamil@student.gtiu.edu.pk',
      phone: '+92 305 8899001',
      prog: 'BSEE',
      batch: 'Fall 2022',
      sem: 4,
      status: 'Active',
      dob: '2003-10-30',
      pin: '5566',
      address: 'Lahore Road, Near Stadium, Sheikhupura'
    }
  ];

  const studentIdMap = new Map();

  for (const s of students) {
    const [existing] = await db.query('SELECT id FROM students WHERE registration_no = ?', [s.reg]);
    let studentId;
    if (existing.length > 0) {
      studentId = existing[0].id;
    } else {
      const [res] = await db.query(`
        INSERT INTO students (registration_no, name, father_name, email, phone, program_code, batch, current_semester, status, dob, pin, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [s.reg, s.name, s.father, s.email, s.phone, s.prog, s.batch, s.sem, s.status, s.dob, s.pin, s.address]);
      studentId = res.insertId;
    }
    studentIdMap.set(s.reg, studentId);
  }

  // 4. Seed Course Enrollments and Results across 4 Semesters
  console.log('[Seed] Seeding enrollments and semester results...');

  const semesterCourseDefs = {
    1: [
      { code: 'CS101', teacher: 'Dr. Shahzad Rafiq', ch: 3, max: 100 },
      { code: 'CS102', teacher: 'Engr. Zeeshan Ali', ch: 4, max: 100 },
      { code: 'MT101', teacher: 'Prof. Muhammad Aslam', ch: 3, max: 100 },
      { code: 'IS101', teacher: 'Dr. Hafiz Bilal Tahir', ch: 2, max: 100 }
    ],
    2: [
      { code: 'CS201', teacher: 'Dr. Shahzad Rafiq', ch: 4, max: 100 },
      { code: 'CS202', teacher: 'Ms. Amna Nadeem', ch: 3, max: 100 },
      { code: 'EE201', teacher: 'Engr. Tahir Farooq', ch: 4, max: 100 },
      { code: 'PK101', teacher: 'Mr. Salman Qureshi', ch: 2, max: 100 }
    ],
    3: [
      { code: 'CS301', teacher: 'Dr. Arshad Nawaz', ch: 4, max: 100 },
      { code: 'CS302', teacher: 'Dr. Shahzad Rafiq', ch: 4, max: 100 },
      { code: 'MT201', teacher: 'Prof. Muhammad Aslam', ch: 3, max: 100 },
      { code: 'SE301', teacher: 'Engr. Sana Javed', ch: 3, max: 100 }
    ],
    4: [ // Current semester registered courses & sessional marks
      { code: 'CS401', teacher: 'Dr. Usman Ghani', ch: 4, max: 100 },
      { code: 'CS402', teacher: 'Dr. Arshad Nawaz', ch: 3, max: 100 },
      { code: 'CS403', teacher: 'Engr. Hamza Riaz', ch: 4, max: 100 },
      { code: 'AI401', teacher: 'Dr. Mian Muhammad Bilal', ch: 3, max: 100 }
    ]
  };

  // Student baseline profiles for realistic grade variance
  // Ali Khan: top grades (85-94)
  // Fatima Noor: good grades (78-88)
  // Usman Tariq: average (65-76)
  // Zainab Bibi: good grades (76-86)
  // Hamza Bilal: at-risk (42-60, with an F in CS202)
  // Ayesha Malik: top grades (80-90)
  // Bilal Hassan: average (65-75)
  // Maryam Jamil: good (72-84)

  const studentPerformance = {
    'GTIU-2022-CS-101': { base: 88, variance: 5, failCourse: null },
    'GTIU-2022-CS-102': { base: 82, variance: 6, failCourse: null },
    'GTIU-2022-CS-103': { base: 70, variance: 7, failCourse: null },
    'GTIU-2022-CS-104': { base: 80, variance: 5, failCourse: null },
    'GTIU-2022-CS-105': { base: 52, variance: 10, failCourse: 'CS202' }, // Failed Discrete Math
    'GTIU-2022-SE-201': { base: 84, variance: 6, failCourse: null },
    'GTIU-2022-SE-202': { base: 68, variance: 8, failCourse: null },
    'GTIU-2022-EE-301': { base: 76, variance: 6, failCourse: null }
  };

  for (const [reg, studentId] of studentIdMap.entries()) {
    const perf = studentPerformance[reg] || { base: 75, variance: 5, failCourse: null };

    for (let semNum = 1; semNum <= 4; semNum++) {
      const semCourses = semesterCourseDefs[semNum];
      const evaluatedCourses = [];

      for (let i = 0; i < semCourses.length; i++) {
        const c = semCourses[i];
        
        // Enroll student
        const term = semNum % 2 === 1 ? 'Fall' : 'Spring';
        const year = semNum <= 2 ? '2022-2023' : '2023-2024';
        const status = semNum === 4 ? 'Registered' : 'Completed';

        const [enrRes] = await db.query(`
          INSERT INTO enrollments (student_id, course_code, semester_number, teacher_name, section, academic_year, term, status)
          VALUES (?, ?, ?, ?, 'A', ?, ?, ?)
        `, [studentId, c.code, semNum, c.teacher, year, term, status]);
        
        const enrollmentId = enrRes.insertId;

        // Determine marks
        let targetMarks;
        if (perf.failCourse === c.code) {
          targetMarks = 42; // Fail grade F
        } else {
          // pseudo-random deterministic variation based on student + course
          const offset = ((studentId * 7 + i * 13 + semNum * 11) % (perf.variance * 2 + 1)) - perf.variance;
          targetMarks = Math.min(96, Math.max(48, perf.base + offset));
        }

        // Marks breakdown: Assignment (15%), Quiz (15%), Midterm (20%), Final (50%)
        let assign = Math.round((targetMarks * 0.15 + ((i % 3) * 0.5)) * 10) / 10;
        let quiz = Math.round((targetMarks * 0.15 - ((i % 2) * 0.5)) * 10) / 10;
        let mid = Math.round((targetMarks * 0.20 + ((i % 4) * 0.4)) * 10) / 10;
        let finalMarks = Math.round((targetMarks - (assign + quiz + mid)) * 10) / 10;

        // If sem 4 (current semester in progress), final exam is pending (or upcoming)
        if (semNum === 4) {
          finalMarks = 0; // Final not yet conducted
        }

        const totalObtained = semNum === 4 ? (assign + quiz + mid) : (assign + quiz + mid + finalMarks);
        const totalMax = semNum === 4 ? 50 : 100;
        const percentage = calculateSubjectPercentage(totalObtained, totalMax);
        const { grade, gradePoint } = getGradeAndPoints(semNum === 4 ? (percentage) : totalObtained);
        const isPassed = gradePoint > 0 ? 1 : 0;

        await db.query(`
          INSERT INTO results (
            enrollment_id, student_id, course_code, semester_number,
            assignment_marks, quiz_marks, mid_marks, final_marks,
            total_obtained, total_max, percentage, grade, grade_point, is_passed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          enrollmentId, studentId, c.code, semNum,
          assign, quiz, mid, finalMarks,
          totalObtained, totalMax, percentage, grade, gradePoint, isPassed
        ]);

        evaluatedCourses.push({
          courseCode: c.code,
          creditHours: c.ch,
          gradePoint: semNum === 4 ? 0 : gradePoint,
          marksObtained: totalObtained,
          totalMarks: totalMax
        });
      }

      // Calculate and save semester summary
      if (semNum < 4) {
        const semStats = calculateSemesterGPA(evaluatedCourses);
        const term = semNum % 2 === 1 ? 'Fall' : 'Spring';
        const year = semNum <= 2 ? '2022-2023' : '2023-2024';

        await db.query(`
          INSERT INTO semesters (
            student_id, semester_number, academic_year, term,
            sgpa, earned_ch, total_ch, total_obtained, total_max, percentage
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          studentId, semNum, year, term,
          semStats.sgpa, semStats.earnedCH, semStats.totalCH,
          semStats.totalObtained, semStats.totalMaxMarks, semStats.percentage
        ]);
      }
    }
  }

  // 5. Seed Attendance for the last 3 months
  console.log('[Seed] Seeding attendance records (last 90 days)...');
  const sem4Courses = ['CS401', 'CS402', 'CS403', 'AI401'];
  
  // Generate dates for past 90 days (excluding Sundays)
  const today = new Date();
  const attendanceDates = [];
  for (let d = 80; d >= 1; d--) {
    const cur = new Date(today);
    cur.setDate(cur.getDate() - d);
    const day = cur.getDay();
    if (day !== 0) { // Exclude Sundays
      attendanceDates.push(cur.toISOString().split('T')[0]);
    }
  }

  for (const [reg, studentId] of studentIdMap.entries()) {
    // Hamza Bilal (CS-105) has poor attendance (~66%)
    // Bilal Hassan (SE-202) has poor attendance (~64%)
    // Others have 82% - 94% attendance
    let presentProbability = 0.88;
    if (reg === 'GTIU-2022-CS-105') presentProbability = 0.66;
    if (reg === 'GTIU-2022-SE-202') presentProbability = 0.64;
    if (reg === 'GTIU-2022-CS-101') presentProbability = 0.95;

    for (const courseCode of sem4Courses) {
      // Pick 20-24 lecture dates for each course
      const courseDates = attendanceDates.filter((_, idx) => (idx + courseCode.charCodeAt(2)) % 3 === 0);

      for (let i = 0; i < courseDates.length; i++) {
        const dateStr = courseDates[i];
        const pseudoRand = ((studentId * 31 + i * 17 + courseCode.charCodeAt(3)) % 100) / 100;
        let status = 'present';
        if (pseudoRand > presentProbability) {
          status = pseudoRand > (presentProbability + 0.08) ? 'absent' : 'leave';
        }

        await db.query(`
          INSERT INTO attendance (student_id, course_code, lecture_date, status, remarks)
          VALUES (?, ?, ?, ?, ?)
        `, [studentId, courseCode, dateStr, status, status === 'leave' ? 'Approved medical/casual leave' : null]);
      }
    }
  }

  // 6. Seed Timetable
  console.log('[Seed] Seeding weekly timetable...');
  const timetableSlots = [
    { day: 'Monday', start: '08:30:00', end: '10:00:00', code: 'CS401', title: 'Operating Systems', teacher: 'Dr. Usman Ghani', room: 'Lab 3 (Computing)' },
    { day: 'Monday', start: '10:15:00', end: '11:45:00', code: 'CS402', title: 'Design and Analysis of Algorithms', teacher: 'Dr. Arshad Nawaz', room: 'Lecture Hall 102' },
    { day: 'Tuesday', start: '08:30:00', end: '10:00:00', code: 'CS403', title: 'Computer Communication & Networks', teacher: 'Engr. Hamza Riaz', room: 'Lab 1 (Networking)' },
    { day: 'Tuesday', start: '10:15:00', end: '11:45:00', code: 'AI401', title: 'Introduction to Artificial Intelligence', teacher: 'Dr. Mian Muhammad Bilal', room: 'Lecture Hall 104' },
    { day: 'Wednesday', start: '08:30:00', end: '10:00:00', code: 'CS401', title: 'Operating Systems', teacher: 'Dr. Usman Ghani', room: 'Lecture Hall 102' },
    { day: 'Wednesday', start: '11:00:00', end: '12:30:00', code: 'CS402', title: 'Design and Analysis of Algorithms', teacher: 'Dr. Arshad Nawaz', room: 'Lecture Hall 102' },
    { day: 'Thursday', start: '09:00:00', end: '10:30:00', code: 'CS403', title: 'Computer Communication & Networks', teacher: 'Engr. Hamza Riaz', room: 'Lecture Hall 105' },
    { day: 'Thursday', start: '11:00:00', end: '12:30:00', code: 'AI401', title: 'Introduction to Artificial Intelligence', teacher: 'Dr. Mian Muhammad Bilal', room: 'AI & Data Science Lab' },
    { day: 'Friday', start: '08:30:00', end: '11:30:00', code: 'CS401', title: 'Operating Systems - Practical Lab', teacher: 'Engr. Zeeshan Ali', room: 'Systems Lab' }
  ];

  for (const t of timetableSlots) {
    await db.query(`
      INSERT INTO timetable (program_code, semester_number, section, day_of_week, start_time, end_time, course_code, course_title, teacher_name, room)
      VALUES ('BSCS', 4, 'A', ?, ?, ?, ?, ?, ?, ?)
    `, [t.day, t.start, t.end, t.code, t.title, t.teacher, t.room]);
  }

  // 7. Seed Exam Schedule
  console.log('[Seed] Seeding upcoming exam schedule...');
  const examSlots = [
    { code: 'CS401', title: 'Operating Systems', date: '2026-11-20', start: '09:00:00', end: '12:00:00', room: 'Exam Hall A', seat: 'ROW-1' },
    { code: 'CS402', title: 'Design and Analysis of Algorithms', date: '2026-11-23', start: '09:00:00', end: '12:00:00', room: 'Exam Hall A', seat: 'ROW-1' },
    { code: 'CS403', title: 'Computer Communication & Networks', date: '2026-11-26', start: '09:00:00', end: '12:00:00', room: 'Exam Hall B', seat: 'ROW-2' },
    { code: 'AI401', title: 'Introduction to Artificial Intelligence', date: '2026-11-29', start: '09:00:00', end: '12:00:00', room: 'Auditorium', seat: 'SEC-C' }
  ];

  for (const es of examSlots) {
    await db.query(`
      INSERT INTO exam_schedule (program_code, semester_number, course_code, course_title, exam_date, start_time, end_time, room, seat_no_prefix)
      VALUES ('BSCS', 4, ?, ?, ?, ?, ?, ?, ?)
    `, [es.code, es.title, es.date, es.start, es.end, es.room, es.seat]);
  }

  // 8. Seed Admin Account
  console.log('[Seed] Seeding admin account...');
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const rawAdminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedAdminPass = rawAdminPass.startsWith('$2') 
    ? rawAdminPass 
    : bcrypt.hashSync(rawAdminPass, 10);

  const [existingAdmin] = await db.query('SELECT id FROM admins WHERE username = ?', [adminUsername]);
  if (existingAdmin.length === 0) {
    await db.query(`
      INSERT INTO admins (username, password_hash, role)
      VALUES (?, ?, 'SuperAdmin')
    `, [adminUsername, hashedAdminPass]);
  } else {
    await db.query(`
      UPDATE admins SET password_hash = ? WHERE username = ?
    `, [hashedAdminPass, adminUsername]);
  }

  console.log('[Seed] Seeding completed successfully!');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}

module.exports = seed;

