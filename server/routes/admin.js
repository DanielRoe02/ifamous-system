const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const router = express.Router();

function shouldUseSsl() {
  return (
    process.env.DB_SSL === "true" ||
    String(process.env.DB_HOST || "").includes("aivencloud.com")
  );
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: shouldUseSsl()
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

async function ensureAdminTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin (
      user_id INT NOT NULL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

router.get("/users", async (req, res) => {
  try {
    await ensureAdminTable();

    const [rows] = await db.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.phone_number,
        u.affiliation,
        u.co_org_name,
        u.expertise,
        u.is_utm_staff,
        s.metric_number,
        s.CGPA,
        s.credit_hours_completed,
        sv.sv_capacity,
        sv.current_capacity,
        c.user_id AS coordinator_id,
        sv.supervisor_id,
        e.examiners_id,
        st.student_id,
        a.user_id AS admin_id
      FROM users u
      LEFT JOIN students st ON st.student_id = u.user_id
      LEFT JOIN students s ON s.student_id = u.user_id
      LEFT JOIN supervisor sv ON sv.supervisor_id = u.user_id
      LEFT JOIN examiners e ON e.examiners_id = u.user_id
      LEFT JOIN coordinator c ON c.user_id = u.user_id
      LEFT JOIN admin a ON a.user_id = u.user_id
      ORDER BY u.user_id DESC
    `);

    const users = rows.map((user) => {
      const roles = [];

      if (user.admin_id) roles.push("Admin");
      if (user.coordinator_id) roles.push("Coordinator");
      if (user.supervisor_id) roles.push("Supervisor");
      if (user.examiners_id) roles.push("Examiner");
      if (user.student_id) roles.push("Student");

      if (roles.length === 0) {
        if (String(user.email || "").toLowerCase().endsWith("@graduate.utm.my")) {
          roles.push("Student");
        } else if (String(user.email || "").toLowerCase().endsWith("@utm.my")) {
          roles.push("UTM Staff");
        } else {
          roles.push("External User");
        }
      }

      return {
        ...user,
        roles,
      };
    });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const userId = req.params.id;
    const newPassword = req.body.password || "Temp1234!";
    const pepper = process.env.SECRET_PEPPER || "";
    const hashedPassword = await bcrypt.hash(newPassword + pepper, 10);

    await db.query(
      "UPDATE users SET password_hash = ? WHERE user_id = ?",
      [hashedPassword, userId]
    );

    res.json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Admin reset password error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/users/:id/roles", async (req, res) => {
  try {
    await ensureAdminTable();

    const userId = Number(req.params.id);
    const {
      isAdmin,
      isCoordinator,
      isSupervisor,
      isExaminer,
      isStudent,
      metricNumber,
      cgpa,
      creditHours,
      proofOfCreditHours,
      expertise,
      capacity,
      industryBackground,
    } = req.body;

    if (isAdmin) {
      await db.query("INSERT IGNORE INTO admin (user_id) VALUES (?)", [userId]);
    } else {
      await db.query("DELETE FROM admin WHERE user_id = ?", [userId]);
    }

    if (isCoordinator) {
      await db.query("INSERT IGNORE INTO coordinator (user_id) VALUES (?)", [userId]);
    } else {
      await db.query("DELETE FROM coordinator WHERE user_id = ?", [userId]);
    }

    if (isSupervisor) {
      await db.query(
        `
        INSERT INTO supervisor (supervisor_id, research_expertise, sv_capacity, current_capacity)
        VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE
          research_expertise = VALUES(research_expertise),
          sv_capacity = VALUES(sv_capacity)
        `,
        [userId, expertise || "General Supervision", Number(capacity) || 5]
      );
    } else {
      await db.query("DELETE FROM supervisor WHERE supervisor_id = ?", [userId]);
    }

    if (isExaminer) {
      await db.query(
        `
        INSERT INTO examiners (examiners_id, industry_background)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          industry_background = VALUES(industry_background)
        `,
        [userId, industryBackground || "Academic Examiner"]
      );
    } else {
      await db.query("DELETE FROM examiners WHERE examiners_id = ?", [userId]);
    }

    if (isStudent) {
      await db.query(
        `
        INSERT INTO students (
          student_id,
          metric_number,
          CGPA,
          proof_of_credit_hours,
          credit_hours_completed
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          metric_number = VALUES(metric_number),
          CGPA = VALUES(CGPA),
          proof_of_credit_hours = VALUES(proof_of_credit_hours),
          credit_hours_completed = VALUES(credit_hours_completed)
        `,
        [
          userId,
          metricNumber || `A${userId}`,
          Number(cgpa) || 0,
          proofOfCreditHours || "Pending Upload",
          Number(creditHours) || 0,
        ]
      );
    } else {
      await db.query("DELETE FROM students WHERE student_id = ?", [userId]);
    }

    res.json({
      success: true,
      message: "Roles updated successfully.",
    });
  } catch (error) {
    console.error("Admin role update error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
