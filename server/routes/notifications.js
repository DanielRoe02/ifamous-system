/**
 * notification management routes
 * handles fetching system notifications, marking notifications as read, and creating new server-side notifications in SQL database
 */

const express = require("express");
const db = require("../config/db").promise();

const router = express.Router();

// GET /api/notifications & /api/supervisor-matching/notifications - get system notifications filtered by role or recipient email from SQL database
async function getNotificationsHandler(req, res) {
  try {
    const {
      recipientEmail,
      recipientType,
      all,
      roles,
      email
    } = req.query;

    if (all === "true") {
      const [rows] = await db.query(`
        SELECT
          notification_id,
          project_id,
          recipient_type,
          recipient_name,
          recipient_email,
          title,
          message,
          is_read,
          created_at
        FROM fyp_notifications
        ORDER BY created_at DESC, notification_id DESC
        LIMIT 50
      `);

      return res.json({
        success: true,
        notifications: rows.map((row) => ({
          notification_id: row.notification_id,
          project_id: row.project_id,
          recipientType: row.recipient_type,
          recipientName: row.recipient_name,
          recipientEmail: row.recipient_email,
          title: row.title,
          message: row.message,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        })),
      });
    }

    if (roles && email) {
      const roleList = String(roles)
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean);

      const roleConditions = [];
      const params = [];

      if (roleList.includes("Coordinator")) {
        roleConditions.push("(recipient_type = 'Coordinator')");
      }

      if (roleList.includes("Supervisor")) {
        roleConditions.push(
          "(recipient_type = 'Supervisor' AND LOWER(recipient_email) = LOWER(?))"
        );
        params.push(email);
      }

      if (roleList.includes("Student")) {
        roleConditions.push(
          "(recipient_type = 'Student' AND LOWER(recipient_email) = LOWER(?))"
        );
        params.push(email);
      }

      if (roleList.includes("Examiner")) {
        roleConditions.push(
          "(recipient_type = 'Examiner' AND LOWER(recipient_email) = LOWER(?))"
        );
        params.push(email);
      }

      if (roleConditions.length === 0) {
        return res.json({
          success: true,
          notifications: [],
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          notification_id,
          project_id,
          recipient_type,
          recipient_name,
          recipient_email,
          title,
          message,
          is_read,
          created_at
        FROM fyp_notifications
        WHERE ${roleConditions.join(" OR ")}
        ORDER BY created_at DESC, notification_id DESC
        LIMIT 50
        `,
        params
      );

      return res.json({
        success: true,
        notifications: rows.map((row) => ({
          notification_id: row.notification_id,
          project_id: row.project_id,
          recipientType: row.recipient_type,
          recipientName: row.recipient_name,
          recipientEmail: row.recipient_email,
          title: row.title,
          message: row.message,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        })),
      });
    }

    const whereParts = [];
    const params = [];

    if (recipientEmail) {
      whereParts.push("LOWER(recipient_email) = LOWER(?)");
      params.push(recipientEmail);
    }

    if (recipientType) {
      whereParts.push("recipient_type = ?");
      params.push(recipientType);
    }

    const whereSql =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `
      SELECT
        notification_id,
        project_id,
        recipient_type,
        recipient_name,
        recipient_email,
        title,
        message,
        is_read,
        created_at
      FROM fyp_notifications
      ${whereSql}
      ORDER BY created_at DESC, notification_id DESC
      LIMIT 50
      `,
      params
    );

    return res.json({
      success: true,
      notifications: rows.map((row) => ({
        notification_id: row.notification_id,
        project_id: row.project_id,
        recipientType: row.recipient_type,
        recipientName: row.recipient_name,
        recipientEmail: row.recipient_email,
        title: row.title,
        message: row.message,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load notifications.",
      details: error.message,
    });
  }
}

// PATCH /api/notifications/:notificationId/read & /api/supervisor-matching/notifications/:notificationId/read - mark notification as read in SQL database
async function markNotificationReadHandler(req, res) {
  try {
    const { notificationId } = req.params;

    const [result] = await db.execute(
      `
      UPDATE fyp_notifications
      SET is_read = 1
      WHERE notification_id = ?
      `,
      [notificationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Notification not found.",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read.",
      notificationId,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to update notification.",
      details: error.message,
    });
  }
}

// POST /api/notifications - create new notification in SQL database
router.post("/notifications", async (req, res) => {
  try {
    const {
      projectId,
      recipientType,
      recipientName,
      recipientEmail,
      title,
      message,
    } = req.body || {};

    if (!title || !message || !recipientType) {
      return res.status(400).json({
        success: false,
        error: "Title, message, and recipientType are required fields.",
      });
    }

    const [result] = await db.execute(
      `
      INSERT INTO fyp_notifications
        (project_id, recipient_type, recipient_name, recipient_email, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
      `,
      [
        projectId || null,
        recipientType,
        recipientName || "",
        recipientEmail || "",
        title,
        message,
      ]
    );

    res.json({
      success: true,
      message: "Notification created successfully.",
      notificationId: result.insertId,
    });
  } catch (error) {
    console.error("Create notification error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to create notification.",
      details: error.message,
    });
  }
});

// Route mappings for /api/notifications
router.get("/notifications", getNotificationsHandler);
router.patch("/notifications/:notificationId/read", markNotificationReadHandler);

// Legacy route mappings for /api/supervisor-matching/notifications (backwards compatibility)
router.get("/supervisor-matching/notifications", getNotificationsHandler);
router.patch("/supervisor-matching/notifications/:notificationId/read", markNotificationReadHandler);

module.exports = router;
