// server/routes/supervisorMatching.js

const express = require("express");
const db = require("../config/db").promise();
const multer = require("multer");
const mammoth = require("mammoth");
const pdfParseModule = require("pdf-parse");

const router = express.Router();

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "https://ollama.com";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || process.env.OLLAMA_CHAT_MODEL || "gemma4:31b-cloud";

const pdfParse = pdfParseModule.default || pdfParseModule;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

// ------------------------------------------------------------
// Get lecturer / supervisor candidates from database
// ------------------------------------------------------------
async function getLecturerCandidates() {
  const [rows] = await db.query(`
    SELECT 
      user_id,
      full_name,
      email,
      phone_number,
      expertise,
      affiliation,
      co_org_name,
      is_utm_staff
    FROM users
    WHERE expertise IS NOT NULL
      AND TRIM(expertise) <> ''
      AND is_utm_staff = 1
      AND LOWER(full_name) NOT LIKE '%coordinator%'
    ORDER BY full_name ASC
    LIMIT 30
  `);

  return rows.map((row) => ({
    user_id: row.user_id,
    name: row.full_name || row.email || "Unnamed Lecturer",
    email: row.email || "-",
    phone: row.phone_number || "-",
    expertise: row.expertise || "General academic supervision",
    affiliation: row.affiliation || row.co_org_name || "Universiti Teknologi Malaysia",
    is_utm_staff: row.is_utm_staff,
  }));
}

// ------------------------------------------------------------
// Fallback matching if Groq unavailable
// ------------------------------------------------------------
function simpleFallbackMatch(project, lecturers) {
  const projectText = `
    ${project.projectTitle || ""}
    ${project.abstract || ""}
    ${project.keywords || ""}
    ${project.memberText || ""}
  `.toLowerCase();

  const scored = lecturers.map((lecturer) => {
    const expertiseWords = String(lecturer.expertise || "")
      .toLowerCase()
      .split(/[,;\s]+/)
      .filter((word) => word.length > 2);

    let score = 55;

    expertiseWords.forEach((word) => {
      if (projectText.includes(word)) {
        score += 8;
      }
    });

    if (
      projectText.includes("ai") &&
      lecturer.expertise.toLowerCase().includes("artificial")
    ) {
      score += 12;
    }

    if (
      projectText.includes("machine") &&
      lecturer.expertise.toLowerCase().includes("machine")
    ) {
      score += 10;
    }

    if (
      projectText.includes("web") &&
      lecturer.expertise.toLowerCase().includes("web")
    ) {
      score += 10;
    }

    if (
      projectText.includes("database") &&
      lecturer.expertise.toLowerCase().includes("database")
    ) {
      score += 10;
    }

    if (
      projectText.includes("iot") &&
      lecturer.expertise.toLowerCase().includes("iot")
    ) {
      score += 10;
    }

    if (
      projectText.includes("software") &&
      lecturer.expertise.toLowerCase().includes("software")
    ) {
      score += 10;
    }

    score = Math.min(score, 95);

    return {
      user_id: lecturer.user_id,
      name: lecturer.name,
      title: lecturer.is_utm_staff ? "UTM Academic Staff" : "External Examiner / Lecturer",
      faculty: lecturer.affiliation || "Faculty of Computing",
      department: "Software Engineering",
      email: lecturer.email,
      phone: lecturer.phone,
      expertise: lecturer.expertise,
      score,
      workload: "Available",
      recentProjects: [
        "Academic Management System",
        "Student Monitoring Dashboard",
        "Assessment Workflow Platform",
      ],
      reason:
        "This lecturer is recommended because their expertise contains keywords related to the submitted project title, abstract, or project keywords.",
      status: score >= 90 ? "Best Match" : score >= 80 ? "Recommended" : "Alternative",
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

// ------------------------------------------------------------
// Ollama Cloud supervisor matching
// ------------------------------------------------------------
async function ollamaSupervisorMatch(project, lecturers) {
  if (!OLLAMA_API_KEY) {
    return simpleFallbackMatch(project, lecturers);
  }

  const lecturerListText = lecturers
    .map(
      (lecturer, index) => `
${index + 1}. user_id: ${lecturer.user_id}
Name: ${lecturer.name}
Email: ${lecturer.email}
Phone: ${lecturer.phone}
Affiliation: ${lecturer.affiliation}
Expertise: ${lecturer.expertise}
`
    )
    .join("\n");

  const membersText =
    Array.isArray(project.members) && project.members.length > 0
      ? project.members
          .map(
            (member, index) =>
              `${index + 1}. ${member.name || "Unknown"} (${member.matricNo || "No matric"})`
          )
          .join("\n")
      : project.memberText || project.studentName || "Not provided";

  const prompt = `
You are an AI supervisor matching engine for I-FAMOUS, an Intelligent FYP Assessment Management and Outcome System.

Important:
A proposal may be an individual project or a group project. Match the supervisor based on the PROJECT CONTENT, not based on the number of students.

Your task:
Rank the best 3 supervisors for the FYP project based on project title, abstract, keywords, and lecturer expertise.

Project members:
${membersText}

Project information:
Project Type: ${project.projectType || "Not provided"}
Project Title: ${project.projectTitle || "Not provided"}
Keywords: ${project.keywords || "Not provided"}
Abstract:
${project.abstract || "Not provided"}

Lecturer candidates:
${lecturerListText}

Return ONLY valid JSON.
Do not include markdown.
Do not include explanation outside JSON.

JSON format:
[
  {
    "rank": 1,
    "user_id": 123,
    "name": "Lecturer Name",
    "title": "Senior Lecturer",
    "faculty": "Faculty of Computing",
    "department": "Software Engineering",
    "email": "email@example.com",
    "phone": "phone number",
    "expertise": "expertise text",
    "score": 94,
    "workload": "Available",
    "recentProjects": ["Project 1", "Project 2", "Project 3"],
    "reason": "Short reason why this lecturer matches the project.",
    "status": "Best Match"
  }
]

Rules:
- Score must be between 0 and 100.
- Rank must be 1, 2, and 3.
- Use only lecturers from the candidate list.
- Match based on semantic relevance, not exact keywords only.
- If project involves AI, NLP, recommendation, automation, or data analysis, prioritize lecturers with AI/ML/Data expertise.
- If project involves web system, dashboard, software architecture, or backend, prioritize Software Engineering/Web/System lecturers.
- If project involves database or academic records, prioritize Database/Information System lecturers.
`;

  const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OLLAMA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: "You are a strict JSON generator. Always return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      options: {
        temperature: 0.2,
        num_predict: 1800,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Ollama supervisor matching error:", errorText);
    return simpleFallbackMatch(project, lecturers);
  }

  const data = await response.json();
  const aiText = data.message?.content || "";

  try {
    const parsed = JSON.parse(aiText);

    if (!Array.isArray(parsed)) {
      throw new Error("AI response is not an array");
    }

    return parsed.slice(0, 3).map((item, index) => ({
      rank: index + 1,
      user_id: item.user_id || null,
      name: item.name || "Unknown Lecturer",
      title: item.title || "Lecturer",
      faculty: item.faculty || "Faculty of Computing",
      department: item.department || "Software Engineering",
      email: item.email || "-",
      phone: item.phone || "-",
      expertise: item.expertise || "General academic supervision",
      score: Number(item.score) || 75,
      workload: item.workload || "Available",
      recentProjects: Array.isArray(item.recentProjects)
        ? item.recentProjects
        : ["Academic Management System", "Student Dashboard", "Assessment Platform"],
      reason:
        item.reason ||
        "This lecturer is recommended based on project similarity and lecturer expertise.",
      status:
        item.status ||
        (index === 0 ? "Best Match" : index === 1 ? "Recommended" : "Alternative"),
    }));
  } catch (parseError) {
    console.error("Failed to parse Ollama JSON:", parseError);
    console.error("Raw AI text:", aiText);
    return simpleFallbackMatch(project, lecturers);
  }
}

// ------------------------------------------------------------
// Extract text from uploaded proposal file
// ------------------------------------------------------------
async function extractTextFromFile(file) {
  if (!file) {
    throw new Error("No file uploaded.");
  }

  const fileName = file.originalname || "";
  const mimeType = file.mimetype || "";
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".txt") || mimeType.includes("text/plain")) {
    return file.buffer.toString("utf8");
  }

  if (
    lowerName.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || "";
  }

  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    const result = await pdfParse(file.buffer);
    return result.text || "";
  }

  throw new Error("Unsupported file type. Please upload .txt, .docx, or .pdf file.");
}

// ------------------------------------------------------------
// Extract multiple members using simple regex
// ------------------------------------------------------------
function extractMembersSimple(rawText) {
  const text = String(rawText || "").replace(/\r/g, "");
  const members = [];
  const seen = new Set();

  const memberRegex =
    /(?:^|\n)\s*(?:\d+[\.\)]\s*)?([A-Z][A-Z\s'@\/\.-]{5,}?)\s*(?:\(|-|–|—)?\s*(A\d{2}[A-Z]{2}\d{4})\s*\)?/gim;

  let match;

  while ((match = memberRegex.exec(text)) !== null) {
    const name = String(match[1] || "")
      .replace(/MEMBERS?:/gi, "")
      .replace(/NAME/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const matricNo = String(match[2] || "").trim().toUpperCase();

    if (!name || !matricNo) continue;

    const key = matricNo;
    if (seen.has(key)) continue;

    seen.add(key);
    members.push({
      name,
      matricNo,
    });
  }

  return members;
}

// ------------------------------------------------------------
// Simple proposal field extraction
// ------------------------------------------------------------
function simpleProposalFieldExtraction(rawText) {
  const text = String(rawText || "").replace(/\r/g, "").trim();

  const getAfterLabel = (labels) => {
    for (const label of labels) {
      const regex = new RegExp(
        `${label}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*(Members|Student Name|Matric|Metric|Project Type|Project Title|Title|Abstract|Problem Statement|Keywords|Project Objectives|Implementation)\\s*[:\\-]|$)`,
        "i"
      );

      const match = text.match(regex);

      if (match && match[1]) {
        return match[1].trim().replace(/\n+/g, " ");
      }
    }

    return "";
  };

  const members = extractMembersSimple(text);
  const memberText = members
    .map((member, index) => `${index + 1}. ${member.name} (${member.matricNo})`)
    .join("\n");

  let studentName = members[0]?.name || getAfterLabel(["Student Name", "Name"]);
  let matricNo =
    members[0]?.matricNo ||
    getAfterLabel(["Matric Number", "Metric Number", "Matric No", "Metric No"]);

  let projectType = getAfterLabel(["Project Type"]);
  let projectTitle = getAfterLabel(["Project Title", "Title"]);
  let abstract = getAfterLabel(["Abstract", "Problem Statement"]);
  let keywords = getAfterLabel(["Keywords", "Keyword"]);

  if (!projectTitle) {
    const titleMatch = text.match(/Project Title\s*:\s*(.+)/i);
    if (titleMatch) {
      projectTitle = titleMatch[1].trim();
    }
  }

  if (!projectTitle) {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const titleLine = lines.find((line) =>
      /system|application|platform|dashboard|ai|iot|management|advisor|audit|prediction|classification|detection/i.test(
        line
      )
    );

    projectTitle = titleLine || lines[0] || "";
  }

  if (!abstract) {
    const problemStart = text.search(/Problem Statement/i);

    if (problemStart >= 0) {
      abstract = text.slice(problemStart).replace(/Problem Statement\s*[:\-]?/i, "").trim();
    } else {
      const abstractStart = text.search(/Abstract/i);

      if (abstractStart >= 0) {
        abstract = text.slice(abstractStart).replace(/Abstract\s*[:\-]?/i, "").trim();
      } else {
        abstract = text.slice(0, 1800);
      }
    }
  }

  if (!keywords) {
    const keywordCandidates = [];
    const lower = text.toLowerCase();

    const possibleKeywords = [
      "artificial intelligence",
      "machine learning",
      "data analytics",
      "supervisor matching",
      "fyp management",
      "scheduling",
      "dashboard",
      "software engineering",
      "database",
      "web application",
      "automation",
      "iot",
      "academic information system",
      "vue.js",
      "vue",
      "state management",
      "academic advisor",
      "credit audit",
      "pinia",
    ];

    possibleKeywords.forEach((keyword) => {
      if (lower.includes(keyword)) keywordCandidates.push(keyword);
    });

    keywords = keywordCandidates.join(", ");
  }

  return {
    studentName,
    matricNo,
    members,
    memberText,
    projectType: projectType || "Development",
    projectTitle,
    abstract,
    keywords,
    rawText: text,
  };
}

// ------------------------------------------------------------
// Ollama Cloud extraction for proposal fields
// ------------------------------------------------------------
async function ollamaExtractProposalFields(rawText) {
  const simple = simpleProposalFieldExtraction(rawText);

  if (!OLLAMA_API_KEY) {
    return {
      source: "fallback",
      ...simple,
    };
  }

  const prompt = `
You are an information extraction assistant for I-FAMOUS.

A proposal may contain one student or multiple group members.

Extract proposal information from the text below.

Return ONLY valid JSON.
No markdown.
No explanation.

JSON format:
{
  "members": [
    { "name": "student full name", "matricNo": "matric number" }
  ],
  "studentName": "first/main student name or empty string",
  "matricNo": "first/main matric number or empty string",
  "projectType": "Development or Research or empty string",
  "projectTitle": "project title",
  "abstract": "clean abstract/problem statement/synopsis text",
  "keywords": "comma-separated keywords"
}

Extraction rules:
- If there is a MEMBERS section, extract all listed members.
- Matric number usually looks like A24MJ5074.
- Project title may appear after "Project Title:".
- If there is no Abstract section, use Problem Statement or Project Synopsis as abstract.
- Do not invent members.
- Do not invent matric numbers.
- Keep abstract concise but informative.

Proposal text:
${String(rawText || "").slice(0, 10000)}
`;

  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content: "You are a strict JSON generator. Always return valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        options: {
          temperature: 0.1,
          num_predict: 1800,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama proposal extraction error:", errorText);

      return {
        source: "fallback",
        ...simple,
      };
    }

    const data = await response.json();
    const aiText = data.message?.content || "";
    const parsed = JSON.parse(aiText);

    const parsedMembers = Array.isArray(parsed.members) ? parsed.members : [];
    const finalMembers = parsedMembers.length > 0 ? parsedMembers : simple.members;

    return {
      source: "ollama",
      members: finalMembers,
      memberText: finalMembers
        .map(
          (member, index) =>
            `${index + 1}. ${member.name || ""} (${member.matricNo || ""})`
        )
        .join("\n"),
      studentName: parsed.studentName || finalMembers[0]?.name || simple.studentName,
      matricNo: parsed.matricNo || finalMembers[0]?.matricNo || simple.matricNo,
      projectType: parsed.projectType || simple.projectType || "Development",
      projectTitle: parsed.projectTitle || simple.projectTitle,
      abstract: parsed.abstract || simple.abstract,
      keywords: parsed.keywords || simple.keywords,
      rawText: String(rawText || ""),
    };
  } catch (error) {
    console.error("Failed to extract proposal fields with Ollama:", error);

    return {
      source: "fallback",
      ...simple,
    };
  }
}

// ------------------------------------------------------------
// Helper: format project record
// ------------------------------------------------------------
function formatProjectRecord(row) {
  let members = [];

  try {
    if (Array.isArray(row.members_json)) {
      members = row.members_json;
    } else if (typeof row.members_json === "string") {
      members = JSON.parse(row.members_json);
    } else if (row.members_json) {
      members = row.members_json;
    }
  } catch {
    members = [];
  }

  members = members.filter((member) => member && member.name);

  return {
    project_id: row.project_id,
    projectTitle: row.project_title,
    projectType: row.project_type,
    abstract: row.abstract,
    keywords: row.keywords,
    supervisor: {
      user_id: row.supervisor_user_id,
      name: row.supervisor_name,
      email: row.supervisor_email,
      expertise: row.supervisor_expertise,
    },
    matchScore: row.match_score,
    status: row.status,
    members,
    memberCount: members.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ------------------------------------------------------------
// POST: Extract proposal fields from uploaded file
// ------------------------------------------------------------
router.post(
  "/api/supervisor-matching/extract-proposal",
  upload.single("proposal"),
  async (req, res) => {
    try {
      const rawText = await extractTextFromFile(req.file);

      if (!rawText || rawText.trim().length < 20) {
        return res.status(400).json({
          success: false,
          error:
            "Could not extract enough text from this file. If this is a scanned PDF/image, OCR is required.",
        });
      }

      const extracted = await ollamaExtractProposalFields(rawText);

      res.json({
        success: true,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        extractionSource: extracted.source,
        extracted,
      });
    } catch (error) {
      console.error("Proposal extraction error:", error);

      res.status(500).json({
        success: false,
        error: error.message || "Failed to extract proposal file.",
      });
    }
  }
);

// ------------------------------------------------------------
// POST: AI Supervisor Matching
// ------------------------------------------------------------
router.post("/api/supervisor-matching/match", async (req, res) => {
  try {
    const project = req.body;

    if (!project.projectTitle && !project.abstract && !project.keywords) {
      return res.status(400).json({
        success: false,
        error: "Project title, abstract, or keywords are required.",
      });
    }

    let lecturers = await getLecturerCandidates();

    if (!lecturers.length) {
      lecturers = [
        {
          user_id: 4017,
          name: "Ts. Dr. Wong Mei Ling",
          email: "wong.meiling@utm.my",
          phone: "+60 13-555 6789",
          expertise: "Artificial Intelligence, Machine Learning, Data Analytics",
          affiliation: "Faculty of Computing",
          is_utm_staff: 1,
        },
        {
          user_id: 4019,
          name: "Dr. David Kumar",
          email: "david.kumar@utm.my",
          phone: "+60 12-444 8912",
          expertise: "Software Engineering, Web Application, System Architecture",
          affiliation: "Faculty of Computing",
          is_utm_staff: 1,
        },
        {
          user_id: 4020,
          name: "Dr. Lim Wei Jie",
          email: "lim.weijie@utm.my",
          phone: "+60 11-222 7634",
          expertise: "Database Systems, Academic Information Systems, Automation",
          affiliation: "Faculty of Computing",
          is_utm_staff: 1,
        },
      ];
    }

    const recommendations = await ollamaSupervisorMatch(project, lecturers);

    res.json({
      success: true,
      source: OLLAMA_API_KEY ? "ollama" : "fallback",
      project,
      recommendations,
    });
  } catch (error) {
    console.error("Supervisor matching route error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to perform supervisor matching.",
      details: error.message,
    });
  }
});

// ------------------------------------------------------------
// POST: Assign supervisor to project
// Workflow 6, 7, 8, 9
// ------------------------------------------------------------
router.post("/api/supervisor-matching/assign", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { projectId, project, supervisor } = req.body;

    if (!project) {
      return res.status(400).json({
        success: false,
        error: "Project data is required.",
      });
    }

    if (!supervisor) {
      return res.status(400).json({
        success: false,
        error: "Supervisor data is required.",
      });
    }

    if (!project.projectTitle) {
      return res.status(400).json({
        success: false,
        error: "Project title is required.",
      });
    }

    await connection.beginTransaction();

    let finalProjectId = projectId ? Number(projectId) : null;

    if (finalProjectId) {
      // Update existing student-submitted project
      await connection.execute(
        `
        UPDATE fyp_projects
        SET
          project_title = ?,
          project_type = ?,
          abstract = ?,
          keywords = ?,
          supervisor_user_id = ?,
          supervisor_name = ?,
          supervisor_email = ?,
          supervisor_expertise = ?,
          match_score = ?,
          status = 'Pending Supervisor Approval',
          updated_at = NOW()
        WHERE project_id = ?
        `,
        [
          project.projectTitle,
          project.projectType || "Development",
          project.abstract || "",
          project.keywords || "",
          supervisor.user_id || null,
          supervisor.name || "",
          supervisor.email || "",
          supervisor.expertise || "",
          Number(supervisor.score) || 0,
          finalProjectId,
        ]
      );
    } else {
      // Fallback for old manual/demo proposal flow
      const [projectResult] = await connection.execute(
        `
        INSERT INTO fyp_projects (
          project_title,
          project_type,
          abstract,
          keywords,
          supervisor_user_id,
          supervisor_name,
          supervisor_email,
          supervisor_expertise,
          match_score,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Supervisor Approval', NOW(), NOW())
        `,
        [
          project.projectTitle,
          project.projectType || "Development",
          project.abstract || "",
          project.keywords || "",
          supervisor.user_id || null,
          supervisor.name || "",
          supervisor.email || "",
          supervisor.expertise || "",
          Number(supervisor.score) || 0,
        ]
      );

      finalProjectId = projectResult.insertId;

      const members = Array.isArray(project.members) ? project.members : [];
      for (const member of members) {
        if (!member.name && !member.matricNo) continue;

        await connection.execute(
          `
          INSERT INTO fyp_project_members (
            project_id,
            student_name,
            matric_no
          )
          VALUES (?, ?, ?)
          `,
          [finalProjectId, member.name || "Unnamed Student", member.matricNo || ""]
        );
      }
    }

    // Get project/student info for notifications
    const [projectRows] = await connection.execute(
      `
      SELECT
        fp.project_id,
        fp.project_title,
        fp.student_name,
        fp.matric_no,
        fp.student_user_id,
        u.email AS student_email
      FROM fyp_projects fp
      LEFT JOIN users u ON u.user_id = fp.student_user_id
      WHERE fp.project_id = ?
      LIMIT 1
      `,
      [finalProjectId]
    );

    const savedProject = projectRows[0] || {};

    // Supervisor notification
    await connection.execute(
      `
      INSERT INTO fyp_notifications (
        project_id,
        recipient_type,
        recipient_name,
        recipient_email,
        title,
        message,
        is_read,
        created_at
      )
      VALUES (?, 'Supervisor', ?, ?, ?, ?, 0, NOW())
      `,
      [
        finalProjectId,
        supervisor.name || "Supervisor",
        supervisor.email || "",
        "New FYP Supervision Assignment",
        `You have been assigned to supervise the project "${savedProject.project_title || project.projectTitle}".`,
      ]
    );

    // Coordinator notification
    await connection.execute(
      `
      INSERT INTO fyp_notifications (
        project_id,
        recipient_type,
        recipient_name,
        recipient_email,
        title,
        message,
        is_read,
        created_at
      )
      VALUES (?, 'Coordinator', 'Coordinator', '', ?, ?, 0, NOW())
      `,
      [
        finalProjectId,
        "Supervisor Assignment Completed",
        `You assigned ${supervisor.name} as supervisor for the project "${savedProject.project_title || project.projectTitle}".`,
      ]
    );

    // Student notification
    if (savedProject.student_user_id || savedProject.student_email) {
      await connection.execute(
        `
        INSERT INTO fyp_notifications (
          project_id,
          recipient_type,
          recipient_name,
          recipient_email,
          title,
          message,
          is_read,
          created_at
        )
        VALUES (?, 'Student', ?, ?, ?, ?, 0, NOW())
        `,
        [
          finalProjectId,
          savedProject.student_name || "Student",
          savedProject.student_email || "",
          "FYP Supervisor Assigned",
          `Your project "${savedProject.project_title || project.projectTitle}" has been assigned to ${supervisor.name}.`,
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Supervisor assigned successfully.",
      assignment: {
        projectId: finalProjectId,
        supervisorId: supervisor.user_id || null,
        supervisorName: supervisor.name || "",
        supervisorEmail: supervisor.email || "",
        matchScore: Number(supervisor.score) || 0,
        status: "Pending Supervisor Approval",
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Assign supervisor error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to assign supervisor.",
      details: error.message,
    });
  } finally {
    connection.release();
  }
});


// GET: Project records
// ------------------------------------------------------------
router.get("/api/supervisor-matching/projects", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.project_id,
        p.project_title,
        p.project_type,
        p.abstract,
        p.keywords,
        p.supervisor_user_id,
        p.supervisor_name,
        p.supervisor_email,
        p.supervisor_expertise,
        p.match_score,
        p.status,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_ARRAYAGG(
            CASE
              WHEN m.member_id IS NULL THEN NULL
              ELSE JSON_OBJECT(
                'member_id', m.member_id,
                'name', m.student_name,
                'matricNo', m.matric_no
              )
            END
          ),
          JSON_ARRAY()
        ) AS members_json
      FROM fyp_projects p
      LEFT JOIN fyp_project_members m
        ON p.project_id = m.project_id
      GROUP BY
        p.project_id,
        p.project_title,
        p.project_type,
        p.abstract,
        p.keywords,
        p.supervisor_user_id,
        p.supervisor_name,
        p.supervisor_email,
        p.supervisor_expertise,
        p.match_score,
        p.status,
        p.created_at,
        p.updated_at
      ORDER BY p.created_at DESC
    `);

    const projects = rows.map((row) => formatProjectRecord(row));

    res.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Get project records error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load project records.",
      details: error.message,
    });
  }
});

// ------------------------------------------------------------
// GET: Notifications
// Supports:
// 1. ?all=true
// 2. ?recipientEmail=danielramlann@utm.my
// 3. ?recipientType=Coordinator
// 4. ?roles=Coordinator,Supervisor&email=danielramlann@utm.my
//
// Multi-role logic:
// - Coordinator can see all Coordinator notifications.
// - Supervisor can only see Supervisor notifications sent to their own email.
// - Student can only see Student notifications sent to their own email.
// - Examiner can only see Examiner notifications sent to their own email.
// ------------------------------------------------------------
router.get("/api/supervisor-matching/notifications", async (req, res) => {
  try {
    const {
      recipientEmail,
      recipientType,
      all,
      roles,
      email
    } = req.query;

    // ------------------------------------------------------------
    // Debug mode: show all notifications
    // Example:
    // /api/supervisor-matching/notifications?all=true
    // ------------------------------------------------------------
    if (all === "true") {
      const [rows] = await db.query(`
        SELECT
          notification_id,
          project_id,
          recipient_type,
          recipient_name,
          recipient_email,
          title,
          message,
          is_read,
          created_at
        FROM fyp_notifications
        ORDER BY created_at DESC, notification_id DESC
        LIMIT 50
      `);

      return res.json({
        success: true,
        notifications: rows.map((row) => ({
          notification_id: row.notification_id,
          project_id: row.project_id,
          recipientType: row.recipient_type,
          recipientName: row.recipient_name,
          recipientEmail: row.recipient_email,
          title: row.title,
          message: row.message,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        })),
      });
    }

    // ------------------------------------------------------------
    // Multi-role mode
    // Example:
    // /api/supervisor-matching/notifications?roles=Coordinator,Supervisor&email=danielramlann@utm.my
    //
    // For Daniel:
    // - Show all Coordinator notifications because Daniel is Coordinator.
    // - Show Supervisor notifications only if recipient_email = Daniel email.
    // ------------------------------------------------------------
    if (roles && email) {
      const roleList = String(roles)
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean);

      const roleConditions = [];
      const params = [];

      if (roleList.includes("Coordinator")) {
        roleConditions.push("(recipient_type = 'Coordinator')");
      }

      if (roleList.includes("Supervisor")) {
        roleConditions.push(
          "(recipient_type = 'Supervisor' AND LOWER(recipient_email) = LOWER(?))"
        );
        params.push(email);
      }

      if (roleList.includes("Student")) {
        roleConditions.push(
          "(recipient_type = 'Student' AND LOWER(recipient_email) = LOWER(?))"
        );
        params.push(email);
      }

      if (roleList.includes("Examiner")) {
        roleConditions.push(
          "(recipient_type = 'Examiner' AND LOWER(recipient_email) = LOWER(?))"
        );
        params.push(email);
      }

      if (roleConditions.length === 0) {
        return res.json({
          success: true,
          notifications: [],
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          notification_id,
          project_id,
          recipient_type,
          recipient_name,
          recipient_email,
          title,
          message,
          is_read,
          created_at
        FROM fyp_notifications
        WHERE ${roleConditions.join(" OR ")}
        ORDER BY created_at DESC, notification_id DESC
        LIMIT 50
        `,
        params
      );

      return res.json({
        success: true,
        notifications: rows.map((row) => ({
          notification_id: row.notification_id,
          project_id: row.project_id,
          recipientType: row.recipient_type,
          recipientName: row.recipient_name,
          recipientEmail: row.recipient_email,
          title: row.title,
          message: row.message,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        })),
      });
    }

    // ------------------------------------------------------------
    // Old/simple filter mode
    // Examples:
    // /api/supervisor-matching/notifications?recipientType=Coordinator
    // /api/supervisor-matching/notifications?recipientEmail=danielramlann@utm.my
    // /api/supervisor-matching/notifications?recipientType=Supervisor&recipientEmail=danielramlann@utm.my
    // ------------------------------------------------------------
    const whereParts = [];
    const params = [];

    if (recipientEmail) {
      whereParts.push("LOWER(recipient_email) = LOWER(?)");
      params.push(recipientEmail);
    }

    if (recipientType) {
      whereParts.push("recipient_type = ?");
      params.push(recipientType);
    }

    const whereSql =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `
      SELECT
        notification_id,
        project_id,
        recipient_type,
        recipient_name,
        recipient_email,
        title,
        message,
        is_read,
        created_at
      FROM fyp_notifications
      ${whereSql}
      ORDER BY created_at DESC, notification_id DESC
      LIMIT 50
      `,
      params
    );

    return res.json({
      success: true,
      notifications: rows.map((row) => ({
        notification_id: row.notification_id,
        project_id: row.project_id,
        recipientType: row.recipient_type,
        recipientName: row.recipient_name,
        recipientEmail: row.recipient_email,
        title: row.title,
        message: row.message,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load notifications.",
      details: error.message,
    });
  }
});

// ------------------------------------------------------------
// PATCH: Mark notification as read
// ------------------------------------------------------------
router.patch("/api/supervisor-matching/notifications/:notificationId/read", async (req, res) => {
  try {
    const { notificationId } = req.params;

    const [result] = await db.execute(
      `
      UPDATE fyp_notifications
      SET is_read = 1
      WHERE notification_id = ?
      `,
      [notificationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Notification not found.",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read.",
      details: error.message,
    });
  }
});

module.exports = router;
