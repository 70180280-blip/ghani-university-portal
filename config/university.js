/**
 * University Configuration - Ghani Technical & Islamic University
 * 
 * Centralized source of truth for institute information, branding, grading scales,
 * and academic rules. Read by every page, the transcript, and the admit card.
 */

module.exports = {
  name: 'Ghani Technical & Islamic University',
  shortName: 'GTIU',
  portalTitle: 'Ghani University Portal',
  city: 'Sheikhupura, Pakistan',
  address: 'GT Road, Sheikhupura Bypass Campus, Sheikhupura, Punjab, Pakistan',
  phone: '+92 56 3781200 / +92 56 3781201',
  email: 'registrar@gtiu.edu.pk | info@gtiu.edu.pk',
  website: 'https://gtiu.edu.pk',
  tagline: 'Excellence in Modern Technology & Islamic Values',
  
  // Institute structure
  faculties: [
    'Faculty of Computing & Information Technology',
    'Faculty of Engineering & Technology',
    'Faculty of Islamic Studies & Humanities',
    'Faculty of Management Sciences'
  ],

  departments: [
    'Department of Computer Science',
    'Department of Software Engineering',
    'Department of Electrical Engineering',
    'Department of Islamic Studies & Ethics',
    'Department of Business Administration'
  ],

  programs: [
    {
      code: 'BSCS',
      name: 'Bachelor of Science in Computer Science',
      degreeTitle: 'Bachelor of Science in Computer Science',
      totalCreditHours: 130,
      totalSemesters: 8
    },
    {
      code: 'BSSE',
      name: 'Bachelor of Science in Software Engineering',
      degreeTitle: 'Bachelor of Science in Software Engineering',
      totalCreditHours: 132,
      totalSemesters: 8
    },
    {
      code: 'BSEE',
      name: 'Bachelor of Science in Electrical Engineering',
      degreeTitle: 'Bachelor of Science in Electrical Engineering',
      totalCreditHours: 136,
      totalSemesters: 8
    },
    {
      code: 'BBA',
      name: 'Bachelor of Business Administration',
      degreeTitle: 'Bachelor of Business Administration',
      totalCreditHours: 126,
      totalSemesters: 8
    }
  ],

  // Academic grading policy (as specified in guidelines)
  // Grade points: A=4.00, A-=3.67, B+=3.33, B=3.00, B-=2.67, C+=2.33, C=2.00, C-=1.67, D=1.00, F=0.00
  gradingScale: [
    { grade: 'A',  gradePoint: 4.00, minMarks: 85, maxMarks: 100, description: 'Outstanding' },
    { grade: 'A-', gradePoint: 3.67, minMarks: 80, maxMarks: 84.99, description: 'Excellent' },
    { grade: 'B+', gradePoint: 3.33, minMarks: 75, maxMarks: 79.99, description: 'Very Good' },
    { grade: 'B',  gradePoint: 3.00, minMarks: 70, maxMarks: 74.99, description: 'Good' },
    { grade: 'B-', gradePoint: 2.67, minMarks: 65, maxMarks: 69.99, description: 'Above Average' },
    { grade: 'C+', gradePoint: 2.33, minMarks: 61, maxMarks: 64.99, description: 'Average' },
    { grade: 'C',  gradePoint: 2.00, minMarks: 58, maxMarks: 60.99, description: 'Satisfactory' },
    { grade: 'C-', gradePoint: 1.67, minMarks: 55, maxMarks: 57.99, description: 'Pass' },
    { grade: 'D',  gradePoint: 1.00, minMarks: 50, maxMarks: 54.99, description: 'Low Pass' },
    { grade: 'F',  gradePoint: 0.00, minMarks: 0,  maxMarks: 49.99, description: 'Fail' }
  ],

  // Attendance policy
  minimumAttendance: 75, // in percent

  // Optional student login extra verification (configurable, OFF by default)
  optionalLoginVerification: {
    enabled: false, // Set to true to require extra verification on login
    field: 'dob',   // 'dob' (date of birth YYYY-MM-DD) or 'pin' (4-digit security PIN)
    label: 'Date of Birth (YYYY-MM-DD)'
  },

  // Official Branding Colors from Palette (#1E3A8A, #3B82F6, #93C5FD, #F8FAFC, #FFFFFF)
  colors: {
    navy: '#1E3A8A',        // Primary Deep Navy
    blue: '#3B82F6',        // Vibrant Royal Blue
    skyBlue: '#3B82F6',     // Primary Accent
    softSky: '#93C5FD',     // Highlight & Subtle Accent
    white: '#FFFFFF',       // Crisp White
    lightBg: '#F8FAFC',     // Clean Off-White Background
    red: '#C4161C',         // Warnings and critical actions
    charcoal: '#4A4A4A',    // Secondary text
    darkBg: '#0B1120',
    darkCard: '#1E293B'
  },

  // Logo configuration
  logo: {
    path: '/images/logo.png',
    placeholderText: 'GTIU'
  }
};

