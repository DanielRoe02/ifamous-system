const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// Status API Endpoint
router.get("/status", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err)
      return res.status(500).json({ error: "Database connection failed" });
    res.json({ message: "connected" });
  });
});

// Signup API Endpoint
router.post("/signup", async (req, res) => {
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
router.post("/login", (req, res) => {
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
            JWT_SECRET,
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

module.exports = router;
