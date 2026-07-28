// server/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");

// Import Route Modules
const authRoutes = require("./routes/auth");
const sessionRoutes = require("./routes/sessions");
const timetableRoutes = require("./routes/timetables");
const userRoutes = require("./routes/users");
const studentRoutes = require("./routes/student");
const supervisorRoutes = require("./routes/supervisor");
const coordinatorRoutes = require("./routes/coordinator");
const adminRoutes = require("./routes/admin");
const assistantRouter = require("./routes/assistant");
const supervisorMatchingRouter = require("./routes/supervisorMatching");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Ensure necessary database tables exist on startup
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

// Mount Domain Routers
app.use("/api", authRoutes);
app.use("/api", sessionRoutes);
app.use("/api", timetableRoutes);
app.use("/api", userRoutes);
app.use("/api", studentRoutes);
app.use("/api", supervisorRoutes);
app.use("/api", coordinatorRoutes);
app.use("/api/admin", adminRoutes);

// Mount Existing Feature Routers
app.use(assistantRouter);
app.use(supervisorMatchingRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
