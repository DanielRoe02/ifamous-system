const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const nodeFs = require("fs");
const nodePath = require("path");

const proposalUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

const proposalUploadDir = nodePath.join(__dirname, "..", "uploads", "proposals");
nodeFs.mkdirSync(proposalUploadDir, { recursive: true });

const savedProposalUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, proposalUploadDir);
    },
    filename: (req, file, cb) => {
      const safeOriginal = String(file.originalname || "proposal")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safeOriginal}`);
    },
  }),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

function extractJsonFromText(text) {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch (_) {}

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

async function callGemmaProposalExtractor(proposalText, fileName) {
  const ollamaBaseUrl = process.env.OLLAMA_API_URL || "https://ollama.com";
  const model =
    process.env.OLLAMA_MODEL ||
    process.env.OLLAMA_CHAT_MODEL ||
    "gemma4:31b-cloud";

  const prompt = `
You are an academic Final Year Project proposal extraction assistant for the I-FAMOUS system.

Extract useful FYP information from the proposal text.

Return ONLY valid JSON. Do not use markdown.

Required JSON format:
{
  "projectTitle": "clear project title",
  "projectType": "Development or Research",
  "abstract": "short but meaningful abstract summary, 80 to 150 words",
  "keywords": "5 to 8 strong academic keywords separated by commas"
}

Rules:
- Do not copy course code as the project title unless no project title exists.
- Ignore cover page noise such as course code, lecturer name, section, member list, and university name.
- Prefer the actual system/project title from the proposal content.
- Keywords must be intelligent academic/technical keywords, not random filename words.
- If the proposal is about software, system, web app, database, AI, automation, or mobile app, projectType is usually "Development".
- If information is missing, infer carefully from the proposal text.

File name:
${fileName}

Proposal text:
${proposalText.slice(0, 12000)}
`;

  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.OLLAMA_API_KEY
        ? `Bearer ${process.env.OLLAMA_API_KEY}`
        : undefined,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gemma proposal extraction failed");
  }

  const content = data.message?.content || data.response || "";
  const parsed = extractJsonFromText(content);

  if (!parsed) {
    throw new Error("AI returned invalid extraction format");
  }

  return {
    projectTitle: parsed.projectTitle || "",
    projectType: parsed.projectType || "Development",
    abstract: parsed.abstract || "",
    keywords: parsed.keywords || "",
  };
}

async function extractProposalText(file) {
  const fileName = String(file.originalname || "").toLowerCase();
  const buffer = file.buffer;

  if (fileName.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return result.text || "";
  }

  if (fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (fileName.endsWith(".txt")) {
    return buffer.toString("utf8");
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}

module.exports = {
  proposalUpload,
  savedProposalUpload,
  proposalUploadDir,
  extractJsonFromText,
  callGemmaProposalExtractor,
  extractProposalText,
};
