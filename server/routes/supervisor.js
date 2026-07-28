const express = require("express");
const nodeFs = require("fs");
const nodePath = require("path");
const db = require("../config/db");
const { getTokenUserId } = require("../middleware/auth");

const router = express.Router();

// GET supervisor dashboard
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
        ["Assigned", "Pending Supervisor Approval", "Pending Review"].includes(String(p.status || ""))
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
          status: p.status || "Assigned",
          matchScore: p.match_score || null,
          lastUpdated: p.updated_at || p.created_at,
        })),
      });
    });
  });
});

// GET supervisor projects
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
        status: p.status || "Assigned",
        matchScore: p.match_score || null,
        lastUpdated: p.updated_at || p.created_at,
      })),
    });
  });
});

// GET project review details for supervisor
router.get("/supervisor/review/:projectId", (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = req.params.projectId;

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const sql = `
    SELECT
      fp.project_id,
      fp.project_title,
      fp.project_type,
      fp.abstract,
      fp.keywords,
      fp.student_user_id,
      fp.student_name,
      fp.matric_no,
      fp.supervisor_user_id,
      fp.supervisor_name,
      fp.supervisor_email,
      fp.status,
      fp.match_score,
      fp.created_at,
      fp.updated_at,
      ps.submission_id,
      ps.submission_title,
      ps.file_path,
      ps.original_file_name,
      ps.submission_type,
      ps.status AS submission_status,
      ps.feedback,
      ps.submitted_at
    FROM fyp_projects fp
    LEFT JOIN projects_submissions ps 
      ON ps.project_id = fp.project_id
      AND ps.submission_type = 'proposal'
    WHERE fp.project_id = ?
    AND fp.supervisor_user_id = ?
  `;

  db.query(sql, [projectId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Project not found for this supervisor" });
    }

    const first = rows[0];

    const documents = rows
      .filter((row) => row.submission_id)
      .map((row) => ({
        submission_id: row.submission_id,
        title: row.submission_title || "Proposal Submission",
        fileName: row.original_file_name || "Proposal document",
        filePath: row.file_path || "",
        type: row.submission_type || "proposal",
        status: row.submission_status || "pending",
        feedback: row.feedback || "",
        submittedAt: row.submitted_at,
      }));

    res.json({
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
      },
    });
  });
});

// Download proposal document
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

// Submit proposal review decision
router.post("/supervisor/review/:projectId/decision", (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = req.params.projectId;
  const { decision, feedback } = req.body || {};

  if (!userId) {
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
    return res.status(400).json({ error: "Decision must be approve, revision, or reject" });
  }

  const projectSql = `
    SELECT 
      fp.project_id,
      fp.project_title,
      fp.student_user_id,
      fp.student_name,
      u.email AS student_email
    FROM fyp_projects fp
    LEFT JOIN users u ON u.user_id = fp.student_user_id
    WHERE fp.project_id = ?
    AND fp.supervisor_user_id = ?
    LIMIT 1
  `;

  db.query(projectSql, [projectId, userId], (projectErr, projectRows) => {
    if (projectErr) return res.status(500).json({ error: projectErr.message });

    if (!projectRows || projectRows.length === 0) {
      return res.status(404).json({ error: "Project not found for this supervisor" });
    }

    const project = projectRows[0];

    const updateSql = `
      UPDATE fyp_projects
      SET status = ?, updated_at = NOW()
      WHERE project_id = ?
      AND supervisor_user_id = ?
    `;

    db.query(updateSql, [newStatus, projectId, userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });

      db.query(
        `
        UPDATE projects_submissions
        SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE project_id = ?
        AND submission_type = 'proposal'
        `,
        [
          decisionValue === "approve" ? "approved" : decisionValue === "revision" ? "pending" : "rejected",
          feedback || "",
          userId,
          projectId,
        ],
        () => {}
      );

      const studentTitle =
        decisionValue === "approve"
          ? "FYP Proposal Approved"
          : decisionValue === "revision"
            ? "FYP Proposal Requires Revision"
            : "FYP Proposal Rejected";

      const studentMessage =
        decisionValue === "approve"
          ? `Your FYP proposal "${project.project_title}" has been approved by your supervisor.`
          : decisionValue === "revision"
            ? `Your FYP proposal "${project.project_title}" requires revision. Supervisor feedback: ${feedback || "Please review your proposal."}`
            : `Your FYP proposal "${project.project_title}" has been rejected. Supervisor feedback: ${feedback || "No feedback provided."}`;

      db.query(
        `
        INSERT INTO fyp_notifications
          (project_id, recipient_type, recipient_name, recipient_email, title, message, is_read, created_at)
        VALUES (?, 'Student', ?, ?, ?, ?, 0, NOW())
        `,
        [
          projectId,
          project.student_name || "Student",
          project.student_email || "",
          studentTitle,
          studentMessage,
        ],
        () => {}
      );

      db.query(
        `
        INSERT INTO fyp_notifications
          (project_id, recipient_type, recipient_name, recipient_email, title, message, is_read, created_at)
        VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())
        `,
        [
          projectId,
          "Supervisor Decision Submitted",
          `Supervisor submitted decision "${newStatus}" for project "${project.project_title}".`,
        ],
        () => {}
      );

      res.json({
        success: true,
        message: `Decision submitted: ${newStatus}`,
        status: newStatus,
      });
    });
  });
});

module.exports = router;
