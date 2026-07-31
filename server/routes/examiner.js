const express = require("express");
const { authenticateToken, requireAnyRole } = require("../middleware/auth");
const { query, transaction } = require("../utils/dbPromise");
const { assertProjectAccess, requireProjectRole, loadRoles } = require("../utils/projectAccess");
const { notifyCoordinators } = require("../utils/innovationNotifications");

const router = express.Router();
const sendError = (res, error) => {
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

router.get(
  "/staff/dashboard",
  authenticateToken,
  requireAnyRole("supervisor", "examiner", "coordinator"),
  async (req, res) => {
    try {
      const userId = req.user.user_id;
      const [roles, supervised, examinations] = await Promise.all([
        loadRoles(userId),
        query(
          `SELECT project_id, project_title, student_name, matric_no, status, progress_percent, risk_status, updated_at
           FROM fyp_projects WHERE supervisor_user_id = ? ORDER BY updated_at DESC`,
          [userId]
        ),
        query(
          `SELECT fp.project_id, fp.project_title, fp.student_name, fp.matric_no, fp.status,
                  ea.assigned_at, ea.status AS assignment_status,
                  ev.status AS evaluation_status, ev.total_score, ev.submitted_at
           FROM fyp_examiner_assignments ea
           JOIN fyp_projects fp ON fp.project_id = ea.project_id
           LEFT JOIN fyp_evaluations ev
             ON ev.project_id = fp.project_id AND ev.examiner_user_id = ea.examiner_user_id
           WHERE ea.examiner_user_id = ? AND ea.status = 'Assigned'
           ORDER BY ea.assigned_at DESC`,
          [userId]
        ),
      ]);

      res.json({
        success: true,
        roles,
        stats: {
          supervised: supervised.length,
          pendingSupervisorReview: supervised.filter((p) => /Submitted|Review|Revision/i.test(p.status || "")).length,
          examinationAssignments: examinations.length,
          pendingExaminations: examinations.filter((p) => p.evaluation_status !== "Submitted").length,
          completedExaminations: examinations.filter((p) => p.evaluation_status === "Submitted").length,
        },
        supervised: supervised.map((item) => ({
          ...item,
          status: String(item.status || "Pending Supervisor Approval") === "Assigned"
            ? "Pending Supervisor Approval"
            : (item.status || "Pending Supervisor Approval"),
        })),
        examinations,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.get(
  "/examiner/projects",
  authenticateToken,
  requireAnyRole("examiner"),
  async (req, res) => {
    try {
      const rows = await query(
        `SELECT fp.project_id, fp.project_title, fp.project_type, fp.abstract, fp.keywords,
                fp.student_name, fp.matric_no, fp.supervisor_name, fp.status,
                fp.github_url, fp.google_drive_url, fp.approved_submission_id,
                ea.assigned_at, ev.status AS evaluation_status, ev.total_score, ev.submitted_at
         FROM fyp_examiner_assignments ea
         JOIN fyp_projects fp ON fp.project_id = ea.project_id
         LEFT JOIN fyp_evaluations ev
           ON ev.project_id = fp.project_id AND ev.examiner_user_id = ea.examiner_user_id
         WHERE ea.examiner_user_id = ? AND ea.status = 'Assigned'
         ORDER BY CASE WHEN ev.status = 'Submitted' THEN 1 ELSE 0 END, ea.assigned_at DESC`,
        [req.user.user_id]
      );
      res.json({ success: true, projects: rows });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.get(
  "/examiner/projects/:projectId",
  authenticateToken,
  assertProjectAccess,
  requireProjectRole("examiner", "coordinator", "admin"),
  async (req, res) => {
    try {
      const projectId = req.project.project_id;
      const [submissions, rubric, evaluation, scores, feedback] = await Promise.all([
        query(
          `SELECT submission_id, submission_title, original_file_name, mime_type,
                  submission_type, status, version_number, is_locked, submitted_at
           FROM projects_submissions
           WHERE project_id = ? AND (is_locked = 1 OR submission_id = ?)
           ORDER BY version_number DESC`,
          [projectId, req.project.approved_submission_id]
        ),
        query(
          `SELECT rubric_item_id, criterion, description, max_score, weightage, display_order
           FROM fyp_rubric_items WHERE is_active = 1 ORDER BY display_order, rubric_item_id`
        ),
        query(
          `SELECT * FROM fyp_evaluations WHERE project_id = ? AND examiner_user_id = ? LIMIT 1`,
          [projectId, req.user.user_id]
        ),
        query(
          `SELECT es.* FROM fyp_evaluation_scores es
           JOIN fyp_evaluations ev ON ev.evaluation_id = es.evaluation_id
           WHERE ev.project_id = ? AND ev.examiner_user_id = ?`,
          [projectId, req.user.user_id]
        ),
        query("SELECT * FROM fyp_feedback WHERE project_id = ? ORDER BY created_at DESC", [projectId]),
      ]);
      res.json({
        success: true,
        project: req.project,
        submissions,
        rubric,
        evaluation: evaluation[0] || null,
        scores,
        feedback,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.put(
  "/examiner/projects/:projectId/evaluation",
  authenticateToken,
  assertProjectAccess,
  requireProjectRole("examiner"),
  async (req, res) => {
    try {
      const projectId = req.project.project_id;
      const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
      if (!scores.length) return res.status(400).json({ error: "At least one rubric score is required" });

      const rubric = await query(
        "SELECT rubric_item_id, max_score FROM fyp_rubric_items WHERE is_active = 1"
      );
      const maxById = new Map(rubric.map((item) => [Number(item.rubric_item_id), Number(item.max_score)]));
      for (const item of scores) {
        const max = maxById.get(Number(item.rubricItemId));
        const score = Number(item.score);
        if (max === undefined || !Number.isFinite(score) || score < 0 || score > max) {
          return res.status(400).json({ error: `Invalid score for rubric item ${item.rubricItemId}` });
        }
      }
      const total = scores.reduce((sum, item) => sum + Number(item.score || 0), 0);
      const maxTotal = rubric.reduce((sum, item) => sum + Number(item.max_score || 0), 0);
      const percentage = maxTotal ? Number(((total / maxTotal) * 100).toFixed(2)) : 0;
      const submit = Boolean(req.body.submit);

      const evaluationId = await transaction(async (connection) => {
        const [existing] = await connection.query(
          "SELECT evaluation_id, status FROM fyp_evaluations WHERE project_id = ? AND examiner_user_id = ? FOR UPDATE",
          [projectId, req.user.user_id]
        );
        if (existing[0]?.status === "Submitted") {
          const error = new Error("This evaluation has already been submitted and locked");
          error.status = 409;
          throw error;
        }

        let id = existing[0]?.evaluation_id;
        if (id) {
          await connection.query(
            `UPDATE fyp_evaluations SET strengths = ?, improvements = ?, recommendations = ?,
                    overall_comments = ?, total_score = ?, percentage = ?, status = ?,
                    submitted_at = ?, updated_at = NOW()
             WHERE evaluation_id = ?`,
            [
              req.body.strengths || null,
              req.body.improvements || null,
              req.body.recommendations || null,
              req.body.overallComments || null,
              total,
              percentage,
              submit ? "Submitted" : "Draft",
              submit ? new Date() : null,
              id,
            ]
          );
          await connection.query("DELETE FROM fyp_evaluation_scores WHERE evaluation_id = ?", [id]);
        } else {
          const [result] = await connection.query(
            `INSERT INTO fyp_evaluations
              (project_id, examiner_user_id, strengths, improvements, recommendations,
               overall_comments, total_score, percentage, status, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              projectId,
              req.user.user_id,
              req.body.strengths || null,
              req.body.improvements || null,
              req.body.recommendations || null,
              req.body.overallComments || null,
              total,
              percentage,
              submit ? "Submitted" : "Draft",
              submit ? new Date() : null,
            ]
          );
          id = result.insertId;
        }

        for (const item of scores) {
          await connection.query(
            `INSERT INTO fyp_evaluation_scores (evaluation_id, rubric_item_id, score, comment)
             VALUES (?, ?, ?, ?)`,
            [id, item.rubricItemId, item.score, item.comment || null]
          );
        }

        if (submit) {
          await connection.query(
            `UPDATE fyp_projects SET status = 'Grading Completed', current_phase = 'Result Review',
             progress_percent = 95, risk_status = 'On Track', result_status = 'Pending Release', updated_at = NOW() WHERE project_id = ?`,
            [projectId]
          );
          await connection.query(
            `UPDATE fyp_examiner_assignments SET completed_at = NOW()
             WHERE project_id = ? AND examiner_user_id = ? AND status = 'Assigned'`,
            [projectId, req.user.user_id]
          );
        }
        return id;
      });

      if (submit) {
        await notifyCoordinators({
          projectId,
          title: "Examiner Evaluation Submitted",
          message: `The examiner completed grading for ${req.project.project_title}.`,
          sendEmail: req.body.sendEmail,
          actionPath: "/assign-examiner",
        });
      }
      res.json({
        success: true,
        evaluationId,
        status: submit ? "Submitted" : "Draft",
        totalScore: total,
        percentage,
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      return sendError(res, error);
    }
  }
);

module.exports = router;
