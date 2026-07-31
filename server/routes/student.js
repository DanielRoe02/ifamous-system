/**
 * student management routes
 * handles student FYP proposal extraction, listing student projects, viewing project details, and submitting proposals in SQL database
 */

const express = require("express");
const nodeFs = require("fs");
const nodePath = require("path");
const db = require("../config/db");
const { getTokenUserId } = require("../middleware/auth");
const { query, transaction } = require("../utils/dbPromise");
const {
  proposalUpload,
  savedProposalUpload,
  extractProposalText,
  callGemmaProposalExtractor,
} = require("../services/proposalExtractor");
const { notifyUser } = require("../utils/innovationNotifications");

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
router.get("/student/my-fyp/:projectId", async (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = Number(req.params.projectId);

  if (!userId) return res.status(401).json({ error: "Missing or invalid token" });
  if (!projectId) return res.status(400).json({ error: "Valid project ID is required" });

  try {
    const rows = await query(
      `SELECT
        fp.project_id, fp.project_title, fp.project_type, fp.abstract, fp.keywords,
        fp.student_user_id, fp.student_name, fp.matric_no, fp.supervisor_name,
        fp.supervisor_email, fp.examiner_name, fp.examiner_email, fp.status,
        fp.current_phase, fp.progress_percent, fp.risk_status, fp.final_score,
        fp.final_grade, fp.result_status, fp.result_released_at, fp.created_at,
        fp.updated_at, ps.submission_id, ps.submission_title, ps.file_path,
        ps.original_file_name, ps.mime_type, ps.submission_type,
        ps.status AS submission_status, ps.feedback, ps.submitted_at,
        ps.reviewed_at, ps.version_number, ps.is_locked
       FROM fyp_projects fp
       LEFT JOIN projects_submissions ps ON ps.project_id = fp.project_id
       WHERE fp.project_id = ? AND fp.student_user_id = ?
       ORDER BY ps.submitted_at DESC, ps.submission_id DESC`,
      [projectId, userId]
    );

    if (!rows.length) return res.status(404).json({ error: "Project not found for this student" });
    const first = rows[0];
    const documents = rows.filter((row) => row.submission_id).map((row) => ({
      id: row.submission_id,
      title: row.submission_title || row.original_file_name || row.file_path || "Submitted document",
      fileName: row.original_file_name || row.file_path || "Document",
      filePath: row.file_path || "",
      type: row.submission_type || "proposal",
      mimeType: row.mime_type || "application/octet-stream",
      version: Number(row.version_number || 1),
      isLocked: Number(row.is_locked || 0) === 1,
      status: row.submission_status || "pending",
      feedback: row.feedback || "",
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
    }));
    const feedback = await query(
      `SELECT feedback_id, submission_id, author_role, comment, attachment_path,
              attachment_name, attachment_mime, created_at
       FROM fyp_feedback WHERE project_id = ? ORDER BY created_at DESC`,
      [projectId]
    );

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
        currentPhase: first.current_phase || "Proposal",
        progressPercent: Number(first.progress_percent || 0),
        riskStatus: first.risk_status || "On Track",
        finalScore: first.final_score,
        finalGrade: first.final_grade,
        resultStatus: first.result_status,
        resultReleasedAt: first.result_released_at,
        studentName: first.student_name || "",
        matricNo: first.matric_no || "",
        supervisor: first.supervisor_name || "Not Assigned",
        supervisorEmail: first.supervisor_email || "",
        examiner: first.examiner_name || "Not Assigned",
        examinerEmail: first.examiner_email || "",
        createdAt: first.created_at,
        updatedAt: first.updated_at,
        documents,
        feedback,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load project details" });
  }
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
        'Revision Required',
        'Revised Proposal Submitted',
        'Active',
        'Development in Progress',
        'Final Deliverables Submitted',
        'Final Correction Required',
        'Approved for Examination',
        'Awaiting Examiner Assignment',
        'Examiner Assigned',
        'Under Examination',
        'Grading Completed',
        'Result Pending Release',
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
router.post("/student/my-fyp-submit", savedProposalUpload.single("proposal"), async (req, res) => {
  const userId = getTokenUserId(req);

  if (!userId) {
    if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const { projectTitle, projectType, abstract, keywords, supervisorNominations } = req.body || {};

  if (!projectTitle || String(projectTitle).trim().length < 3) {
    if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Project title is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Proposal file is required" });
  }

  try {
    const students = await query(
      `SELECT u.user_id, u.full_name, u.email, s.metric_number
       FROM users u
       LEFT JOIN students s ON s.student_id = u.user_id
       WHERE u.user_id = ? LIMIT 1`,
      [userId]
    );
    const student = students[0];
    if (!student) {
      nodeFs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Student user not found" });
    }

    const activeRows = await query(
      `SELECT project_id FROM fyp_projects
       WHERE student_user_id = ?
         AND status IN (
           'Draft','Pending Review','Pending Coordinator Review','Pending AI Matching',
           'Pending Supervisor Assignment','Pending Supervisor Approval','Revision Required',
           'Revised Proposal Submitted','Active',
           'Development in Progress','Final Deliverables Submitted','Final Correction Required',
           'Approved for Examination','Awaiting Examiner Assignment','Examiner Assigned',
           'Under Examination','Grading Completed','Result Pending Release','Assigned'
         )
       LIMIT 1`,
      [userId]
    );
    if (activeRows.length) {
      nodeFs.unlink(req.file.path, () => {});
      return res.status(409).json({ error: "You already have a pending or active FYP." });
    }

    const relativeFilePath = nodePath
      .join("uploads", "proposals", req.file.filename)
      .replaceAll("\\", "/");

    const result = await transaction(async (connection) => {
      const [projectResult] = await connection.query(
        `INSERT INTO fyp_projects
          (student_user_id, student_name, matric_no, project_title, project_type,
           abstract, keywords, supervisor_name, supervisor_email, status,
           current_phase, progress_percent, risk_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'Pending Coordinator Review',
                 'Proposal', 0, 'On Track', NOW(), NOW())`,
        [
          userId,
          student.full_name || "",
          student.metric_number || "",
          String(projectTitle).trim(),
          projectType || "Development",
          abstract || "",
          keywords || "",
        ]
      );
      const projectId = projectResult.insertId;

      await connection.query(
        `INSERT INTO fyp_project_members (project_id, student_name, matric_no)
         VALUES (?, ?, ?)`,
        [projectId, student.full_name || "Student", student.metric_number || ""]
      );

      let parsedNominations = [];
      try {
        parsedNominations = Array.isArray(supervisorNominations)
          ? supervisorNominations
          : JSON.parse(supervisorNominations || "[]");
      } catch {
        parsedNominations = [];
      }
      const uniqueNominees = [];
      const seenNominees = new Set();
      for (const item of parsedNominations.slice(0, 3)) {
        const supervisorUserId = Number(item.supervisorUserId || item.user_id);
        if (!supervisorUserId || seenNominees.has(supervisorUserId)) continue;
        seenNominees.add(supervisorUserId);
        uniqueNominees.push({
          supervisorUserId,
          preferenceRank: Math.max(1, Math.min(3, Number(item.preferenceRank || uniqueNominees.length + 1))),
          note: String(item.note || "AI-assisted student nomination").slice(0, 500),
        });
      }
      let insertedNominationCount = 0;
      for (const nominee of uniqueNominees) {
        const [eligibleRows] = await connection.query(
          `SELECT supervisor_id FROM supervisor
           WHERE supervisor_id = ? AND COALESCE(current_capacity, 0) < COALESCE(sv_capacity, 5)
           LIMIT 1`,
          [nominee.supervisorUserId]
        );
        if (!eligibleRows.length) continue;
        await connection.query(
          `INSERT INTO fyp_supervisor_nominations
            (project_id, student_user_id, supervisor_user_id, preference_rank, note, status)
           VALUES (?, ?, ?, ?, ?, 'Nominated')`,
          [projectId, userId, nominee.supervisorUserId, nominee.preferenceRank, nominee.note]
        );
        insertedNominationCount += 1;
      }

      const [submissionResult] = await connection.query(
        `INSERT INTO projects_submissions
          (submission_title, file_path, original_file_name, mime_type, submitted_at,
           submission_type, status, project_id, version_number, is_locked, uploaded_by)
         VALUES (?, ?, ?, ?, NOW(), 'proposal', 'pending', ?, 1, 0, ?)`,
        [
          "Proposal Submission",
          relativeFilePath,
          req.file.originalname,
          req.file.mimetype || "application/octet-stream",
          projectId,
          userId,
        ]
      );

      await connection.query(
        `INSERT INTO fyp_notifications
          (project_id, recipient_type, recipient_name, recipient_email, title, message, is_read, created_at)
         VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())`,
        [
          projectId,
          "New FYP Proposal Submitted",
          `${student.full_name || "A student"} submitted a new FYP proposal titled "${String(projectTitle).trim()}" with ${insertedNominationCount} supervisor nomination(s). Please review the preferences and run supervisor matching if needed.`,
        ]
      );

      return { projectId, submissionId: submissionResult.insertId, nominationCount: insertedNominationCount };
    });

    return res.json({
      success: true,
      message: "FYP proposal and document were submitted successfully.",
      projectId: result.projectId,
      submissionId: result.submissionId,
      nominationCount: result.nominationCount || 0,
    });
  } catch (error) {
    if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
    console.error("Student proposal transaction error:", error);
    const hint = error.code === "ER_NO_REFERENCED_ROW_2"
      ? "The projects_submissions foreign key still points to the legacy projects table. Run the submission foreign-key repair script."
      : undefined;
    return res.status(500).json({
      error: "The proposal could not be saved together with its document.",
      details: error.message,
      code: error.code || "PROPOSAL_SAVE_FAILED",
      hint,
    });
  }
});


// POST /api/student/my-fyp/:projectId/revision - upload a revised proposal version
router.post(
  "/student/my-fyp/:projectId/revision",
  savedProposalUpload.single("proposal"),
  async (req, res) => {
    const userId = getTokenUserId(req);
    const projectId = Number(req.params.projectId);
    const responseNote = String(req.body?.responseNote || "").trim().slice(0, 2000);

    if (!userId) {
      if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
      return res.status(401).json({ error: "Missing or invalid token" });
    }
    if (!projectId) {
      if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Valid project ID is required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a revised PDF or DOCX proposal" });
    }

    try {
      const relativeFilePath = nodePath
        .join("uploads", "proposals", req.file.filename)
        .replaceAll("\\", "/");

      const result = await transaction(async (connection) => {
        const [projects] = await connection.query(
          `SELECT fp.project_id, fp.project_title, fp.status, fp.student_name,
                  fp.supervisor_user_id, fp.supervisor_name, fp.supervisor_email
           FROM fyp_projects fp
           WHERE fp.project_id = ? AND fp.student_user_id = ?
           LIMIT 1 FOR UPDATE`,
          [projectId, userId]
        );
        if (!projects.length) {
          const err = new Error("Project not found for this student");
          err.statusCode = 404;
          throw err;
        }
        const project = projects[0];
        if (String(project.status || "") !== "Revision Required") {
          const err = new Error("A revised proposal can only be uploaded when the status is Revision Required");
          err.statusCode = 409;
          throw err;
        }

        const [versionRows] = await connection.query(
          `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
           FROM projects_submissions
           WHERE project_id = ? AND submission_type = 'proposal'`,
          [projectId]
        );
        const version = Number(versionRows[0]?.next_version || 1);

        const [submissionResult] = await connection.query(
          `INSERT INTO projects_submissions
            (submission_title, file_path, original_file_name, mime_type, submitted_at,
             submission_type, status, project_id, version_number, is_locked, uploaded_by, feedback)
           VALUES (?, ?, ?, ?, NOW(), 'proposal', 'pending', ?, ?, 0, ?, ?)`,
          [
            `Revised Proposal - Version ${version}`,
            relativeFilePath,
            req.file.originalname,
            req.file.mimetype || "application/octet-stream",
            projectId,
            version,
            userId,
            responseNote || null,
          ]
        );

        await connection.query(
          `UPDATE fyp_projects
           SET status = 'Revised Proposal Submitted', current_phase = 'Proposal Re-review',
               progress_percent = 20, risk_status = 'Needs Attention', updated_at = NOW()
           WHERE project_id = ? AND student_user_id = ?`,
          [projectId, userId]
        );

        return {
          submissionId: submissionResult.insertId,
          version,
          project,
        };
      });

      const notification = await notifyUser({
        projectId,
        userId: result.project.supervisor_user_id,
        recipientType: "Supervisor",
        title: "Revised FYP Proposal Submitted",
        message: `${result.project.student_name || "The student"} submitted proposal version ${result.version} for "${result.project.project_title}". Please review the revised proposal.`,
        sendEmail: req.body?.sendEmail,
        actionPath: `/supervisor-review?projectId=${projectId}`,
      });

      return res.status(201).json({
        success: true,
        message: "Revised proposal submitted. Your supervisor has been notified.",
        submissionId: result.submissionId,
        version: result.version,
        status: "Revised Proposal Submitted",
        notification: {
          inApp: notification?.inAppStatus || "Sent",
          email: notification?.emailStatus || "Not Requested",
        },
      });
    } catch (error) {
      if (req.file?.path) nodeFs.unlink(req.file.path, () => {});
      return res.status(error.statusCode || 500).json({
        error: error.message || "Failed to submit revised proposal",
      });
    }
  }
);

// GET /api/student/my-fyp/:projectId/result - released result, rubric breakdown and feedback
router.get("/student/my-fyp/:projectId/result", async (req, res) => {
  const userId = getTokenUserId(req);
  const projectId = Number(req.params.projectId);
  if (!userId) return res.status(401).json({ error: "Missing or invalid token" });
  if (!projectId) return res.status(400).json({ error: "Valid project ID is required" });

  try {
    const projects = await query(
      `SELECT project_id, project_title, status, result_status, final_score, final_grade,
              result_released_at, supervisor_name, examiner_name
       FROM fyp_projects WHERE project_id = ? AND student_user_id = ? LIMIT 1`,
      [projectId, userId]
    );
    if (!projects.length) return res.status(404).json({ error: "Project not found for this student" });
    const project = projects[0];
    if (project.status !== "Result Released" && project.result_status !== "Released") {
      return res.status(403).json({
        error: "The result has not been released by the coordinator yet.",
        code: "RESULT_NOT_RELEASED",
      });
    }

    const [settingsRows, supervisorRows, examinerRows, supervisorScores, examinerScores, feedback] = await Promise.all([
      query("SELECT supervisor_weight, examiner_weight FROM fyp_assessment_settings WHERE setting_id = 1"),
      query(
        `SELECT assessment_id, supervisor_user_id, comments, total_score, percentage, submitted_at
         FROM fyp_supervisor_assessments
         WHERE project_id = ? AND status = 'Submitted' LIMIT 1`,
        [projectId]
      ),
      query(
        `SELECT evaluation_id, examiner_user_id, strengths, improvements, recommendations,
                overall_comments, total_score, percentage, submitted_at
         FROM fyp_evaluations
         WHERE project_id = ? AND status = 'Submitted' LIMIT 1`,
        [projectId]
      ),
      query(
        `SELECT ri.criterion, ri.description, ri.max_score, ri.weightage,
                ss.score, ss.comment
         FROM fyp_supervisor_assessment_scores ss
         JOIN fyp_supervisor_assessments sa ON sa.assessment_id = ss.assessment_id
         JOIN fyp_rubric_items ri ON ri.rubric_item_id = ss.rubric_item_id
         WHERE sa.project_id = ? AND sa.status = 'Submitted'
         ORDER BY ri.display_order, ri.rubric_item_id`,
        [projectId]
      ),
      query(
        `SELECT ri.criterion, ri.description, ri.max_score, ri.weightage,
                es.score, es.comment
         FROM fyp_evaluation_scores es
         JOIN fyp_evaluations ev ON ev.evaluation_id = es.evaluation_id
         JOIN fyp_rubric_items ri ON ri.rubric_item_id = es.rubric_item_id
         WHERE ev.project_id = ? AND ev.status = 'Submitted'
         ORDER BY ri.display_order, ri.rubric_item_id`,
        [projectId]
      ),
      query(
        `SELECT feedback_id, submission_id, author_role, comment, attachment_path,
                attachment_name, attachment_mime, created_at
         FROM fyp_feedback
         WHERE project_id = ? AND author_role IN ('Supervisor','Examiner')
         ORDER BY created_at DESC`,
        [projectId]
      ),
    ]);

    res.json({
      success: true,
      project,
      settings: settingsRows[0] || { supervisor_weight: null, examiner_weight: null },
      supervisorAssessment: supervisorRows[0] || null,
      examinerEvaluation: examinerRows[0] || null,
      supervisorScores,
      examinerScores,
      feedback,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load released result" });
  }
});

module.exports = router;
