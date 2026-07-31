// server/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const { ensureNotificationEmailSchema } = require("./utils/notificationSchema");

// Import Route Modules
const authRoutes = require("./routes/auth");
const sessionRoutes = require("./routes/sessions");
const timetableRoutes = require("./routes/timetables");
const userRoutes = require("./routes/users");
const studentRoutes = require("./routes/student");
const supervisorRoutes = require("./routes/supervisor");
const coordinatorRoutes = require("./routes/coordinator");
const adminRoutes = require("./routes/admin");
const notificationRoutes = require("./routes/notifications");
const assistantRouter = require("./routes/assistant");
const supervisorMatchingRouter = require("./routes/supervisorMatching");
const journeyRoutes = require("./routes/journey");
const examinerRoutes = require("./routes/examiner");
const examinerAssignmentRoutes = require("./routes/examinerAssignment");
const profileRoutes = require("./routes/profile");
const supervisorAssessmentRoutes = require("./routes/supervisorAssessment");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Ensure necessary database tables and ON DELETE CASCADE constraints exist on startup
function ensureAdminTable() {
  db.query(
    `CREATE TABLE IF NOT EXISTS admin (
      user_id INT NOT NULL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err && !err.message.includes("already exists")) {
        // Fallback for simple table creation if constraint already exists
        db.query(
          `CREATE TABLE IF NOT EXISTS admin (
            user_id INT NOT NULL PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        );
      }
    }
  );

  const cascadeStatements = [
    "ALTER TABLE coordinator DROP FOREIGN KEY coordinator_ibfk_1, ADD CONSTRAINT coordinator_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE",
    "ALTER TABLE examiners DROP FOREIGN KEY examiners_ibfk_1, ADD CONSTRAINT examiners_ibfk_1 FOREIGN KEY (examiners_id) REFERENCES users (user_id) ON DELETE CASCADE",
    "ALTER TABLE students DROP FOREIGN KEY students_ibfk_1, ADD CONSTRAINT students_ibfk_1 FOREIGN KEY (student_id) REFERENCES users (user_id) ON DELETE CASCADE",
    "ALTER TABLE supervisor DROP FOREIGN KEY supervisor_ibfk_1, ADD CONSTRAINT supervisor_ibfk_1 FOREIGN KEY (supervisor_id) REFERENCES users (user_id) ON DELETE CASCADE",
  ];

  cascadeStatements.forEach((sql) => {
    db.query(sql, () => {
      // Intentionally ignore error if constraint name differs or already altered
    });
  });
}

ensureAdminTable();

// Mount Domain Routers
app.use("/api", authRoutes);
app.use("/api", sessionRoutes);
app.use("/api", timetableRoutes);
app.use("/api", userRoutes);
app.use("/api", studentRoutes);
app.use("/api", supervisorRoutes);
app.use("/api", coordinatorRoutes);
app.use("/api", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", journeyRoutes);
app.use("/api", examinerRoutes);
app.use("/api", examinerAssignmentRoutes);
app.use("/api", profileRoutes);
app.use("/api", supervisorAssessmentRoutes);

// Mount Existing Feature Routers
app.use(assistantRouter);
app.use(supervisorMatchingRouter);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await ensureNotificationEmailSchema();
    console.log("Notification email schema ready");
  } catch (error) {
    console.warn("Notification email schema check failed:", error.message);
  }

  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

startServer();
