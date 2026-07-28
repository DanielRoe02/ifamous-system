const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const Tesseract = require("tesseract.js");

function getPythonExecutable() {
  const isWindows = process.platform === "win32";
  const venvPython = isWindows
    ? path.join(__dirname, "..", "venv", "Scripts", "python.exe")
    : path.join(__dirname, "..", "venv", "bin", "python");

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return isWindows ? "python.exe" : "python3";
}

async function extractTimetableText(filePath, fileBuffer) {
  const pythonBin = getPythonExecutable();
  const scriptPath = path.join(__dirname, "..", "scripts", "parse_docling.py");

  return new Promise((resolve) => {
    execFile(
      pythonBin,
      [scriptPath, filePath],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      async (error, stdout, stderr) => {
        if (error || !stdout) {
          console.warn("[Docling Bridge] Docling failed or not ready. Falling back to Tesseract OCR...", error?.message || stderr);
          return resolve(await fallbackTesseract(fileBuffer));
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.success && result.markdown && result.markdown.trim().length > 10) {
            console.log("[Docling Bridge] Successfully extracted timetable table using Docling!");
            return resolve({
              source: "docling",
              text: result.markdown,
            });
          } else {
            console.warn("[Docling Bridge] Docling returned empty/error. Falling back to Tesseract OCR...", result.error);
            return resolve(await fallbackTesseract(fileBuffer));
          }
        } catch (parseErr) {
          console.warn("[Docling Bridge] Failed to parse script JSON output. Falling back to Tesseract OCR...", parseErr.message);
          return resolve(await fallbackTesseract(fileBuffer));
        }
      }
    );
  });
}

async function fallbackTesseract(buffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, "eng");
    return {
      source: "tesseract",
      text: text || "",
    };
  } catch (err) {
    console.error("[Docling Bridge] Tesseract OCR fallback failed:", err.message);
    return {
      source: "failed",
      text: "",
    };
  }
}

module.exports = {
  extractTimetableText,
};
