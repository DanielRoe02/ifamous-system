/**
 * authentication routes
 * handles database connection status check, user registration, and user login with JWT tokens
 */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// GET /api/status - check database connection status
router.get("/status", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err)
      return res.status(500).json({ error: "Database connection failed" });
    res.json({ message: "connected" });
  });
});

function detectAccountType(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (normalized.endsWith("@graduate.utm.my")) return "student";
  if (normalized.endsWith("@utm.my")) return "staff";
  return "external";
}

async function assignDetectedRoles(connection, {
  userId,
  accountType,
  metricNumber,
  cgpa,
  totalCreditHour,
  creditHourProofName,
  expertise,
  workloadCapacity,
  affiliation,
}) {
  if (accountType === "student") {
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
        String(metricNumber).trim().toUpperCase(),
        Number(cgpa),
        creditHourProofName || "Proof uploaded during signup",
        Number(totalCreditHour),
      ]
    );
    return ["Student"];
  }

  if (accountType === "staff") {
    const capacity = Math.max(1, Number(workloadCapacity || 5));
    const expertiseText = String(expertise || "General academic supervision").trim();
    await connection.query(
      `INSERT INTO supervisor
        (research_expertise, sv_capacity, current_capacity, supervisor_id)
       VALUES (?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE
        research_expertise = VALUES(research_expertise),
        sv_capacity = VALUES(sv_capacity)`,
      [expertiseText, capacity, userId]
    );
    await connection.query(
      `INSERT INTO examiners (industry_background, examiners_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE industry_background = VALUES(industry_background)`,
      [String(affiliation || expertiseText || "UTM Academic Staff").trim(), userId]
    );
    return ["Supervisor", "Examiner"];
  }

  return ["External"];
}

// POST /api/signup - backend-authoritative registration and role assignment
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
  const normalizedPhone = String(phoneNumber).replace(/\s+/g, "").trim();
  const accountType = detectAccountType(normalizedEmail);

  if (!/^\d+$/.test(normalizedPhone)) {
    return res.status(400).json({
      error: "Invalid phone number",
      details: "Phone number must contain digits only.",
    });
  }

  if (accountType === "student") {
    if (!metricNumber || cgpa === null || cgpa === undefined || totalCreditHour === null || totalCreditHour === undefined || !creditHourProofName) {
      return res.status(400).json({
        error: "Missing student details",
        details: "Student signup requires metric number, CGPA, completed credit hours, and proof of credit hours.",
      });
    }
  }

  if (accountType === "staff" && !expertise) {
    return res.status(400).json({
      error: "Missing staff expertise",
      details: "UTM staff signup requires at least one expertise area.",
    });
  }

  const connection = await db.promise().getConnection();

  try {
    const [duplicates] = await connection.query(
      `SELECT email, phone_number FROM users
       WHERE LOWER(email) = ? OR phone_number = ? LIMIT 1`,
      [normalizedEmail, normalizedPhone]
    );
    if (duplicates.length) {
      const sameEmail = String(duplicates[0].email || "").toLowerCase() === normalizedEmail;
      return res.status(409).json({
        error: sameEmail ? "Email already registered" : "Phone number already registered",
      });
    }

    const pepper = process.env.SECRET_PEPPER || "";
    const hashedPassword = await bcrypt.hash(password + pepper, 10);

    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `INSERT INTO users
        (email, password_hash, full_name, phone_number, date_created, last_date_login,
         is_utm_staff, co_org_name, expertise, affiliation)
       VALUES (?, ?, ?, ?, CURDATE(), CURDATE(), ?, ?, ?, ?)`,
      [
        normalizedEmail,
        hashedPassword,
        String(fullName).trim(),
        normalizedPhone,
        accountType === "staff" ? 1 : 0,
        accountType === "external" ? companyName || null : null,
        expertise || null,
        affiliation || null,
      ]
    );

    const roles = await assignDetectedRoles(connection, {
      userId: userResult.insertId,
      accountType,
      metricNumber,
      cgpa,
      totalCreditHour,
      creditHourProofName,
      expertise,
      workloadCapacity,
      affiliation,
    });

    await connection.commit();

    return res.status(201).json({
      message:
        accountType === "student"
          ? "Student account registered successfully."
          : accountType === "staff"
            ? "UTM staff account registered with Supervisor and Examiner capabilities."
            : "External user registered successfully.",
      user_id: userResult.insertId,
      accountType,
      roles,
      role: roles.join(", "),
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

async function repairOfficialEmailRole(user) {
  const accountType = detectAccountType(user.email);
  if (accountType === "external") return { repaired: false, accountType };

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    if (accountType === "staff") {
      const expertiseText = String(user.expertise || "General academic supervision").trim();
      await connection.query("UPDATE users SET is_utm_staff = 1 WHERE user_id = ?", [user.user_id]);
      await connection.query(
        `INSERT INTO supervisor (research_expertise, sv_capacity, current_capacity, supervisor_id)
         VALUES (?, 5, 0, ?)
         ON DUPLICATE KEY UPDATE research_expertise = COALESCE(NULLIF(research_expertise, ''), VALUES(research_expertise))`,
        [expertiseText, user.user_id]
      );
      await connection.query(
        `INSERT INTO examiners (industry_background, examiners_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE industry_background = COALESCE(NULLIF(industry_background, ''), VALUES(industry_background))`,
        [String(user.affiliation || expertiseText || "UTM Academic Staff"), user.user_id]
      );
    } else {
      const [existing] = await connection.query(
        "SELECT student_id FROM students WHERE student_id = ? LIMIT 1",
        [user.user_id]
      );
      if (!existing.length) {
        const placeholderMetric = `PENDING${user.user_id}`.slice(0, 20);
        await connection.query(
          `INSERT INTO students
            (student_id, metric_number, CGPA, proof_of_credit_hours, credit_hours_completed)
           VALUES (?, ?, 0, 'Student profile completion required', 0)`,
          [user.user_id, placeholderMetric]
        );
      }
      await connection.query("UPDATE users SET is_utm_staff = 0 WHERE user_id = ?", [user.user_id]);
    }
    await connection.commit();
    return { repaired: true, accountType };
  } catch (error) {
    await connection.rollback();
    console.warn("Official email role repair skipped:", error.message);
    return { repaired: false, accountType, error: error.message };
  } finally {
    connection.release();
  }
}

// POST /api/login - authenticate user login, verify password, and return JWT token with roles
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

      const roleRepair = await repairOfficialEmailRole(user);

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
              is_student: user.is_student,
              is_supervisor: user.is_supervisor,
              is_examiner: user.is_examiner,
            },
            JWT_SECRET,
            { expiresIn: "24h" }
          );

          res.json({ message: "Login successful", user, token, roleRepair });
        }
      );
    } catch (compareError) {
      console.error("Password comparison error:", compareError);
      return res.status(500).json({ error: "Server error during login" });
    }
  });
});

module.exports = router;
