const express = require("express");
const fs = require("fs");
const path = require("path");
const { authenticateToken } = require("../middleware/auth");
const { query, transaction } = require("../utils/dbPromise");
const {
  assertProjectAccess,
  requireProjectRole,
} = require("../utils/projectAccess");
const { upload } = require("../utils/innovationUpload");
const { notifyUser, notifyCoordinators } = require("../utils/innovationNotifications");
const { ACTIVE_RISK_STATUSES, workflowStateForStatus } = require("../utils/workflowState");

const router = express.Router();
const migrationError = (res, error) => {
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      error: "The innovation database migration has not been applied yet.",
      code: "MIGRATION_REQUIRED",
      details: error.message,
    });
  }
  console.error(error);
  return res.status(500).json({ error: error.message || "Server error" });
};

router.use("/projects/:projectId", authenticateToken, assertProjectAccess);

router.get("/projects/:projectId/journey", async (req, res) => {
  try {
    const projectId = req.project.project_id;
    if (String(req.project.status || "") === "Rejected" && !req.roles.is_coordinator && !req.roles.is_admin) {
      return res.status(409).json({
        error: "Rejected proposals do not have an FYP Development Journey. Open the proposal details to view the rejection decision and feedback.",
        code: "JOURNEY_NOT_AVAILABLE",
        projectId,
      });
    }
    await query(
      `UPDATE fyp_milestones SET status = 'Overdue', updated_at = NOW()
       WHERE project_id = ? AND due_date < CURDATE()
         AND status NOT IN ('Completed', 'Revision Required')`,
      [projectId]
    );
    const examinerOnly = req.roles.is_examiner && !req.roles.is_coordinator && !req.roles.is_admin;
    const [milestones, progress, logbooks, submissions, feedback, actionItems, examinerEvaluations, supervisorAssessments, nominations] = await Promise.all([
      examinerOnly ? Promise.resolve([]) : query("SELECT * FROM fyp_milestones WHERE project_id = ? ORDER BY due_date, milestone_id", [projectId]),
      examinerOnly ? Promise.resolve([]) : query("SELECT * FROM fyp_progress_updates WHERE project_id = ? ORDER BY created_at DESC", [projectId]),
      examinerOnly ? Promise.resolve([]) : query("SELECT * FROM fyp_logbooks WHERE project_id = ? ORDER BY meeting_date DESC, logbook_id DESC", [projectId]),
      query(
        `SELECT submission_id, submission_title, original_file_name, file_path, mime_type,
                submission_type, status, version_number, is_locked, uploaded_by, submitted_at,
                feedback, reviewed_by, reviewed_at
         FROM projects_submissions WHERE project_id = ?
           ${examinerOnly ? "AND (is_locked = 1 OR submission_id = ?)" : ""}
         ORDER BY submission_type, version_number DESC, submission_id DESC`,
        examinerOnly ? [projectId, req.project.approved_submission_id] : [projectId]
      ),
      examinerOnly
        ? query("SELECT * FROM fyp_feedback WHERE project_id = ? AND author_user_id = ? ORDER BY created_at DESC", [projectId, req.user.user_id])
        : query("SELECT * FROM fyp_feedback WHERE project_id = ? ORDER BY created_at DESC", [projectId]),
      examinerOnly ? Promise.resolve([]) : query("SELECT * FROM fyp_action_items WHERE project_id = ? ORDER BY due_date, action_item_id", [projectId]),
      query(
        `SELECT examiner_user_id, strengths, improvements, recommendations, overall_comments,
                total_score, percentage, status, submitted_at
         FROM fyp_evaluations WHERE project_id = ? AND status = 'Submitted'`,
        [projectId]
      ),
      query(
        `SELECT supervisor_user_id, comments, total_score, percentage, status, submitted_at
         FROM fyp_supervisor_assessments WHERE project_id = ? AND status = 'Submitted'`,
        [projectId]
      ),
      query(
        `SELECT n.*, u.full_name AS supervisor_name, u.email AS supervisor_email,
                s.research_expertise, s.sv_capacity, s.current_capacity
         FROM fyp_supervisor_nominations n
         JOIN users u ON u.user_id = n.supervisor_user_id
         LEFT JOIN supervisor s ON s.supervisor_id = n.supervisor_user_id
         WHERE n.project_id = ? ORDER BY n.preference_rank, n.created_at`,
        [projectId]
      ),
    ]);

    const completed = milestones.filter((item) => item.status === "Completed").length;
    const milestonePercent = milestones.length ? Math.round((completed / milestones.length) * 100) : 0;
    const workflow = workflowStateForStatus(
      req.project.status,
      Math.max(Number(req.project.progress_percent || 0), milestonePercent)
    );
    const progressPercent = workflow.progress;
    const overdueCount = milestones.filter((item) => item.status === "Overdue").length;
    const lastProgressAt = progress[0]?.created_at ? new Date(progress[0].created_at) : null;
    const inactiveDays = lastProgressAt
      ? Math.floor((Date.now() - lastProgressAt.getTime()) / 86400000)
      : progressPercent > 0 ? 0 : 999;
    let riskStatus = workflow.risk;
    if (ACTIVE_RISK_STATUSES.has(String(req.project.status || ""))) {
      riskStatus = overdueCount >= 2 || inactiveDays >= 21
        ? "At Risk"
        : overdueCount >= 1 || inactiveDays >= 14
          ? "Needs Attention"
          : workflow.risk;
    }

    if (
      riskStatus !== req.project.risk_status ||
      workflow.phase !== req.project.current_phase ||
      Number(req.project.progress_percent || 0) !== progressPercent
    ) {
      await query(
        "UPDATE fyp_projects SET current_phase = ?, progress_percent = ?, risk_status = ?, updated_at = NOW() WHERE project_id = ?",
        [workflow.phase, progressPercent, riskStatus, projectId]
      );
    }

    res.json({
      success: true,
      project: {
        ...req.project,
        current_phase: workflow.phase,
        progress_percent: progressPercent,
        risk_status: riskStatus,
        accessRole: req.roles.is_coordinator || req.roles.is_admin
          ? "coordinator"
          : req.isProjectStudent
            ? "student"
            : Number(req.project.supervisor_user_id) === Number(req.user.user_id)
              ? "supervisor"
              : "examiner",
      },
      milestones,
      progress,
      logbooks,
      submissions,
      feedback,
      actionItems,
      nominations,
      releasedResult: req.project.status === "Result Released" || req.roles.is_coordinator || req.roles.is_admin
        ? {
            finalScore: req.project.final_score,
            finalGrade: req.project.final_grade,
            examinerEvaluations,
            supervisorAssessments,
          }
        : null,
    });
  } catch (error) {
    return migrationError(res, error);
  }
});

router.get(
  "/projects/:projectId/supervisor-candidates",
  requireProjectRole("student", "coordinator", "admin"),
  async (_req, res) => {
    try {
      const rows = await query(
        `SELECT u.user_id, u.full_name, u.email, u.expertise, u.affiliation,
                s.research_expertise, s.sv_capacity, s.current_capacity
         FROM supervisor s JOIN users u ON u.user_id = s.supervisor_id
         ORDER BY (s.current_capacity >= s.sv_capacity), s.current_capacity, u.full_name`
      );
      res.json({ success: true, candidates: rows.map((row) => ({
        ...row,
        available: Number(row.current_capacity || 0) < Number(row.sv_capacity || 0),
      })) });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.post(
  "/projects/:projectId/supervisor-nomination",
  requireProjectRole("student"),
  async (req, res) => {
    try {
      if (req.project.supervisor_user_id) {
        return res.status(409).json({ error: "A supervisor has already been assigned to this project" });
      }
      const supervisorUserId = Number(req.body.supervisorUserId);
      const rank = Math.max(1, Math.min(3, Number(req.body.preferenceRank || 1)));
      if (!supervisorUserId) return res.status(400).json({ error: "Supervisor user ID is required" });
      const eligible = await query(
        `SELECT supervisor_id FROM supervisor WHERE supervisor_id = ? AND current_capacity < sv_capacity LIMIT 1`,
        [supervisorUserId]
      );
      if (!eligible.length) return res.status(409).json({ error: "Selected supervisor is unavailable or at capacity" });
      await query(
        `INSERT INTO fyp_supervisor_nominations
          (project_id, student_user_id, supervisor_user_id, preference_rank, note)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE preference_rank = VALUES(preference_rank), note = VALUES(note), status = 'Nominated'`,
        [req.project.project_id, req.user.user_id, supervisorUserId, rank, req.body.note || null]
      );
      await notifyCoordinators({
        projectId: req.project.project_id,
        title: "Supervisor Nomination Submitted",
        message: `${req.project.student_name || "Student"} nominated a preferred supervisor for ${req.project.project_title}.`,
      });
      res.status(201).json({ success: true });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.patch(
  "/projects/:projectId/supervisor-nominations/:nominationId",
  requireProjectRole("coordinator", "admin"),
  async (req, res) => {
    try {
      const status = String(req.body.status || "");
      if (!["Accepted", "Not Selected"].includes(status)) {
        return res.status(400).json({ error: "Nomination status must be Accepted or Not Selected" });
      }
      const nominationId = Number(req.params.nominationId);
      const rows = await query(
        `SELECT nomination_id, supervisor_user_id FROM fyp_supervisor_nominations
         WHERE nomination_id = ? AND project_id = ? LIMIT 1`,
        [nominationId, req.project.project_id]
      );
      if (!rows.length) return res.status(404).json({ error: "Supervisor nomination not found" });

      await transaction(async (connection) => {
        if (status === "Accepted") {
          await connection.query(
            `UPDATE fyp_supervisor_nominations SET status = 'Not Selected'
             WHERE project_id = ? AND nomination_id <> ?`,
            [req.project.project_id, nominationId]
          );
        }
        await connection.query(
          "UPDATE fyp_supervisor_nominations SET status = ? WHERE nomination_id = ? AND project_id = ?",
          [status, nominationId, req.project.project_id]
        );
      });
      res.json({ success: true, nominationId, status });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.patch(
  "/projects/:projectId/links",
  requireProjectRole("student", "coordinator", "admin"),
  async (req, res) => {
    try {
      const examinationLockedStatuses = new Set([
        "Awaiting Examiner Assignment", "Examiner Assigned", "Under Examination",
        "Grading Completed", "Result Pending Release", "Result Released",
      ]);
      const isStudentOwner = Boolean(req.isProjectStudent);
      if (isStudentOwner && examinationLockedStatuses.has(req.project.status)) {
        return res.status(409).json({
          error: "GitHub and Google Drive links are locked with the approved examination submission.",
          code: "APPROVED_SUBMISSION_LOCKED",
        });
      }
      const githubUrl = String(req.body.githubUrl || "").trim() || null;
      const googleDriveUrl = String(req.body.googleDriveUrl || "").trim() || null;
      const valid = (value) => !value || /^https:\/\//i.test(value);
      if (!valid(githubUrl) || !valid(googleDriveUrl)) {
        return res.status(400).json({ error: "Links must start with https://" });
      }
      await query(
        "UPDATE fyp_projects SET github_url = ?, google_drive_url = ?, updated_at = NOW() WHERE project_id = ?",
        [githubUrl, googleDriveUrl, req.project.project_id]
      );
      res.json({ success: true, githubUrl, googleDriveUrl });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.post(
  "/projects/:projectId/submissions",
  requireProjectRole("student", "coordinator", "admin"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "A file is required" });
      const submissionType = String(req.body.submissionType || "progress_report");
      const examinationLockedStatuses = new Set([
        "Awaiting Examiner Assignment", "Examiner Assigned", "Under Examination",
        "Grading Completed", "Result Pending Release", "Result Released",
      ]);
      const isStudentOwner = Boolean(req.isProjectStudent);
      if (isStudentOwner && examinationLockedStatuses.has(req.project.status)) {
        fs.unlink(req.file.path, () => {});
        return res.status(409).json({
          error: "The approved examination package is locked. A coordinator must reopen corrections before another upload.",
          code: "APPROVED_SUBMISSION_LOCKED",
        });
      }
      const allowedTypes = new Set([
        "proposal", "administrative", "presentation", "progress_report",
        "final_deliverable", "logbook", "prototype", "testing_evidence", "feedback_attachment",
      ]);
      if (!allowedTypes.has(submissionType)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "Unsupported submission type" });
      }

      const versionRows = await query(
        "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM projects_submissions WHERE project_id = ? AND submission_type = ?",
        [req.project.project_id, submissionType]
      );
      const version = Number(versionRows?.[0]?.next_version || 1);
      const relativePath = path.relative(path.join(__dirname, ".."), req.file.path).replaceAll("\\", "/");

      const result = await query(
        `INSERT INTO projects_submissions
          (submission_title, file_path, original_file_name, mime_type, submitted_at,
           submission_type, status, project_id, version_number, is_locked, uploaded_by)
         VALUES (?, ?, ?, ?, NOW(), ?, 'pending', ?, ?, 0, ?)`,
        [
          req.body.title || req.file.originalname,
          relativePath,
          req.file.originalname,
          req.file.mimetype,
          submissionType,
          req.project.project_id,
          version,
          req.user.user_id,
        ]
      );

      if (submissionType === "final_deliverable") {
        await query(
          "UPDATE fyp_projects SET status = 'Final Deliverables Submitted', current_phase = 'Final Review', updated_at = NOW() WHERE project_id = ?",
          [req.project.project_id]
        );
      }

      if (req.project.supervisor_user_id && Number(req.user.user_id) === Number(req.project.student_user_id)) {
        await notifyUser({
          projectId: req.project.project_id,
          userId: req.project.supervisor_user_id,
          recipientType: "Supervisor",
          title: submissionType === "final_deliverable" ? "Final Deliverables Submitted" : "New FYP Submission",
          message: `${req.project.student_name || "A student"} uploaded ${req.file.originalname} for ${req.project.project_title}.`,
        });
      }

      res.status(201).json({
        success: true,
        submissionId: result.insertId,
        version,
        message: "Submission uploaded successfully",
      });
    } catch (error) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return migrationError(res, error);
    }
  }
);

router.get("/projects/:projectId/submissions/:submissionId/file", async (req, res) => {
  try {
    const rows = await query(
      `SELECT file_path, original_file_name, mime_type
       FROM projects_submissions WHERE project_id = ? AND submission_id = ? LIMIT 1`,
      [req.project.project_id, req.params.submissionId]
    );
    if (!rows.length) return res.status(404).json({ error: "File not found" });
    const item = rows[0];
    const absolutePath = path.join(__dirname, "..", item.file_path || "");
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: "Stored file is missing" });
    res.type(item.mime_type || "application/octet-stream");
    if (req.query.download === "1") return res.download(absolutePath, item.original_file_name || "download");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(item.original_file_name || "preview")}`);
    return res.sendFile(absolutePath);
  } catch (error) {
    return migrationError(res, error);
  }
});

router.post(
  "/projects/:projectId/milestones",
  requireProjectRole("student", "coordinator", "admin"),
  async (req, res) => {
    try {
      const { title, description, dueDate } = req.body;
      if (!title || !dueDate) return res.status(400).json({ error: "Title and due date are required" });
      const result = await query(
        `INSERT INTO fyp_milestones
          (project_id, title, description, due_date, status, created_by)
         VALUES (?, ?, ?, ?, 'Not Started', ?)`,
        [req.project.project_id, title, description || null, dueDate, req.user.user_id]
      );
      res.status(201).json({ success: true, milestoneId: result.insertId });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.patch("/projects/:projectId/milestones/:milestoneId", async (req, res) => {
  try {
    const allowed = ["Not Started", "In Progress", "Submitted", "Revision Required", "Completed", "Overdue"];
    const status = String(req.body.status || "");
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid milestone status" });
    const isStudent = Boolean(req.isProjectStudent);
    const isReviewer = req.roles.is_supervisor || req.roles.is_coordinator || req.roles.is_admin;
    if (!isStudent && !isReviewer) return res.status(403).json({ error: "Not allowed" });
    if (isStudent && ["Completed", "Revision Required"].includes(status)) {
      return res.status(403).json({ error: "Only supervisor/coordinator may confirm this milestone status" });
    }
    await query(
      "UPDATE fyp_milestones SET status = ?, updated_at = NOW() WHERE milestone_id = ? AND project_id = ?",
      [status, req.params.milestoneId, req.project.project_id]
    );
    res.json({ success: true });
  } catch (error) {
    return migrationError(res, error);
  }
});

router.post(
  "/projects/:projectId/progress",
  requireProjectRole("student", "coordinator", "admin"),
  async (req, res) => {
    try {
      const percent = Math.max(0, Math.min(100, Number(req.body.progressPercent || 0)));
      const result = await query(
        `INSERT INTO fyp_progress_updates
          (project_id, user_id, work_completed, next_work, blockers, evidence_url, progress_percent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.project.project_id,
          req.user.user_id,
          req.body.workCompleted || "",
          req.body.nextWork || "",
          req.body.blockers || null,
          req.body.evidenceUrl || null,
          percent,
        ]
      );
      await query(
        `UPDATE fyp_projects
         SET progress_percent = GREATEST(COALESCE(progress_percent, 0), ?),
             current_phase = 'Development in Progress', updated_at = NOW()
         WHERE project_id = ?`,
        [percent, req.project.project_id]
      );
      await notifyUser({
        projectId: req.project.project_id,
        userId: req.project.supervisor_user_id,
        recipientType: "Supervisor",
        title: "FYP Progress Updated",
        message: `${req.project.student_name || "Student"} submitted a ${percent}% progress update for ${req.project.project_title}.`,
      });
      res.status(201).json({ success: true, progressId: result.insertId });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.post(
  "/projects/:projectId/logbooks",
  requireProjectRole("student", "coordinator", "admin"),
  async (req, res) => {
    try {
      const { meetingDate, meetingType, topics, progress, problems, advice, nextMeetingDate } = req.body;
      if (!meetingDate || !topics) return res.status(400).json({ error: "Meeting date and topics are required" });
      const result = await query(
        `INSERT INTO fyp_logbooks
          (project_id, student_user_id, meeting_date, meeting_type, topics_discussed,
           progress_summary, problems_identified, supervisor_advice, next_meeting_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
        [
          req.project.project_id,
          req.project.student_user_id,
          meetingDate,
          meetingType || "Physical",
          topics,
          progress || null,
          problems || null,
          advice || null,
          nextMeetingDate || null,
        ]
      );
      await notifyUser({
        projectId: req.project.project_id,
        userId: req.project.supervisor_user_id,
        recipientType: "Supervisor",
        title: "Logbook Entry Submitted",
        message: `${req.project.student_name || "Student"} submitted a meeting logbook for review.`,
      });
      res.status(201).json({ success: true, logbookId: result.insertId });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.patch(
  "/projects/:projectId/logbooks/:logbookId/review",
  requireProjectRole("supervisor", "coordinator", "admin"),
  async (req, res) => {
    try {
      const status = req.body.status;
      if (!["Approved", "Request Edit"].includes(status)) {
        return res.status(400).json({ error: "Status must be Approved or Request Edit" });
      }
      await query(
        `UPDATE fyp_logbooks SET status = ?, supervisor_comment = ?, reviewed_by = ?, reviewed_at = NOW()
         WHERE logbook_id = ? AND project_id = ?`,
        [status, req.body.comment || null, req.user.user_id, req.params.logbookId, req.project.project_id]
      );
      await notifyUser({
        projectId: req.project.project_id,
        userId: req.project.student_user_id,
        recipientType: "Student",
        title: `Logbook ${status}`,
        message: `Your supervisor marked the logbook entry as ${status}.`,
      });
      res.json({ success: true });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.post(
  "/projects/:projectId/action-items",
  requireProjectRole("student", "supervisor", "coordinator", "admin"),
  async (req, res) => {
    try {
      if (!req.body.task || !req.body.dueDate) return res.status(400).json({ error: "Task and due date are required" });
      const result = await query(
        `INSERT INTO fyp_action_items
          (project_id, logbook_id, title, assigned_to_user_id, due_date, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
        [
          req.project.project_id,
          req.body.logbookId || null,
          req.body.task,
          req.body.assignedToUserId || req.project.student_user_id,
          req.body.dueDate,
          req.user.user_id,
        ]
      );
      res.status(201).json({ success: true, actionItemId: result.insertId });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.patch("/projects/:projectId/action-items/:actionItemId", async (req, res) => {
  try {
    const status = String(req.body.status || "");
    if (!["Pending", "In Progress", "Completed", "Overdue", "Cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid action item status" });
    }
    await query(
      "UPDATE fyp_action_items SET status = ?, updated_at = NOW() WHERE action_item_id = ? AND project_id = ?",
      [status, req.params.actionItemId, req.project.project_id]
    );
    res.json({ success: true });
  } catch (error) {
    return migrationError(res, error);
  }
});

router.post(
  "/projects/:projectId/feedback",
  requireProjectRole("supervisor", "examiner", "coordinator", "admin"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const relativePath = req.file
        ? path.relative(path.join(__dirname, ".."), req.file.path).replaceAll("\\", "/")
        : null;
      const result = await query(
        `INSERT INTO fyp_feedback
          (project_id, submission_id, author_user_id, author_role, comment, attachment_path,
           attachment_name, attachment_mime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.project.project_id,
          req.body.submissionId || null,
          req.user.user_id,
          req.roles.is_examiner ? "Examiner" : req.roles.is_supervisor ? "Supervisor" : "Coordinator",
          req.body.comment || "",
          relativePath,
          req.file?.originalname || null,
          req.file?.mimetype || null,
        ]
      );
      await notifyUser({
        projectId: req.project.project_id,
        userId: req.project.student_user_id,
        recipientType: "Student",
        title: `${req.roles.is_examiner ? "Examiner" : "Supervisor"} Feedback Added`,
        message: `New feedback was added to ${req.project.project_title}.`,
        sendEmail: req.body.sendEmail,
        actionPath: `/student-project-details?projectId=${req.project.project_id}`,
      });
      res.status(201).json({ success: true, feedbackId: result.insertId });
    } catch (error) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return migrationError(res, error);
    }
  }
);

router.get("/projects/:projectId/feedback/:feedbackId/file", async (req, res) => {
  try {
    const rows = await query(
      "SELECT attachment_path, attachment_name, attachment_mime FROM fyp_feedback WHERE feedback_id = ? AND project_id = ?",
      [req.params.feedbackId, req.project.project_id]
    );
    if (!rows.length || !rows[0].attachment_path) return res.status(404).json({ error: "Attachment not found" });
    const item = rows[0];
    const absolutePath = path.join(__dirname, "..", item.attachment_path);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: "Stored attachment is missing" });
    res.type(item.attachment_mime || "application/octet-stream");
    if (req.query.download === "1") return res.download(absolutePath, item.attachment_name || "feedback-file");
    return res.sendFile(absolutePath);
  } catch (error) {
    return migrationError(res, error);
  }
});


router.post(
  "/projects/:projectId/demo-journey",
  requireProjectRole("student"),
  async (req, res) => {
    try {
      if (!req.project.supervisor_user_id) {
        return res.status(409).json({
          error: "A supervisor must be assigned before journey demo data can be created.",
        });
      }
      const allowedStatuses = new Set([
        "Active",
        "Development in Progress",
        "Revision Required",
        "Final Correction Required",
        "Final Deliverables Submitted",
      ]);
      if (!allowedStatuses.has(String(req.project.status || ""))) {
        return res.status(409).json({
          error: "Demo journey data is available only after the proposal has been approved and the project is active.",
        });
      }

      const uploadRoot = path.join(__dirname, "..", "uploads", "journey");
      fs.mkdirSync(uploadRoot, { recursive: true });
      const safeProjectId = Number(req.project.project_id);
      const ensureDemoFile = (name, body) => {
        const fileName = `${safeProjectId}-demo-${name}`;
        const absolutePath = path.join(uploadRoot, fileName);
        if (!fs.existsSync(absolutePath)) fs.writeFileSync(absolutePath, body, "utf8");
        return {
          originalName: name,
          relativePath: path.relative(path.join(__dirname, ".."), absolutePath).replaceAll("\\", "/"),
        };
      };

      const proposalFile = ensureDemoFile(
        "proposal.txt",
        `Demo proposal for ${req.project.project_title}\n\nThis file was generated only for I-FAMOUS workflow testing.`
      );
      const progressFile = ensureDemoFile(
        "progress-report.txt",
        `Demo progress report for ${req.project.project_title}\n\nProgress: 80%\nCore implementation and testing evidence are available.`
      );
      const finalFile = ensureDemoFile(
        "final-deliverable.txt",
        `Demo final deliverable for ${req.project.project_title}\n\nThis test package is ready for supervisor review and examiner assignment.`
      );

      await transaction(async (connection) => {
        await connection.query(
          `UPDATE fyp_projects
           SET github_url = COALESCE(NULLIF(github_url, ''), ?),
               google_drive_url = COALESCE(NULLIF(google_drive_url, ''), ?),
               proposal_approved_at = COALESCE(proposal_approved_at, NOW()),
               current_phase = 'Final Review', progress_percent = 80,
               risk_status = 'On Track', status = 'Final Deliverables Submitted',
               updated_at = NOW()
           WHERE project_id = ?`,
          [
            `https://github.com/demo/ifamous-project-${safeProjectId}`,
            `https://drive.google.com/drive/folders/demo-ifamous-${safeProjectId}`,
            safeProjectId,
          ]
        );

        const seedSubmission = async (type, title, file) => {
          const [existing] = await connection.query(
            `SELECT submission_id FROM projects_submissions
             WHERE project_id = ? AND submission_type = ?
             ORDER BY version_number DESC, submission_id DESC LIMIT 1`,
            [safeProjectId, type]
          );
          if (existing.length) {
            if (type === "proposal") {
              await connection.query(
                "UPDATE projects_submissions SET status = 'approved', reviewed_at = COALESCE(reviewed_at, NOW()) WHERE submission_id = ?",
                [existing[0].submission_id]
              );
            }
            return existing[0].submission_id;
          }
          const [result] = await connection.query(
            `INSERT INTO projects_submissions
              (submission_title, file_path, original_file_name, mime_type, submitted_at,
               submission_type, status, project_id, version_number, is_locked, uploaded_by)
             VALUES (?, ?, ?, 'text/plain', NOW(), ?, ?, ?, 1, 0, ?)`,
            [
              title,
              file.relativePath,
              file.originalName,
              type,
              type === "proposal" ? "approved" : "pending",
              safeProjectId,
              req.user.user_id,
            ]
          );
          return result.insertId;
        };

        await seedSubmission("proposal", "Demo Approved Proposal", proposalFile);
        await seedSubmission("progress_report", "Demo Progress Report", progressFile);
        await seedSubmission("final_deliverable", "Demo Final Deliverable", finalFile);

        const [milestoneRows] = await connection.query(
          "SELECT COUNT(*) AS total FROM fyp_milestones WHERE project_id = ?",
          [safeProjectId]
        );
        if (Number(milestoneRows[0]?.total || 0) === 0) {
          await connection.query(
            `INSERT INTO fyp_milestones
              (project_id, title, description, due_date, status, created_by)
             VALUES
              (?, 'Requirements and Design', 'Complete project requirements and system design.', DATE_SUB(CURDATE(), INTERVAL 21 DAY), 'Completed', ?),
              (?, 'Prototype Development', 'Implement and demonstrate the core prototype.', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Completed', ?),
              (?, 'Testing and Final Report', 'Complete testing evidence and final report.', CURDATE(), 'Completed', ?)`,
            [safeProjectId, req.user.user_id, safeProjectId, req.user.user_id, safeProjectId, req.user.user_id]
          );
        } else {
          await connection.query(
            "UPDATE fyp_milestones SET status = 'Completed', updated_at = NOW() WHERE project_id = ?",
            [safeProjectId]
          );
        }

        const [progressRows] = await connection.query(
          "SELECT COUNT(*) AS total FROM fyp_progress_updates WHERE project_id = ?",
          [safeProjectId]
        );
        if (Number(progressRows[0]?.total || 0) === 0) {
          await connection.query(
            `INSERT INTO fyp_progress_updates
              (project_id, user_id, work_completed, next_work, blockers, evidence_url, progress_percent)
             VALUES (?, ?, ?, ?, NULL, ?, 100)`,
            [
              safeProjectId,
              req.user.user_id,
              "Completed requirements, implementation, integration testing and final report preparation.",
              "Submit the final package for supervisor examination-readiness approval.",
              `https://github.com/demo/ifamous-project-${safeProjectId}/commits/main`,
            ]
          );
        }

        const [logbookRows] = await connection.query(
          "SELECT COUNT(*) AS total FROM fyp_logbooks WHERE project_id = ?",
          [safeProjectId]
        );
        let logbookId;
        if (Number(logbookRows[0]?.total || 0) === 0) {
          const [logResult] = await connection.query(
            `INSERT INTO fyp_logbooks
              (project_id, student_user_id, meeting_date, meeting_type, topics_discussed,
               progress_summary, problems_identified, supervisor_advice, next_meeting_date,
               status, supervisor_comment, reviewed_by, reviewed_at)
             VALUES (?, ?, NOW(), 'Google Meet', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY),
                     'Approved', ?, ?, NOW())`,
            [
              safeProjectId,
              req.project.student_user_id,
              "Final progress review, testing results and examination readiness.",
              "All planned development milestones and final deliverables were completed.",
              "No critical blocker. Minor formatting improvements remain.",
              "Prepare the final package and demonstrate the completed system.",
              "Demo logbook approved for workflow testing.",
              req.project.supervisor_user_id,
            ]
          );
          logbookId = logResult.insertId;
        } else {
          const [existingLog] = await connection.query(
            "SELECT logbook_id FROM fyp_logbooks WHERE project_id = ? ORDER BY logbook_id DESC LIMIT 1",
            [safeProjectId]
          );
          logbookId = existingLog[0]?.logbook_id || null;
          await connection.query(
            `UPDATE fyp_logbooks SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW()
             WHERE project_id = ?`,
            [req.project.supervisor_user_id, safeProjectId]
          );
        }

        const [actionRows] = await connection.query(
          "SELECT COUNT(*) AS total FROM fyp_action_items WHERE project_id = ?",
          [safeProjectId]
        );
        if (Number(actionRows[0]?.total || 0) === 0) {
          await connection.query(
            `INSERT INTO fyp_action_items
              (project_id, logbook_id, title, assigned_to_user_id, due_date, status, created_by)
             VALUES (?, ?, 'Submit final examination package', ?, CURDATE(), 'Completed', ?)`,
            [safeProjectId, logbookId, req.project.student_user_id, req.user.user_id]
          );
        }
      });

      await notifyUser({
        projectId: safeProjectId,
        userId: req.project.supervisor_user_id,
        recipientType: "Supervisor",
        title: "Demo Final Deliverables Submitted",
        message: `${req.project.student_name || "Student"} filled the demo journey and submitted a test final package for ${req.project.project_title}.`,
      });

      return res.json({
        success: true,
        message: "Demo journey data was created. The project is ready for supervisor final review.",
      });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

router.get("/projects/:projectId/readiness", async (req, res) => {
  try {
    const [rows] = await Promise.all([
      query(
        `SELECT
          (proposal_approved_at IS NOT NULL OR status IN (
             'Active','Development in Progress','Final Deliverables Submitted',
             'Final Correction Required','Awaiting Examiner Assignment','Examiner Assigned',
             'Under Examination','Grading Completed','Result Pending Release','Result Released'
           ) OR EXISTS(
             SELECT 1 FROM projects_submissions
             WHERE project_id = ? AND submission_type = 'proposal' AND status = 'approved'
           )) proposal_approved,
          EXISTS(SELECT 1 FROM projects_submissions WHERE project_id = ? AND submission_type = 'progress_report') progress_report,
          EXISTS(SELECT 1 FROM fyp_logbooks WHERE project_id = ? AND status = 'Approved') approved_logbook,
          EXISTS(SELECT 1 FROM projects_submissions WHERE project_id = ? AND submission_type = 'final_deliverable') final_deliverable,
          (github_url IS NOT NULL AND github_url <> '') github_link,
          (google_drive_url IS NOT NULL AND google_drive_url <> '') drive_link
         FROM fyp_projects WHERE project_id = ?`,
        [req.project.project_id, req.project.project_id, req.project.project_id, req.project.project_id, req.project.project_id]
      ),
    ]);
    const checklist = rows?.[0] || {};
    const ready = Object.values(checklist).every((value) => Number(value) === 1);
    res.json({ success: true, ready, checklist });
  } catch (error) {
    return migrationError(res, error);
  }
});

router.post(
  "/projects/:projectId/final-decision",
  requireProjectRole("supervisor", "coordinator", "admin"),
  async (req, res) => {
    try {
      const decision = String(req.body.decision || "");
      const alreadyInExamination = [
        "Examiner Assigned", "Under Examination", "Grading Completed",
        "Result Pending Release", "Result Released",
      ].includes(req.project.status);
      if (alreadyInExamination && !req.roles.is_coordinator && !req.roles.is_admin) {
        return res.status(409).json({ error: "Examiner workflow has started. The coordinator must reset it before a new final decision." });
      }
      if (!["correction", "approve_for_examination"].includes(decision)) {
        return res.status(400).json({ error: "Invalid final decision" });
      }

      const result = await transaction(async (connection) => {
        const [submissionRows] = await connection.query(
          `SELECT submission_id FROM projects_submissions
           WHERE project_id = ? AND submission_type = 'final_deliverable'
           ORDER BY version_number DESC, submission_id DESC LIMIT 1 FOR UPDATE`,
          [req.project.project_id]
        );
        if (!submissionRows.length) throw new Error("No final deliverable has been uploaded");
        const submissionId = submissionRows[0].submission_id;

        if (decision === "approve_for_examination") {
          await connection.query(
            "UPDATE projects_submissions SET status = 'approved', is_locked = 1, feedback = ?, reviewed_by = ?, reviewed_at = NOW() WHERE submission_id = ?",
            [req.body.feedback || null, req.user.user_id, submissionId]
          );
          await connection.query(
            `UPDATE fyp_projects SET status = 'Awaiting Examiner Assignment', current_phase = 'Examiner Assignment',
             progress_percent = 85, risk_status = 'On Track', final_approved_at = NOW(), approved_submission_id = ?, updated_at = NOW() WHERE project_id = ?`,
            [submissionId, req.project.project_id]
          );
        } else {
          await connection.query(
            "UPDATE projects_submissions SET status = 'pending', feedback = ?, reviewed_by = ?, reviewed_at = NOW() WHERE submission_id = ?",
            [req.body.feedback || null, req.user.user_id, submissionId]
          );
          await connection.query(
            "UPDATE fyp_projects SET status = 'Final Correction Required', current_phase = 'Final Correction', progress_percent = 75, risk_status = 'Needs Attention', updated_at = NOW() WHERE project_id = ?",
            [req.project.project_id]
          );
        }
        return { submissionId };
      });

      const finalStatus = decision === "approve_for_examination" ? "Awaiting Examiner Assignment" : "Final Correction Required";
      await notifyUser({
        projectId: req.project.project_id,
        userId: req.project.student_user_id,
        recipientType: "Student",
        title: decision === "approve_for_examination" ? "Approved for Examination" : "Final Correction Required",
        message: decision === "approve_for_examination"
          ? `Your final submission for ${req.project.project_title} was approved for examination.`
          : `Your final submission for ${req.project.project_title} requires correction.`,
        sendEmail: req.body.sendEmail,
        actionPath: `/student-project-details?projectId=${req.project.project_id}`,
      });
      if (decision === "approve_for_examination") {
        await notifyCoordinators({
          projectId: req.project.project_id,
          title: "Examiner Assignment Required",
          message: `${req.project.project_title} is ready for examiner assignment.`,
          sendEmail: req.body.sendEmail,
          actionPath: "/assign-examiner",
        });
      }

      res.json({
        success: true,
        status: finalStatus,
        ...result,
      });
    } catch (error) {
      return migrationError(res, error);
    }
  }
);

module.exports = router;
