/**
 * FYP session management routes
 * handles session CRUD operations, active session toggling, and calendar data retrieval in SQL database
 */

const express = require("express");
const db = require("../config/db");

const router = express.Router();

// GET /api/sessions - get all FYP sessions from SQL database
router.get("/sessions", (req, res) => {
  db.query("CALL sp_get_all_session()", (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch sessions: " + err.message });
    res.json(results[0] || []);
  });
});

// GET /api/sessions/active - get currently active FYP session from SQL database
router.get("/sessions/active", (req, res) => {
  db.query("CALL sp_get_all_session()", (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch active session: " + err.message });
    const sessions = results[0] || [];
    const activeSession = sessions.find(s => s.is_active === 1 || s.is_active === true || s.is_active === Buffer.from([1]));
    if (!activeSession) return res.status(404).json({ error: "No active session found" });
    res.json(activeSession);
  });
});

// PUT /api/sessions/:id/active - set specified FYP session as active in SQL database
router.put("/sessions/:id/active", (req, res) => {
  const sessionId = req.params.id;
  db.query("sp_SetActiveFYPSession(?)", [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to update active session: " + err.message });
    res.json({ message: "Session set as active successfully" });
  });
});

// GET /api/sessions/:id - get single FYP session details from SQL database
router.get("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  db.query("CALL sp_select_session(?)", [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch session: " + err.message });
    res.json(results[0]?.[0] || null);
  });
});

// POST /api/sessions - create new FYP session in SQL database
router.post("/sessions", (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: "Session ID (number) is required" });

  db.query("CALL sp_insert_session(?)", [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to create session: " + err.message });
    res.json({ message: "Session created successfully" });
  });
});

// PUT /api/sessions/:id - update FYP session ID in SQL database
router.put("/sessions/:id", (req, res) => {
  const old_id = req.params.id;
  const { new_session_id } = req.body;
  if (!new_session_id) return res.status(400).json({ error: "New Session ID is required" });

  db.query("CALL sp_update_session(?, ?)", [old_id, new_session_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to update session: " + err.message });
    res.json({ message: "Session updated successfully" });
  });
});

// DELETE /api/sessions/:id - delete FYP session from SQL database
router.delete("/sessions/:id", (req, res) => {
  const session_id = req.params.id;
  db.query("CALL sp_delete_session(?)", [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to delete session: " + err.message });
    res.json({ message: "Session deleted successfully" });
  });
});

// GET /api/sessions/:id/data - get timetables and calendar data for specified FYP session from SQL database
router.get("/sessions/:id/data", (req, res) => {
  const sessionId = req.params.id;
  db.query("CALL sp_GetSessionCalendarData(?)", [sessionId], (err, results) => {
    if (err) {
      console.error("Database error in sp_GetSessionCalendarData:", err);
      return res.status(500).json({ error: "Failed to fetch session data: " + err.message });
    }

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
      projects: []
    });
  });
});

module.exports = router;
