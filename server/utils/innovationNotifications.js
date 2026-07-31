const { query } = require("./dbPromise");
const { sendEmailNotification, absoluteActionUrl } = require("./emailService");

function wantsEmail(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "boolean") return value;
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function defaultActionPath(recipientType, projectId, title = "") {
  const id = encodeURIComponent(projectId || "");
  const lowerTitle = String(title).toLowerCase();
  if (recipientType === "Student") {
    const tab = lowerTitle.includes("result") ? "&tab=result" : lowerTitle.includes("revision") ? "&tab=revision" : "";
    return `/student-project-details?projectId=${id}${tab}`;
  }
  if (recipientType === "Supervisor") {
    if (lowerTitle.includes("revision") || lowerTitle.includes("proposal")) {
      return `/supervisor-review?projectId=${id}`;
    }
    return `/project-journey?projectId=${id}`;
  }
  if (recipientType === "Examiner") return `/examiner-review?projectId=${id}`;
  if (recipientType === "Coordinator") {
    if (lowerTitle.includes("examiner") || lowerTitle.includes("evaluation") || lowerTitle.includes("result")) {
      return "/assign-examiner";
    }
    return "/manage-fyp";
  }
  return "/";
}

async function createNotificationRecord({
  projectId,
  recipientType,
  recipientName,
  recipientEmail,
  title,
  message,
  sendEmail,
  actionPath,
}) {
  const emailRequested = wantsEmail(sendEmail);
  const initialStatus = emailRequested ? "Pending" : "Not Requested";
  const actionUrl = absoluteActionUrl(actionPath || defaultActionPath(recipientType, projectId, title));

  const result = await query(
    `INSERT INTO fyp_notifications
      (project_id, recipient_type, recipient_name, recipient_email, title, message,
       is_read, created_at, email_requested, email_status, action_url)
     VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), ?, ?, ?)`,
    [
      projectId || null,
      recipientType,
      recipientName || recipientType,
      recipientEmail || "",
      title,
      message,
      emailRequested ? 1 : 0,
      initialStatus,
      actionUrl,
    ]
  );

  if (!emailRequested) {
    return {
      notificationId: result.insertId,
      inAppStatus: "Sent",
      emailStatus: "Not Requested",
      actionUrl,
    };
  }

  const email = await sendEmailNotification({
    to: recipientEmail,
    recipientName,
    title,
    message,
    actionPath: actionUrl,
    actionLabel: "Open in I-FAMOUS",
  });

  await query(
    `UPDATE fyp_notifications
     SET email_status = ?, email_sent_at = CASE WHEN ? IN ('Accepted', 'Sent') THEN NOW() ELSE NULL END,
         email_error = ?
     WHERE notification_id = ?`,
    [email.status, email.status, email.error || null, result.insertId]
  );

  return {
    notificationId: result.insertId,
    inAppStatus: "Sent",
    emailStatus: email.status,
    emailError: email.error || null,
    actionUrl,
  };
}

async function notifyUser({
  projectId,
  userId,
  recipientType,
  title,
  message,
  sendEmail = true,
  actionPath,
}) {
  if (!userId) return null;
  try {
    const rows = await query("SELECT full_name, email FROM users WHERE user_id = ? LIMIT 1", [userId]);
    const user = rows[0];
    if (!user) return null;
    return await createNotificationRecord({
      projectId,
      recipientType,
      recipientName: user.full_name || recipientType,
      recipientEmail: user.email || "",
      title,
      message,
      sendEmail,
      actionPath,
    });
  } catch (error) {
    // Notification failures must never roll back the academic workflow.
    console.warn("Innovation notification skipped:", error.message);
    return { inAppStatus: "Failed", emailStatus: "Failed", emailError: error.message };
  }
}

async function notifyCoordinators({ projectId, title, message, sendEmail = true, actionPath }) {
  try {
    const rows = await query(
      `SELECT u.user_id FROM coordinator c JOIN users u ON u.user_id = c.user_id`
    );
    return await Promise.all(
      rows.map((row) =>
        notifyUser({
          projectId,
          userId: row.user_id,
          recipientType: "Coordinator",
          title,
          message,
          sendEmail,
          actionPath,
        })
      )
    );
  } catch (error) {
    console.warn("Coordinator notification skipped:", error.message);
    return [];
  }
}

module.exports = {
  createNotificationRecord,
  notifyUser,
  notifyCoordinators,
  wantsEmail,
};
