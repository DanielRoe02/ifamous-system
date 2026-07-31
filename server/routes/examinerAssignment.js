const express = require("express");
const { authenticateToken, requireAnyRole } = require("../middleware/auth");
const { query, transaction } = require("../utils/dbPromise");
const { notifyUser } = require("../utils/innovationNotifications");


const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "https://ollama.com";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || process.env.OLLAMA_CHAT_MODEL || "gemma4:31b-cloud";

const router = express.Router();
router.use("/coordinator", authenticateToken, requireAnyRole("coordinator"));

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

function tokenize(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9+#. ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

function expertiseScore(project, candidate) {
  const projectWords = tokenize(`${project.project_title} ${project.abstract} ${project.keywords} ${project.project_type}`);
  const expertiseWords = tokenize(`${candidate.expertise} ${candidate.industry_background} ${candidate.affiliation}`);
  if (!projectWords.size || !expertiseWords.size) return 45;
  let overlap = 0;
  for (const word of projectWords) if (expertiseWords.has(word)) overlap += 1;
  const lexical = Math.min(70, Math.round((overlap / Math.max(1, Math.min(projectWords.size, 12))) * 100));
  const workloadBonus = Math.max(0, 20 - Number(candidate.pending_examinations || 0) * 4);
  const availabilityBonus = candidate.is_available === 0 ? -30 : 10;
  return Math.max(0, Math.min(100, 20 + lexical + workloadBonus + availabilityBonus));
}

async function rankCandidates(project, candidates) {
  const fallback = candidates
    .map((candidate) => ({
      ...candidate,
      matchScore: expertiseScore(project, candidate),
      eligible: Number(candidate.is_available) === 1,
      reason: Number(candidate.is_available) === 1
        ? "Expertise, workload and availability considered"
        : "Marked unavailable",
    }))
    .sort((a, b) => b.matchScore - a.matchScore || a.pending_examinations - b.pending_examinations);

  if (!OLLAMA_API_KEY || candidates.length === 0) {
    return { method: "Explainable fallback: expertise keywords + workload + availability", candidates: fallback };
  }

  const candidateText = candidates.map((c) => ({
    user_id: c.user_id, name: c.full_name, expertise: c.expertise || c.industry_background,
    affiliation: c.department || c.organisation || c.affiliation,
    pending_examinations: Number(c.pending_examinations || 0), available: Number(c.is_available) === 1,
  }));
  const prompt = `You rank FYP examiner candidates. The project supervisor is already excluded.
Project: ${JSON.stringify({ title: project.project_title, type: project.project_type, abstract: project.abstract, keywords: project.keywords })}
Candidates: ${JSON.stringify(candidateText)}
Return ONLY a JSON array containing every candidate once: [{"user_id":1,"score":90,"reason":"..."}]. Consider semantic expertise, examination workload, availability and assignment balance. Score 0-100.`;

  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${OLLAMA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL, stream: false,
        messages: [
          { role: "system", content: "Return strict valid JSON only." },
          { role: "user", content: prompt },
        ],
        options: { temperature: 0.15, num_predict: 1500 },
      }),
    });
    if (!response.ok) throw new Error(`AI service returned ${response.status}`);
    const body = await response.json();
    const parsed = JSON.parse(body.message?.content || "[]");
    const byId = new Map(parsed.map((item) => [Number(item.user_id), item]));
    const ranked = fallback.map((candidate) => {
      const ai = byId.get(Number(candidate.user_id));
      if (!ai) return candidate;
      const aiScore = Math.max(0, Math.min(100, Number(ai.score || candidate.matchScore)));
      const balancedScore = Math.round(aiScore * 0.8 + candidate.matchScore * 0.2);
      return { ...candidate, matchScore: balancedScore, reason: ai.reason || candidate.reason };
    }).sort((a, b) => b.matchScore - a.matchScore || a.pending_examinations - b.pending_examinations);
    return { method: `Ollama ${OLLAMA_MODEL} semantic ranking with workload safeguards`, candidates: ranked };
  } catch (error) {
    console.warn("Examiner AI matching fallback:", error.message);
    return { method: "Explainable fallback used because AI service was unavailable", candidates: fallback };
  }
}

router.get("/coordinator/assessment-settings", async (_req, res) => {
  try {
    const rows = await query(
      "SELECT supervisor_weight, examiner_weight, updated_at FROM fyp_assessment_settings WHERE setting_id = 1"
    );
    res.json({ success: true, settings: rows[0] || { supervisor_weight: null, examiner_weight: null } });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put("/coordinator/assessment-settings", async (req, res) => {
  try {
    const supervisorWeight = Number(req.body.supervisorWeight);
    const examinerWeight = Number(req.body.examinerWeight);
    if (!Number.isFinite(supervisorWeight) || !Number.isFinite(examinerWeight) || supervisorWeight < 0 || examinerWeight < 0 || Math.abs(supervisorWeight + examinerWeight - 100) > 0.001) {
      return res.status(400).json({ error: "Supervisor and examiner weights must be non-negative and total 100%." });
    }
    await query(
      `INSERT INTO fyp_assessment_settings (setting_id, supervisor_weight, examiner_weight, updated_by)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE supervisor_weight = VALUES(supervisor_weight), examiner_weight = VALUES(examiner_weight), updated_by = VALUES(updated_by)`,
      [supervisorWeight, examinerWeight, req.user.user_id]
    );
    res.json({ success: true, supervisorWeight, examinerWeight });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/coordinator/examiner-queue", async (_req, res) => {
  try {
    const [rows, settingRows] = await Promise.all([query(
      `SELECT fp.project_id, fp.project_title, fp.project_type, fp.abstract, fp.keywords,
              fp.student_name, fp.matric_no, fp.supervisor_user_id, fp.supervisor_name,
              fp.status, fp.final_approved_at, fp.approved_submission_id,
              ea.examiner_user_id, eu.full_name AS examiner_name, eu.email AS examiner_email,
              ea.assigned_at, ev.status AS evaluation_status,
              ev.total_score AS examiner_total_score, ev.percentage AS examiner_percentage,
              sa.status AS supervisor_assessment_status, sa.percentage AS supervisor_percentage,
              fp.final_score, fp.final_grade
       FROM fyp_projects fp
       LEFT JOIN fyp_examiner_assignments ea
         ON ea.project_id = fp.project_id AND ea.status = 'Assigned'
       LEFT JOIN users eu ON eu.user_id = ea.examiner_user_id
       LEFT JOIN fyp_evaluations ev
         ON ev.project_id = fp.project_id AND ev.examiner_user_id = ea.examiner_user_id
       LEFT JOIN fyp_supervisor_assessments sa
         ON sa.project_id = fp.project_id AND sa.supervisor_user_id = fp.supervisor_user_id
       WHERE fp.status IN (
         'Awaiting Examiner Assignment', 'Examiner Assigned', 'Under Examination',
         'Grading Completed', 'Result Pending Release', 'Result Released'
       )
       ORDER BY fp.final_approved_at DESC, fp.updated_at DESC`
    ), query("SELECT supervisor_weight, examiner_weight FROM fyp_assessment_settings WHERE setting_id = 1")]);
    const settings = settingRows[0] || {};
    const sw = Number(settings.supervisor_weight);
    const ew = Number(settings.examiner_weight);
    const configured = Number.isFinite(sw) && Number.isFinite(ew) && Math.abs(sw + ew - 100) < 0.001;
    const projects = rows.map((item) => ({
      ...item,
      combined_score: configured && item.supervisor_percentage != null && item.examiner_percentage != null
        ? Number((Number(item.supervisor_percentage) * sw / 100 + Number(item.examiner_percentage) * ew / 100).toFixed(2))
        : null,
    }));
    res.json({ success: true, projects, assessmentSettings: settings, weightsConfigured: configured });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/coordinator/examiner-match/:projectId", async (req, res) => {
  try {
    const projectRows = await query(
      `SELECT project_id, project_title, project_type, abstract, keywords,
              supervisor_user_id, supervisor_name, status
       FROM fyp_projects WHERE project_id = ? LIMIT 1`,
      [req.params.projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: "Project not found" });
    const project = projectRows[0];
    if (!['Awaiting Examiner Assignment', 'Examiner Assigned'].includes(project.status)) {
      return res.status(409).json({ error: "The project is not ready for examiner assignment" });
    }

    const candidates = await query(
      `SELECT u.user_id, u.full_name, u.email, u.expertise, u.affiliation,
              e.industry_background,
              COALESCE(up.department, '') AS department,
              COALESCE(up.organisation, u.company_name, '') AS organisation,
              COALESCE(up.is_available, 1) AS is_available,
              COUNT(CASE WHEN ea.status = 'Assigned' AND (ev.status IS NULL OR ev.status <> 'Submitted') THEN 1 END) AS pending_examinations
       FROM users u
       LEFT JOIN examiners e ON e.examiners_id = u.user_id
       LEFT JOIN students st ON st.student_id = u.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.user_id
       LEFT JOIN fyp_examiner_assignments ea ON ea.examiner_user_id = u.user_id
       LEFT JOIN fyp_evaluations ev
         ON ev.project_id = ea.project_id AND ev.examiner_user_id = ea.examiner_user_id
       WHERE u.user_id <> ? AND st.student_id IS NULL
       GROUP BY u.user_id, u.full_name, u.email, u.expertise, u.affiliation,
                e.industry_background, up.department, up.organisation, up.is_available, u.company_name`,
      [project.supervisor_user_id]
    );

    const ranking = await rankCandidates(project, candidates);

    res.json({
      success: true,
      project,
      method: ranking.method,
      candidates: ranking.candidates,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/coordinator/projects/:projectId/assign-examiner", async (req, res) => {
  try {
    const examinerUserId = Number(req.body.examinerUserId);
    if (!examinerUserId) return res.status(400).json({ error: "Examiner user ID is required" });

    const result = await transaction(async (connection) => {
      const [projects] = await connection.query(
        `SELECT project_id, project_title, supervisor_user_id, status
         FROM fyp_projects WHERE project_id = ? FOR UPDATE`,
        [req.params.projectId]
      );
      if (!projects.length) throw Object.assign(new Error("Project not found"), { status: 404 });
      const project = projects[0];
      if (!['Awaiting Examiner Assignment', 'Examiner Assigned'].includes(project.status)) {
        throw Object.assign(new Error("Project is not ready for examiner assignment"), { status: 409 });
      }
      if (Number(project.supervisor_user_id) === examinerUserId) {
        throw Object.assign(new Error("The same person cannot supervise and examine the same FYP"), { status: 409 });
      }

      const [eligible] = await connection.query(
        `SELECT u.user_id, u.full_name, u.email, u.expertise
         FROM users u LEFT JOIN students st ON st.student_id = u.user_id
         WHERE u.user_id = ? AND st.student_id IS NULL LIMIT 1`,
        [examinerUserId]
      );
      if (!eligible.length) throw Object.assign(new Error("A student account cannot be assigned as an examiner"), { status: 400 });

      await connection.query(
        `INSERT INTO examiners (industry_background, examiners_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE industry_background = VALUES(industry_background)`,
        [eligible[0].expertise || "General academic or industry expertise", examinerUserId]
      );

      await connection.query(
        "UPDATE fyp_examiner_assignments SET status = 'Reassigned', unassigned_at = NOW() WHERE project_id = ? AND status = 'Assigned'",
        [project.project_id]
      );
      const [assignment] = await connection.query(
        `INSERT INTO fyp_examiner_assignments
          (project_id, examiner_user_id, assigned_by, status, match_score, assignment_reason)
         VALUES (?, ?, ?, 'Assigned', ?, ?)`,
        [
          project.project_id,
          examinerUserId,
          req.user.user_id,
          req.body.matchScore || null,
          req.body.reason || "Coordinator assignment",
        ]
      );
      await connection.query(
        `UPDATE fyp_projects
         SET examiner_user_id = ?, examiner_name = ?, examiner_email = ?,
             status = 'Examiner Assigned', current_phase = 'Examination', progress_percent = 90, risk_status = 'On Track', updated_at = NOW()
         WHERE project_id = ?`,
        [examinerUserId, eligible[0].full_name, eligible[0].email, project.project_id]
      );
      return { assignmentId: assignment.insertId, examiner: eligible[0], project };
    });

    const notification = await notifyUser({
      projectId: req.params.projectId,
      userId: result.examiner.user_id,
      recipientType: "Examiner",
      title: "FYP Examination Assigned",
      message: `You have been assigned to examine "${result.project.project_title}".`,
      sendEmail: req.body.sendEmail,
      actionPath: `/examiner-review?projectId=${req.params.projectId}`,
    });

    res.status(201).json({
      success: true,
      assignmentId: result.assignmentId,
      examiner: result.examiner,
      notification: {
        inApp: notification?.inAppStatus || "Sent",
        email: notification?.emailStatus || "Not Requested",
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    return sendError(res, error);
  }
});

router.delete("/coordinator/projects/:projectId/examiner", async (req, res) => {
  try {
    const evaluation = await query(
      "SELECT status FROM fyp_evaluations WHERE project_id = ? AND status = 'Submitted' LIMIT 1",
      [req.params.projectId]
    );
    if (evaluation.length && !req.body?.forceReset) {
      return res.status(409).json({ error: "Evaluation has been submitted. Use an authorised reset before reassignment." });
    }

    await transaction(async (connection) => {
      await connection.query(
        "UPDATE fyp_examiner_assignments SET status = 'Removed', unassigned_at = NOW() WHERE project_id = ? AND status = 'Assigned'",
        [req.params.projectId]
      );
      await connection.query(
        `UPDATE fyp_projects SET examiner_user_id = NULL, examiner_name = NULL, examiner_email = NULL,
         status = 'Awaiting Examiner Assignment', current_phase = 'Examiner Assignment', progress_percent = 85, risk_status = 'On Track', updated_at = NOW()
         WHERE project_id = ?`,
        [req.params.projectId]
      );
    });
    res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/coordinator/projects/:projectId/release-result", async (req, res) => {
  try {
    const [examinerRows, supervisorRows, settingRows] = await Promise.all([
      query("SELECT percentage FROM fyp_evaluations WHERE project_id = ? AND status = 'Submitted' LIMIT 1", [req.params.projectId]),
      query("SELECT percentage FROM fyp_supervisor_assessments WHERE project_id = ? AND status = 'Submitted' LIMIT 1", [req.params.projectId]),
      query("SELECT supervisor_weight, examiner_weight FROM fyp_assessment_settings WHERE setting_id = 1"),
    ]);
    if (!examinerRows.length) return res.status(409).json({ error: "No submitted examiner evaluation found" });
    if (!supervisorRows.length) return res.status(409).json({ error: "No submitted supervisor assessment found" });
    const settings = settingRows[0] || {};
    const sw = Number(settings.supervisor_weight);
    const ew = Number(settings.examiner_weight);
    if (!Number.isFinite(sw) || !Number.isFinite(ew) || Math.abs(sw + ew - 100) > 0.001) {
      return res.status(409).json({ error: "Configure the official supervisor/examiner assessment weights before releasing results." });
    }
    const finalScore = Number((Number(supervisorRows[0].percentage) * sw / 100 + Number(examinerRows[0].percentage) * ew / 100).toFixed(2));
    await query(
      `UPDATE fyp_projects SET status = 'Result Released', result_status = 'Released',
       final_score = ?, result_released_at = NOW(), current_phase = 'Completed', progress_percent = 100, risk_status = 'On Track', updated_at = NOW()
       WHERE project_id = ?`,
      [finalScore, req.params.projectId]
    );
    const projectRows = await query("SELECT student_user_id, project_title FROM fyp_projects WHERE project_id = ?", [req.params.projectId]);
    const notification = await notifyUser({
      projectId: req.params.projectId,
      userId: projectRows[0]?.student_user_id,
      recipientType: "Student",
      title: "FYP Result Released",
      message: `Your result for ${projectRows[0]?.project_title || "your FYP"} has been released.`,
      sendEmail: req.body.sendEmail,
      actionPath: `/student-project-details?projectId=${req.params.projectId}&tab=result`,
    });
    res.json({
      success: true,
      status: "Result Released",
      finalScore,
      notification: {
        inApp: notification?.inAppStatus || "Sent",
        email: notification?.emailStatus || "Not Requested",
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
