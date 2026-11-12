/**
 * PDF Generation Service - Interim Transcript & Examination Admit Card
 * 
 * Uses PDFKit to produce high-resolution, vector-accurate, print-ready documents
 * conforming to official university ERP formatting.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const universityConfig = require('../../config/university');

/**
 * Generate Official Interim Transcript PDF
 * @param {Object} student 
 * @param {Array} semestersWithCourses 
 * @param {Object} overallStats 
 * @returns {Promise<Buffer>}
 */
function generateInterimTranscriptPDF(student, semestersWithCourses = [], overallStats = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: `Interim Transcript - ${student.registration_no}`,
        Author: universityConfig.name,
        Subject: 'Official Academic Transcript'
      }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Decorative Header Band
    doc.rect(36, 36, 523, 5).fill(universityConfig.colors.navy);

    // University Logo / Emblem (or text placeholder)
    const logoPath = path.resolve(process.cwd(), 'public/images/logo.png');
    let hasLogoImage = false;
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 42, 48, { width: 45, height: 45 });
        hasLogoImage = true;
      } catch (e) {
        hasLogoImage = false;
      }
    }

    if (!hasLogoImage) {
      doc.rect(42, 48, 45, 45).fill('#0B2A7A');
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('GTIU', 45, 62, { width: 39, align: 'center' });
    }

    // Official University Titles
    doc.fillColor(universityConfig.colors.navy).fontSize(16).font('Helvetica-Bold')
      .text(universityConfig.name.toUpperCase(), 95, 48);

    doc.fillColor(universityConfig.colors.skyBlue).fontSize(9).font('Helvetica-Bold')
      .text('OFFICE OF THE CONTROLLER OF EXAMINATIONS', 95, 66);

    doc.fillColor(universityConfig.colors.charcoal).fontSize(8).font('Helvetica')
      .text(`${universityConfig.city} | ${universityConfig.address}`, 95, 78)
      .text(`Email: ${universityConfig.email} | Web: ${universityConfig.website}`, 95, 88);

    doc.moveDown(1.5);

    // Document Title Banner
    const bannerY = 106;
    doc.rect(36, bannerY, 523, 20).fill('#0B2A7A');
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
      .text('OFFICIAL INTERIM ACADEMIC TRANSCRIPT', 36, bannerY + 5, { width: 523, align: 'center' });

    // Student Information Grid
    const infoY = 132;
    doc.rect(36, infoY, 523, 62).lineWidth(1).strokeColor('#CBD5E1').stroke();
    doc.fillColor('#F8FAFC').rect(37, infoY + 1, 521, 60).fill();

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0B2A7A');
    doc.text('STUDENT NAME:', 46, infoY + 8);
    doc.text("FATHER'S NAME:", 46, infoY + 22);
    doc.text('REGISTRATION NO:', 46, infoY + 36);
    doc.text('ACADEMIC PROGRAM:', 46, infoY + 50);

    doc.font('Helvetica').fillColor('#1E293B');
    doc.text(student.name.toUpperCase(), 150, infoY + 8);
    doc.text(student.father_name.toUpperCase(), 150, infoY + 22);
    doc.text(student.registration_no, 150, infoY + 36);
    doc.text(`${student.program_name || student.program_code}`, 150, infoY + 50);

    doc.font('Helvetica-Bold').fillColor('#0B2A7A');
    doc.text('BATCH / INTAKE:', 340, infoY + 8);
    doc.text('CURRENT STATUS:', 340, infoY + 22);
    doc.text('DATE OF ISSUE:', 340, infoY + 36);
    doc.text('DEGREE DURATION:', 340, infoY + 50);

    doc.font('Helvetica').fillColor('#1E293B');
    doc.text(student.batch, 440, infoY + 8);
    doc.text(student.status || 'Active / Regular', 440, infoY + 22);
    doc.text(new Date().toISOString().split('T')[0], 440, infoY + 36);
    doc.text('4 Years (8 Semesters)', 440, infoY + 50);

    let currentY = 202;

    // Render Each Semester
    semestersWithCourses.forEach((sem, semIdx) => {
      // Check page overflow
      if (currentY > 680) {
        doc.addPage();
        currentY = 40;
      }

      // Semester Header Box
      doc.rect(36, currentY, 523, 16).fill('#1E293B');
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text(`SEMESTER ${sem.semester_number} (${sem.term || 'Fall'} ${sem.academic_year || '2023'})`, 42, currentY + 4);

      currentY += 16;

      // Table Header
      doc.rect(36, currentY, 523, 14).fill('#E2E8F0');
      doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold');
      doc.text('Course Code', 42, currentY + 3);
      doc.text('Course Title', 110, currentY + 3);
      doc.text('CH', 290, currentY + 3);
      doc.text('Marks', 330, currentY + 3);
      doc.text('%age', 380, currentY + 3);
      doc.text('Grade', 430, currentY + 3);
      doc.text('Grade Point', 480, currentY + 3);

      currentY += 14;

      // Table Rows
      const courses = sem.courses || [];
      courses.forEach((c, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, currentY, 523, 13).fill(bg);

        doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
        doc.text(c.course_code, 42, currentY + 2);
        doc.text((c.title || c.course_title || '').substring(0, 36), 110, currentY + 2);
        doc.text(String(c.credit_hours || 3), 295, currentY + 2);
        doc.text(`${c.total_obtained || 0} / ${c.total_max || 100}`, 330, currentY + 2);
        doc.text(`${c.percentage || 0}%`, 380, currentY + 2);

        // Fail grade in red
        const isF = (c.grade || '').toUpperCase() === 'F';
        doc.fillColor(isF ? '#C4161C' : '#0B2A7A').font(isF ? 'Helvetica-Bold' : 'Helvetica')
          .text(c.grade || 'P', 435, currentY + 2);

        doc.fillColor('#334155').font('Helvetica')
          .text(Number(c.grade_point || 0).toFixed(2), 485, currentY + 2);

        currentY += 13;
      });

      // Semester Summary Row
      doc.rect(36, currentY, 523, 14).fill('#EFF6FF');
      doc.fillColor('#0B2A7A').fontSize(7.5).font('Helvetica-Bold');
      doc.text(`Semester Total CH: ${sem.total_ch || 0}   |   Earned CH: ${sem.earned_ch || 0}   |   SGPA: ${Number(sem.sgpa || 0).toFixed(2)}   |   Cumulative CGPA: ${Number(sem.cgpa || overallStats.cgpa || 0).toFixed(2)}`, 42, currentY + 3);

      currentY += 18;
    });

    // Overall Summary Card
    if (currentY > 660) {
      doc.addPage();
      currentY = 40;
    }

    doc.moveDown(0.5);
    doc.rect(36, currentY, 523, 30).fill('#0B2A7A');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    doc.text('CUMULATIVE ACADEMIC RECORD SUMMARY', 42, currentY + 5);

    doc.fontSize(8.5).font('Helvetica');
    doc.text(`Required Credit Hours: ${student.total_ch_required || 130}   |   Earned Credit Hours: ${overallStats.earnedCH || 0}   |   Overall %: ${overallStats.overallPercentage || 0}%   |   FINAL CGPA: ${Number(overallStats.cgpa || 0).toFixed(2)}`, 42, currentY + 17);

    currentY += 40;

    // Grading Legend & Signatures
    doc.rect(36, currentY, 523, 32).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
    doc.fillColor('#475569').fontSize(6.5).font('Helvetica')
      .text('GRADING SCALE: A (4.00, >=85%), A- (3.67, 80-84%), B+ (3.33, 75-79%), B (3.00, 70-74%), B- (2.67, 65-69%), C+ (2.33, 61-64%), C (2.00, 58-60%), C- (1.67, 55-57%), D (1.00, 50-54%), F (0.00, <50%).', 42, currentY + 4, { width: 510 })
      .text('Note: This is a verified electronic interim transcript issued for academic and evaluation purposes.', 42, currentY + 18);

    currentY += 42;

    // Official Signature Blocks
    doc.strokeColor('#94A3B8').lineWidth(1)
      .moveTo(50, currentY + 25).lineTo(180, currentY + 25).stroke()
      .moveTo(380, currentY + 25).lineTo(510, currentY + 25).stroke();

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1E293B')
      .text('Prepared & Checked By', 50, currentY + 28, { width: 130, align: 'center' })
      .text('Controller of Examinations', 380, currentY + 28, { width: 130, align: 'center' });

    doc.end();
  });
}

/**
 * Generate Examination Admit Card / Roll Number Slip PDF
 * @param {Object} student 
 * @param {Array} registeredCourses 
 * @param {Array} examSchedule 
 * @returns {Promise<Buffer>}
 */
function generateAdmitCardPDF(student, registeredCourses = [], examSchedule = []) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: `Admit Card - ${student.registration_no}`,
        Author: universityConfig.name,
        Subject: 'Official Examination Admit Card'
      }
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Decorative Header Band
    doc.rect(36, 36, 523, 6).fill(universityConfig.colors.navy);

    // University Logo / Emblem
    const logoPath = path.resolve(process.cwd(), 'public/images/logo.png');
    let hasLogo = false;
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 42, 48, { width: 45, height: 45 });
        hasLogo = true;
      } catch (e) {
        hasLogo = false;
      }
    }
    if (!hasLogo) {
      doc.rect(42, 48, 45, 45).fill('#0B2A7A');
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('GTIU', 45, 62, { width: 39, align: 'center' });
    }

    // Header Text
    doc.fillColor(universityConfig.colors.navy).fontSize(16).font('Helvetica-Bold')
      .text(universityConfig.name.toUpperCase(), 95, 48);

    doc.fillColor(universityConfig.colors.skyBlue).fontSize(9).font('Helvetica-Bold')
      .text('CONTROLLER OF EXAMINATIONS - ROLL NUMBER SLIP / ADMIT CARD', 95, 66);

    doc.fillColor(universityConfig.colors.charcoal).fontSize(8).font('Helvetica')
      .text(`Sheikhupura Campus | End Semester Examinations - Spring 2024`, 95, 78);

    // Admit Card Banner
    const bannerY = 104;
    doc.rect(36, bannerY, 523, 20).fill('#0B2A7A');
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
      .text('EXAMINATION ADMISSION SLIP (STUDENT COPY)', 36, bannerY + 5, { width: 523, align: 'center' });

    // Student Information Grid + Photo Placeholder
    const infoY = 130;
    doc.rect(36, infoY, 430, 85).lineWidth(1).strokeColor('#CBD5E1').stroke();
    doc.fillColor('#F8FAFC').rect(37, infoY + 1, 428, 83).fill();

    // Photo Box Placeholder
    doc.rect(475, infoY, 84, 85).lineWidth(1).strokeColor('#94A3B8').stroke();
    doc.fillColor('#F1F5F9').rect(476, infoY + 1, 82, 83).fill();
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold')
      .text('STUDENT PHOTO', 476, infoY + 32, { width: 82, align: 'center' })
      .font('Helvetica').fontSize(6.5)
      .text('(Affix passport size photograph)', 478, infoY + 44, { width: 78, align: 'center' });

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0B2A7A');
    doc.text('CANDIDATE NAME:', 46, infoY + 10);
    doc.text("FATHER'S NAME:", 46, infoY + 26);
    doc.text('REGISTRATION NO:', 46, infoY + 42);
    doc.text('PROGRAM & BATCH:', 46, infoY + 58);
    doc.text('EXAMINATION CENTER:', 46, infoY + 74);

    doc.font('Helvetica').fillColor('#1E293B');
    doc.text(student.name.toUpperCase(), 155, infoY + 10);
    doc.text(student.father_name.toUpperCase(), 155, infoY + 26);
    doc.text(student.registration_no, 155, infoY + 42);
    doc.text(`${student.program_code} - ${student.batch}`, 155, infoY + 58);
    doc.text('GTIU Main Academic Block, Sheikhupura Bypass Campus', 155, infoY + 74);

    // Examination Dates Table
    let currentY = 228;
    doc.rect(36, currentY, 523, 18).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
      .text('REGISTERED COURSES & DATE SHEET', 42, currentY + 5);

    currentY += 18;

    // Table Header
    doc.rect(36, currentY, 523, 16).fill('#E2E8F0');
    doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold');
    doc.text('Course Code', 42, currentY + 4);
    doc.text('Course Title', 115, currentY + 4);
    doc.text('Exam Date', 290, currentY + 4);
    doc.text('Exam Time', 375, currentY + 4);
    doc.text('Room', 450, currentY + 4);
    doc.text('Invig. Sign', 505, currentY + 4);

    currentY += 16;

    const scheduleList = examSchedule && examSchedule.length > 0 ? examSchedule : [
      { course_code: 'CS401', course_title: 'Operating Systems', exam_date: '2026-11-20', start_time: '09:00:00', end_time: '12:00:00', room: 'Hall A' },
      { course_code: 'CS402', course_title: 'Design and Analysis of Algorithms', exam_date: '2026-11-23', start_time: '09:00:00', end_time: '12:00:00', room: 'Hall A' },
      { course_code: 'CS403', course_title: 'Computer Communication & Networks', exam_date: '2026-11-26', start_time: '09:00:00', end_time: '12:00:00', room: 'Hall B' },
      { course_code: 'AI401', course_title: 'Introduction to Artificial Intelligence', exam_date: '2026-11-29', start_time: '09:00:00', end_time: '12:00:00', room: 'Auditorium' }
    ];

    scheduleList.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(36, currentY, 523, 20).fill(bg);

      doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
      doc.text(item.course_code, 42, currentY + 5);
      doc.text((item.course_title || item.title || '').substring(0, 32), 115, currentY + 5);
      doc.text(String(item.exam_date || 'TBA'), 290, currentY + 5);
      doc.text(`${item.start_time || '09:00'} - ${item.end_time || '12:00'}`, 375, currentY + 5);
      doc.text(item.room || 'Hall A', 450, currentY + 5);

      // Signature line for invigilator
      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(500, currentY + 14).lineTo(550, currentY + 14).stroke();

      currentY += 20;
    });

    currentY += 15;

    // Instructions Box
    doc.rect(36, currentY, 523, 110).lineWidth(1).strokeColor('#EF4444').stroke();
    doc.fillColor('#FEF2F2').rect(37, currentY + 1, 521, 108).fill();

    doc.fillColor('#B91C1C').fontSize(8.5).font('Helvetica-Bold')
      .text('IMPORTANT INSTRUCTIONS FOR EXAM CANDIDATES:', 46, currentY + 8);

    doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
      .text('1. Entry to the examination hall is strictly prohibited without this Admit Card and official GTIU Student ID Card.', 46, currentY + 22)
      .text('2. Candidates must be seated at least 15 minutes before the start of the examination.', 46, currentY + 34)
      .text('3. Mobile phones, programmable calculators, smart watches, and unauthorized material are strictly prohibited.', 46, currentY + 46)
      .text('4. Candidate must maintain at least 75% attendance in each course to be eligible to sit in the examination.', 46, currentY + 58)
      .text('5. Any violation will lead to disciplinary proceedings under University Unfair Means (UMC) rules.', 46, currentY + 70)
      .text('6. Wearing modest attire conforming to university Islamic ethics code is mandatory.', 46, currentY + 82);

    currentY += 125;

    // Signatures
    doc.strokeColor('#94A3B8').lineWidth(1)
      .moveTo(50, currentY + 25).lineTo(180, currentY + 25).stroke()
      .moveTo(380, currentY + 25).lineTo(510, currentY + 25).stroke();

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1E293B')
      .text('Student Signature', 50, currentY + 28, { width: 130, align: 'center' })
      .text('Controller of Examinations', 380, currentY + 28, { width: 130, align: 'center' });

    doc.end();
  });
}

module.exports = {
  generateInterimTranscriptPDF,
  generateAdmitCardPDF
};

