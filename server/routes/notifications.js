/** Secure notification routes. Notification visibility is derived from the authenticated account. */
const express = require("express");
const db = require("../config/db").promise();
const { authenticateToken } = require("../middleware/auth");
const { loadRoles } = require("../utils/projectAccess");
const { toUtcIso } = require("../utils/dateTime");

const router = express.Router();
router.use(authenticateToken);

const mapNotification = (row) => ({
  notification_id: row.notification_id,
  project_id: row.project_id,
  recipientType: row.recipient_type,
  recipientName: row.recipient_name,
  recipientEmail: row.recipient_email,
  title: row.title,
  message: row.message,
  isRead: Boolean(row.is_read),
  createdAt: toUtcIso(row.created_at),
  emailRequested: Boolean(row.email_requested),
  emailStatus: row.email_status || "Not Requested",
  emailSentAt: toUtcIso(row.email_sent_at),
  emailError: row.email_error || null,
  actionUrl: row.action_url || null,
});

async function getNotificationsHandler(req, res) {
  try {
    const roles = await loadRoles(req.user.user_id);
    const email = String(req.user.email || "").toLowerCase();
    const wantsAll = req.query.all === "true";

    if (wantsAll && !roles.is_admin && !roles.is_coordinator) {
      return res.status(403).json({ error: "Only coordinator/admin can view all notifications" });
    }

    const conditions = [];
    const params = [];
    if (roles.is_admin || wantsAll) {
      conditions.push("1 = 1");
    } else {
      if (roles.is_coordinator) conditions.push("recipient_type = 'Coordinator'");
      for (const role of ["Student", "Supervisor", "Examiner"]) {
        if (roles[`is_${role.toLowerCase()}`]) {
          conditions.push("(recipient_type = ? AND LOWER(recipient_email) = ?)");
          params.push(role, email);
        }
      }
    }

    if (!conditions.length) return res.json({ success: true, notifications: [] });

    const [rows] = await db.query(
      `SELECT notification_id, project_id, recipient_type, recipient_name, recipient_email,
              title, message, is_read, created_at, email_requested, email_status,
              email_sent_at, email_error, action_url
       FROM fyp_notifications
       WHERE ${conditions.join(" OR ")}
       ORDER BY created_at DESC, notification_id DESC
       LIMIT 50`,
      params
    );
    res.json({ success: true, notifications: rows.map(mapNotification) });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, error: "Failed to load notifications.", details: error.message });
  }
}

async function markNotificationReadHandler(req, res) {
  try {
    const roles = await loadRoles(req.user.user_id);
    const [rows] = await db.query(
      "SELECT notification_id, recipient_type, recipient_email FROM fyp_notifications WHERE notification_id = ? LIMIT 1",
      [req.params.notificationId]
    );
    if (!rows.length) return res.status(404).json({ error: "Notification not found" });
    const item = rows[0];
    const ownsNotification =
      (roles.is_coordinator && item.recipient_type === "Coordinator") ||
      String(item.recipient_email || "").toLowerCase() === String(req.user.email || "").toLowerCase();
    if (!roles.is_admin && !ownsNotification) {
      return res.status(403).json({ error: "You cannot update another user's notification" });
    }
    await db.execute("UPDATE fyp_notifications SET is_read = 1 WHERE notification_id = ?", [req.params.notificationId]);
    res.json({ success: true, notificationId: req.params.notificationId });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ success: false, error: "Failed to update notification.", details: error.message });
  }
}

router.post("/notifications", async (req, res) => {
  try {
    const roles = await loadRoles(req.user.user_id);
    if (!roles.is_admin && !roles.is_coordinator) {
      return res.status(403).json({ error: "Only coordinator/admin can create arbitrary notifications" });
    }
    const { projectId, recipientType, recipientName, recipientEmail, title, message } = req.body || {};
    if (!title || !message || !recipientType) {
      return res.status(400).json({ error: "Title, message, and recipientType are required" });
    }
    const [result] = await db.execute(
      `INSERT INTO fyp_notifications
        (project_id, recipient_type, recipient_name, recipient_email, title, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [projectId || null, recipientType, recipientName || "", recipientEmail || "", title, message]
    );
    res.json({ success: true, notificationId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create notification.", details: error.message });
  }
});

router.get("/notifications", getNotificationsHandler);
router.patch("/notifications/:notificationId/read", markNotificationReadHandler);
router.get("/supervisor-matching/notifications", getNotificationsHandler);
router.patch("/supervisor-matching/notifications/:notificationId/read", markNotificationReadHandler);

module.exports = router;
