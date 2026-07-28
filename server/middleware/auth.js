const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "ifamous-super-secret-key-2026";

function getTokenUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.user_id || decoded.userId || decoded.id || decoded.user?.user_id || null;
  } catch (error) {
    return null;
  }
}

function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing admin token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.is_admin === 1 || decoded.email === "admin@utm.my") {
      req.adminUser = decoded;
      return next();
    }

    return res.status(403).json({ error: "Admin access required" });
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = {
  JWT_SECRET,
  getTokenUserId,
  verifyAdmin,
};
