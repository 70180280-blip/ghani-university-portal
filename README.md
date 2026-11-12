# Ghani University Portal (GTIU)
**Ghani Technical & Islamic University, Sheikhupura, Pakistan**

> A production-ready, enterprise-grade University Student Portal and Academic ERP designed in the SAP Fiori design language, built with Node.js, Express, pure MySQL (`mysql2/promise`), and Google Gemini AI.

---

## 🌟 Architecture & Highlights

- **SAP Fiori UI / Design System**: Modular launchpad with live counters grouped into 4 distinct functional quadrants:
  - **Results**: My Results (component breakdown & SGPA progression bar chart), Degree Audit (progress bar, completed vs. pending courses).
  - **Student Academics**: Registered Courses (lecture/lab hours, instructors), My Timetable (live highlights of today's classes), Personal Details.
  - **Student Administration**: Attendance Audit (per-course metrics, red alerts below 75%, month-wise trend line chart, and daily drilldown calendar), Interim Transcript (printable & downloadable official PDF), Examination Admit Card (printable & downloadable official PDF).
  - **AI Assistant (Powered by Gemini & Deterministic Code)**: AI Study Assistant (natural language in English or Roman Urdu), AI Performance Insights (trend analysis & personalized study tips), What-If Simulator (code-calculated SGPA/CGPA projections with AI explanation), Smart Attendance Alert.
- **Strict Calculation Isolation**: All grades, quality points, SGPA, CGPA, attendance rates, absence allowances, and required marks are calculated **strictly in deterministic code** (`src/utils/calculations.js`), never by AI. Gemini acts solely as an institutional advisor and natural language translator.
- **Data Privacy by Design**: Student AI requests only receive the logged-in student's own pre-computed data. Cross-student data exposure is structurally impossible.
- **Resilient AI Fallback Engine**: If Gemini API quota is exceeded, billing is inactive, or a timeout occurs, the system automatically falls back to an intelligent rule-based academic knowledge engine, ensuring 100% uptime.
- **Pure Enterprise MySQL Architecture**:
  - Direct connection to MySQL (local MySQL 8 or cloud MySQL providers like Aiven, AWS RDS, or DigitalOcean with SSL and `ca.pem`).
  - Automatic idempotent schema creation on first run (`src/db/schema.sql`).
  - Diagnostic database check script (`npm run check`) for monitoring table row counts and connection health.
- **Zero Dummy Data Guarantee**:
  - The portal starts completely **CLEAN & EMPTY**.
  - All student records, marks, and attendance data enter the system exclusively through real administrative uploads or manual entry.
  - `npm run seed` is strictly an optional script for offline demo evaluation and is never executed automatically.
- **Admin ERP System (`/admin`)**:
  - **AI Document Ingestion**: Upload any PDF, Excel (`.xlsx`, `.xls`, `.csv`), or PowerPoint (`.pptx`) with a plain instruction. Gemini automatically extracts, maps messy/Urdu/English headers, matches students by registration number or name, and validates impossible numbers (marks > 100, attendance > 100%, negative numbers).
  - **Interactive Preview & Commit**: Review extracted rows, fix unmatched values directly in editable table cells, and commit to the database.
  - **Rollback System**: Delete an upload batch at any time to purge data created by that upload.
  - **AI Admin Natural Search**: Plain language search translated into safe, read-only parameterized queries against whitelisted tables, complete with direct CSV export.
  - **AI Institutional At-Risk Report**: Code flags students with attendance < 75%, CGPA < 2.0, or failed courses; Gemini compiles a structured advisory memo for the Academic Council.
  - **Excel Exports**: One-click `.xlsx` export for students, results, and attendance records.
  - **Security Audit Trail**: Immutable logging of all admin actions with IP tracking.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+, v20+, or v22+ recommended)
- MySQL Server (Local MySQL 8 or Cloud MySQL such as Aiven)

### 1. Installation
Clone or navigate to the project directory and install dependencies:
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```ini
# Server Port
PORT=3000

# Session Secret (random 32+ characters string)
SESSION_SECRET=change_this_to_a_secure_random_string_in_production

# MySQL Database Configuration (Local or Cloud like Aiven)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=defaultdb

# Set DB_SSL=true when connecting to cloud MySQL (Aiven, DigitalOcean, etc.) with ca.pem
DB_SSL=false

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Admin Portal Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

> **Cloud MySQL (Aiven / AWS RDS)**: When `DB_SSL=true`, place the CA certificate as `ca.pem` in the project root directory.

### 3. Verify Database State
Run the diagnostic check script to inspect your MySQL tables:
```bash
npm run check
```
This displays the live row count for every table. On a fresh installation, the portal tables will be cleanly initialized and ready for your first data upload.

> **DEMO ONLY NOTICE**: `npm run seed` exists ONLY for offline local demo presentations and inserts fake sample students. **Do NOT run `npm run seed` in production or with real university data.**

### 4. Start the Application
Run the server:
```bash
npm start
```
Or with auto-reload during development:
```bash
npm run dev
```

Open your browser:
- **Student Portal**: [http://localhost:3000/](http://localhost:3000/)
- **Admin ERP**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔑 Login Guide

### 1. Admin Portal (`/admin`)
- **URL**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Username**: `admin`
- **Password**: Defined in `.env` (default: `admin123`)

### 2. Student Portal (`/`)
- **URL**: [http://localhost:3000/](http://localhost:3000/)
- Students authenticate using their three official identifiers:
  1. **Full Name** (e.g., `Ali Khan`)
  2. **Father's Name** (e.g., `Ahmed Khan`)
  3. **Registration Number** (e.g., `GTIU-2022-CS-101`)

*(Matching is case-insensitive and whitespace-trimmed. Failed attempts are rate-limited to prevent brute-force attacks).*

---

## 📤 How to Upload Your First Real File

1. Log in to the Admin ERP at [http://localhost:3000/admin](http://localhost:3000/admin).
2. Go to the **Upload Files & Data** tab.
3. Choose your file (`.xlsx`, `.xls`, `.csv`, `.pdf`, or `.pptx`):
   - Example 1: Student Roster Excel containing columns for Registration Number, Student Name, Father Name, Contact, Program.
   - Example 2: Marks Sheet containing Course Code, Semester, Assignment, Quiz, Midterm, and Final Marks.
   - Example 3: Attendance Sheet containing Course Code, Date, and Attendance Status (`Present`, `Absent`, `Leave`).
4. (Optional) Provide a plain instruction in Urdu or English (e.g., *"Yeh Fall 2024 batch ke students ka data hai"* or *"Midterm and Final marks for CS101"*).
5. Click **Process File & Generate AI Preview**.
6. The AI parser extracts the data and presents a live table:
   - Green badges indicate valid rows.
   - Any cell can be clicked and edited inline to correct typos or missing values.
7. Click **✓ Confirm & Commit to Database**.
8. Once committed, the button confirms: `✓ Thank You for Submitting the Data`. The records are immediately live in MySQL and available on the student portal!

---

## 🧪 Automated Testing

Run the academic calculation unit test suite:
```bash
npm test
```
All 23 deterministic unit tests verify:
- SGPA, CGPA, quality points, and repeat course logic.
- Attendance percentage, safe absence allowance, and exam eligibility thresholds.
- Required final exam marks calculation.
- What-If academic performance projections.

---

## 📂 Project Structure

```
intro-to-ai-product/
├── config/
│   └── university.js         # Institute details, statutory grading scale, colors
├── public/
│   ├── css/
│   │   └── portal.css        # SAP Fiori styles, dark/light theme CSS variables
│   ├── images/
│   │   ├── logo.png          # Official University Emblem
│   │   └── logo.svg          # Vector Emblem
│   └── js/
│       ├── portal.js         # Student Frontend Controller & Chart.js graph manager
│       └── admin.js          # Admin ERP Frontend Controller
├── src/
│   ├── db/
│   │   ├── pool.js           # Pure MySQL2 promise pool with SSL & auto-table init
│   │   ├── schema.sql        # Standardized DDL schema with foreign keys and indexes
│   │   ├── clearData.js      # Database reset utility (removes student data safely)
│   │   └── seed.js           # Optional offline demo seed script (for demo only)
│   ├── utils/
│   │   └── calculations.js   # Pure deterministic academic calculation engine (CODE ONLY)
│   ├── services/
│   │   ├── aiService.js      # Gemini API client, prompt injection defense, quota fallbacks
│   │   ├── fileParserService.js # Multi-format parser (pdf-parse, xlsx, officeparser)
│   │   └── pdfService.js     # Vector PDF generator for transcripts & admit cards
│   ├── middleware/
│   │   ├── auth.js           # Session auth, login lockout, and rate limiting
│   │   └── security.js       # CSRF protection and audit logger
│   ├── controllers/
│   │   ├── studentAuthController.js
│   │   ├── studentPortalController.js
│   │   ├── studentAiController.js
│   │   ├── adminAuthController.js
│   │   └── adminPortalController.js
│   └── routes/
│       ├── studentRoutes.js
│       └── adminRoutes.js
├── views/
│   ├── index.html            # Student Portal View (Responsive Fiori UI)
│   └── admin.html            # Admin ERP Management View
├── tests/
│   ├── calculations.test.js  # Pure unit tests for academic calculations
│   └── api.test.js           # Integration test suite
├── scripts/
│   ├── check-db.js           # Diagnostic database check script (npm run check)
│   └── generate_sample_files.js # Generates test files for upload preview testing
├── .env.example
├── .gitignore
├── package.json
├── server.js                 # Server entry point
└── README.md
```

---

## ☁️ Cloud Deployment Guide

### Deploying to Render
1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your Git repository.
3. Configure build settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. In **Environment Variables**, set:
   - `SESSION_SECRET`: A long random string.
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: Your chosen admin password.
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`: MySQL connection details.
   - If using SSL with Aiven, provide the CA certificate contents or configure SSL accordingly.

### Deploying to Railway
1. Create a new project on [Railway](https://railway.app/).
2. Add a **MySQL** database service from Railway.
3. Add a **Node.js** service linked to this repository.
4. Set Railway environment variables to reference the provisioned MySQL service (`${{MySQL.MYSQLHOST}}`, `${{MySQL.MYSQLPORT}}`, etc.).
5. Deploy; Railway will run `npm install` and `npm start` automatically.

---

## 🏛️ Handing Over to a Real University Checklist

When transitioning this portal to a real production university environment, follow this operational checklist:

### 1. Institutional Configuration
- Open [`config/university.js`](file:///c:/Users/saifullah/Desktop/intro%20to%20AI%20product/config/university.js).
- Replace placeholders with the university's official postal address, registrar telephone lines, official domain email (`registrar@gtiu.edu.pk`), and website.
- Verify that the grading scale matches the university's official statutory academic regulations.

### 2. Security & Credentials
- [ ] **Rotate Session Secret**: Set a cryptographically strong 64-character random string for `SESSION_SECRET`.
- [ ] **Enforce HTTPS**: Set `cookie.secure = true` in `server.js` when behind an SSL/TLS termination proxy (e.g. NGINX, Cloudflare).
- [ ] **Enable Extra Verification**: In [`config/university.js`](file:///c:/Users/saifullah/Desktop/intro%20to%20AI%20product/config/university.js), set `optionalLoginVerification.enabled = true` to mandate Date of Birth or a 4-digit Security PIN alongside registration numbers.
- [ ] **Admin Credentials**: Change `ADMIN_PASSWORD` in `.env` to a strong passphrase; the system will automatically hash it with bcrypt.
- [ ] **API Keys**: Restrict the `GEMINI_API_KEY` in Google Cloud Console / AI Studio by HTTP referrer or IP whitelist.

### 3. Database Backups & High Availability
- **Automated Daily Dumps**: Schedule cron or Task Scheduler to perform automated daily logical backups:
  ```bash
  mysqldump -h DB_HOST -u DB_USER -p defaultdb --single-transaction --routines --triggers > backup_$(date +%Y%m%d).sql
  ```
- **Point-in-Time Recovery**: Ensure MySQL binary logging (`binlog`) is active with at least 14 days of retention.
- **Off-Site Storage**: Encrypt and sync database dumps to cold Cloud Storage (e.g., GCS, AWS S3) with lifecycle rules.
- **Disaster Recovery Drill**: Run quarterly test restorations into a staging database to verify backup integrity.
