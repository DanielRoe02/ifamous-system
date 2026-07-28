/**
 * user management routes
 * handles user listing, pagination, profile updates, autocomplete searching, and admin user role administration in SQL database
 */

const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { verifyAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/users - get all users from SQL database
router.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// GET /api/users/recent - get recent users categorized by students, lecturers, and outsiders from SQL database
router.get("/users/recent", (req, res) => {
  db.query("CALL sp_GetRecentUsersByCategory()", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      students: results[0] || [],
      lecturers: results[1] || [],
      outsiders: results[2] || []
    });
  });
});

// GET /api/users/paginated - get paginated user records filtered by category from SQL database
router.get("/users/paginated", (req, res) => {
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

// DELETE /api/users/:id - delete user from SQL database
router.delete("/users/:id", (req, res) => {
  db.query("DELETE FROM users WHERE user_id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "User deleted successfully" });
  });
});

// POST /api/users - create new user in SQL database using stored procedure
router.post("/users", async (req, res) => {
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

// PUT /api/users/:id - update user profile details in SQL database
router.put("/users/:id", (req, res) => {
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

// GET /api/users/search - search non-student users for autocomplete
router.get("/users/search", (req, res) => {
  const query = req.query.q;
  const sessionId = req.query.session_id;
  if (!query || !sessionId) return res.json([]);
  const searchStr = `%${query}%`;
  db.query("CALL sp_SearchNonStudentUsers(?, ?)", [searchStr, sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0] || []);
  });
});

// GET /api/classes/search - search FYP classes for autocomplete
router.get("/classes/search", (req, res) => {
  const query = req.query.q;
  const sessionId = req.query.session_id;
  if (!query || !sessionId) return res.json([]);
  const sql = "SELECT class_id, section_name FROM fyp_classes WHERE fyp_session_id = ? AND section_name LIKE ? AND class_id NOT IN (SELECT class_id FROM time_table WHERE fyp_session_id = ? AND class_id IS NOT NULL) LIMIT 10";
  db.query(sql, [sessionId, `%${query}%`, sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET /api/admin/users - get all users with admin role information from SQL database
router.get("/admin/users", verifyAdmin, (req, res) => {
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

// PUT /api/admin/users/:id/roles - update user role permissions from admin panel in SQL database
router.put("/admin/users/:id/roles", verifyAdmin, async (req, res) => {
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

// PUT /api/admin/users/:id/password - reset user password from admin panel in SQL database
router.put("/admin/users/:id/password", verifyAdmin, async (req, res) => {
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

module.exports = router;
