/**
 * supervisor management routes
 * handles supervisor dashboard stats, assigned FYP project listing, document downloading, and review decisions in SQL database
 */

const express = require("express");
const nodeFs = require("fs");
const nodePath = require("path");
const db = require("../config/db");
const { getTokenUserId } = require("../middleware/auth");
const { query, transaction } = require("../utils/dbPromise");
const { upload } = require("../utils/innovationUpload");
const { notifyUser, notifyCoordinators } = require("../utils/innovationNotifications");

const router = express.Router();

// GET /api/supervisor/dashboard - get supervisor dashboard metrics, capacity, and project list from SQL database
router.get("/supervisor/dashboard", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      sv.sv_capacity,
      sv.current_capacity
    FROM users u
    LEFT JOIN supervisor sv ON sv.supervisor_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (err, supervisorRows) => {
    if (err) return res.status(500).json({ error: err.message });

    const supervisor = supervisorRows && supervisorRows[0];

    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found" });
    }

    const projectSql = `
      SELECT
        project_id,
        student_user_id,
        student_name,
        matric_no,
        project_title,
        project_type,
        abstract,
        keywords,
        status,
        match_score,
        created_at,
        updated_at
      FROM fyp_projects
      WHERE supervisor_user_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `;

    db.query(projectSql, [userId], (projectErr, projectRows) => {
      if (projectErr) return res.status(500).json({ error: projectErr.message });

      const projects = projectRows || [];

      const pendingReviews = projects.filter((p) =>
        [
          "Assigned",
          "Pending Supervisor Approval",
          "Pending Review",
          "Revision Required",
          "Revised Proposal Submitted",
        ].includes(String(p.status || ""))
      ).length;

      res.json({
        success: true,
        supervisor: {
          user_id: supervisor.user_id,
          full_name: supervisor.full_name,
          email: supervisor.email,
          capacity: supervisor.sv_capacity || 5,
          current_capacity: projects.length,
        },
        stats: {
          workload: projects.length,
          capacity: supervisor.sv_capacity || 5,
          pendingReviews,
          assignedProjects: projects.length,
          pendingFeedback: 0,
          pendingLogbooks: 0,
        },
        projects: projects.map((p) => ({
          project_id: p.project_id,
          studentName: p.student_name || "Student",
          matricNo: p.matric_no || "-",
          projectTitle: p.project_title || "Untitled Project",
          projectType: p.project_type || "Development",
          abstract: p.abstract || "",
          keywords: p.keywords || "",
          status: String(p.status || "Pending Supervisor Approval") === "Assigned" ? "Pending Supervisor Approval" : (p.status || "Pending Supervisor Approval"),
          matchScore: p.match_score || null,
          lastUpdated: p.updated_at || p.created_at,
        })),
      });
    });
  });
});

// GET /api/supervisor/projects - get assigned FYP projects for supervisor from SQL database
router.get("/supervisor/projects", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT
      project_id,
      student_user_id,
      student_name,
      matric_no,
      project_title,
      project_type,
      abstract,
      keywords,
      status,
      match_score,
      created_at,
      updated_at
    FROM fyp_projects
    WHERE supervisor_user_id = ?
    ORDER BY updated_at DESC, created_at DESC
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      success: true,
      projects: (rows || []).map((p) => ({
        project_id: p.project_id,
        studentName: p.student_name || "Student",
        matricNo: p.matric_no || "-",
        projectTitle: p.project_title || "Untitled Project",
        projectType: p.project_type || "Development",
        abstract: p.abstract || "",
        keywords: p.keywords || "",
        status: String(p.status || "Pending Supervisor Approval") === "Assigned" ? "Pending Supervisor Approval" : (p.status || "Pending Supervisor Approval"),
        matchScore: p.match_score || null,
        lastUpdated: p.updated_at || p.created_at,
      })),
    });
  });
});

// GET /api/supervisor/review/:projectId - project, proposal versions and revision feedback
router.get("/supervisor/review/:projectId", async (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = Number(req.params.projectId);

  if (!userId) return res.status(401).json({ error: "Missing or invalid token" });
  if (!projectId) return res.status(400).json({ error: "Valid project ID is required" });

  try {
    const rows = await query(
      `SELECT
        fp.project_id, fp.project_title, fp.project_type, fp.abstract, fp.keywords,
        fp.student_user_id, fp.student_name, fp.matric_no, fp.supervisor_user_id,
        fp.supervisor_name, fp.supervisor_email, fp.status, fp.match_score,
        fp.created_at, fp.updated_at, ps.submission_id, ps.submission_title,
        ps.file_path, ps.original_file_name, ps.mime_type, ps.submission_type,
        ps.status AS submission_status, ps.feedback, ps.submitted_at,
        ps.reviewed_at, ps.version_number, ps.is_locked
       FROM fyp_projects fp
       LEFT JOIN projects_submissions ps
         ON ps.project_id = fp.project_id AND ps.submission_type = 'proposal'
       WHERE fp.project_id = ? AND fp.supervisor_user_id = ?
       ORDER BY ps.version_number DESC, ps.submission_id DESC`,
      [projectId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Project not found for this supervisor" });
    }

    const first = rows[0];
    const documents = rows.filter((row) => row.submission_id).map((row) => ({
      submission_id: row.submission_id,
      title: row.submission_title || "Proposal Submission",
      fileName: row.original_file_name || "Proposal document",
      filePath: row.file_path || "",
      type: row.submission_type || "proposal",
      mimeType: row.mime_type || "application/octet-stream",
      status: row.submission_status || "pending",
      feedback: row.feedback || "",
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      version: Number(row.version_number || 1),
      isLocked: Number(row.is_locked || 0) === 1,
    }));
    const feedbackRows = await query(
      `SELECT feedback_id, submission_id, author_role, comment, attachment_path,
              attachment_name, attachment_mime, created_at
       FROM fyp_feedback
       WHERE project_id = ? AND author_role = 'Supervisor'
       ORDER BY created_at DESC, feedback_id DESC`,
      [projectId]
    );

    return res.json({
      success: true,
      project: {
        project_id: first.project_id,
        title: first.project_title,
        type: first.project_type || "Development",
        abstract: first.abstract || "",
        keywords: first.keywords || "",
        student_user_id: first.student_user_id,
        studentName: first.student_name || "Student",
        matricNo: first.matric_no || "-",
        supervisorName: first.supervisor_name || "Supervisor",
        status: first.status || "Pending Supervisor Approval",
        matchScore: first.match_score || null,
        documents,
        feedback: feedbackRows,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load project review" });
  }
});

// GET /api/supervisor/review/:projectId/document/:submissionId - download proposal document file from server storage
router.get("/supervisor/review/:projectId/document/:submissionId", (req, res) => {
  const userId = getTokenUserId(req);
  const { projectId, submissionId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT ps.file_path, ps.original_file_name
    FROM projects_submissions ps
    JOIN fyp_projects fp ON fp.project_id = ps.project_id
    WHERE ps.submission_id = ?
    AND ps.project_id = ?
    AND fp.supervisor_user_id = ?
    LIMIT 1
  `;

  db.query(sql, [submissionId, projectId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const doc = rows[0];
    const absolutePath = nodePath.join(__dirname, "..", doc.file_path || "");

    if (!nodeFs.existsSync(absolutePath)) {
      return res.status(404).json({ error: "File is missing on server storage" });
    }

    res.download(absolutePath, doc.original_file_name || "proposal_document");
  });
});

// POST /api/supervisor/review/:projectId/decision - submit supervisor review decision and optional correction attachment
router.post(
  "/supervisor/review/:projectId/decision",
  upload.single("attachment"),
  async (req, res) => {
    const userId = getTokenUserId(req);
    const projectId = Number(req.params.projectId);
    const { decision, feedback } = req.body || {};

    if (!userId) {
      if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    const decisionValue = String(decision || "").toLowerCase();
    const statusMap = {
      approve: "Active",
      revision: "Revision Required",
      reject: "Rejected",
    };
    const newStatus = statusMap[decisionValue];
    if (!newStatus) {
      if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Decision must be approve, revision, or reject" });
    }

    try {
      const result = await transaction(async (connection) => {
        const [projects] = await connection.query(
          `SELECT fp.project_id, fp.project_title, fp.student_user_id, fp.student_name,
                  fp.status, u.email AS student_email
           FROM fyp_projects fp
           LEFT JOIN users u ON u.user_id = fp.student_user_id
           WHERE fp.project_id = ? AND fp.supervisor_user_id = ?
           LIMIT 1 FOR UPDATE`,
          [projectId, userId]
        );
        if (!projects.length) {
          const err = new Error("Project not found for this supervisor");
          err.statusCode = 404;
          throw err;
        }
        const project = projects[0];
        const currentStatus = String(project.status || "");
        if (currentStatus === "Rejected") {
          const err = new Error("A rejected proposal is closed and cannot receive another supervisor decision");
          err.statusCode = 409;
          throw err;
        }
        if (currentStatus === "Revision Required") {
          const err = new Error("Waiting for the student to submit a revised proposal before another decision can be made");
          err.statusCode = 409;
          throw err;
        }
        const decisionReadyStatuses = new Set([
          "Assigned",
          "Pending Supervisor Approval",
          "Pending Review",
          "Revised Proposal Submitted",
        ]);
        if (!decisionReadyStatuses.has(currentStatus)) {
          const err = new Error(`Proposal decisions are not available while the project status is ${currentStatus || "unknown"}`);
          err.statusCode = 409;
          throw err;
        }

        const [submissionRows] = await connection.query(
          `SELECT submission_id FROM projects_submissions
           WHERE project_id = ? AND submission_type = 'proposal'
           ORDER BY version_number DESC, submission_id DESC LIMIT 1`,
          [projectId]
        );
        const submissionId = submissionRows[0]?.submission_id || null;

        await connection.query(
          `UPDATE fyp_projects
           SET status = ?,
               current_phase = CASE
                 WHEN ? = 'Active' THEN 'Development in Progress'
                 WHEN ? = 'Revision Required' THEN 'Proposal Revision'
                 WHEN ? = 'Rejected' THEN 'Proposal Closed'
                 ELSE current_phase END,
               progress_percent = CASE
                 WHEN ? = 'Active' THEN GREATEST(COALESCE(progress_percent, 0), 30)
                 WHEN ? = 'Revision Required' THEN 20
                 WHEN ? = 'Rejected' THEN 0
                 ELSE progress_percent END,
               proposal_approved_at = CASE WHEN ? = 'Active' THEN COALESCE(proposal_approved_at, NOW()) ELSE proposal_approved_at END,
               risk_status = CASE
                 WHEN ? = 'Active' THEN 'On Track'
                 WHEN ? = 'Revision Required' THEN 'Needs Attention'
                 WHEN ? = 'Rejected' THEN 'Closed'
                 ELSE risk_status END,
               updated_at = NOW()
           WHERE project_id = ? AND supervisor_user_id = ?`,
          [
            newStatus,
            newStatus, newStatus, newStatus,
            newStatus, newStatus, newStatus,
            newStatus,
            newStatus, newStatus, newStatus,
            projectId, userId,
          ]
        );

        if (submissionId) {
          await connection.query(
            `UPDATE projects_submissions
             SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = NOW()
             WHERE submission_id = ?`,
            [
              decisionValue === "approve" ? "approved" : decisionValue === "revision" ? "pending" : "rejected",
              feedback || "",
              userId,
              submissionId,
            ]
          );
        }

        let feedbackId = null;
        if ((feedback && String(feedback).trim()) || req.file) {
          const relativePath = req.file
            ? nodePath.relative(nodePath.join(__dirname, ".."), req.file.path).replaceAll("\\", "/")
            : null;
          const [feedbackResult] = await connection.query(
            `INSERT INTO fyp_feedback
              (project_id, submission_id, author_user_id, author_role, comment,
               attachment_path, attachment_name, attachment_mime)
             VALUES (?, ?, ?, 'Supervisor', ?, ?, ?, ?)`,
            [
              projectId,
              submissionId,
              userId,
              feedback || (req.file ? "Correction attachment provided by supervisor." : ""),
              relativePath,
              req.file?.originalname || null,
              req.file?.mimetype || null,
            ]
          );
          feedbackId = feedbackResult.insertId;
        }

        const studentTitle = decisionValue === "approve"
          ? "FYP Proposal Approved"
          : decisionValue === "revision"
            ? "FYP Proposal Requires Revision"
            : "FYP Proposal Rejected";
        const studentMessage = decisionValue === "approve"
          ? `Your FYP proposal "${project.project_title}" has been approved. You may begin the FYP development journey.`
          : decisionValue === "revision"
            ? `Your FYP proposal "${project.project_title}" requires revision. ${feedback || "Please review the supervisor feedback and correction attachment."}`
            : `Your FYP proposal "${project.project_title}" has been rejected. ${feedback || "No feedback provided."}`;

        return { project, feedbackId, studentTitle, studentMessage };
      });

      const sendEmail = req.body.sendEmail;
      const [studentNotification, coordinatorNotifications] = await Promise.all([
        notifyUser({
          projectId,
          userId: result.project.student_user_id,
          recipientType: "Student",
          title: result.studentTitle,
          message: result.studentMessage,
          sendEmail,
          actionPath: `/student-project-details?projectId=${projectId}&tab=${decisionValue === "revision" ? "revision" : "decision"}`,
        }),
        notifyCoordinators({
          projectId,
          title: "Supervisor Decision Submitted",
          message: `Supervisor submitted decision "${newStatus}" for project "${result.project.project_title}".`,
          sendEmail,
          actionPath: `/coordinator-project-details?projectId=${projectId}`,
        }),
      ]);

      return res.json({
        success: true,
        message: `Decision submitted: ${newStatus}`,
        status: newStatus,
        feedbackId: result.feedbackId,
        hasAttachment: Boolean(req.file),
        notification: {
          inApp: studentNotification?.inAppStatus || "Sent",
          email: studentNotification?.emailStatus || "Not Requested",
          coordinators: coordinatorNotifications,
        },
      });
    } catch (error) {
      if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
      console.error("Supervisor decision error:", error);
      return res.status(error.statusCode || 500).json({ error: error.message || "Failed to submit decision" });
    }
  }
);

module.exports = router;
