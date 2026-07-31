const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { query } = require("../utils/dbPromise");
const { loadRoles } = require("../utils/projectAccess");

const router = express.Router();
router.use(authenticateToken);

function sendError(res, error) {
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      error: "The innovation database migration has not been applied yet.",
      code: "MIGRATION_REQUIRED",
      details: error.message,
    });
  }
  return res.status(500).json({ error: error.message });
}

router.get("/profile", async (req, res) => {
  try {
    const rows = await query(
      `SELECT u.user_id, u.full_name, u.email, u.phone_number, u.company_name,
              u.expertise, u.affiliation, up.department, up.organisation,
              up.biography, up.profile_photo_url, up.professional_link,
              up.is_available, up.supervisor_specialisation, up.examiner_specialisation
       FROM users u LEFT JOIN user_profiles up ON up.user_id = u.user_id
       WHERE u.user_id = ? LIMIT 1`,
      [req.user.user_id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    const roles = await loadRoles(req.user.user_id);
    res.json({ success: true, profile: rows[0], roles });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const allowed = {
      fullName: req.body.fullName,
      phoneNumber: req.body.phoneNumber,
      expertise: req.body.expertise,
      affiliation: req.body.affiliation,
      companyName: req.body.companyName,
    };
    await query(
      `UPDATE users SET
         full_name = COALESCE(NULLIF(?, ''), full_name),
         phone_number = COALESCE(NULLIF(?, ''), phone_number),
         expertise = ?, affiliation = ?, company_name = ?
       WHERE user_id = ?`,
      [
        allowed.fullName || "",
        allowed.phoneNumber || "",
        allowed.expertise || null,
        allowed.affiliation || null,
        allowed.companyName || null,
        req.user.user_id,
      ]
    );
    await query(
      `INSERT INTO user_profiles
        (user_id, department, organisation, biography, profile_photo_url, professional_link,
         is_available, supervisor_specialisation, examiner_specialisation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         department = VALUES(department), organisation = VALUES(organisation),
         biography = VALUES(biography), profile_photo_url = VALUES(profile_photo_url),
         professional_link = VALUES(professional_link), is_available = VALUES(is_available),
         supervisor_specialisation = VALUES(supervisor_specialisation),
         examiner_specialisation = VALUES(examiner_specialisation)`,
      [
        req.user.user_id,
        req.body.department || null,
        req.body.organisation || null,
        req.body.biography || null,
        req.body.profilePhotoUrl || null,
        req.body.professionalLink || null,
        req.body.isAvailable === false ? 0 : 1,
        req.body.supervisorSpecialisation || null,
        req.body.examinerSpecialisation || null,
      ]
    );
    res.json({ success: true, message: "Profile updated" });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
