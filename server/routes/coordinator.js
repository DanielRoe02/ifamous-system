const express = require("express");
const db = require("../config/db");

const router = express.Router();

// GET coordinator FYP queue
router.get("/coordinator/fyp-queue", (req, res) => {
  const sql = `
    SELECT
      fp.project_id,
      fp.student_user_id,
      fp.student_name,
      fp.matric_no,
      fp.project_title,
      fp.project_type,
      fp.abstract,
      fp.keywords,
      fp.supervisor_user_id,
      fp.supervisor_name,
      fp.supervisor_email,
      fp.match_score,
      fp.status,
      fp.created_at,
      fp.updated_at,
      ps.original_file_name,
      ps.file_path,
      ps.submission_type,
      ps.status AS submission_status,
      ps.submitted_at
    FROM fyp_projects fp
    LEFT JOIN projects_submissions ps 
      ON ps.project_id = fp.project_id
      AND ps.submission_type = 'proposal'
    WHERE
      fp.student_user_id IS NOT NULL
      OR fp.status IN (
        'Pending Coordinator Review',
        'Pending Review',
        'Pending AI Matching',
        'Pending Supervisor Assignment',
        'Pending Supervisor Approval'
      )
    ORDER BY fp.created_at DESC, fp.project_id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    const projects = (rows || []).map((row) => ({
      project_id: row.project_id,
      student_user_id: row.student_user_id,
      studentName: row.student_name || "Student",
      matricNo: row.matric_no || "-",
      projectTitle: row.project_title || "Untitled FYP",
      projectType: row.project_type || "Development",
      abstract: row.abstract || "",
      keywords: row.keywords || "",
      supervisor_user_id: row.supervisor_user_id,
      supervisorName: row.supervisor_name || "Not Assigned",
      supervisorEmail: row.supervisor_email || "",
      matchScore: row.match_score || null,
      status: row.status || "Pending Coordinator Review",
      proposalStatus: row.submission_status || "pending",
      aiStatus: row.match_score ? "AI Completed" : "Pending AI Matching",
      fileName: row.original_file_name || row.file_path || "Proposal document",
      submittedAt: row.submitted_at || row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      success: true,
      projects,
    });
  });
});

// PATCH coordinator FYP status update
router.patch("/coordinator/fyp-status/:projectId", (req, res) => {
  const projectId = req.params.projectId;
  const { status, matchScore } = req.body || {};

  if (!projectId) {
    return res.status(400).json({ success: false, error: "Project ID is required" });
  }

  if (!status) {
    return res.status(400).json({ success: false, error: "Status is required" });
  }

  const allowedStatuses = [
    "Pending Coordinator Review",
    "Pending AI Matching",
    "Pending Supervisor Assignment",
    "Pending Supervisor Approval",
    "Active",
    "Revision Required",
    "Rejected"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid project status" });
  }

  const sql = `
    UPDATE fyp_projects
    SET status = ?,
        match_score = COALESCE(?, match_score),
        updated_at = NOW()
    WHERE project_id = ?
  `;

  db.query(sql, [status, matchScore || null, projectId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      projectId,
      status,
      affectedRows: result.affectedRows,
    });
  });
});

module.exports = router;
