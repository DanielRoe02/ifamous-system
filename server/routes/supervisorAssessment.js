const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { assertProjectAccess, requireProjectRole } = require("../utils/projectAccess");
const { query, transaction } = require("../utils/dbPromise");
const { notifyCoordinators } = require("../utils/innovationNotifications");

const router = express.Router();

function sendError(res, error) {
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      error: "The innovation database migration has not been applied yet.",
      code: "MIGRATION_REQUIRED",
      details: error.message,
    });
  }
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: error.message || "Server error" });
}

router.get(
  "/supervisor/projects/:projectId/assessment",
  authenticateToken,
  assertProjectAccess,
  requireProjectRole("supervisor", "coordinator", "admin"),
  async (req, res) => {
    try {
      const assessorId = Number(req.project.supervisor_user_id);
      const [rubric, assessment, scores] = await Promise.all([
        query(
          `SELECT rubric_item_id, criterion, description, max_score, weightage, display_order
           FROM fyp_rubric_items WHERE is_active = 1 ORDER BY display_order, rubric_item_id`
        ),
        query(
          `SELECT * FROM fyp_supervisor_assessments
           WHERE project_id = ? AND supervisor_user_id = ? LIMIT 1`,
          [req.project.project_id, assessorId]
        ),
        query(
          `SELECT ss.* FROM fyp_supervisor_assessment_scores ss
           JOIN fyp_supervisor_assessments sa ON sa.assessment_id = ss.assessment_id
           WHERE sa.project_id = ? AND sa.supervisor_user_id = ?`,
          [req.project.project_id, assessorId]
        ),
      ]);
      res.json({
        success: true,
        project: req.project,
        rubric,
        assessment: assessment[0] || null,
        scores,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.put(
  "/supervisor/projects/:projectId/assessment",
  authenticateToken,
  assertProjectAccess,
  requireProjectRole("supervisor"),
  async (req, res) => {
    try {
      const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
      if (!scores.length) return res.status(400).json({ error: "At least one rubric score is required" });
      const rubric = await query("SELECT rubric_item_id, max_score FROM fyp_rubric_items WHERE is_active = 1");
      const maxById = new Map(rubric.map((item) => [Number(item.rubric_item_id), Number(item.max_score)]));
      for (const item of scores) {
        const maximum = maxById.get(Number(item.rubricItemId));
        const score = Number(item.score);
        if (maximum === undefined || !Number.isFinite(score) || score < 0 || score > maximum) {
          return res.status(400).json({ error: `Invalid score for rubric item ${item.rubricItemId}` });
        }
      }
      const total = scores.reduce((sum, item) => sum + Number(item.score || 0), 0);
      const maxTotal = rubric.reduce((sum, item) => sum + Number(item.max_score || 0), 0);
      const percentage = maxTotal ? Number(((total / maxTotal) * 100).toFixed(2)) : 0;
      const submit = Boolean(req.body.submit);

      const assessmentId = await transaction(async (connection) => {
        const [existing] = await connection.query(
          `SELECT assessment_id, status FROM fyp_supervisor_assessments
           WHERE project_id = ? AND supervisor_user_id = ? FOR UPDATE`,
          [req.project.project_id, req.user.user_id]
        );
        if (existing[0]?.status === "Submitted") {
          throw Object.assign(new Error("This supervisor assessment is already submitted and locked"), { status: 409 });
        }
        let id = existing[0]?.assessment_id;
        if (id) {
          await connection.query(
            `UPDATE fyp_supervisor_assessments SET comments = ?, total_score = ?, percentage = ?,
             status = ?, submitted_at = ?, updated_at = NOW() WHERE assessment_id = ?`,
            [req.body.comments || null, total, percentage, submit ? "Submitted" : "Draft", submit ? new Date() : null, id]
          );
          await connection.query("DELETE FROM fyp_supervisor_assessment_scores WHERE assessment_id = ?", [id]);
        } else {
          const [created] = await connection.query(
            `INSERT INTO fyp_supervisor_assessments
              (project_id, supervisor_user_id, comments, total_score, percentage, status, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              req.project.project_id,
              req.user.user_id,
              req.body.comments || null,
              total,
              percentage,
              submit ? "Submitted" : "Draft",
              submit ? new Date() : null,
            ]
          );
          id = created.insertId;
        }
        for (const item of scores) {
          await connection.query(
            `INSERT INTO fyp_supervisor_assessment_scores
              (assessment_id, rubric_item_id, score, comment) VALUES (?, ?, ?, ?)`,
            [id, item.rubricItemId, item.score, item.comment || null]
          );
        }
        return id;
      });
      if (submit) {
        await notifyCoordinators({
          projectId: req.project.project_id,
          title: "Supervisor Assessment Submitted",
          message: `The supervisor completed assessment for ${req.project.project_title}.`,
          sendEmail: req.body.sendEmail,
          actionPath: "/assign-examiner",
        });
      }
      res.json({ success: true, assessmentId, totalScore: total, percentage, status: submit ? "Submitted" : "Draft" });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

module.exports = router;
