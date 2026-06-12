// server/server.js
const express = require("express");
const adminRoutes = require("./routes/admin");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;
const bcrypt = require("bcrypt");

const app = express();
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

app.listen(3000, () => console.log("Backend running on port 3000"));
