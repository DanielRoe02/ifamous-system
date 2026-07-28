/**
 * student management routes
 * handles student FYP proposal extraction, listing student projects, viewing project details, and submitting proposals in SQL database
 */

const express = require("express");
const nodePath = require("path");
const db = require("../config/db");
const { getTokenUserId } = require("../middleware/auth");
const {
  proposalUpload,
  savedProposalUpload,
  extractProposalText,
  callGemmaProposalExtractor,
} = require("../services/proposalExtractor");

const router = express.Router();

// POST /api/student/extract-proposal - extract title, abstract, and keywords from uploaded proposal document using AI
router.post("/student/extract-proposal", proposalUpload.single("proposal"), async (req, res) => {
  try {
    const userId = getTokenUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No proposal file uploaded" });
    }

    const proposalText = await extractProposalText(req.file);

    if (!proposalText || proposalText.trim().length < 50) {
      return res.status(400).json({
        error: "Could not read enough text from the proposal. Try uploading a text-based PDF, DOCX, or TXT file.",
      });
    }

    const extracted = await callGemmaProposalExtractor(
      proposalText,
      req.file.originalname
    );

    res.json({
      success: true,
      fileName: req.file.originalname,
      extracted,
    });
  } catch (error) {
    console.error("Proposal extraction error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/student/my-fyp - get all FYP project records for logged-in student from SQL database
router.get("/student/my-fyp", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const studentSql = `
    SELECT 
      u.user_id,
      u.full_name,
      u.email,
      s.metric_number
    FROM users u
    LEFT JOIN students s ON s.student_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(studentSql, [userId], (studentErr, studentRows) => {
    if (studentErr) {
      return res.status(500).json({ error: studentErr.message });
    }

    const student = studentRows && studentRows[0];

    if (!student) {
      return res.status(404).json({ error: "Student user not found" });
    }

    const projectSql = `
      SELECT DISTINCT
        fp.project_id,
        fp.project_title,
        fp.project_type,
        fp.abstract,
        fp.keywords,
        fp.supervisor_name,
        fp.supervisor_email,
        fp.examiner_name,
        fp.examiner_email,
        fp.status,
        fp.created_at,
        fp.updated_at
      FROM fyp_projects fp
      LEFT JOIN fyp_project_members fpm ON fpm.project_id = fp.project_id
      WHERE 
        fp.student_user_id = ?
        OR LOWER(fpm.matric_no) = LOWER(?)
        OR LOWER(fpm.student_name) = LOWER(?)
      ORDER BY fp.updated_at DESC, fp.created_at DESC, fp.project_id DESC
    `;

    db.query(
      projectSql,
      [
        userId,
        student.metric_number || "",
        student.full_name || "",
      ],
      (projectErr, projectRows) => {
        if (projectErr) {
          return res.status(500).json({ error: projectErr.message });
        }

        const records = (projectRows || []).map((row) => ({
          id: row.project_id,
          project_id: row.project_id,
          title: row.project_title,
          type: row.project_type || "Development",
          abstract: row.abstract || "",
          keywords: row.keywords || "",
          status: row.status || "Pending Review",
          supervisor: row.supervisor_name || "Not Assigned",
          supervisorEmail: row.supervisor_email || "",
          examiner: row.examiner_name || "Not Assigned",
          examinerEmail: row.examiner_email || "",
          lastUpdated: row.updated_at || row.created_at,
        }));

        res.json({
          success: true,
          student,
          records,
        });
      }
    );
  });
});

// GET /api/student/my-fyp/:projectId - get detailed FYP project info and submitted documents from SQL database
router.get("/student/my-fyp/:projectId", (req, res) => {
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
      fp.supervisor_name,
      fp.supervisor_email,
      fp.examiner_name,
      fp.examiner_email,
      fp.status,
      fp.created_at,
      fp.updated_at,
      ps.submission_id,
      ps.submission_title,
      ps.file_path,
      ps.original_file_name,
      ps.submission_type,
      ps.status AS submission_status,
      ps.feedback,
      ps.submitted_at,
      ps.reviewed_at
    FROM fyp_projects fp
    LEFT JOIN projects_submissions ps ON ps.project_id = fp.project_id
    WHERE fp.project_id = ?
    AND fp.student_user_id = ?
  `;

  db.query(sql, [projectId, userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Project not found for this student" });
    }

    const first = rows[0];

    const documents = rows
      .filter((row) => row.submission_id)
      .map((row) => ({
        id: row.submission_id,
        title: row.submission_title || row.original_file_name || row.file_path || "Submitted document",
        fileName: row.original_file_name || row.file_path || "Document",
        filePath: row.file_path || "",
        type: row.submission_type || "proposal",
        status: row.submission_status || "pending",
        feedback: row.feedback || "",
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
      }));

    res.json({
      success: true,
      project: {
        id: first.project_id,
        project_id: first.project_id,
        title: first.project_title,
        type: first.project_type || "Development",
        abstract: first.abstract || "",
        keywords: first.keywords || "",
        status: first.status || "Pending Review",
        studentName: first.student_name || "",
        matricNo: first.matric_no || "",
        supervisor: first.supervisor_name || "Not Assigned",
        supervisorEmail: first.supervisor_email || "",
        examiner: first.examiner_name || "Not Assigned",
        examinerEmail: first.examiner_email || "",
        createdAt: first.created_at,
        updatedAt: first.updated_at,
        documents,
      },
    });
  });
});

// POST /api/student/my-fyp - submit new FYP proposal metadata into SQL database
router.post("/student/my-fyp", (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const {
    projectTitle,
    projectType,
    abstract,
    keywords,
    originalFileName
  } = req.body || {};

  if (!projectTitle || String(projectTitle).trim().length < 3) {
    return res.status(400).json({ error: "Project title is required" });
  }

  const studentSql = `
    SELECT 
      u.user_id,
      u.full_name,
      u.email,
      s.metric_number
    FROM users u
    LEFT JOIN students s ON s.student_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(studentSql, [userId], (studentErr, studentRows) => {
    if (studentErr) {
      return res.status(500).json({ error: studentErr.message });
    }

    const student = studentRows && studentRows[0];

    if (!student) {
      return res.status(404).json({ error: "Student user not found" });
    }

    const activeSql = `
      SELECT project_id
      FROM fyp_projects
      WHERE student_user_id = ?
      AND status IN (
        'Draft',
        'Pending Review',
        'Pending Coordinator Review',
        'Pending AI Matching',
        'Pending Supervisor Assignment',
        'Pending Supervisor Approval',
        'Active',
        'Assigned'
      )
      LIMIT 1
    `;

    db.query(activeSql, [userId], (activeErr, activeRows) => {
      if (activeErr) {
        return res.status(500).json({ error: activeErr.message });
      }

      if (activeRows && activeRows.length > 0) {
        return res.status(409).json({
          error: "You already have a pending or active FYP.",
        });
      }

      const insertProjectSql = `
        INSERT INTO fyp_projects
          (
            student_user_id,
            student_name,
            matric_no,
            project_title,
            project_type,
            abstract,
            keywords,
            supervisor_name,
            supervisor_email,
            status,
            created_at,
            updated_at
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'Pending Coordinator Review', NOW(), NOW())
      `;

      db.query(
        insertProjectSql,
        [
          userId,
          student.full_name || "",
          student.metric_number || "",
          String(projectTitle).trim(),
          projectType || "Development",
          abstract || "",
          keywords || "",
        ],
        (insertErr, result) => {
          if (insertErr) {
            return res.status(500).json({ error: insertErr.message });
          }

          const projectId = result.insertId;

          const memberSql = `
            INSERT INTO fyp_project_members
              (project_id, student_name, matric_no)
            VALUES (?, ?, ?)
          `;

          db.query(
            memberSql,
            [
              projectId,
              student.full_name || "Student",
              student.metric_number || "",
            ],
            (memberErr) => {
              if (memberErr) {
                console.error("FYP member insert error:", memberErr.message);
              }

              const submissionSql = `
                INSERT INTO projects_submissions
                  (
                    submission_title,
                    file_path,
                    original_file_name,
                    submitted_at,
                    submission_type,
                    status,
                    project_id
                  )
                VALUES (?, ?, ?, NOW(), 'proposal', 'pending', ?)
              `;

              db.query(
                submissionSql,
                [
                  "Proposal Submission",
                  originalFileName || "proposal_document",
                  originalFileName || "proposal_document",
                  projectId,
                ],
                (submissionErr) => {
                  if (submissionErr) {
                    console.error("Submission insert error:", submissionErr.message);
                  }

                  const notificationSql = `
                    INSERT INTO fyp_notifications
                      (
                        project_id,
                        recipient_type,
                        recipient_name,
                        recipient_email,
                        title,
                        message,
                        is_read,
                        created_at
                      )
                    VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())
                  `;

                  db.query(
                    notificationSql,
                    [
                      projectId,
                      "New FYP Proposal Submitted",
                      `${student.full_name || "A student"} submitted a new FYP proposal titled "${String(projectTitle).trim()}". Please review and run supervisor matching.`,
                    ],
                    (notiErr) => {
                      if (notiErr) {
                        console.error("Coordinator notification insert error:", notiErr.message);
                      }

                      return res.json({
                        success: true,
                        message: "FYP proposal submitted successfully and coordinator has been notified.",
                        projectId,
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
});

// POST /api/student/my-fyp-submit - submit new FYP proposal with file upload into SQL database
router.post("/student/my-fyp-submit", savedProposalUpload.single("proposal"), (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const {
    projectTitle,
    projectType,
    abstract,
    keywords,
  } = req.body || {};

  if (!projectTitle || String(projectTitle).trim().length < 3) {
    return res.status(400).json({ error: "Project title is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Proposal file is required" });
  }

  const studentSql = `
    SELECT 
      u.user_id,
      u.full_name,
      u.email,
      s.metric_number
    FROM users u
    LEFT JOIN students s ON s.student_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(studentSql, [userId], (studentErr, studentRows) => {
    if (studentErr) {
      return res.status(500).json({ error: studentErr.message });
    }

    const student = studentRows && studentRows[0];

    if (!student) {
      return res.status(404).json({ error: "Student user not found" });
    }

    const activeSql = `
      SELECT project_id
      FROM fyp_projects
      WHERE student_user_id = ?
      AND status IN (
        'Draft',
        'Pending Review',
        'Pending Coordinator Review',
        'Pending AI Matching',
        'Pending Supervisor Assignment',
        'Pending Supervisor Approval',
        'Active',
        'Assigned'
      )
      LIMIT 1
    `;

    db.query(activeSql, [userId], (activeErr, activeRows) => {
      if (activeErr) {
        return res.status(500).json({ error: activeErr.message });
      }

      if (activeRows && activeRows.length > 0) {
        return res.status(409).json({
          error: "You already have a pending or active FYP.",
        });
      }

      const insertProjectSql = `
        INSERT INTO fyp_projects
          (
            student_user_id,
            student_name,
            matric_no,
            project_title,
            project_type,
            abstract,
            keywords,
            supervisor_name,
            supervisor_email,
            status,
            created_at,
            updated_at
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'Pending Coordinator Review', NOW(), NOW())
      `;

      db.query(
        insertProjectSql,
        [
          userId,
          student.full_name || "",
          student.metric_number || "",
          String(projectTitle).trim(),
          projectType || "Development",
          abstract || "",
          keywords || "",
        ],
        (insertErr, result) => {
          if (insertErr) {
            return res.status(500).json({ error: insertErr.message });
          }

          const projectId = result.insertId;

          const relativeFilePath = nodePath.join(
            "uploads",
            "proposals",
            req.file.filename
          );

          const memberSql = `
            INSERT INTO fyp_project_members
              (project_id, student_name, matric_no)
            VALUES (?, ?, ?)
          `;

          db.query(memberSql, [projectId, student.full_name || "Student", student.metric_number || ""], () => {
            const submissionSql = `
              INSERT INTO projects_submissions
                (
                  submission_title,
                  file_path,
                  original_file_name,
                  submitted_at,
                  submission_type,
                  status,
                  project_id
                )
              VALUES (?, ?, ?, NOW(), 'proposal', 'pending', ?)
            `;

            db.query(
              submissionSql,
              [
                "Proposal Submission",
                relativeFilePath,
                req.file.originalname,
                projectId,
              ],
              (submissionErr) => {
                if (submissionErr) {
                  console.error("Submission insert error:", submissionErr.message);
                }

                const notificationSql = `
                  INSERT INTO fyp_notifications
                    (
                      project_id,
                      recipient_type,
                      recipient_name,
                      recipient_email,
                      title,
                      message,
                      is_read,
                      created_at
                    )
                  VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())
                `;

                db.query(
                  notificationSql,
                  [
                    projectId,
                    "New FYP Proposal Submitted",
                    `${student.full_name || "A student"} submitted a new FYP proposal titled "${String(projectTitle).trim()}". Please review and run supervisor matching.`,
                  ],
                  () => {
                    return res.json({
                      success: true,
                      message: "FYP proposal submitted successfully and coordinator has been notified.",
                      projectId,
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

module.exports = router;
