const { query } = require("./dbPromise");

async function loadRoles(userId) {
  const rows = await query(
    `SELECT
       EXISTS(SELECT 1 FROM students WHERE student_id = ?) AS is_student,
       EXISTS(SELECT 1 FROM supervisor WHERE supervisor_id = ?) AS is_supervisor,
       EXISTS(SELECT 1 FROM examiners WHERE examiners_id = ?) AS is_examiner,
       EXISTS(SELECT 1 FROM coordinator WHERE user_id = ?) AS is_coordinator,
       EXISTS(SELECT 1 FROM admin WHERE user_id = ?) AS is_admin`,
    [userId, userId, userId, userId, userId]
  );

  const role = rows?.[0] || {};
  return {
    is_student: Number(role.is_student || 0),
    is_supervisor: Number(role.is_supervisor || 0),
    is_examiner: Number(role.is_examiner || 0),
    is_coordinator: Number(role.is_coordinator || 0),
    is_admin: Number(role.is_admin || 0),
  };
}

async function loadProject(projectId) {
  const rows = await query(
    `SELECT fp.*,
       COALESCE(ea.examiner_user_id, fp.examiner_user_id) AS assigned_examiner_user_id,
       eu.full_name AS assigned_examiner_name,
       eu.email AS assigned_examiner_email
     FROM fyp_projects fp
     LEFT JOIN fyp_examiner_assignments ea
       ON ea.project_id = fp.project_id AND ea.status = 'Assigned'
     LEFT JOIN users eu
       ON eu.user_id = COALESCE(ea.examiner_user_id, fp.examiner_user_id)
     WHERE fp.project_id = ?
     LIMIT 1`,
    [projectId]
  );
  return rows?.[0] || null;
}

function canViewProject(project, userId, roles, isProjectStudentMember = false) {
  if (!project) return false;
  if (roles.is_admin || roles.is_coordinator) return true;
  if (roles.is_student && (Number(project.student_user_id) === Number(userId) || isProjectStudentMember)) return true;
  if (roles.is_supervisor && Number(project.supervisor_user_id) === Number(userId)) return true;
  if (roles.is_examiner && Number(project.assigned_examiner_user_id) === Number(userId)) return true;
  return false;
}

async function assertProjectAccess(req, res, next) {
  try {
    const projectId = Number(req.params.projectId || req.body?.projectId || req.query?.projectId);
    if (!projectId) {
      return res.status(400).json({ error: "A valid project ID is required" });
    }

    const userId = Number(req.user?.user_id);
    const [roles, project] = await Promise.all([loadRoles(userId), loadProject(projectId)]);

    if (!project) return res.status(404).json({ error: "Project not found" });
    let isProjectStudentMember = false;
    if (roles.is_student && Number(project.student_user_id) !== userId) {
      const memberRows = await query(
        `SELECT 1
         FROM students s
         JOIN users u ON u.user_id = s.student_id
         JOIN fyp_project_members m
           ON LOWER(m.matric_no) = LOWER(s.metric_number)
           OR LOWER(m.student_name) = LOWER(u.full_name)
         WHERE s.student_id = ? AND m.project_id = ? LIMIT 1`,
        [userId, projectId]
      );
      isProjectStudentMember = memberRows.length > 0;
    }
    if (!canViewProject(project, userId, roles, isProjectStudentMember)) {
      return res.status(403).json({
        error: "You are not assigned to this FYP project",
        code: "PROJECT_ACCESS_DENIED",
      });
    }

    req.project = project;
    req.roles = roles;
    req.isProjectStudent = roles.is_student && (Number(project.student_user_id) === userId || isProjectStudentMember);
    return next();
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
      return res.status(503).json({
        error: "The innovation database migration has not been applied yet.",
        code: "MIGRATION_REQUIRED",
        details: error.message,
      });
    }
    return next(error);
  }
}

function requireProjectRole(...allowed) {
  return (req, res, next) => {
    const roles = req.roles || {};
    const userId = Number(req.user?.user_id);
    const project = req.project || {};
    const checks = {
      student: Boolean(req.isProjectStudent),
      supervisor: roles.is_supervisor && Number(project.supervisor_user_id) === userId,
      examiner: roles.is_examiner && Number(project.assigned_examiner_user_id) === userId,
      coordinator: roles.is_coordinator,
      admin: roles.is_admin,
    };
    if (allowed.some((role) => checks[role])) return next();
    return res.status(403).json({ error: "This action is not allowed for your project role" });
  };
}

module.exports = {
  loadRoles,
  loadProject,
  canViewProject,
  assertProjectAccess,
  requireProjectRole,
};
