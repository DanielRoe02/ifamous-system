const mysql = require("mysql2");
require("dotenv").config();

function shouldUseSsl() {
  return (
    process.env.DB_SSL === "true" ||
    String(process.env.DB_HOST || "").includes("aivencloud.com")
  );
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Aiven and I-FAMOUS store server timestamps in UTC. Parse MySQL dates as UTC.
  timezone: process.env.DB_TIMEZONE || "Z",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: shouldUseSsl()
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

// Keep every pooled connection on UTC so NOW(), TIMESTAMP and DATETIME values
// have one predictable meaning. The frontend converts them to Malaysia time.
db.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) console.warn("Unable to set MySQL session timezone to UTC:", error.message);
  });
});

module.exports = db;
