const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const multer = require('multer');
const Tesseract = require('tesseract.js');

const router = express.Router();

function shouldUseSsl() {
    return (
        process.env.DB_SSL === "true" ||
        String(process.env.DB_HOST || "").includes("aivencloud.com")
    );
}

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: shouldUseSsl()
        ? {
              rejectUnauthorized: false,
          }
        : undefined,
});

const JWT_SECRET = process.env.JWT_SECRET || 'ifamous-super-secret-key-2026';

const upload = multer({ storage: multer.memoryStorage() });

const SYSTEM_PROMPT = `You are the I-FAMOUS AI Assistant, a friendly and professional AI chatbot inside the Universiti Teknologi Malaysia (UTM) I-FAMOUS Final Year Project management system.

Your main job:
- Chat naturally with users.
- Help users understand and use the I-FAMOUS system.
- Explain coordinator features such as Dashboard, Manage Session, View Calendar, Add Time Table, Manage User, Manage FYP, Export, and Import.
- Help troubleshoot common problems such as no active session, calendar not loading, timetable not appearing, lecturer not found, AI/Ollama unavailable, database connection problems, and role permission issues.
- Give clear step-by-step guidance when needed.
- Keep answers short, helpful, and professional.
- If the user greets you, reply naturally and ask how you can help.
- Do not pretend to know private database records unless the user gives the details.
- Do not trigger action JSON for casual conversation.

I-FAMOUS system knowledge:
- Coordinator users can access the main dashboard.
- A session must be created and active before calendar and timetable data work properly.
- Timetable schedules can be added manually or extracted using AI upload.
- Staff/Lecturer users usually use @utm.my email.
- Normal external users may appear as outsiders.
- Student creation may require import or separate student data because the basic user form is mainly for staff/outsiders.
- The AI assistant uses Ollama Cloud with gemma4:31b-cloud for AI responses.
- If AI is unavailable, the cloud/local AI configuration may be missing or incorrect.

IMPORTANT:
Only output action JSON if the user clearly and explicitly asks you to perform that action.

ACTION: CREATE USER
If and only if the user clearly asks to create/add/register/make a new user, lecturer, staff, student, examiner, supervisor, or account, extract the details and output this JSON block at the very end of your message:
\`\`\`json
{"action": "CREATE_USER", "fullName": "<Name>", "email": "<Email>", "password": "<temp pass>", "phoneNumber": "<temp phone number>", "affiliation": "<title>", "coOrgName": "<org>", "expertise": "<expertise>"}
\`\`\`
If you do not know a field, leave it as an empty string. If no password is given, use "Temp1234!".

ACTION: AUTO SCHEDULE MEETINGS
If and only if the user clearly asks you to schedule, auto-assign, or arrange meetings, extract the settings and output this JSON block at the very end of your message:
\`\`\`json
{"action": "AUTO_SCHEDULE_MEETINGS", "startDate": "<YYYY-MM-DD>", "endDate": "<YYYY-MM-DD>", "duration": <Duration>, "allowedDays": [<Array of numbers 1-7, where 1 is Monday and 7 is Sunday>]}
\`\`\`
If dates are unclear, ask the user for the missing information instead of guessing.

For normal questions, greetings, explanations, troubleshooting, and general chat, do not output JSON.`;

function getLatestUserMessage(messages) {
    const latest = [...messages].reverse().find((message) => message.role === 'user');
    return latest?.content?.toLowerCase()?.trim() || '';
}

function userAskedToCreateUser(latestUserMessage) {
    return (
        /\b(create|add|register|make)\b.*\b(user|account|lecturer|staff|student|examiner|supervisor)\b/i.test(latestUserMessage) ||
        /\b(user|account|lecturer|staff|student|examiner|supervisor)\b.*\b(create|add|register|make)\b/i.test(latestUserMessage) ||
        /\b(create|add|register|make)\b.*\b(this|him|her|them)\b/i.test(latestUserMessage) ||
        /\b(name card|business card|profile card|card)\b.*\b(create|add|register|make)\b/i.test(latestUserMessage) ||
        /\b(create|add|register|make)\b.*\b(name card|business card|profile card|card)\b/i.test(latestUserMessage)
    );
}

function userAskedToSchedule(latestUserMessage) {
    return (
        /\b(schedule|auto schedule|auto-schedule|auto assign|auto-assign|arrange)\b.*\b(meeting|meetings|presentation|presentations|slot|slots)\b/i.test(latestUserMessage) ||
        /\b(meeting|meetings|presentation|presentations|slot|slots)\b.*\b(schedule|auto schedule|auto-schedule|auto assign|auto-assign|arrange)\b/i.test(latestUserMessage)
    );
}

function removeActionJson(replyContent) {
    let cleanReply = replyContent
        .replace(/```json\s*\{[\s\S]*?"action"\s*:\s*"CREATE_USER"[\s\S]*?\}\s*```/gi, '')
        .replace(/```json\s*\{[\s\S]*?"action"\s*:\s*"AUTO_SCHEDULE_MEETINGS"[\s\S]*?\}\s*```/gi, '')
        .replace(/\{[\s\S]*?"action"\s*:\s*"CREATE_USER"[\s\S]*?\}/gi, '')
        .replace(/\{[\s\S]*?"action"\s*:\s*"AUTO_SCHEDULE_MEETINGS"[\s\S]*?\}/gi, '')
        .trim();

    if (!cleanReply) {
        cleanReply = 'Hello! I am the I-FAMOUS AI Assistant. How can I help you today?';
    }

    return cleanReply;
}

function extractJsonBlock(replyContent) {
    const markdownMatch = replyContent.match(/```json\s*(\{[\s\S]*?\})\s*```/i);

    if (markdownMatch) {
        return JSON.parse(markdownMatch[1]);
    }

    const plainJsonMatch = replyContent.match(/(\{[\s\S]*?"action"[\s\S]*?\})/i);

    if (plainJsonMatch) {
        return JSON.parse(plainJsonMatch[1]);
    }

    return null;
}

function extractJsonFromText(replyContent) {
    let cleanReply = replyContent.trim();

    cleanReply = cleanReply
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();

    const firstBrace = cleanReply.indexOf('{');
    const lastBrace = cleanReply.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanReply = cleanReply.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleanReply);
}

function extractEmail(rawText) {
    const match = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : '';
}

function extractPhone(rawText) {
    const match = rawText.match(/(\+?6?0[\d\s-]{8,15})/);
    return match ? match[0].replace(/\s+/g, '') : '';
}

function titleCase(text) {
    return text
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractName(rawText) {
    const lines = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        const cleaned = line.replace(/[^a-zA-Z\s.'@-]/g, '').trim();
        const lower = cleaned.toLowerCase();

        if (
            cleaned.length >= 3 &&
            cleaned.length <= 60 &&
            !lower.includes('@') &&
            !lower.includes('email') &&
            !lower.includes('phone') &&
            !lower.includes('tel') &&
            !lower.includes('system') &&
            !lower.includes('solutions') &&
            !lower.includes('robotics') &&
            !lower.includes('automation') &&
            !lower.includes('software') &&
            !lower.includes('aura') &&
            /^[a-zA-Z\s.'-]+$/.test(cleaned)
        ) {
            return titleCase(cleaned);
        }
    }

    return '';
}

function extractCompany(rawText) {
    const lowerAll = rawText.toLowerCase();

    if (lowerAll.includes('aura tech system')) {
        return 'Aura Tech System';
    }

    const lines = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const companyKeywords = [
        'system',
        'systems',
        'tech',
        'technology',
        'sdn',
        'bhd',
        'solutions',
        'automation',
        'university',
        'universiti',
        'utm',
        'mjiit',
        'faculty',
        'institute',
    ];

    for (const line of lines) {
        const lower = line.toLowerCase();

        if (
            companyKeywords.some((keyword) => lower.includes(keyword)) &&
            !lower.includes('@') &&
            !lower.includes('ai-driven robotics') &&
            !lower.includes('software solutions') &&
            !lower.includes('iot automation')
        ) {
            return line.trim();
        }
    }

    return '';
}

function extractAffiliation(rawText, email = '') {
    const lower = rawText.toLowerCase();

    if (lower.includes('senior lecturer')) {
        return 'Senior Lecturer';
    }

    if (lower.includes('lecturer')) {
        return 'Lecturer';
    }

    if (lower.includes('professor')) {
        return 'Professor';
    }

    if (lower.includes('student')) {
        return 'Student';
    }

    if (lower.includes('founder')) {
        return 'Founder';
    }

    if (email.toLowerCase().endsWith('@utm.my')) {
        return 'UTM Staff';
    }

    return 'Industry Expert';
}

function extractExpertise(rawText) {
    const lower = rawText.toLowerCase();
    const expertise = [];

    if (lower.includes('ai') || lower.includes('artificial intelligence')) {
        expertise.push('Artificial Intelligence');
    }

    if (lower.includes('robotic') || lower.includes('robotics')) {
        expertise.push('Robotics');
    }

    if (lower.includes('software')) {
        expertise.push('Software Solutions');
    }

    if (lower.includes('iot')) {
        expertise.push('IoT Automation');
    }

    if (lower.includes('automation')) {
        expertise.push('Automation');
    }

    if (lower.includes('machine learning')) {
        expertise.push('Machine Learning');
    }

    if (lower.includes('computer vision')) {
        expertise.push('Computer Vision');
    }

    if (lower.includes('network')) {
        expertise.push('Networking');
    }

    if (lower.includes('cyber')) {
        expertise.push('Cybersecurity');
    }

    return [...new Set(expertise)];
}

async function extractProfileDataFromText(rawText) {
    const fallbackEmail = extractEmail(rawText);
    const fallbackData = {
        fullName: extractName(rawText),
        email: fallbackEmail,
        phoneNumber: extractPhone(rawText),
        affiliation: extractAffiliation(rawText, fallbackEmail),
        coOrgName: extractCompany(rawText),
        expertise: extractExpertise(rawText),
    };

    const prompt = `Convert the OCR text from a name card, business card, CV, or university profile card into strict JSON only.

OCR text:
"""
${rawText}
"""

Return only this JSON structure:
{
  "fullName": "",
  "email": "",
  "phoneNumber": "",
  "affiliation": "",
  "coOrgName": "",
  "expertise": []
}

Rules:
- Return JSON only.
- No markdown.
- No explanation.
- expertise must be an array.
- If a field is missing, use an empty string.
- If the card contains a job title such as Lecturer or Senior Lecturer, put it in affiliation.
- If the card contains a university, faculty, company, or organization, put it in coOrgName.
`;

    let aiData = null;

    try {
        const reply = await runOllama(
            [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            'chat'
        );

        aiData = extractJsonFromText(reply);
    } catch (aiErr) {
        console.error('AI profile JSON parse failed. Using OCR fallback:', aiErr.message);
    }

    const finalData = {
        fullName: aiData?.fullName || fallbackData.fullName || '',
        email: aiData?.email || fallbackData.email || '',
        phoneNumber: aiData?.phoneNumber || fallbackData.phoneNumber || '',
        affiliation: aiData?.affiliation || fallbackData.affiliation || '',
        coOrgName: aiData?.coOrgName || fallbackData.coOrgName || '',
        expertise:
            Array.isArray(aiData?.expertise) && aiData.expertise.length > 0
                ? aiData.expertise
                : fallbackData.expertise,
    };

    return finalData;
}

function normalizeCreateUserPayload(profileData) {
    return {
        action: 'CREATE_USER',
        fullName: profileData.fullName || '',
        email: profileData.email || '',
        password: 'Temp1234!',
        phoneNumber: profileData.phoneNumber || '',
        affiliation: profileData.affiliation || '',
        coOrgName: profileData.coOrgName || '',
        expertise: Array.isArray(profileData.expertise)
            ? profileData.expertise.join(', ')
            : profileData.expertise || '',
    };
}

function verifyCoordinator(req, callback) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return callback(new Error('Security Error: You are not logged in. Missing authentication token.'));
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        db.query(
            'SELECT 1 FROM coordinator c JOIN users u ON c.user_id = u.user_id WHERE c.user_id = ? LIMIT 1',
            [decoded.user_id],
            (err, results) => {
                if (err) {
                    return callback(new Error('Database error while checking coordinator permission.'));
                }

                if (!results || results.length === 0) {
                    return callback(new Error('Access Denied: You do not have coordinator privileges.'));
                }

                return callback(null, decoded);
            }
        );
    } catch (jwtErr) {
        return callback(new Error('Security Error: Invalid or expired authentication token.'));
    }
}

/*
|--------------------------------------------------------------------------
| AI Provider Function
|--------------------------------------------------------------------------
| Uses Ollama Cloud on Render when OLLAMA_API_KEY is available.
|
| Render Environment Variables:
| OLLAMA_API_URL=https://ollama.com
| OLLAMA_API_KEY=your_real_ollama_key
| OLLAMA_MODEL=gemma4:31b-cloud
| OLLAMA_CHAT_MODEL=gemma4:31b-cloud
| OLLAMA_VISION_MODEL=gemma4:31b-cloud
|
| For local testing, you may put the same variables in server/.env.
| server/.env is ignored by Git, so it will not be uploaded to GitHub.
|--------------------------------------------------------------------------
*/
async function runOllama(messages, mode = 'chat') {
    const selectedModel =
        mode === 'vision'
            ? process.env.OLLAMA_VISION_MODEL || process.env.OLLAMA_MODEL || 'gemma4:31b-cloud'
            : process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_MODEL || 'gemma4:31b-cloud';

    const ollamaPayload = {
        model: selectedModel,
        stream: false,
        messages,
        options: {
            temperature: 0.3,
        },
    };

    // Ollama Cloud for Render deployment
    if (process.env.OLLAMA_API_KEY) {
        const baseUrl = process.env.OLLAMA_API_URL || 'https://ollama.com';

        const ollamaCloudResponse = await axios.post(
            `${baseUrl}/api/chat`,
            ollamaPayload,
            {
                headers: {
                    Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return ollamaCloudResponse.data.message?.content || '';
    }

    // Local fallback for laptop development using local Ollama
    const ollamaResponse = await axios.post('http://localhost:11434/api/chat', ollamaPayload);
    return ollamaResponse.data.message?.content || '';
}

router.post('/api/assistant/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid message format' });
        }

        let combinedOcrText = '';

        for (let i = 0; i < messages.length; i++) {
            if (messages[i].images && messages[i].images.length > 0) {
                try {
                    const imgBuffer = Buffer.from(messages[i].images[0], 'base64');

                    const {
                        data: { text },
                    } = await Tesseract.recognize(imgBuffer, 'eng');

                    combinedOcrText += `\n${text}\n`;

                    messages[i].content += `\n[Image OCR Text Extracted]:\n${text}\n`;
                    delete messages[i].images;
                } catch (ocrErr) {
                    console.error('OCR Error:', ocrErr.message);
                }
            }
        }

        const latestUserMessage = getLatestUserMessage(messages);
        const shouldCreateUser = userAskedToCreateUser(latestUserMessage);
        const shouldSchedule = userAskedToSchedule(latestUserMessage);

        if (shouldCreateUser && combinedOcrText.trim().length > 0) {
            return verifyCoordinator(req, async (authErr) => {
                if (authErr) {
                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: authErr.message,
                        },
                    });
                }

                try {
                    const profileData = await extractProfileDataFromText(combinedOcrText);
                    const payload = normalizeCreateUserPayload(profileData);

                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: "I've extracted the user details from the uploaded name card/profile image. Please review and confirm below before I create the account.",
                            action: 'CONFIRM_CREATE_USER',
                            payload,
                        },
                    });
                } catch (extractErr) {
                    console.error('Name card extraction failed:', extractErr.message);

                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: 'I received the image, but I could not extract the user details clearly. Please upload a clearer name card or type the name and email.',
                        },
                    });
                }
            });
        }

        const ollamaMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
        ];

        let replyContent = await runOllama(ollamaMessages, 'chat');

        if (shouldCreateUser && replyContent.includes('"action": "CREATE_USER"')) {
            return verifyCoordinator(req, (authErr) => {
                if (authErr) {
                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: authErr.message,
                        },
                    });
                }

                try {
                    const parsedAction = extractJsonBlock(replyContent);

                    if (!parsedAction) {
                        return res.status(200).json({
                            success: true,
                            reply: {
                                role: 'assistant',
                                content: removeActionJson(replyContent),
                            },
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: "I've extracted the user details. Please review and confirm below before I create the account.",
                            action: 'CONFIRM_CREATE_USER',
                            payload: parsedAction,
                        },
                    });
                } catch (parseErr) {
                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: 'I can help create a user, but I could not read the user details clearly. Please provide the name and email.',
                        },
                    });
                }
            });
        }

        if (shouldSchedule && replyContent.includes('"action": "AUTO_SCHEDULE_MEETINGS"')) {
            return verifyCoordinator(req, (authErr) => {
                if (authErr) {
                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: authErr.message,
                        },
                    });
                }

                try {
                    const parsedAction = extractJsonBlock(replyContent);

                    if (!parsedAction) {
                        return res.status(200).json({
                            success: true,
                            reply: {
                                role: 'assistant',
                                content: removeActionJson(replyContent),
                            },
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: 'I can help you auto-schedule all meetings. Please review and confirm the settings below.',
                            action: 'CONFIRM_AUTO_SCHEDULE',
                            payload: parsedAction,
                        },
                    });
                } catch (parseErr) {
                    return res.status(200).json({
                        success: true,
                        reply: {
                            role: 'assistant',
                            content: 'I can help schedule meetings, but I need a clearer date range and duration first.',
                        },
                    });
                }
            });
        }

        replyContent = removeActionJson(replyContent);

        return res.status(200).json({
            success: true,
            reply: {
                role: 'assistant',
                content: replyContent,
            },
        });
    } catch (error) {
        console.error('AI Backend Error:', error.message);

        return res.status(500).json({
            success: false,
            error: 'AI Assistant is currently unavailable.',
        });
    }
});

router.post('/api/assistant/execute-user-creation', async (req, res) => {
    try {
        verifyCoordinator(req, async (authErr) => {
            if (authErr) {
                return res.status(403).json({ error: authErr.message });
            }

            const {
                email,
                password,
                fullName,
                phoneNumber,
                coOrgName,
                expertise,
                affiliation,
            } = req.body;

            if (!email || !fullName) {
                return res.status(400).json({
                    error: 'Full name and email are required.',
                });
            }

            const finalPassword = password || 'Temp1234!';
            const pepper = process.env.SECRET_PEPPER || '';
            const hashedPassword = await bcrypt.hash(finalPassword + pepper, 10);

            db.query(
                'CALL sp_signup_normal_user(?, ?, ?, ?, ?, ?, ?)',
                [
                    email,
                    hashedPassword,
                    fullName,
                    phoneNumber || null,
                    coOrgName || '',
                    expertise || '',
                    affiliation || '',
                ],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    return res.json({
                        success: true,
                        message: 'User created successfully!',
                    });
                }
            );
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

router.post('/api/assistant/analyze-timetable', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }

        console.log('Analyzing timetable image with OCR first...');

        const {
            data: { text },
        } = await Tesseract.recognize(req.file.buffer, 'eng');

        console.log('OCR Timetable Text:', text);

        if (!text || text.trim().length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Could not read enough text from the timetable image. Please upload a clearer image.',
            });
        }

        const prompt = `You are an expert AI system that converts OCR text from a university timetable image into strict JSON.

The OCR text below was extracted from a timetable image:

"""
${text}
"""

Your task:
1. Determine whether the OCR text is from a timetable or schedule.
2. Extract the timetable owner if available.
3. Extract weekly recurring schedule items.
4. Return ONLY valid JSON. No markdown. No explanation.

IMPORTANT:
If the text is not a timetable or schedule, return exactly:
{
  "error": "Not a timetable"
}

Expected JSON schema:
{
  "target_type": "Lecturer",
  "target_name": "Dr Daniel",
  "specific_events": [],
  "weekly_recurring": [
    {
      "day_of_week": 1,
      "day_name": "Monday",
      "slots": [
        {
          "start_time": "09:00",
          "end_time": "11:00",
          "label": "Advanced AI System - MJIIT Lab 2",
          "is_blocking": true
        }
      ]
    }
  ]
}

Rules:
- day_of_week must be number 1 to 7. Monday is 1, Tuesday is 2, Wednesday is 3, Thursday is 4, Friday is 5, Saturday is 6, Sunday is 7.
- specific_events should be an empty array unless there is an exact one-time date.
- weekly_recurring must group slots by day.
- Use 24-hour time format HH:MM.
- If a class spans 09:00-11:00, use start_time "09:00" and end_time "11:00".
- If the owner says TIMETABLE FOR LECTURER, target_type is "Lecturer".
- If the owner says TIMETABLE FOR STUDENT GROUP or section, target_type is "Section Class".
- If the owner cannot be found, use empty string for target_type and target_name.
- If OCR has small mistakes, infer the most likely timetable meaning.
- Return JSON only.`;

        const reply = await runOllama(
            [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            'chat'
        );

        let parsedJson;

        try {
            parsedJson = extractJsonFromText(reply);
        } catch (e) {
            console.error('Failed to parse JSON from AI response:', reply);

            return res.status(500).json({
                success: false,
                error: 'AI output was not valid JSON.',
                raw: reply,
                ocrText: text,
            });
        }

        if (parsedJson.error === 'Not a timetable') {
            return res.status(400).json({
                success: false,
                error: 'The provided image does not appear to be a valid timetable.',
                ocrText: text,
            });
        }

        if (!Array.isArray(parsedJson.specific_events)) {
            parsedJson.specific_events = [];
        }

        if (!Array.isArray(parsedJson.weekly_recurring)) {
            parsedJson.weekly_recurring = [];
        }

        if (!parsedJson.target_type) {
            parsedJson.target_type = '';
        }

        if (!parsedJson.target_name) {
            parsedJson.target_name = '';
        }

        return res.status(200).json({
            success: true,
            data: parsedJson,
            ocrText: text,
        });
    } catch (error) {
        console.error('AI Backend Error (analyze-timetable):', error.message);

        return res.status(500).json({
            success: false,
            error: 'AI Assistant is currently unavailable for image processing.',
        });
    }
});

router.post('/api/assistant/extract-user-profile', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const {
            data: { text },
        } = await Tesseract.recognize(req.file.buffer, 'eng');

        console.log('OCR Extracted Text:', text);

        const profileData = await extractProfileDataFromText(text);

        return res.status(200).json({
            success: true,
            data: profileData,
            ocrText: text,
        });
    } catch (error) {
        console.error('AI Backend Error (extract-user-profile):', error.message);

        return res.status(500).json({
            success: false,
            error: 'AI Assistant is currently unavailable for image processing.',
        });
    }
});

module.exports = router;
