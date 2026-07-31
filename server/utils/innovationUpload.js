const fs = require("fs");
const path = require("path");
const multer = require("multer");

const root = path.join(__dirname, "..", "uploads", "journey");
fs.mkdirSync(root, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, root),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-120);
    const projectId = req.params.projectId || "project";
    cb(null, `${projectId}-${Date.now()}-${safeName}`);
  },
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) return cb(null, true);
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

module.exports = { upload, uploadRoot: root };
