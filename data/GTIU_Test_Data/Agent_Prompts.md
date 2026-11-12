# GTIU Portal – Agent Prompts for Loading Test Data

Use **Prompt 0 (master)** once at the start of the session, then send **one file-type prompt (1–9)** per task.
Attach the matching batch files (2022–2026) with each prompt.

---

## Prompt 0 – Master prompt (send first)

```
You are a data-loading agent for the "Ghani University Portal" (Ghani Technical & Islamic University, Sheikhupura).
I will give you Excel test-data files. Your job is to load them into our existing database, in the correct tables,
without inventing, changing or deleting any values.

DATA LAYOUT
- 5 batches: 2022, 2023, 2024, 2025, 2026. File names look like GTIU_<YEAR>_<Type>.xlsx.
- 9 file types: Personal_Details, Academic_Summary, Semester_Results, Degree_Audit, Registered_Courses,
  Timetable, Attendance, Interim_Transcript, Admit_Card.
- Student key: "Registration Number" (format GTIU-YYYY-CS-NNN, e.g. GTIU-2026-CS-101). It is unique and is the
  foreign key in every file. The batch is the YYYY part (= "Batch" / "Registration Year" in Personal_Details).
- Row counts per batch (students): 2022=20, 2023=25, 2024=30, 2025=35, 2026=26.
- Current semester (Fall 2026): batch 2022 = Sem 8, 2023 = Sem 6, 2024 = Sem 4, 2025 = Sem 2, 2026 = Sem 1.

RULES
1. Load Personal_Details FIRST (it is the parent table). Every other table must reference an existing Registration Number.
2. Use the database's existing tables/columns where they exist; create a table only if none exists. Map each Excel
   column to the closest existing column and show me the mapping before inserting.
3. Be idempotent: use UPSERT on the natural key (given in each prompt) so running twice never creates duplicates.
4. Keep types: phone numbers and roll numbers are TEXT (keep leading zeros), dates are ISO YYYY-MM-DD, GPA values are
   DECIMAL(3,2), percentages DECIMAL(5,1).
5. Never modify, round, re-order or "fix" values. If something looks wrong, report it and continue.
6. Empty sheets/files (2026 Semester_Results and Interim_Transcript are header-only on purpose) must create 0 rows, not an error.
7. After each load, run and show verification queries: row count per batch vs expected, orphan check
   (rows whose Registration Number is missing in Personal_Details = must be 0), duplicate check on the natural key = 0.
8. Do all work inside a transaction; roll back on any failure and tell me what failed.
9. Finish with a short report: table, rows inserted, rows updated, rows skipped, warnings.
```

---

## Prompt 1 – Personal_Details  (card: Profile & Info)

```
Load the files GTIU_<YEAR>_Personal_Details.xlsx (sheet: Student_Profile) into the students/profile table.
Natural key: Registration Number.
Columns (14): Registration Number, Registration Year, Student Name, Father Name, Gender, Student Contact Number,
Father Contact Number, Email (Test), Date of Birth (Test), Program, Campus, Admission Date, Batch, Student Status.
Expected rows: 2022=20, 2023=25, 2024=30, 2025=35, 2026=26 (total 136).
Rules: contact numbers stay TEXT (e.g. 03132319780). Email is a test address (@students.example.test).
Registration Number must be unique across all batches. Student Status is "Active" for everyone.
Also create a login/user record only if our auth table requires it, using Registration Number as username (do NOT create passwords; ask me).
Verify: count by Batch, and that Registration Year = 'GTIU-' + Batch for every row.
```

## Prompt 2 – Academic_Summary  (cards: My Results header numbers, Registered Courses count, Classes Today)

```
Load GTIU_<YEAR>_Academic_Summary.xlsx (sheet: Academic_Summary). Natural key: Registration Number (one row per student).
Columns: Registration Number, Current Class, Academic Standing, Completed Semesters, Latest SGPA, CGPA,
Registered Courses, Registered Credit Hours, Classes Today, Campus.
Expected rows per batch = number of students (20/25/30/35/26).
Rules: Latest SGPA and CGPA must equal the LAST row of that student in Semester_Results (check after loading
Semester_Results). Completed Semesters = number of Semester_Results rows for the student. Registered Courses must equal the
number of Registered_Courses rows for the student (5) and Registered Credit Hours = sum of their credit hours (15).
"Classes Today" is only a placeholder (0): the app should compute today's classes from the Timetable table, not from this column.
Batch 2026 has 0 completed semesters and SGPA/CGPA = 0 on purpose.
```

## Prompt 3 – Semester_Results  (card: My Results, Performance Insights, What-If Simulator)

```
Load GTIU_<YEAR>_Semester_Results.xlsx (sheet: Semester_Results). Natural key: Registration Number + Semester.
Columns: Registration Number, Semester, Academic Session, Registered CH, Earned CH, SGPA, CGPA, Result Status.
Expected rows: 2022=140 (20 students x 7 sems), 2023=125 (25 x 5), 2024=90 (30 x 3), 2025=35 (35 x 1), 2026=0 (file is empty on purpose).
Rules: Academic Session pattern: odd semester = "<year> Fall", even semester = "<year+1> Spring" counted from the batch year.
CGPA is cumulative (credit-weighted) up to and including that semester. Result Status is Pass/Fail.
Verify: for each student, SGPA of each semester = credit-weighted average of grade points of that semester's rows in Interim_Transcript
(difference must be <= 0.01). Report any mismatch.
```

## Prompt 4 – Degree_Audit  (card: Degree Audit "0 / 130 CH")

```
Load GTIU_<YEAR>_Degree_Audit.xlsx (sheet: Degree_Audit). Natural key: Registration Number.
Columns: Registration Number, Degree Program, Degree Requirement (CH), Completed Credit Hours,
Current Semester Registered CH, Remaining Credit Hours, Degree Completion Percent, Audit Status.
Rules to verify: Degree Requirement = 130; Remaining = 130 - Completed - Current Semester Registered
(for batch 2026 the file shows Remaining = 130 and Completed = 0, keep as given); Completed CH = sum of Earned CH from
Semester_Results; Degree Completion Percent = Completed / 130 x 100 (1 decimal). Audit Status = "In Progress".
Expected rows = number of students per batch.
```

## Prompt 5 – Registered_Courses  (card: Registered Courses "N Courses")

```
Load GTIU_<YEAR>_Registered_Courses.xlsx (sheet: Registered_Courses). Natural key: Registration Number + Course Code + Semester.
Columns: Registration Number, Semester, Course Code, Course Title, Credit Hours, Section, Instructor, Course Status.
Expected rows: 2022=100, 2023=125, 2024=150, 2025=175, 2026=130 (5 courses per student, 3 CH each).
Rules: every batch is registered in its current semester (2022=8, 2023=6, 2024=4, 2025=2, 2026=1). Section = A, Course Status = Registered.
Store courses in a separate course catalogue table (Course Code, Title, Credit Hours) if the schema has one, and link by Course Code.
Verify: each student has exactly 5 courses and 15 credit hours; no duplicate (student, course).
```

## Prompt 6 – Timetable  (card: My Timetable "N Classes Today")

```
Load GTIU_<YEAR>_Timetable.xlsx (sheet: Timetable). Natural key: Registration Number + Day + Time.
Columns: Registration Number, Semester, Day, Time, Course Code, Course Title, Room, Campus.
Expected rows: same as Registered_Courses (100/125/150/175/130): one class per course per week, Monday-Friday.
Rules: every (Registration Number, Course Code) must exist in Registered_Courses; no student has two classes at the same Day+Time.
Day is the English weekday name. Time is text "HH:MM-HH:MM".
Note for the app: "Classes Today" = count of this student's rows where Day = today's weekday name. There are no Saturday/Sunday classes, so it must show 0 on weekends.
```

## Prompt 7 – Attendance  (card: Attendance Report "% Overall")

```
Load GTIU_<YEAR>_Attendance.xlsx. Each workbook has 3 sheets:

(a) Attendance_Sheet  - HUMAN-READABLE REGISTER. Do NOT import this sheet; it is a printable view.
    Rows 1-3 hold Registration Number / Student Name / Father Name for every student (one student per column, from column E).
    From row 5: Date, Day, Course Code, Course Title, then P (present) or A (absent) for every student. Weekends and the
    public holiday (2026-08-14) are greyed and have no P/A.

(b) Daily_Records - IMPORT THIS into the attendance_daily table.
    Natural key: Registration Number + Date + Course Code.
    Columns: Registration Number, Semester, Date, Day, Time, Course Code, Course Title, Attendance Status (Present/Absent).
    Expected rows: 2022=1740, 2023=1600, 2024=1320, 2025=770, 2026=1144.

(c) Attendance_Summary - IMPORT THIS into the attendance_summary table.
    Natural key: Registration Number + Course Code + Semester.
    Columns: Registration Number, Semester, Course Code, Course Title, Total Classes, Attended Classes, Attendance Percent, Attendance Status.
    Expected rows: same as Registered_Courses (100/125/150/175/130).

Period covered (complete calendar months, up to 31 Oct 2026): 2022 = Jul-Oct (4 months), 2023 = Aug-Oct (3), 2024 = Sep-Oct (2),
2025 = Oct (1), 2026 = Sep-Oct (since admission on 2026-09-01).
Verify: Total Classes = count of Daily_Records for that student+course; Attended = count of 'Present'; Percent = Attended/Total x 100 (1 decimal);
Status = 'Eligible' if Percent >= 75 else 'Below 75% Threshold'. Every Daily_Records Day must match that course's weekday in Timetable.
App note: "Overall %" = sum(Attended)/sum(Total) over all the student's courses, and "All Courses Above 75% Threshold" is true only when no course is below 75.
```

## Prompt 8 – Interim_Transcript  (card: Interim Transcript "Verified PDF")

```
Load GTIU_<YEAR>_Interim_Transcript.xlsx (sheet: Interim_Transcript). Natural key: Registration Number + Semester + Course Code.
Columns: Registration Number, Semester, Course Code, Course Title, Credit Hours, Marks, Grade, Grade Points, Result.
Expected rows: 2022=700, 2023=625, 2024=450, 2025=175, 2026=0 (header only on purpose: new students have no transcript yet).
Rules: only COMPLETED semesters appear here (never the current semester). 5 courses x 3 CH per semester.
Grade scale used: A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0 ... ; Result = Pass.
Verify: per student and semester, credit-weighted Grade Points = SGPA in Semester_Results.
```

## Prompt 9 – Admit_Card  (card: Admit Card "Exam Hall Slip")

```
Load GTIU_<YEAR>_Admit_Card.xlsx (sheet: Admit_Card). Natural key: Registration Number + Course Code + Exam Session.
Columns (13): Registration Number, Student Name, Father Name, Program, Semester, Exam Session, Roll Number, Course Code,
Course Title, Exam Date, Exam Time, Exam Venue, Admit Card Status.
Expected rows: 100/125/150/175/130 (one row per registered course).
Rules: Roll Number is TEXT and is the same for all rows of a student (unique per student). Exam Session = "Fall 2026".
Admit Card Status = "Issued (Test)". Student Name / Father Name must match Personal_Details for that Registration Number.
Every (student, course) must exist in Registered_Courses, and a student must not have two exams on the same date.
```

---

## Suggested loading order
1 Personal_Details → 5 Registered_Courses → 6 Timetable → 8 Interim_Transcript → 3 Semester_Results → 2 Academic_Summary → 4 Degree_Audit → 7 Attendance → 9 Admit_Card
