const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "ifamous-super-secret-key-2026";

/**
 * Validates token signature and expiration.
 * Returns decoded payload if valid, or throws error with specific code.
 */
function verifyTokenPayload(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getTokenUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader || req.query?.access_token || req.query?.token || null;

  if (!token) return null;

  try {
    const decoded = verifyTokenPayload(token);
    return decoded.user_id || decoded.userId || decoded.id || decoded.user?.user_id || null;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to authenticate any valid JWT token.
 * Validates token structure, signature, and expiration (configured by the login token, currently 24 hours).
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader || req.query?.access_token || null;

  if (!token) {
    return res.status(401).json({ error: "Missing authentication token", code: "MISSING_TOKEN" });
  }

  try {
    const decoded = verifyTokenPayload(token);
    req.user = decoded;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Session expired. Please log in again.",
        code: "SESSION_EXPIRED",
        expiredAt: error.expiredAt,
      });
    }
    return res.status(401).json({
      error: "Invalid token signature or payload.",
      code: "INVALID_TOKEN",
    });
  }
}

function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing admin token", code: "MISSING_TOKEN" });
  }

  try {
    const decoded = verifyTokenPayload(token);

    if (decoded.is_admin === 1 || decoded.email === "admin@utm.my") {
      req.adminUser = decoded;
      return next();
    }

    return res.status(403).json({ error: "Admin access required", code: "FORBIDDEN" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Session expired. Please log in again.",
        code: "SESSION_EXPIRED",
        expiredAt: error.expiredAt,
      });
    }
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }
}

function requireAnyRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user || {};
    const allowed = allowedRoles.some((role) => Number(user[`is_${role}`] || 0) === 1);
    if (allowed || Number(user.is_admin || 0) === 1) return next();
    return res.status(403).json({
      error: `Required role: ${allowedRoles.join(" or ")}`,
      code: "ROLE_FORBIDDEN",
    });
  };
}

module.exports = {
  JWT_SECRET,
  getTokenUserId,
  authenticateToken,
  verifyAdmin,
  verifyTokenPayload,
  requireAnyRole,
};

