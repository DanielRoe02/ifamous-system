const db = require("../config/db").promise();

const REQUIRED_COLUMNS = {
  email_requested: "TINYINT(1) NOT NULL DEFAULT 0",
  email_status: "VARCHAR(30) NOT NULL DEFAULT 'Not Requested'",
  email_sent_at: "DATETIME NULL",
  email_error: "VARCHAR(500) NULL",
  action_url: "VARCHAR(500) NULL",
};

async function ensureNotificationEmailSchema() {
  const [tables] = await db.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fyp_notifications' LIMIT 1`
  );
  if (!tables.length) return;

  const [columns] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fyp_notifications'`
  );
  const existing = new Set(columns.map((row) => row.COLUMN_NAME));

  for (const [column, definition] of Object.entries(REQUIRED_COLUMNS)) {
    if (existing.has(column)) continue;
    await db.query(`ALTER TABLE fyp_notifications ADD COLUMN \`${column}\` ${definition}`);
  }
}

module.exports = { ensureNotificationEmailSchema };
