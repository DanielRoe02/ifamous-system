let transporter = null;
let nodemailerModule = null;

function getNodemailer() {
  if (nodemailerModule) return nodemailerModule;
  try {
    nodemailerModule = require("nodemailer");
    return nodemailerModule;
  } catch (error) {
    return null;
  }
}

function booleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFrontendBaseUrl() {
  return String(
    process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "http://localhost:5173"
  ).replace(/\/$/, "");
}

function absoluteActionUrl(actionPath) {
  if (!actionPath) return getFrontendBaseUrl();
  if (/^https?:\/\//i.test(String(actionPath))) return String(actionPath);
  return `${getFrontendBaseUrl()}${String(actionPath).startsWith("/") ? "" : "/"}${actionPath}`;
}

function getTransporter() {
  if (transporter) return transporter;

  const nodemailer = getNodemailer();
  if (!nodemailer) return null;

  const smtpUrl = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!smtpUrl && (!host || !user || !pass)) return null;

  const options = smtpUrl
    ? smtpUrl
    : {
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: booleanEnv(process.env.SMTP_SECURE, Number(process.env.SMTP_PORT || 587) === 465),
        auth: { user, pass },
        pool: booleanEnv(process.env.SMTP_POOL, true),
      };

  transporter = nodemailer.createTransport(options, {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  });
  return transporter;
}

function buildEmailHtml({ recipientName, title, message, actionUrl, actionLabel }) {
  const safeName = escapeHtml(recipientName || "I-FAMOUS user");
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br>");
  const safeUrl = escapeHtml(actionUrl);
  const safeLabel = escapeHtml(actionLabel || "Open in I-FAMOUS");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3eee8;font-family:Arial,sans-serif;color:#2f1820">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:white;border-radius:20px;overflow:hidden;border:1px solid #e2d4ca">
          <tr><td style="background:#5c001f;color:white;padding:24px 30px">
            <div style="font-size:12px;letter-spacing:2px;color:#f8be17;font-weight:bold">UNIVERSITI TEKNOLOGI MALAYSIA</div>
            <div style="font-size:25px;font-weight:bold;margin-top:6px">I-FAMOUS</div>
          </td></tr>
          <tr><td style="padding:30px">
            <p style="margin:0 0 14px">Hello ${safeName},</p>
            <h1 style="font-size:24px;color:#5c001f;margin:0 0 16px">${safeTitle}</h1>
            <p style="line-height:1.65;margin:0 0 24px">${safeMessage}</p>
            <a href="${safeUrl}" style="display:inline-block;background:#5c001f;color:white;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:bold">${safeLabel}</a>
            <p style="font-size:12px;color:#74656b;line-height:1.5;margin:26px 0 0">No file is attached to this email. Open I-FAMOUS securely to view project documents, correction files, assessment feedback, or results.</p>
          </td></tr>
          <tr><td style="background:#f7f1ea;padding:18px 30px;font-size:12px;color:#74656b">This is an automated notification from I-FAMOUS. Please do not reply directly to this message.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendEmailNotification({
  to,
  recipientName,
  title,
  message,
  actionPath,
  actionLabel,
}) {
  const mailer = getTransporter();
  if (!to) return { status: "Failed", error: "Recipient email is missing" };
  if (!mailer) {
    return {
      status: "Not Configured",
      error: "SMTP is not configured. Set SMTP_URL or SMTP_HOST, SMTP_USER and SMTP_PASS.",
    };
  }

  const actionUrl = absoluteActionUrl(actionPath);
  try {
    const info = await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `[I-FAMOUS] ${title}`,
      text: `${title}\n\n${message}\n\nOpen in I-FAMOUS: ${actionUrl}\n\nNo files are attached to this email.`,
      html: buildEmailHtml({ recipientName, title, message, actionUrl, actionLabel }),
    });
    return { status: "Accepted", messageId: info.messageId || null, error: null };
  } catch (error) {
    return { status: "Failed", error: String(error.message || error).slice(0, 500) };
  }
}

module.exports = {
  absoluteActionUrl,
  sendEmailNotification,
};
