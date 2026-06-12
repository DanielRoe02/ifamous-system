// server/server.js
const express = require("express");
const adminRoutes = require("./routes/admin");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const nodeFs = require("fs");
const nodePath = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;
const bcrypt = require("bcrypt");

const app = express();

const proposalUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

function extractJsonFromText(text) {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch (_) {}

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

async function callGemmaProposalExtractor(proposalText, fileName) {
  const ollamaBaseUrl = process.env.OLLAMA_API_URL || "https://ollama.com";
  const model =
    process.env.OLLAMA_MODEL ||
    process.env.OLLAMA_CHAT_MODEL ||
    "gemma4:31b-cloud";

  const prompt = `
You are an academic Final Year Project proposal extraction assistant for the I-FAMOUS system.

Extract useful FYP information from the proposal text.

Return ONLY valid JSON. Do not use markdown.

Required JSON format:
{
  "projectTitle": "clear project title",
  "projectType": "Development or Research",
  "abstract": "short but meaningful abstract summary, 80 to 150 words",
  "keywords": "5 to 8 strong academic keywords separated by commas"
}

Rules:
- Do not copy course code as the project title unless no project title exists.
- Ignore cover page noise such as course code, lecturer name, section, member list, and university name.
- Prefer the actual system/project title from the proposal content.
- Keywords must be intelligent academic/technical keywords, not random filename words.
- If the proposal is about software, system, web app, database, AI, automation, or mobile app, projectType is usually "Development".
- If information is missing, infer carefully from the proposal text.

File name:
${fileName}

Proposal text:
${proposalText.slice(0, 12000)}
`;

  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.OLLAMA_API_KEY
        ? `Bearer ${process.env.OLLAMA_API_KEY}`
        : undefined,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gemma proposal extraction failed");
  }

  const content = data.message?.content || data.response || "";
  const parsed = extractJsonFromText(content);

  if (!parsed) {
    throw new Error("AI returned invalid extraction format");
  }

  return {
    projectTitle: parsed.projectTitle || "",
    projectType: parsed.projectType || "Development",
    abstract: parsed.abstract || "",
    keywords: parsed.keywords || "",
  };
}

async function extractProposalText(file) {
  const fileName = String(file.originalname || "").toLowerCase();
  const buffer = file.buffer;

  if (fileName.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return result.text || "";
  }

  if (fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (fileName.endsWith(".txt")) {
    return buffer.toString("utf8");
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}


const proposalUploadDir = nodePath.join(__dirname, "uploads", "proposals");
nodeFs.mkdirSync(proposalUploadDir, { recursive: true });

const savedProposalUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, proposalUploadDir);
    },
    filename: (req, file, cb) => {
      const safeOriginal = String(file.originalname || "proposal")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safeOriginal}`);
    },
  }),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Import and use the assistant router
const assistantRouter = require("./routes/assistant");
app.use(assistantRouter);

// Import and use the supervisor matching router
const supervisorMatchingRouter = require("./routes/supervisorMatching");
app.use(supervisorMatchingRouter);

function shouldUseSsl() {
  return (
    process.env.DB_SSL === "true" ||
    String(process.env.DB_HOST || "").includes("aivencloud.com")
  );
}

// Database Connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: shouldUseSsl()
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

console.log("Connected to database.");

function ensureAdminTable() {
  db.query(
    `CREATE TABLE IF NOT EXISTS admin (
      user_id INT NOT NULL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) console.error("Failed to ensure admin table:", err.message);
    }
  );
}

ensureAdminTable();

function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing admin token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET || "ifamous-super-secret-key-2026");

    if (decoded.is_admin === 1 || decoded.email === "admin@utm.my") {
      req.adminUser = decoded;
      return next();
    }

    return res.status(403).json({ error: "Admin access required" });
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Status API Endpoint
app.get("/api/status", (req, res) => {
  db.query('SELECT 1', (err) => {
    if (err)
      return res.status(500).json({ error: "Database connection failed" });
    res.json({ message: "connected" });
  });
});

// Signup API Endpoint
app.post("/api/signup", async (req, res) => {
  const {
    email,
    password,
    fullName,
    phoneNumber,
    companyName,
    expertise,
    affiliation,
    metricNumber,
    cgpa,
    totalCreditHour,
    creditHourProofName,
    workloadCapacity,
  } = req.body;

  if (!email || !password || !fullName || !phoneNumber) {
    return res.status(400).json({
      error: "Missing required fields",
      details: "Full name, email, phone number, and password are required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const isStudentEmail = normalizedEmail.endsWith("@graduate.utm.my");
  const isStaffEmail = normalizedEmail.endsWith("@utm.my") && !isStudentEmail;

  if (isStudentEmail) {
    if (!metricNumber || cgpa === null || cgpa === undefined || !totalCreditHour || !creditHourProofName) {
      return res.status(400).json({
        error: "Missing student details",
        details: "Student signup requires metric number, CGPA, completed credit hours, and proof of credit hours.",
      });
    }
  }

  if (isStaffEmail && !expertise) {
    return res.status(400).json({
      error: "Missing staff expertise",
      details: "UTM staff signup requires at least one expertise area.",
    });
  }

  const connection = await db.promise().getConnection();

  try {
    const pepper = process.env.SECRET_PEPPER || "";
    const hashedPassword = await bcrypt.hash(password + pepper, 10);

    await connection.beginTransaction();

    await connection.query("CALL sp_signup_normal_user(?, ?, ?, ?, ?, ?, ?)", [
      normalizedEmail,
      hashedPassword,
      fullName,
      phoneNumber,
      companyName || null,
      expertise || null,
      affiliation || null,
    ]);

    const [userRows] = await connection.query(
      "SELECT user_id, email, full_name FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (!userRows || userRows.length === 0) {
      throw new Error("User was created but could not be found for role assignment.");
    }

    const createdUser = userRows[0];

    if (isStudentEmail) {
      await connection.query(
        `INSERT INTO students
          (student_id, metric_number, CGPA, proof_of_credit_hours, credit_hours_completed)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          metric_number = VALUES(metric_number),
          CGPA = VALUES(CGPA),
          proof_of_credit_hours = VALUES(proof_of_credit_hours),
          credit_hours_completed = VALUES(credit_hours_completed)`,
        [
          createdUser.user_id,
          String(metricNumber).trim().toUpperCase(),
          Number(cgpa),
          creditHourProofName || "Proof uploaded during signup",
          Number(totalCreditHour),
        ]
      );
    }

    if (isStaffEmail) {
      const capacity = Number(workloadCapacity || 5);

      await connection.query(
        `INSERT INTO supervisor
          (research_expertise, sv_capacity, current_capacity, supervisor_id)
         VALUES (?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
          research_expertise = VALUES(research_expertise),
          sv_capacity = VALUES(sv_capacity)`,
        [expertise || "General academic supervision", capacity, createdUser.user_id]
      );
    }

    await connection.commit();

    res.json({
      message: isStudentEmail
        ? "Student account registered successfully."
        : isStaffEmail
          ? "UTM staff/supervisor account registered successfully."
          : "External user registered successfully.",
      user_id: createdUser.user_id,
      role: isStudentEmail ? "Student" : isStaffEmail ? "Supervisor" : "External",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Signup error:", error);
    return res.status(500).json({
      error: "Registration failed",
      details: error.message,
    });
  } finally {
    connection.release();
  }
});

// Login API Endpoint
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedLogin = String(email).trim().toLowerCase();

  const sql = `
    SELECT u.*
    FROM users u
    LEFT JOIN students s ON s.student_id = u.user_id
    WHERE LOWER(u.email) = ? OR LOWER(s.metric_number) = ?
    LIMIT 1
  `;

  db.query(sql, [normalizedLogin, normalizedLogin], async (err, results) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Database error during login" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid email/metric number or password" });
    }

    const user = results[0];

    try {
      const pepper = process.env.SECRET_PEPPER || "";
      const match = await bcrypt.compare(password + pepper, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: "Invalid email/metric number or password" });
      }

      delete user.password_hash;

      const roleSql = `
        SELECT
          EXISTS(SELECT 1 FROM students WHERE student_id = ?) AS is_student,
          EXISTS(SELECT 1 FROM supervisor WHERE supervisor_id = ?) AS is_supervisor,
          EXISTS(SELECT 1 FROM examiners WHERE examiners_id = ?) AS is_examiner,
          EXISTS(SELECT 1 FROM coordinator WHERE user_id = ?) AS is_coordinator,
          EXISTS(SELECT 1 FROM admin WHERE user_id = ?) AS is_admin
      `;

      db.query(
        roleSql,
        [user.user_id, user.user_id, user.user_id, user.user_id, user.user_id],
        (roleErr, roleResults) => {
          if (roleErr) {
            console.error("Role lookup error:", roleErr);
            return res.status(500).json({ error: "Database error during role lookup" });
          }

          const roles = roleResults?.[0] || {};
          user.is_student = Number(roles.is_student || 0);
          user.is_supervisor = Number(roles.is_supervisor || 0);
          user.is_examiner = Number(roles.is_examiner || 0);
          user.is_coordinator = Number(roles.is_coordinator || 0);
          user.is_admin = Number(roles.is_admin || 0);

          if (String(user.email).toLowerCase() === "admin@utm.my") {
            user.is_admin = 1;
          }

          user.role_info = {
            is_student: user.is_student,
            is_supervisor: user.is_supervisor,
            is_examiner: user.is_examiner,
            is_coordinator: user.is_coordinator,
            is_admin: user.is_admin,
          };

          const token = jwt.sign(
            {
              user_id: user.user_id,
              email: user.email,
              is_admin: user.is_admin,
              is_coordinator: user.is_coordinator,
            },
            JWT_SECRET || "ifamous-super-secret-key-2026",
            { expiresIn: "24h" }
          );

          res.json({ message: "Login successful", user, token });
        }
      );
    } catch (compareError) {
      console.error("Password comparison error:", compareError);
      return res.status(500).json({ error: "Server error during login" });
    }
  });
});

// --- SESSION MANAGEMENT APIs ---

// GET all sessions
app.get("/api/sessions", (req, res) => {
  db.query("CALL sp_get_all_session()", (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch sessions: " + err.message });
    // results[0] contains the select query results
    res.json(results[0] || []);
  });
});

// GET active session
app.get("/api/sessions/active", (req, res) => {
  db.query("CALL sp_get_all_session()", (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch active session: " + err.message });
    const sessions = results[0] || [];
    const activeSession = sessions.find(s => s.is_active === 1 || s.is_active === true || s.is_active === Buffer.from([1]));
    if (!activeSession) return res.status(404).json({ error: "No active session found" });
    res.json(activeSession);
  });
});

// PUT set session as active
app.put("/api/sessions/:id/active", (req, res) => {
  const sessionId = req.params.id;
  // Update all to inactive, then set the specific one to active
  db.query("sp_SetActiveFYPSession(?)", [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to update active session: " + err.message });
    res.json({ message: "Session set as active successfully" });
  });
});

// GET single session
app.get("/api/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  db.query("CALL sp_select_session(?)", [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch session: " + err.message });
    res.json(results[0]?.[0] || null);
  });
});

// POST create new session
app.post("/api/sessions", (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: "Session ID (number) is required" });

  db.query("CALL sp_insert_session(?)", [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to create session: " + err.message });
    res.json({ message: "Session created successfully" });
  });
});

// PUT update session
app.put("/api/sessions/:id", (req, res) => {
  const old_id = req.params.id;
  const { new_session_id } = req.body;
  if (!new_session_id) return res.status(400).json({ error: "New Session ID is required" });

  db.query("CALL sp_update_session(?, ?)", [old_id, new_session_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to update session: " + err.message });
    res.json({ message: "Session updated successfully" });
  });
});

// DELETE session
app.delete("/api/sessions/:id", (req, res) => {
  const session_id = req.params.id;
  db.query("CALL sp_delete_session(?)", [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to delete session: " + err.message });
    res.json({ message: "Session deleted successfully" });
  });
});

// GET full session data (timetables & projects)
app.get("/api/sessions/:id/data", (req, res) => {
  const sessionId = req.params.id;
  db.query("CALL sp_GetSessionCalendarData(?)", [sessionId], (err, results) => {
    if (err) {
      console.error("Database error in sp_GetSessionCalendarData:", err);
      return res.status(500).json({ error: "Failed to fetch session data: " + err.message });
    }

    // With mysql2 stored procedures returning multiple result sets:
    // results[0] -> first SELECT (session verification)
    // results[1] -> second SELECT (timetables)
    const sessionRows = results[0] || [];
    if (sessionRows.length === 0) {
      return res.status(404).json({ error: `Session ${sessionId} not found.` });
    }

    const rawTimetables = results[1] || [];

    const timetables = rawTimetables.map(row => {
      let schedule = {};
      if (row.schedule_json) {
        try {
          schedule = typeof row.schedule_json === 'string'
            ? JSON.parse(row.schedule_json)
            : row.schedule_json;
        } catch (parseErr) {
          console.error(`Failed to parse schedule_json for timetable ${row.time_table_id}:`, parseErr);
        }
      }
      return {
        time_table_id: row.time_table_id,
        user_id: row.user_id,
        staff_name: row.staff_name,
        staff_email: row.staff_email,
        class_id: row.class_id,
        section_name: row.section_name,
        schedule
      };
    });

    res.json({
      fyp_session_id: parseInt(sessionId),
      timetables,
      projects: [] // Return an empty array for backward compatibility
    });
  });
});

// POST create calendar schedule
app.post("/api/timetables", (req, res) => {
  const { fyp_session_id, user_id, class_id, schedule_json } = req.body;

  if (!fyp_session_id || !schedule_json) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const p_user_id = user_id ? parseInt(user_id) : null;
  const p_class_id = class_id ? parseInt(class_id) : null;

  db.query(
    "CALL sp_CreateCalendarSchedule(?, ?, ?, ?)",
    [fyp_session_id, p_user_id, p_class_id, JSON.stringify(schedule_json)],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to create schedule: " + err.message });

      // The procedure returns the new ID in the first result set
      const newIdRow = results[0] && results[0][0];
      const new_time_table_id = newIdRow ? newIdRow.new_time_table_id : null;

      res.json({ message: "Schedule created successfully", time_table_id: new_time_table_id });
    }
  );
});

// DELETE calendar schedule
app.delete("/api/timetables/:id", (req, res) => {
  const timeTableId = req.params.id;
  db.query("CALL sp_DeleteCalendarSchedule(?)", [timeTableId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to delete schedule: " + err.message });
    res.json({ message: "Schedule deleted successfully" });
  });
});

// PUT update calendar schedule
app.put("/api/timetables/:id", (req, res) => {
  const timeTableId = req.params.id;
  const { user_id, class_id, schedule_json } = req.body;

  if (!schedule_json) {
    return res.status(400).json({ error: "schedule_json is required" });
  }

  const p_user_id = user_id ? parseInt(user_id) : null;
  const p_class_id = class_id ? parseInt(class_id) : null;

  db.query("CALL sp_UpdateCalendarSchedule(?, ?, ?, ?)", [timeTableId, p_user_id, p_class_id, JSON.stringify(schedule_json)], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to update schedule: " + err.message });
    res.json({ message: "Schedule updated successfully" });
  });
});

// POST crosscheck timetable data
app.post("/api/timetable/crosscheck", (req, res) => {
  const { fyp_session_id, class_id, user_ids } = req.body;

  if (!fyp_session_id) {
    return res.status(400).json({ error: "fyp_session_id is required" });
  }

  const queries = [];
  const queryValues = [];

  if (class_id) {
    queries.push(`SELECT class_id, schedule_json FROM time_table WHERE class_id = ? AND fyp_session_id = ?`);
    queryValues.push([class_id, fyp_session_id]);
  }

  if (user_ids && user_ids.length > 0) {
    const placeholders = user_ids.map(() => '?').join(',');
    queries.push(`SELECT user_id, schedule_json FROM time_table WHERE user_id IN (${placeholders}) AND fyp_session_id = ?`);
    queryValues.push([...user_ids, fyp_session_id]);
  }

  if (queries.length === 0) {
    return res.json({ status: "success", data: { occupied_events: [] } });
  }

  const promises = queries.map((q, idx) => {
    return new Promise((resolve, reject) => {
      db.query(q, queryValues[idx], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  });

  Promise.all(promises)
    .then(resultsArray => {
      const aggregatedEvents = [];
      let idCounter = 1;

      const formatDate = (date) => {
        let month = '' + (date.getMonth() + 1);
        let day = '' + date.getDate();
        const year = date.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
      };

      resultsArray.forEach(results => {
        results.forEach(row => {
          let schedule = {};
          try {
            schedule = typeof row.schedule_json === 'string' ? JSON.parse(row.schedule_json) : row.schedule_json;
          } catch (e) {
            console.error("Failed to parse schedule_json", e);
            return;
          }

          const isClass = row.class_id != null;
          const ownerLabel = isClass ? `Class ID: ${row.class_id}` : `User ID: ${row.user_id}`;
          const color = isClass ? '#eab308' : '#5C001F'; // Gold for class, Maroon for user

          // 1. Specific calendar events
          if (schedule.specific_events && Array.isArray(schedule.specific_events)) {
            schedule.specific_events.forEach(e => {
              aggregatedEvents.push({
                id: `crosscheck-sp-${idCounter++}`,
                title: e.label || e.title,
                date: e.date || e.target_date,
                start_time: e.start_time || '08:00',
                end_time: e.end_time || '09:00',
                owner: ownerLabel,
                is_class: isClass,
                color: color
              });
            });
          }

          // 2. Weekly recurring slots (mapped to the year 2026)
          if (schedule.weekly_recurring && Array.isArray(schedule.weekly_recurring)) {
            const startDate = new Date(2026, 0, 1);
            const endDate = new Date(2026, 11, 31);

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
              const jsDay = d.getDay();
              const jsonDayOfWeek = jsDay === 0 ? 7 : jsDay; // Convert: 0 (Sun) -> 7 (Sun)
              const dateStr = formatDate(d);

              const recurringDay = schedule.weekly_recurring.find(r => r.day_of_week === jsonDayOfWeek);
              if (recurringDay && recurringDay.slots) {
                recurringDay.slots.forEach(slot => {
                  aggregatedEvents.push({
                    id: `crosscheck-rc-${idCounter++}`,
                    title: slot.label,
                    date: dateStr,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                    owner: ownerLabel,
                    is_class: isClass,
                    color: color
                  });
                });
              }
            }
          }
        });
      });

      res.json({ status: "success", data: { occupied_events: aggregatedEvents } });
    })
    .catch(err => {
      console.error("Crosscheck Query Error:", err);
      res.status(500).json({ error: "Failed to crosscheck timetables: " + err.message });
    });
});

// TODO: POST temporary meeting generation
const fs = require('fs');
const path = require('path');
const tempFilePath = path.join(__dirname, '..', 'localData', 'temp_meeting.json');

app.post("/api/timetable/generate-temp", (req, res) => {
  const { project, date, start_time, end_time, duration } = req.body;

  if (!project || !date || !start_time || !end_time) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  const payload = {
    id: Date.now().toString(),
    project_id: project.project_id,
    project_title: project.fyp_title,
    student: project.student,
    supervisor: project.supervisor,
    examiners: project.examiners || [],
    date,
    start_time,
    end_time,
    duration,
    generated_at: new Date().toISOString()
  };

  try {
    let meetings = [];
    if (fs.existsSync(tempFilePath)) {
      const data = fs.readFileSync(tempFilePath, 'utf8');
      if (data) {
        meetings = JSON.parse(data);
        if (!Array.isArray(meetings)) meetings = [meetings];
      }
    }
    meetings.push(payload);
    fs.writeFileSync(tempFilePath, JSON.stringify(meetings, null, 4));
    res.json({ success: true, message: "Temporary schedule saved successfully", data: meetings });
  } catch (err) {
    console.error("Failed to write temporary schedule:", err);
    res.status(500).json({ success: false, error: "Server file write error" });
  }
});

// TODO: GET temporary meeting
app.get("/api/timetable/temp", (req, res) => {
  try {
    if (fs.existsSync(tempFilePath)) {
      const data = fs.readFileSync(tempFilePath, 'utf8');
      if (data) {
        let meetings = JSON.parse(data);
        if (!Array.isArray(meetings)) meetings = [meetings];
        return res.json({ success: true, data: meetings });
      }
    }
    res.json({ success: true, data: [] });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read temp meeting" });
  }
});

// DELETE temporary meeting
app.delete("/api/timetable/temp", (req, res) => {
  try {
    const id = req.query.id;
    if (fs.existsSync(tempFilePath)) {
      if (id) {
        let meetings = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
        if (!Array.isArray(meetings)) meetings = [meetings];
        meetings = meetings.filter(m => m.id !== id);
        fs.writeFileSync(tempFilePath, JSON.stringify(meetings, null, 4));
      } else {
        fs.writeFileSync(tempFilePath, JSON.stringify([], null, 4));
      }
    }
    res.json({ success: true, message: "Temp meeting(s) deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to delete temp meeting" });
  }
});

// POST: AI Auto-scheduling for all FYP projects
app.post("/api/timetable/auto-assign", async (req, res) => {
  let {
    fyp_session_id,
    startDate,
    endDate,
    duration,
    allowedDays,
    avoidWeekend,
    avoidOffWorkingHour,
    workingHourStart,
    workingHourEnd,
    avoidLunchHour,
    lunchHourStart,
    lunchHourEnd
  } = req.body;

  // 1. Resolve fyp_session_id if not provided
  if (!fyp_session_id) {
    try {
      const sessionResult = await new Promise((resolve, reject) => {
        db.query("CALL sp_get_all_session()", (err, results) => {
          if (err) reject(err);
          else resolve(results[0] || []);
        });
      });
      const activeSession = sessionResult.find(s => s.is_active === 1 || s.is_active === true || s.is_active === Buffer.from([1]));
      if (activeSession) {
        fyp_session_id = activeSession.session_id;
      } else {
        return res.status(400).json({ success: false, error: "No active session found and fyp_session_id not specified." });
      }
    } catch (e) {
      console.error("Failed to fetch active session for auto-assign:", e);
      return res.status(500).json({ success: false, error: "Database error resolving active session" });
    }
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: "startDate and endDate are required" });
  }

  // 2. Load all projects from fyp_mock_structure.json
  const projectsFilePath = path.join(__dirname, '..', 'localData', 'fyp_mock_structure.json');
  let projects = [];
  try {
    if (fs.existsSync(projectsFilePath)) {
      projects = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    }
  } catch (err) {
    console.error("Failed to read fyp_mock_structure.json:", err);
    return res.status(500).json({ success: false, error: "Server failed to load project mock structure" });
  }

  // 3. Fetch all timetables for this session
  let timetables = [];
  try {
    timetables = await new Promise((resolve, reject) => {
      db.query(
        "SELECT user_id, class_id, schedule_json FROM time_table WHERE fyp_session_id = ?",
        [fyp_session_id],
        (err, results) => {
          if (err) reject(err);
          else resolve(results || []);
        }
      );
    });
  } catch (err) {
    console.error("Failed to query time tables for auto-assign:", err);
    return res.status(500).json({ success: false, error: "Database query failed for timetables" });
  }

  // Parse timetables into maps
  const userSchedules = {};
  const classSchedules = {};

  timetables.forEach(row => {
    let schedule = {};
    if (row.schedule_json) {
      try {
        schedule = typeof row.schedule_json === 'string'
          ? JSON.parse(row.schedule_json)
          : row.schedule_json;
      } catch (parseErr) {
        console.error(`Failed to parse schedule_json for timetable row:`, parseErr);
      }
    }
    if (row.user_id != null) {
      userSchedules[row.user_id] = schedule;
    }
    if (row.class_id != null) {
      classSchedules[row.class_id] = schedule;
    }
  });

  // Helper function to check if a specific person/class has conflict with a slot
  const isOccupied = (schedule, dateStr, slotStart, slotEnd) => {
    if (!schedule) return false;

    // A. Specific events
    if (schedule.specific_events && Array.isArray(schedule.specific_events)) {
      for (const e of schedule.specific_events) {
        const eDate = e.date || e.target_date;
        if (eDate === dateStr) {
          const eStart = e.start_time || '08:00';
          const eEnd = e.end_time || '09:00';
          if (slotStart < eEnd && slotEnd > eStart) {
            return true;
          }
        }
      }
    }

    // B. Weekly recurring
    if (schedule.weekly_recurring && Array.isArray(schedule.weekly_recurring)) {
      const [y, m, dayNum] = dateStr.split('-').map(Number);
      const jsDay = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();
      const jsonDayOfWeek = jsDay === 0 ? 7 : jsDay; // 0 (Sun) -> 7 (Sun)
      
      const recurringDay = schedule.weekly_recurring.find(r => r.day_of_week === jsonDayOfWeek);
      if (recurringDay && recurringDay.slots) {
        for (const slot of recurringDay.slots) {
          if (slotStart < slot.end_time && slotEnd > slot.start_time) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Generate date list (timezone-independent)
  const getDatesInRange = (startStr, endStr) => {
    const dates = [];
    const [sYear, sMonth, sDay] = startStr.split('-').map(Number);
    const [eYear, eMonth, eDay] = endStr.split('-').map(Number);
    const start = new Date(Date.UTC(sYear, sMonth - 1, sDay));
    const end = new Date(Date.UTC(eYear, eMonth - 1, eDay));
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      let month = '' + (d.getUTCMonth() + 1);
      let day = '' + d.getUTCDate();
      const year = d.getUTCFullYear();
      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;
      dates.push([year, month, day].join('-'));
    }
    return dates;
  };

  const dates = getDatesInRange(startDate, endDate);
  const dur = parseInt(duration) || 10;
  const meetings = [];
  const unscheduledProjects = [];

  // Helper to add minutes
  const addMinutes = (timeStr, mins) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m + mins;
    const newH = Math.floor(totalMins / 60).toString().padStart(2, '0');
    const newM = (totalMins % 60).toString().padStart(2, '0');
    return `${newH}:${newM}`;
  };

  // We keep a local list of dynamically scheduled meetings to check conflicts in real-time
  const localAssignedSlots = [];

  // Check if a person is double booked with our newly scheduled meetings
  const isScheduledInRun = (userId, classId, dateStr, slotStart, slotEnd) => {
    for (const mt of localAssignedSlots) {
      if (mt.date === dateStr) {
        const isStudentMatch = classId && mt.student?.class_id === classId;
        const isUserMatch = (userId === mt.student?.user_id || 
                             userId === mt.supervisor?.user_id || 
                             mt.examiners?.some(ex => ex.user_id === userId));
        
        if (isStudentMatch || isUserMatch) {
          if (slotStart < mt.end_time && slotEnd > mt.start_time) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // 4. Run scheduling algorithm
  for (const project of projects) {
    let scheduled = false;

    const studentUserId = project.student?.user_id;
    const studentClassId = project.student?.class_id;
    const supervisorUserId = project.supervisor?.user_id;
    const examinerUserIds = (project.examiners || []).map(ex => ex.user_id);

    for (const dateStr of dates) {
      if (scheduled) break;

      const [y, m, dayNum] = dateStr.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();
      const jsDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      if (allowedDays && Array.isArray(allowedDays) && allowedDays.length > 0) {
        if (!allowedDays.includes(jsDayOfWeek)) {
          continue;
        }
      }

      if (avoidWeekend) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue;
        }
      }

      let dayStart = '08:00';
      let dayEnd = '17:00';
      if (avoidOffWorkingHour) {
        dayStart = workingHourStart || '08:00';
        dayEnd = workingHourEnd || '17:00';
      }

      let currentSlotStart = dayStart;
      while (currentSlotStart < dayEnd) {
        const currentSlotEnd = addMinutes(currentSlotStart, dur);
        if (currentSlotEnd > dayEnd) break;

        if (avoidLunchHour && lunchHourStart && lunchHourEnd) {
          if (currentSlotStart < lunchHourEnd && currentSlotEnd > lunchHourStart) {
            currentSlotStart = addMinutes(currentSlotStart, 5);
            continue;
          }
        }

        let hasConflict = false;

        if (studentClassId && isOccupied(classSchedules[studentClassId], dateStr, currentSlotStart, currentSlotEnd)) {
          hasConflict = true;
        }
        if (!hasConflict && studentUserId && isOccupied(userSchedules[studentUserId], dateStr, currentSlotStart, currentSlotEnd)) {
          hasConflict = true;
        }

        if (!hasConflict && supervisorUserId && isOccupied(userSchedules[supervisorUserId], dateStr, currentSlotStart, currentSlotEnd)) {
          hasConflict = true;
        }

        if (!hasConflict) {
          for (const exId of examinerUserIds) {
            if (isOccupied(userSchedules[exId], dateStr, currentSlotStart, currentSlotEnd)) {
              hasConflict = true;
              break;
            }
          }
        }

        if (!hasConflict) {
          if (isScheduledInRun(studentUserId, studentClassId, dateStr, currentSlotStart, currentSlotEnd)) {
            hasConflict = true;
          }
          if (!hasConflict && isScheduledInRun(supervisorUserId, null, dateStr, currentSlotStart, currentSlotEnd)) {
            hasConflict = true;
          }
          if (!hasConflict) {
            for (const exId of examinerUserIds) {
              if (isScheduledInRun(exId, null, dateStr, currentSlotStart, currentSlotEnd)) {
                hasConflict = true;
                break;
              }
            }
          }
        }

        if (!hasConflict) {
          const payload = {
            id: (Date.now() + Math.floor(Math.random() * 100000)).toString(),
            project_id: project.project_id,
            project_title: project.fyp_title,
            student: project.student,
            supervisor: project.supervisor,
            examiners: project.examiners || [],
            date: dateStr,
            start_time: currentSlotStart,
            end_time: currentSlotEnd,
            duration: dur,
            generated_at: new Date().toISOString()
          };

          meetings.push(payload);
          localAssignedSlots.push(payload);
          scheduled = true;
          break;
        }

        currentSlotStart = currentSlotEnd;
      }
    }

    if (!scheduled) {
      unscheduledProjects.push(project);
    }
  }

  try {
    fs.writeFileSync(tempFilePath, JSON.stringify(meetings, null, 4));
    res.json({
      success: true,
      message: "AI scheduling complete",
      data: meetings,
      totalProjects: projects.length,
      unscheduledProjects
    });
  } catch (err) {
    console.error("Failed to save auto-assigned meetings:", err);
    res.status(500).json({ success: false, error: "Failed to write temp meeting file" });
  }
});

// Simple API Endpoint
app.get("/api/users", (req, res) => {
  db.query("SELECT * FROM users", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.get("/api/users/recent", (req, res) => {
  db.query("CALL sp_GetRecentUsersByCategory()", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      students: results[0] || [],
      lecturers: results[1] || [],
      outsiders: results[2] || []
    });
  });
});

app.get("/api/users/paginated", (req, res) => {
  const category = req.query.category;
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  let countQuery = "";
  let dataQuery = "";

  if (category === 'students') {
    countQuery = `SELECT COUNT(*) as total FROM users u JOIN students s ON u.user_id = s.student_id`;
    dataQuery = `SELECT u.*, s.metric_number FROM users u JOIN students s ON u.user_id = s.student_id ORDER BY u.date_created DESC LIMIT ? OFFSET ?`;
  } else if (category === 'lecturers') {
    countQuery = `SELECT COUNT(*) as total FROM users u WHERE u.is_utm_staff = 1 AND u.user_id NOT IN (SELECT student_id FROM students)`;
    dataQuery = `SELECT u.* FROM users u WHERE u.is_utm_staff = 1 AND u.user_id NOT IN (SELECT student_id FROM students) ORDER BY u.date_created DESC LIMIT ? OFFSET ?`;
  } else if (category === 'outsiders') {
    countQuery = `SELECT COUNT(*) as total FROM users u WHERE (u.is_utm_staff = 0 OR u.is_utm_staff IS NULL) AND u.user_id NOT IN (SELECT student_id FROM students)`;
    dataQuery = `SELECT u.* FROM users u WHERE (u.is_utm_staff = 0 OR u.is_utm_staff IS NULL) AND u.user_id NOT IN (SELECT student_id FROM students) ORDER BY u.date_created DESC LIMIT ? OFFSET ?`;
  } else {
    return res.status(400).json({ error: "Invalid category" });
  }

  db.query(countQuery, (err, countResults) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countResults[0].total;

    db.query(dataQuery, [limit, offset], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: results,
        total: total,
        page: page,
        totalPages: Math.ceil(total / limit)
      });
    });
  });
});

app.delete("/api/users/:id", (req, res) => {
  db.query("DELETE FROM users WHERE user_id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "User deleted successfully" });
  });
});

app.post("/api/users", async (req, res) => {
  const { email, password, full_name, phone_number, co_org_name, expertise, affiliation } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const pepper = process.env.SECRET_PEPPER || "";
    const hashedPassword = await bcrypt.hash(password + pepper, 10);

    db.query(
      "CALL sp_signup_normal_user(?, ?, ?, ?, ?, ?, ?)",
      [email, hashedPassword, full_name, phone_number || null, co_org_name || null, expertise || null, affiliation || null],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User created successfully" });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", (req, res) => {
  const { full_name, email, phone_number, expertise, affiliation } = req.body;
  const userId = req.params.id;

  if (!full_name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.query(
    "CALL sp_UpdateUserProfile(?, ?, ?, ?, ?, ?);",
    [
      userId,
      full_name,
      email,
      phone_number || null,
      expertise || null,
      affiliation || null
    ],
    (err, results) => {
      if (err) {
        console.error("Update user error:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "User updated successfully",
        affected_rows: results?.[0]?.[0]?.affected_rows ?? null
      });
    }
  );
});

// Search API Endpoints for Autocomplete
app.get("/api/users/search", (req, res) => {
  const query = req.query.q;
  const sessionId = req.query.session_id;
  if (!query || !sessionId) return res.json([]);
  const searchStr = `%${query}%`;
  db.query("CALL sp_SearchNonStudentUsers(?, ?)", [searchStr, sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    // results[0] contains the actual rows returned by the procedure
    res.json(results[0] || []);
  });
});

app.get("/api/classes/search", (req, res) => {
  const query = req.query.q;
  const sessionId = req.query.session_id;
  if (!query || !sessionId) return res.json([]);
  const sql = "SELECT class_id, section_name FROM fyp_classes WHERE fyp_session_id = ? AND section_name LIKE ? AND class_id NOT IN (SELECT class_id FROM time_table WHERE fyp_session_id = ? AND class_id IS NOT NULL) LIMIT 10";
  db.query(sql, [sessionId, `%${query}%`, sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// --- ADMIN USER/ROLE MANAGEMENT APIs ---
app.get("/api/admin/users", verifyAdmin, (req, res) => {
  const sql = `
    SELECT
      u.user_id,
      u.email,
      u.full_name,
      u.phone_number,
      u.affiliation,
      u.expertise,
      s.metric_number,
      s.CGPA,
      s.proof_of_credit_hours,
      s.credit_hours_completed,
      sv.research_expertise,
      sv.sv_capacity,
      sv.current_capacity,
      ex.industry_background,
      IF(a.user_id IS NULL, 0, 1) AS is_admin,
      IF(c.user_id IS NULL, 0, 1) AS is_coordinator,
      IF(s.student_id IS NULL, 0, 1) AS is_student,
      IF(sv.supervisor_id IS NULL, 0, 1) AS is_supervisor,
      IF(ex.examiners_id IS NULL, 0, 1) AS is_examiner
    FROM users u
    LEFT JOIN admin a ON a.user_id = u.user_id
    LEFT JOIN coordinator c ON c.user_id = u.user_id
    LEFT JOIN students s ON s.student_id = u.user_id
    LEFT JOIN supervisor sv ON sv.supervisor_id = u.user_id
    LEFT JOIN examiners ex ON ex.examiners_id = u.user_id
    ORDER BY u.full_name ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ users: rows || [] });
  });
});

app.put("/api/admin/users/:id/roles", verifyAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const {
    is_admin,
    is_coordinator,
    is_supervisor,
    is_examiner,
    is_student,
    metric_number,
    cgpa,
    credit_hours_completed,
    proof_of_credit_hours,
    research_expertise,
    sv_capacity,
    industry_background,
  } = req.body;

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    if (is_admin) {
      await connection.query("INSERT IGNORE INTO admin (user_id) VALUES (?)", [userId]);
    } else {
      await connection.query("DELETE FROM admin WHERE user_id = ?", [userId]);
    }

    if (is_coordinator) {
      await connection.query("INSERT IGNORE INTO coordinator (user_id) VALUES (?)", [userId]);
    } else {
      await connection.query("DELETE FROM coordinator WHERE user_id = ?", [userId]);
    }

    if (is_student) {
      await connection.query(
        `INSERT INTO students
          (student_id, metric_number, CGPA, proof_of_credit_hours, credit_hours_completed)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          metric_number = VALUES(metric_number),
          CGPA = VALUES(CGPA),
          proof_of_credit_hours = VALUES(proof_of_credit_hours),
          credit_hours_completed = VALUES(credit_hours_completed)`,
        [
          userId,
          String(metric_number || `STU${userId}`).trim().toUpperCase(),
          Number(cgpa || 0),
          proof_of_credit_hours || "Updated by admin",
          Number(credit_hours_completed || 0),
        ]
      );
    } else {
      await connection.query("DELETE FROM students WHERE student_id = ?", [userId]);
    }

    if (is_supervisor) {
      await connection.query(
        `INSERT INTO supervisor
          (research_expertise, sv_capacity, current_capacity, supervisor_id)
         VALUES (?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
          research_expertise = VALUES(research_expertise),
          sv_capacity = VALUES(sv_capacity)`,
        [research_expertise || "General academic supervision", Number(sv_capacity || 5), userId]
      );
    } else {
      await connection.query("DELETE FROM supervisor WHERE supervisor_id = ?", [userId]);
    }

    if (is_examiner) {
      await connection.query(
        `INSERT INTO examiners (industry_background, examiners_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE industry_background = VALUES(industry_background)`,
        [industry_background || "Academic examiner", userId]
      );
    } else {
      await connection.query("DELETE FROM examiners WHERE examiners_id = ?", [userId]);
    }

    await connection.commit();
    res.json({ message: "Roles updated successfully" });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.put("/api/admin/users/:id/password", verifyAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  try {
    const pepper = process.env.SECRET_PEPPER || "";
    const hashedPassword = await bcrypt.hash(String(newPassword) + pepper, 10);

    db.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [hashedPassword, userId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Password reset successfully" });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api/admin", adminRoutes);


// ===============================
// Student My FYP API
// ===============================
function getTokenUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET || "ifamous-super-secret-key-2026");
    return decoded.user_id || decoded.userId || decoded.id || decoded.user?.user_id || null;
  } catch (error) {
    return null;
  }
}


app.post("/api/student/extract-proposal", proposalUpload.single("proposal"), async (req, res) => {
  try {
    const userId = getTokenUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No proposal file uploaded" });
    }

    const proposalText = await extractProposalText(req.file);

    if (!proposalText || proposalText.trim().length < 50) {
      return res.status(400).json({
        error: "Could not read enough text from the proposal. Try uploading a text-based PDF, DOCX, or TXT file.",
      });
    }

    const extracted = await callGemmaProposalExtractor(
      proposalText,
      req.file.originalname
    );

    res.json({
      success: true,
      fileName: req.file.originalname,
      extracted,
    });
  } catch (error) {
    console.error("Proposal extraction error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


app.get("/api/student/my-fyp", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const studentSql = `
    SELECT 
      u.user_id,
      u.full_name,
      u.email,
      s.metric_number
    FROM users u
    LEFT JOIN students s ON s.student_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(studentSql, [userId], (studentErr, studentRows) => {
    if (studentErr) {
      return res.status(500).json({ error: studentErr.message });
    }

    const student = studentRows && studentRows[0];

    if (!student) {
      return res.status(404).json({ error: "Student user not found" });
    }

    const projectSql = `
      SELECT DISTINCT
        fp.project_id,
        fp.project_title,
        fp.project_type,
        fp.abstract,
        fp.keywords,
        fp.supervisor_name,
        fp.supervisor_email,
        fp.examiner_name,
        fp.examiner_email,
        fp.status,
        fp.created_at,
        fp.updated_at
      FROM fyp_projects fp
      LEFT JOIN fyp_project_members fpm ON fpm.project_id = fp.project_id
      WHERE 
        fp.student_user_id = ?
        OR LOWER(fpm.matric_no) = LOWER(?)
        OR LOWER(fpm.student_name) = LOWER(?)
      ORDER BY fp.updated_at DESC, fp.created_at DESC, fp.project_id DESC
    `;

    db.query(
      projectSql,
      [
        userId,
        student.metric_number || "",
        student.full_name || "",
      ],
      (projectErr, projectRows) => {
        if (projectErr) {
          return res.status(500).json({ error: projectErr.message });
        }

        const records = (projectRows || []).map((row) => ({
          id: row.project_id,
          project_id: row.project_id,
          title: row.project_title,
          type: row.project_type || "Development",
          abstract: row.abstract || "",
          keywords: row.keywords || "",
          status: row.status || "Pending Review",
          supervisor: row.supervisor_name || "Not Assigned",
          supervisorEmail: row.supervisor_email || "",
          examiner: row.examiner_name || "Not Assigned",
          examinerEmail: row.examiner_email || "",
          lastUpdated: row.updated_at || row.created_at,
        }));

        res.json({
          success: true,
          student,
          records,
        });
      }
    );
  });
});


app.get("/api/student/my-fyp/:projectId", (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = req.params.projectId;

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT
      fp.project_id,
      fp.project_title,
      fp.project_type,
      fp.abstract,
      fp.keywords,
      fp.student_user_id,
      fp.student_name,
      fp.matric_no,
      fp.supervisor_name,
      fp.supervisor_email,
      fp.examiner_name,
      fp.examiner_email,
      fp.status,
      fp.created_at,
      fp.updated_at,
      ps.submission_id,
      ps.submission_title,
      ps.file_path,
      ps.original_file_name,
      ps.submission_type,
      ps.status AS submission_status,
      ps.feedback,
      ps.submitted_at,
      ps.reviewed_at
    FROM fyp_projects fp
    LEFT JOIN projects_submissions ps ON ps.project_id = fp.project_id
    WHERE fp.project_id = ?
    AND fp.student_user_id = ?
  `;

  db.query(sql, [projectId, userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Project not found for this student" });
    }

    const first = rows[0];

    const documents = rows
      .filter((row) => row.submission_id)
      .map((row) => ({
        id: row.submission_id,
        title: row.submission_title || row.original_file_name || row.file_path || "Submitted document",
        fileName: row.original_file_name || row.file_path || "Document",
        filePath: row.file_path || "",
        type: row.submission_type || "proposal",
        status: row.submission_status || "pending",
        feedback: row.feedback || "",
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
      }));

    res.json({
      success: true,
      project: {
        id: first.project_id,
        project_id: first.project_id,
        title: first.project_title,
        type: first.project_type || "Development",
        abstract: first.abstract || "",
        keywords: first.keywords || "",
        status: first.status || "Pending Review",
        studentName: first.student_name || "",
        matricNo: first.matric_no || "",
        supervisor: first.supervisor_name || "Not Assigned",
        supervisorEmail: first.supervisor_email || "",
        examiner: first.examiner_name || "Not Assigned",
        examinerEmail: first.examiner_email || "",
        createdAt: first.created_at,
        updatedAt: first.updated_at,
        documents,
      },
    });
  });
});



app.post("/api/student/my-fyp", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const {
    projectTitle,
    projectType,
    abstract,
    keywords,
    originalFileName
  } = req.body || {};

  if (!projectTitle || String(projectTitle).trim().length < 3) {
    return res.status(400).json({ error: "Project title is required" });
  }

  const studentSql = `
    SELECT 
      u.user_id,
      u.full_name,
      u.email,
      s.metric_number
    FROM users u
    LEFT JOIN students s ON s.student_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(studentSql, [userId], (studentErr, studentRows) => {
    if (studentErr) {
      return res.status(500).json({ error: studentErr.message });
    }

    const student = studentRows && studentRows[0];

    if (!student) {
      return res.status(404).json({ error: "Student user not found" });
    }

    const activeSql = `
      SELECT project_id
      FROM fyp_projects
      WHERE student_user_id = ?
      AND status IN (
        'Draft',
        'Pending Review',
        'Pending Coordinator Review',
        'Pending AI Matching',
        'Pending Supervisor Assignment',
        'Pending Supervisor Approval',
        'Active',
        'Assigned'
      )
      LIMIT 1
    `;

    db.query(activeSql, [userId], (activeErr, activeRows) => {
      if (activeErr) {
        return res.status(500).json({ error: activeErr.message });
      }

      if (activeRows && activeRows.length > 0) {
        return res.status(409).json({
          error: "You already have a pending or active FYP.",
        });
      }

      const insertProjectSql = `
        INSERT INTO fyp_projects
          (
            student_user_id,
            student_name,
            matric_no,
            project_title,
            project_type,
            abstract,
            keywords,
            supervisor_name,
            supervisor_email,
            status,
            created_at,
            updated_at
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'Pending Coordinator Review', NOW(), NOW())
      `;

      db.query(
        insertProjectSql,
        [
          userId,
          student.full_name || "",
          student.metric_number || "",
          String(projectTitle).trim(),
          projectType || "Development",
          abstract || "",
          keywords || "",
        ],
        (insertErr, result) => {
          if (insertErr) {
            return res.status(500).json({ error: insertErr.message });
          }

          const projectId = result.insertId;

          const memberSql = `
            INSERT INTO fyp_project_members
              (project_id, student_name, matric_no)
            VALUES (?, ?, ?)
          `;

          db.query(
            memberSql,
            [
              projectId,
              student.full_name || "Student",
              student.metric_number || "",
            ],
            (memberErr) => {
              if (memberErr) {
                console.error("FYP member insert error:", memberErr.message);
              }

              const submissionSql = `
                INSERT INTO projects_submissions
                  (
                    submission_title,
                    file_path,
                    original_file_name,
                    submitted_at,
                    submission_type,
                    status,
                    project_id
                  )
                VALUES (?, ?, ?, NOW(), 'proposal', 'pending', ?)
              `;

              db.query(
                submissionSql,
                [
                  "Proposal Submission",
                  originalFileName || "proposal_document",
                  originalFileName || "proposal_document",
                  projectId,
                ],
                (submissionErr) => {
                  if (submissionErr) {
                    console.error("Submission insert error:", submissionErr.message);
                  }

                  const notificationSql = `
                    INSERT INTO fyp_notifications
                      (
                        project_id,
                        recipient_type,
                        recipient_name,
                        recipient_email,
                        title,
                        message,
                        is_read,
                        created_at
                      )
                    VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())
                  `;

                  db.query(
                    notificationSql,
                    [
                      projectId,
                      "New FYP Proposal Submitted",
                      `${student.full_name || "A student"} submitted a new FYP proposal titled "${String(projectTitle).trim()}". Please review and run supervisor matching.`,
                    ],
                    (notiErr) => {
                      if (notiErr) {
                        console.error("Coordinator notification insert error:", notiErr.message);
                      }

                      return res.json({
                        success: true,
                        message: "FYP proposal submitted successfully and coordinator has been notified.",
                        projectId,
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
});



// ===============================
// Coordinator FYP Queue API
// ===============================
app.get("/api/coordinator/fyp-queue", (req, res) => {
  const sql = `
    SELECT
      fp.project_id,
      fp.student_user_id,
      fp.student_name,
      fp.matric_no,
      fp.project_title,
      fp.project_type,
      fp.abstract,
      fp.keywords,
      fp.supervisor_user_id,
      fp.supervisor_name,
      fp.supervisor_email,
      fp.match_score,
      fp.status,
      fp.created_at,
      fp.updated_at,
      ps.original_file_name,
      ps.file_path,
      ps.submission_type,
      ps.status AS submission_status,
      ps.submitted_at
    FROM fyp_projects fp
    LEFT JOIN projects_submissions ps 
      ON ps.project_id = fp.project_id
      AND ps.submission_type = 'proposal'
    WHERE
      fp.student_user_id IS NOT NULL
      OR fp.status IN (
        'Pending Coordinator Review',
        'Pending Review',
        'Pending AI Matching',
        'Pending Supervisor Assignment',
        'Pending Supervisor Approval'
      )
    ORDER BY fp.created_at DESC, fp.project_id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    const projects = (rows || []).map((row) => ({
      project_id: row.project_id,
      student_user_id: row.student_user_id,
      studentName: row.student_name || "Student",
      matricNo: row.matric_no || "-",
      projectTitle: row.project_title || "Untitled FYP",
      projectType: row.project_type || "Development",
      abstract: row.abstract || "",
      keywords: row.keywords || "",
      supervisor_user_id: row.supervisor_user_id,
      supervisorName: row.supervisor_name || "Not Assigned",
      supervisorEmail: row.supervisor_email || "",
      matchScore: row.match_score || null,
      status: row.status || "Pending Coordinator Review",
      proposalStatus: row.submission_status || "pending",
      aiStatus: row.match_score ? "AI Completed" : "Pending AI Matching",
      fileName: row.original_file_name || row.file_path || "Proposal document",
      submittedAt: row.submitted_at || row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      success: true,
      projects,
    });
  });
});


// ===============================
// Supervisor Dashboard / Projects API
// ===============================
app.get("/api/supervisor/dashboard", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      sv.sv_capacity,
      sv.current_capacity
    FROM users u
    LEFT JOIN supervisor sv ON sv.supervisor_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (err, supervisorRows) => {
    if (err) return res.status(500).json({ error: err.message });

    const supervisor = supervisorRows && supervisorRows[0];

    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found" });
    }

    const projectSql = `
      SELECT
        project_id,
        student_user_id,
        student_name,
        matric_no,
        project_title,
        project_type,
        abstract,
        keywords,
        status,
        match_score,
        created_at,
        updated_at
      FROM fyp_projects
      WHERE supervisor_user_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `;

    db.query(projectSql, [userId], (projectErr, projectRows) => {
      if (projectErr) return res.status(500).json({ error: projectErr.message });

      const projects = projectRows || [];

      const pendingReviews = projects.filter((p) =>
        ["Assigned", "Pending Supervisor Approval", "Pending Review"].includes(String(p.status || ""))
      ).length;

      res.json({
        success: true,
        supervisor: {
          user_id: supervisor.user_id,
          full_name: supervisor.full_name,
          email: supervisor.email,
          capacity: supervisor.sv_capacity || 5,
          current_capacity: projects.length,
        },
        stats: {
          workload: projects.length,
          capacity: supervisor.sv_capacity || 5,
          pendingReviews,
          assignedProjects: projects.length,
          pendingFeedback: 0,
          pendingLogbooks: 0,
        },
        projects: projects.map((p) => ({
          project_id: p.project_id,
          studentName: p.student_name || "Student",
          matricNo: p.matric_no || "-",
          projectTitle: p.project_title || "Untitled Project",
          projectType: p.project_type || "Development",
          abstract: p.abstract || "",
          keywords: p.keywords || "",
          status: p.status || "Assigned",
          matchScore: p.match_score || null,
          lastUpdated: p.updated_at || p.created_at,
        })),
      });
    });
  });
});

app.get("/api/supervisor/projects", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT
      project_id,
      student_user_id,
      student_name,
      matric_no,
      project_title,
      project_type,
      abstract,
      keywords,
      status,
      match_score,
      created_at,
      updated_at
    FROM fyp_projects
    WHERE supervisor_user_id = ?
    ORDER BY updated_at DESC, created_at DESC
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      success: true,
      projects: (rows || []).map((p) => ({
        project_id: p.project_id,
        studentName: p.student_name || "Student",
        matricNo: p.matric_no || "-",
        projectTitle: p.project_title || "Untitled Project",
        projectType: p.project_type || "Development",
        abstract: p.abstract || "",
        keywords: p.keywords || "",
        status: p.status || "Assigned",
        matchScore: p.match_score || null,
        lastUpdated: p.updated_at || p.created_at,
      })),
    });
  });
});


// ===============================
// Student FYP Submit with File Save
// ===============================
app.post("/api/student/my-fyp-submit", savedProposalUpload.single("proposal"), (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const {
    projectTitle,
    projectType,
    abstract,
    keywords,
  } = req.body || {};

  if (!projectTitle || String(projectTitle).trim().length < 3) {
    return res.status(400).json({ error: "Project title is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Proposal file is required" });
  }

  const studentSql = `
    SELECT 
      u.user_id,
      u.full_name,
      u.email,
      s.metric_number
    FROM users u
    LEFT JOIN students s ON s.student_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(studentSql, [userId], (studentErr, studentRows) => {
    if (studentErr) {
      return res.status(500).json({ error: studentErr.message });
    }

    const student = studentRows && studentRows[0];

    if (!student) {
      return res.status(404).json({ error: "Student user not found" });
    }

    const activeSql = `
      SELECT project_id
      FROM fyp_projects
      WHERE student_user_id = ?
      AND status IN (
        'Draft',
        'Pending Review',
        'Pending Coordinator Review',
        'Pending AI Matching',
        'Pending Supervisor Assignment',
        'Pending Supervisor Approval',
        'Active',
        'Assigned'
      )
      LIMIT 1
    `;

    db.query(activeSql, [userId], (activeErr, activeRows) => {
      if (activeErr) {
        return res.status(500).json({ error: activeErr.message });
      }

      if (activeRows && activeRows.length > 0) {
        return res.status(409).json({
          error: "You already have a pending or active FYP.",
        });
      }

      const insertProjectSql = `
        INSERT INTO fyp_projects
          (
            student_user_id,
            student_name,
            matric_no,
            project_title,
            project_type,
            abstract,
            keywords,
            supervisor_name,
            supervisor_email,
            status,
            created_at,
            updated_at
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'Pending Coordinator Review', NOW(), NOW())
      `;

      db.query(
        insertProjectSql,
        [
          userId,
          student.full_name || "",
          student.metric_number || "",
          String(projectTitle).trim(),
          projectType || "Development",
          abstract || "",
          keywords || "",
        ],
        (insertErr, result) => {
          if (insertErr) {
            return res.status(500).json({ error: insertErr.message });
          }

          const projectId = result.insertId;

          const relativeFilePath = nodePath.join(
            "uploads",
            "proposals",
            req.file.filename
          );

          const memberSql = `
            INSERT INTO fyp_project_members
              (project_id, student_name, matric_no)
            VALUES (?, ?, ?)
          `;

          db.query(memberSql, [projectId, student.full_name || "Student", student.metric_number || ""], () => {
            const submissionSql = `
              INSERT INTO projects_submissions
                (
                  submission_title,
                  file_path,
                  original_file_name,
                  submitted_at,
                  submission_type,
                  status,
                  project_id
                )
              VALUES (?, ?, ?, NOW(), 'proposal', 'pending', ?)
            `;

            db.query(
              submissionSql,
              [
                "Proposal Submission",
                relativeFilePath,
                req.file.originalname,
                projectId,
              ],
              (submissionErr) => {
                if (submissionErr) {
                  console.error("Submission insert error:", submissionErr.message);
                }

                const notificationSql = `
                  INSERT INTO fyp_notifications
                    (
                      project_id,
                      recipient_type,
                      recipient_name,
                      recipient_email,
                      title,
                      message,
                      is_read,
                      created_at
                    )
                  VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())
                `;

                db.query(
                  notificationSql,
                  [
                    projectId,
                    "New FYP Proposal Submitted",
                    `${student.full_name || "A student"} submitted a new FYP proposal titled "${String(projectTitle).trim()}". Please review and run supervisor matching.`,
                  ],
                  () => {
                    return res.json({
                      success: true,
                      message: "FYP proposal submitted successfully and coordinator has been notified.",
                      projectId,
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});



// ===============================
// Supervisor Review API
// ===============================
app.get("/api/supervisor/review/:projectId", (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = req.params.projectId;

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT
      fp.project_id,
      fp.project_title,
      fp.project_type,
      fp.abstract,
      fp.keywords,
      fp.student_user_id,
      fp.student_name,
      fp.matric_no,
      fp.supervisor_user_id,
      fp.supervisor_name,
      fp.supervisor_email,
      fp.status,
      fp.match_score,
      fp.created_at,
      fp.updated_at,
      ps.submission_id,
      ps.submission_title,
      ps.file_path,
      ps.original_file_name,
      ps.submission_type,
      ps.status AS submission_status,
      ps.feedback,
      ps.submitted_at
    FROM fyp_projects fp
    LEFT JOIN projects_submissions ps 
      ON ps.project_id = fp.project_id
      AND ps.submission_type = 'proposal'
    WHERE fp.project_id = ?
    AND fp.supervisor_user_id = ?
  `;

  db.query(sql, [projectId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Project not found for this supervisor" });
    }

    const first = rows[0];

    const documents = rows
      .filter((row) => row.submission_id)
      .map((row) => ({
        submission_id: row.submission_id,
        title: row.submission_title || "Proposal Submission",
        fileName: row.original_file_name || "Proposal document",
        filePath: row.file_path || "",
        type: row.submission_type || "proposal",
        status: row.submission_status || "pending",
        feedback: row.feedback || "",
        submittedAt: row.submitted_at,
      }));

    res.json({
      success: true,
      project: {
        project_id: first.project_id,
        title: first.project_title,
        type: first.project_type || "Development",
        abstract: first.abstract || "",
        keywords: first.keywords || "",
        student_user_id: first.student_user_id,
        studentName: first.student_name || "Student",
        matricNo: first.matric_no || "-",
        supervisorName: first.supervisor_name || "Supervisor",
        status: first.status || "Pending Supervisor Approval",
        matchScore: first.match_score || null,
        documents,
      },
    });
  });
});

app.get("/api/supervisor/review/:projectId/document/:submissionId", (req, res) => {
  const userId = getTokenUserId(req);
  const { projectId, submissionId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT ps.file_path, ps.original_file_name
    FROM projects_submissions ps
    JOIN fyp_projects fp ON fp.project_id = ps.project_id
    WHERE ps.submission_id = ?
    AND ps.project_id = ?
    AND fp.supervisor_user_id = ?
    LIMIT 1
  `;

  db.query(sql, [submissionId, projectId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const doc = rows[0];
    const absolutePath = nodePath.join(__dirname, doc.file_path || "");

    if (!nodeFs.existsSync(absolutePath)) {
      return res.status(404).json({ error: "File is missing on server storage" });
    }

    res.download(absolutePath, doc.original_file_name || "proposal_document");
  });
});

app.post("/api/supervisor/review/:projectId/decision", (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = req.params.projectId;
  const { decision, feedback } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const decisionValue = String(decision || "").toLowerCase();

  const statusMap = {
    approve: "Active",
    revision: "Revision Required",
    reject: "Rejected",
  };

  const newStatus = statusMap[decisionValue];

  if (!newStatus) {
    return res.status(400).json({ error: "Decision must be approve, revision, or reject" });
  }

  const projectSql = `
    SELECT 
      fp.project_id,
      fp.project_title,
      fp.student_user_id,
      fp.student_name,
      u.email AS student_email
    FROM fyp_projects fp
    LEFT JOIN users u ON u.user_id = fp.student_user_id
    WHERE fp.project_id = ?
    AND fp.supervisor_user_id = ?
    LIMIT 1
  `;

  db.query(projectSql, [projectId, userId], (projectErr, projectRows) => {
    if (projectErr) return res.status(500).json({ error: projectErr.message });

    if (!projectRows || projectRows.length === 0) {
      return res.status(404).json({ error: "Project not found for this supervisor" });
    }

    const project = projectRows[0];

    const updateSql = `
      UPDATE fyp_projects
      SET status = ?, updated_at = NOW()
      WHERE project_id = ?
      AND supervisor_user_id = ?
    `;

    db.query(updateSql, [newStatus, projectId, userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });

      db.query(
        `
        UPDATE projects_submissions
        SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE project_id = ?
        AND submission_type = 'proposal'
        `,
        [
          decisionValue === "approve" ? "approved" : decisionValue === "revision" ? "pending" : "rejected",
          feedback || "",
          userId,
          projectId,
        ],
        () => {}
      );

      const studentTitle =
        decisionValue === "approve"
          ? "FYP Proposal Approved"
          : decisionValue === "revision"
            ? "FYP Proposal Requires Revision"
            : "FYP Proposal Rejected";

      const studentMessage =
        decisionValue === "approve"
          ? `Your FYP proposal "${project.project_title}" has been approved by your supervisor.`
          : decisionValue === "revision"
            ? `Your FYP proposal "${project.project_title}" requires revision. Supervisor feedback: ${feedback || "Please review your proposal."}`
            : `Your FYP proposal "${project.project_title}" has been rejected. Supervisor feedback: ${feedback || "No feedback provided."}`;

      db.query(
        `
        INSERT INTO fyp_notifications
          (project_id, recipient_type, recipient_name, recipient_email, title, message, is_read, created_at)
        VALUES (?, 'Student', ?, ?, ?, ?, 0, NOW())
        `,
        [
          projectId,
          project.student_name || "Student",
          project.student_email || "",
          studentTitle,
          studentMessage,
        ],
        () => {}
      );

      db.query(
        `
        INSERT INTO fyp_notifications
          (project_id, recipient_type, recipient_name, recipient_email, title, message, is_read, created_at)
        VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())
        `,
        [
          projectId,
          "Supervisor Decision Submitted",
          `Supervisor submitted decision "${newStatus}" for project "${project.project_title}".`,
        ],
        () => {}
      );

      res.json({
        success: true,
        message: `Decision submitted: ${newStatus}`,
        status: newStatus,
      });
    });
  });
});



// ===============================
// Coordinator FYP Status Update API
// ===============================
app.patch("/api/coordinator/fyp-status/:projectId", (req, res) => {
  const projectId = req.params.projectId;
  const { status, matchScore } = req.body || {};

  if (!projectId) {
    return res.status(400).json({ success: false, error: "Project ID is required" });
  }

  if (!status) {
    return res.status(400).json({ success: false, error: "Status is required" });
  }

  const allowedStatuses = [
    "Pending Coordinator Review",
    "Pending AI Matching",
    "Pending Supervisor Assignment",
    "Pending Supervisor Approval",
    "Active",
    "Revision Required",
    "Rejected"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid project status" });
  }

  const sql = `
    UPDATE fyp_projects
    SET status = ?,
        match_score = COALESCE(?, match_score),
        updated_at = NOW()
    WHERE project_id = ?
  `;

  db.query(sql, [status, matchScore || null, projectId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      projectId,
      status,
      affectedRows: result.affectedRows,
    });
  });
});

app.listen(3000, () => console.log("Backend running on port 3000"));
