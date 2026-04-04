# NeuroHire — AI CV Parsing & Autofill Module — Presentation Pack

Single structured document for FYP slides, diagrams, and technical reference. Based on the repository source code.

---

## 1. MODULE OVERVIEW

### What is this module?

The **AI CV Parsing & Autofill module** lets **candidates** upload a **PDF résumé**, optionally download a **Word template** for consistency, and use the backend to **extract text** (Python / PyMuPDF) and **structure it with an LLM** (Bytez, default `openai/gpt-4o`) into fields such as name, contact, education, skills, and experience. The UI **prefills** the job application form; on submit, **structured `extractedData`** is stored on the **Application** document for downstream **AI scoring**. A separate **template-validation** path uses the same Python service to compare CV content against **`CV_TEMPLATE.docx`** and return **rule-based** `extractedData` when valid.

### What problem does it solve?

- **Less manual typing:** Candidates avoid re-entering everything from a PDF.
- **Consistent structure for scoring:** Rich **`extractedData`** (nested education, skill arrays) aligns with the **application scoring** pipeline.
- **Quality guardrails:** Template download + optional format check encourage CVs that are easier to parse; the LLM refuses garbage documents by returning empty `{}`.

### FYP slide summary (2–3 lines)

> Candidates upload a **PDF CV**; the server **extracts text with Python** and uses an **LLM** to turn it into **structured JSON** that **fills the apply form** automatically. Parsed data is **saved with the application** so **AI ranking** can score skills, education, and experience fairly. A **downloadable Word template** helps applicants match the expected layout.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Full path | Role |
|-----------|------|
| `frontend/app/candidate/apply/[jobId]/page.js` | Job apply UI: CV upload, **download template**, **Autofill** (`autofillCV`), maps AI result to `formData`, sends **`extractedData`** on `submitApplication` |
| `frontend/lib/api.js` | `checkCVFormat`, `autofillCV`, `downloadCVTemplate` HTTP helpers |
| `frontend/lib/config.js` | Paths: `endpoints.cv.checkFormat`, `autofill`, `template` |
| `frontend/components/ProtectedRoute.jsx` | Wraps candidate apply flow |
| `frontend/lib/firebase.js` | Firebase auth for Bearer token |

**Note:** `checkCVFormat` is **exported from `api.js`** but **not imported** by `apply/[jobId]/page.js` in the current codebase—the **format-check API exists** for integration/testing but the live apply page uses **autofill** + template download only.

### Backend

| Full path | Role |
|-----------|------|
| `backend/routes/cv.js` | `POST /check-format`, `POST /autofill`, `GET /template` |
| `backend/controllers/cvController.js` | `verifyToken`, multer PDF upload, **checkCVFormat** (Python), **downloadCVTemplate**, **autofillCV** (Python text extract + Bytez) |
| `backend/services/cv_checker.py` | PyMuPDF PDF text extraction, template comparison, **`validate_cv_structure`**, **`extract_basic_info`** (regex); CLI JSON for check-format |
| `backend/index.js` | `app.use('/api/cv', cvRoutes)` |

### Database (consumer of parsed output)

| Full path | Role |
|-----------|------|
| `backend/models/Application.js` | **`formData`** (flat strings for UI), **`extractedData`** (Mixed — LLM/nested structure for scoring) |
| `backend/controllers/applicationController.js` | **`submitApplication`**: parses `extractedData` from multipart body or builds from `formData` |

### Config / assets / environment

| Full path | Role |
|-----------|------|
| `CV_TEMPLATE.docx` (project root) | Reference template for format check + **download** endpoint |
| `backend/uploads/cvs/` | Temporary PDF storage during check/autofill (files deleted after processing) |
| `backend/temp_extract.py` | **Runtime-generated** (not in repo): autofill writes a short Python script to stdout PDF text |
| `.env` | `BYTEZ_API_KEY`, `BYTEZ_MODEL` (optional; default model in code) |

### Dependencies

- **Node:** `bytez.js`, `multer`, `firebase-admin` (token verification)  
- **Python:** `python` / `python3` on server host; **`python-docx`**, **`PyMuPDF`** (`fitz`) per `cv_checker.py`  

**No** Mongoose migrations/seeders for this module.

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### 3A — Narrative (step-by-step)

**A) Download CV template (no login required on API)**

1. User clicks download template on **`/candidate/apply/[jobId]`** → **`handleDownloadCVTemplate`**.  
2. **`downloadCVTemplate()`** in **`api.js`** → **`GET /api/cv/template`** (blob response).  
3. **`cvController.downloadCVTemplate`** streams **`CV_TEMPLATE.docx`** from repo root via **`res.download`**.  
4. Browser saves **`CV-Template.docx`**.

**B) AI autofill (primary flow in production UI)**

1. Candidate selects a **PDF** → **`handleFileChange`** sets **`cvFile`**.  
2. User clicks **Autofill** → **`handleAutofill`**.  
3. Builds **`FormData`**, appends **`cv`** file → **`autofillCV(formData, idToken)`** → **`POST /api/cv/autofill`** with **`Authorization: Bearer <Firebase idToken>`** and **`multipart/form-data`**.  
4. **`cvController.verifyToken`** loads **`User`** from Mongo via **`firebaseUid`**.  
5. **Multer** saves PDF under **`uploads/cvs/`**.  
6. Backend writes a **temporary Python script** that imports **`extract_text_from_pdf`** from **`cv_checker.py`**, runs it, captures **stdout** as raw CV text (UTF-8 handling on Windows). Temp script removed; if extraction fails, PDF deleted → **500**.  
7. If text too short → **400**; else build a long **LLM prompt** (JSON schema: name, education object, skills array, etc.) with **`cvText.substring(0, 8000)`**.  
8. **`model.run([{ role: 'user', content: prompt }])`** (Bytez SDK) returns **`output`**; JSON parsed from response (strip markdown fences, regex `{...}`).  
9. Empty object or all-empty fields → **`res.json({ success: true, extractedData: {} })`** (invalid CV).  
10. Otherwise normalize **education**, **skills**, **languages** → **`res.json({ success: true, extractedData: result })`**, delete uploaded PDF.  
11. Frontend **`setExtractedData(extracted)`**, maps nested education/skills/languages into **flat `formData`** strings for inputs, switches tab to application, toast success.

**C) Submit application with parsed structure**

1. User submits form → **`handleSubmit`**.  
2. **`FormData`**: **`jobId`**, **`cv`** file, **`formData`** JSON string, optional **`extractedData`** JSON string if autofill ran.  
3. **`submitApplication`** → **`POST /api/applications/submit`** (see applications module).  
4. **`applicationController`** parses **`extractedData`** or synthesizes from **`formData`**, saves **`Application`** with **`cvPath`**, **`formData`**, **`extractedData`**.  
5. **Scoring service** later uses **`extractedData`** + **`JobPost.weightage`** (separate module).

**D) Check CV format (API present; not used by current apply page)**

1. Client would call **`checkCVFormat(FormData with cv, idToken)`** → **`POST /api/cv/check-format`**.  
2. **`checkCVFormat`** saves PDF, runs **`python cv_checker.py <cvPath> <CV_TEMPLATE.docx>`**, reads **stdout JSON**: **`isValid`**, **`message`**, optional **`extractedData`** from **`extract_basic_info`**, deletes PDF.  
3. Returns **`{ isValid, extractedData?, message }`**.

---

### 3B — Diagram tool prompt (copy-paste)

```
Generate a data flow diagram with swimlanes: Candidate Browser, Next.js Apply Page, Express API, Python (cv_checker), Bytez LLM, MongoDB (on submit).

Template download (no auth):
User clicks Download → GET /api/cv/template → read CV_TEMPLATE.docx → browser file save

Autofill:
User selects PDF + Autofill → POST /api/cv/autofill multipart cv + Bearer token
→ verifyToken → User in Mongo
→ multer saves PDF → Python extract_text_from_pdf (PyMuPDF) → cv text string
→ Bytez model.run(prompt with JSON schema) → parse JSON
→ if empty treat invalid CV else normalized extractedData JSON
→ DELETE temp PDF → response to browser
→ React setState form fields + extractedData for later submit

Submit application:
POST /api/applications/submit with cv + formData + optional extractedData JSON
→ Application document saved with formData and extractedData for AI scoring

Optional format check path:
POST /api/cv/check-format → python cv_checker.py validates sections vs template → JSON isValid + regex extractedData
```

---

## 4. KEY FRONTEND FUNCTIONS

### `downloadCVTemplate` — `frontend/lib/api.js`

**What it does:** Downloads the Word CV template as a blob and triggers browser save.

```javascript
export const downloadCVTemplate = async () => {
  try {
    const response = await api.get('/cv/template', {
      responseType: 'blob',
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'CV-Template.docx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to download CV template',
    };
  }
};
```

### `checkCVFormat` — `frontend/lib/api.js`

**What it does:** Posts PDF to backend template/structure validation (**available**; not wired on apply page in current code).

```javascript
export const checkCVFormat = async (formData, idToken) => {
  try {
    const response = await api.post('/cv/check-format', formData, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to check CV format',
    };
  }
};
```

### `autofillCV` — `frontend/lib/api.js`

**What it does:** Sends PDF for text extraction + LLM parsing.

```javascript
export const autofillCV = async (formData, idToken) => {
  try {
    const response = await api.post('/cv/autofill', formData, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to autofill CV',
    };
  }
};
```

### `handleDownloadCVTemplate` — `frontend/app/candidate/apply/[jobId]/page.js`

**What it does:** Calls API and shows toast on success/failure.

```javascript
  const handleDownloadCVTemplate = async () => {
    try {
      const result = await downloadCVTemplate();
      if (result.success) {
        toast.success("CV template downloaded successfully!");
      } else {
        toast.error(result.error || "Failed to download CV template");
      }
    } catch (error) {
      console.error("Error downloading CV template:", error);
      toast.error("Failed to download CV template");
    }
  };
```

### `handleAutofill` — `frontend/app/candidate/apply/[jobId]/page.js`

**What it does:** Uploads PDF for AI parse; validates non-empty result; fills form and stores **`extractedData`** for submit.

```javascript
  const handleAutofill = async () => {
    if (!cvFile) {
      toast.error("Please select a CV file first");
      return;
    }

    try {
      setParsing(true);
      const formData = new FormData();
      formData.append("cv", cvFile);

      const result = await autofillCV(formData, idToken);
      
      if (result.success && result.data.extractedData) {
        const extracted = result.data.extractedData;
        
        const isEmpty = !extracted || 
          Object.keys(extracted).length === 0 ||
          (
            (!extracted.firstName || extracted.firstName === '') &&
            (!extracted.lastName || extracted.lastName === '') &&
            (!extracted.email || extracted.email === '') &&
            (!extracted.phone || extracted.phone === '') &&
            (!extracted.address || extracted.address === '') &&
            (!extracted.experience || extracted.experience === '') &&
            (!extracted.projects || extracted.projects === '') &&
            (!extracted.skills || (Array.isArray(extracted.skills) && extracted.skills.length === 0)) &&
            (!extracted.languages || (Array.isArray(extracted.languages) && extracted.languages.length === 0)) &&
            (!extracted.education || 
              (typeof extracted.education === 'object' && 
               (!extracted.education.university || extracted.education.university === '') &&
               (!extracted.education.degree || extracted.education.degree === ''))) &&
            (!extracted.certificates || extracted.certificates === '')
          );

        if (isEmpty) {
          toast.error("Please upload a valid CV or fill the form manually. The uploaded file does not appear to be a valid CV.", {
            autoClose: 6000,
          });
          return;
        }
        
        setExtractedData(extracted);
        
        let educationStr = "";
        let cgpaStr = "";
        if (extracted.education) {
          if (typeof extracted.education === 'object' && extracted.education !== null) {
            const edu = extracted.education;
            const parts = [];
            if (edu.university) parts.push(edu.university);
            if (edu.degree) parts.push(edu.degree);
            if (edu.dateOfCompletion) parts.push(`(${edu.dateOfCompletion})`);
            educationStr = parts.join(' - ');
            cgpaStr = edu.cgpa || "";
          } else if (typeof extracted.education === 'string') {
            educationStr = extracted.education;
          }
        }
        
        let skillsStr = "";
        if (extracted.skills) {
          if (Array.isArray(extracted.skills)) {
            skillsStr = extracted.skills.join(', ');
          } else if (typeof extracted.skills === 'string') {
            skillsStr = extracted.skills;
          }
        }
        
        let languagesStr = "";
        if (extracted.languages) {
          if (Array.isArray(extracted.languages)) {
            languagesStr = extracted.languages.join(', ');
          } else if (typeof extracted.languages === 'string') {
            languagesStr = extracted.languages;
          }
        }
        
        setFormData({
          firstName: extracted.firstName || "",
          lastName: extracted.lastName || "",
          email: extracted.email || "",
          phone: extracted.phone || "",
          address: extracted.address || "",
          education: educationStr,
          cgpa: cgpaStr,
          experience: extracted.experience || "",
          projects: extracted.projects || "",
          skills: skillsStr,
          languages: languagesStr,
          certificates: extracted.certificates || "",
        });
        toast.success("CV parsed successfully! Please review and update the information.");
        setActiveTab("application");
      } else {
        toast.error(result.error || "Failed to parse CV");
      }
    } catch (error) {
      console.error("Error autofilling CV:", error);
      toast.error("Failed to parse CV");
    } finally {
      setParsing(false);
    }
  };
```

### `handleSubmit` (extractedData attachment) — `frontend/app/candidate/apply/[jobId]/page.js`

**What it does:** Sends **`extractedData`** JSON alongside **`formData`** when autofill was used.

```javascript
      const applicationFormData = new FormData();
      applicationFormData.append("jobId", jobId);
      applicationFormData.append("cv", cvFile);
      applicationFormData.append("formData", JSON.stringify(formData));
      
      if (extractedData) {
        applicationFormData.append("extractedData", JSON.stringify(extractedData));
      }

      const result = await submitApplication(applicationFormData, idToken);
```

---

## 5. KEY BACKEND FUNCTIONS

### `backend/routes/cv.js` (full)

```javascript
const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cvController');

router.post('/check-format', cvController.checkCVFormat);
router.post('/autofill', cvController.autofillCV);
router.get('/template', cvController.downloadCVTemplate);

module.exports = router;
```

### `verifyToken` (middleware) — `backend/controllers/cvController.js`

**What it does:** Verifies Firebase Bearer token and attaches **`req.user`** from **`User`** by **`firebaseUid`**.

*(Included in full file below; not exported separately.)*

### `checkCVFormat` — `backend/controllers/cvController.js`

**What it does:** Saves PDF, runs **`python cv_checker.py`**, returns **`isValid`** and optional **`extractedData`**, deletes temp file.

*(Included in full file below as **`exports.checkCVFormat`**.)*

### `downloadCVTemplate` — `backend/controllers/cvController.js`

**What it does:** Streams **`CV_TEMPLATE.docx`** from project root as **`CV-Template.docx`** (no auth).

*(Included in full file below.)*

### `autofillCV` — `backend/controllers/cvController.js`

**What it does:** PDF → Python **`extract_text_from_pdf`** → Bytez **`model.run`** with structured JSON prompt → normalize → **`{ success, extractedData }`**.

### Full `backend/controllers/cvController.js`

```javascript
const admin = require('../config/firebase');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Bytez LLM (default: openai/gpt-4o, override with BYTEZ_MODEL)
let Bytez, sdk, model;
try {
  Bytez = require('bytez.js');
  const key = process.env.BYTEZ_API_KEY;
  const modelId = process.env.BYTEZ_MODEL || 'openai/gpt-4o';
  if (key) {
    sdk = new Bytez(key);
    model = sdk.model(modelId);
  }
} catch (error) {
  console.error('LLM functionality will not work until bytez.js is installed.');
}

// Middleware to verify Firebase token and get user
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/cvs/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Check CV format using Python script
exports.checkCVFormat = [verifyToken, upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CV file uploaded' });
    }

    const cvPath = req.file.path;
    const pythonScriptPath = path.join(__dirname, '../services/cv_checker.py');
    const templatePath = path.join(__dirname, '../../CV_TEMPLATE.docx');

    let pythonCommand = 'python3';
    try {
      await execPromise('python3 --version');
    } catch {
      pythonCommand = 'python';
    }
    
    try {
      const { stdout, stderr } = await execPromise(
        `${pythonCommand} "${pythonScriptPath}" "${cvPath}" "${templatePath}"`
      );

      if (stderr && !stderr.includes('Warning')) {
        console.error('Python script error:', stderr);
        fs.unlinkSync(cvPath);
        return res.status(500).json({ error: 'Failed to process CV' });
      }

      const result = JSON.parse(stdout.trim());
      fs.unlinkSync(cvPath);

      if (result.isValid) {
        res.json({
          isValid: true,
          extractedData: result.extractedData,
          message: 'CV format is valid'
        });
      } else {
        res.json({
          isValid: false,
          message: result.message || 'CV format does not match the template'
        });
      }
    } catch (error) {
      console.error('Python script execution error:', error);
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(500).json({ error: 'Failed to process CV. Please ensure Python and required libraries are installed.' });
    }
  } catch (error) {
    console.error('Check CV format error:', error);
    res.status(500).json({ error: error.message || 'Failed to check CV format' });
  }
}];

// Download CV template
exports.downloadCVTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../../CV_TEMPLATE.docx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'CV template not found' });
    }

    res.download(templatePath, 'CV-Template.docx', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download template' });
      }
    });
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({ error: error.message || 'Failed to download template' });
  }
};

// Autofill CV using Bytez (default openai/gpt-4o)
exports.autofillCV = [
  verifyToken, 
  (req, res, next) => {
    upload.single('cv')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (err.message === 'Only PDF files are allowed') {
          return res.status(400).json({ error: 'Only PDF files are allowed' });
        }
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!model) {
        return res.status(503).json({ 
          error: 'LLM service not available. Please ensure bytez.js is installed and BYTEZ_API_KEY is set.' 
        });
      }

      console.log('Request received:', {
        hasFile: !!req.file,
        fileField: req.file?.fieldname,
        fileName: req.file?.originalname,
        bodyKeys: Object.keys(req.body || {}),
        contentType: req.headers['content-type']
      });

      if (!req.file) {
        console.error('No file in request:', {
          files: req.files,
          body: req.body,
          headers: req.headers
        });
        return res.status(400).json({ error: 'No CV file uploaded. Please ensure you are uploading a PDF file.' });
      }

    const cvPath = req.file.path;
    const cvPathAbsolute = path.resolve(cvPath);
    
    if (!fs.existsSync(cvPathAbsolute)) {
      return res.status(400).json({ error: 'Uploaded CV file not found' });
    }

    const pythonScriptPath = path.join(__dirname, '../services/cv_checker.py');

    let pythonCommand = 'python3';
    try {
      await execPromise('python3 --version');
    } catch {
      pythonCommand = 'python';
    }

    let cvText = '';
    try {
      const cvPathForPython = cvPathAbsolute.replace(/\\/g, '/');
      const servicesPath = path.join(__dirname, '../services').replace(/\\/g, '/');
      
      const pythonScript = `# -*- coding: utf-8 -*-
import sys
import os
import io

if sys.platform == 'win32':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

services_dir = r"${servicesPath}"
sys.path.insert(0, services_dir)
from cv_checker import extract_text_from_pdf
try:
    pdf_path = r"${cvPathForPython}"
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    text = extract_text_from_pdf(pdf_path)
    if text:
        text_clean = text.encode('utf-8', errors='replace').decode('utf-8')
        try:
            sys.stdout.buffer.write(text_clean.encode('utf-8'))
        except (AttributeError, ValueError):
            print(text_clean, end='', flush=True)
except Exception as e:
    error_msg = str(e).encode('utf-8', errors='replace').decode('utf-8')
    print(f"Error: {error_msg}", file=sys.stderr)
    sys.exit(1)
`;
      
      const tempScript = path.join(__dirname, '../temp_extract.py');
      fs.writeFileSync(tempScript, pythonScript, 'utf8');
      
      const projectRoot = path.join(__dirname, '../..');
      const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
      const { stdout, stderr } = await execPromise(
        `"${pythonCommand}" "${tempScript}"`,
        { 
          cwd: projectRoot,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024,
          env: env
        }
      );
      
      try {
        if (fs.existsSync(tempScript)) {
          fs.unlinkSync(tempScript);
        }
      } catch (e) {}
      
      if (stderr && !stderr.includes('Warning') && stderr.trim()) {
        console.error('Python stderr:', stderr);
        throw new Error(stderr);
      }
      
      cvText = stdout.trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(500).json({ error: 'Failed to extract text from CV. Please ensure the PDF contains readable text.' });
    }

    if (!cvText || cvText.length < 10) {
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(400).json({ error: 'CV file appears to be empty or could not be read' });
    }

    const prompt = `You are a professional CV parser. Extract the following information from the CV text provided below and return ONLY a valid JSON object with the following structure. If any field is not found, use an empty string "" or empty array [].

Required JSON structure:
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "address": "string",
  "education": {
    "university": "string",
    "degree": "string",
    "dateOfCompletion": "string",
    "cgpa": "string"
  },
  "experience": "string",
  "projects": "string",
  "skills": ["skill1", "skill2", "skill3"],
  "languages": ["language1", "language2"],
  "certificates": "string"
}

Instructions:
1. Extract firstName and lastName from the name field (split if needed)
2. Extract email address
3. Extract phone number (any format)
4. Extract address if available
5. Extract education details as nested object with:
   - university: name of the institution (e.g., "MIT", "Stanford University", "NUST", "FAST")
   - degree: degree name/type (e.g., "Bachelor of Science in Computer Science", "Master's in Data Science")
   - dateOfCompletion: date or year of completion (e.g., "2020", "May 2020", "2020-05")
   - cgpa: CGPA or GPA value if mentioned (e.g., "3.8", "3.75", "4.0"). Extract the numeric value only (with decimal point if applicable). If not found, use empty string ""
   If multiple degrees, extract the most recent/highest one
   IMPORTANT: Education must be returned as a nested object with these exact field names: university, degree, dateOfCompletion, cgpa
6. Extract work experience (companies, roles, duration, responsibilities) as a string
7. Extract projects (personal projects, academic projects, portfolio projects) as a string. Include project names, descriptions, technologies used, and outcomes if available
8. Extract skills as an array of strings (technical skills, soft skills). Skills in the CV are usually comma-separated, so split them into individual array elements. For example: "Python, JavaScript, React" should become ["Python", "JavaScript", "React"]
9. Extract languages as an array of strings (e.g., ["English", "Urdu", "Spanish"]). Include proficiency levels if mentioned (e.g., "English (Fluent)", "Spanish (Basic)")
10. Extract certificates and certifications as a string
11. If a field is not found, use empty string "" for strings, empty object {} for education, or empty array [] for skills/languages
12. Return ONLY the JSON object, no additional text or explanation

CRITICAL: Invalid CV Detection
- If the provided text is NOT a valid CV (e.g., random text, corrupted content, non-CV document, insufficient information, or clearly not a resume/CV), you MUST return an empty JSON object: {}
- A valid CV should contain at least basic personal information (name, email, or phone) and some professional/educational content
- If the text appears to be a CV but is missing critical information and cannot be properly parsed, return an empty JSON object: {}
- Only return structured data if you can confidently extract meaningful information from a legitimate CV document

CV Text:
${cvText.substring(0, 8000)}`;

    try {
      const { error, output } = await model.run([
        {
          "role": "user",
          "content": prompt
        }
      ]);

      if (error) {
        console.error('LLM Error:', error);
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
        return res.status(500).json({ 
          error: 'Failed to process CV with AI. Please try again.' 
        });
      }

      let extractedData = {};
      let outputText = '';
      
      if (typeof output === 'string') {
        outputText = output;
      } else if (output && typeof output === 'object') {
        if (output.content) {
          outputText = typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
        } else if (output.text) {
          outputText = typeof output.text === 'string' ? output.text : JSON.stringify(output.text);
        } else {
          outputText = JSON.stringify(output);
        }
      } else {
        outputText = String(output || '');
      }

      try {
        outputText = outputText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          extractedData = JSON.parse(outputText);
        }
      } catch (parseError) {
        console.error('Error parsing LLM output:', parseError);
        console.error('Output text:', outputText);
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
        return res.status(500).json({ 
          error: 'Failed to parse extracted data. Please try again.' 
        });
      }

      const isEmpty = !extractedData || 
        Object.keys(extractedData).length === 0 ||
        (
          (!extractedData.firstName || extractedData.firstName === '') &&
          (!extractedData.lastName || extractedData.lastName === '') &&
          (!extractedData.email || extractedData.email === '') &&
          (!extractedData.phone || extractedData.phone === '') &&
          (!extractedData.address || extractedData.address === '') &&
          (!extractedData.experience || extractedData.experience === '') &&
          (!extractedData.projects || extractedData.projects === '') &&
          (!extractedData.skills || (Array.isArray(extractedData.skills) && extractedData.skills.length === 0)) &&
          (!extractedData.languages || (Array.isArray(extractedData.languages) && extractedData.languages.length === 0)) &&
          (!extractedData.education || 
            (typeof extractedData.education === 'object' && 
             (!extractedData.education.university || extractedData.education.university === '') &&
             (!extractedData.education.degree || extractedData.education.degree === ''))) &&
          (!extractedData.certificates || extractedData.certificates === '')
        );

      if (isEmpty) {
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
        return res.json({
          success: true,
          extractedData: {}
        });
      }

      let educationData = extractedData.education || {};
      
      if (typeof educationData === 'string' && educationData) {
        try {
          educationData = JSON.parse(educationData);
        } catch {
          educationData = { degree: educationData, university: '', dateOfCompletion: '', cgpa: '' };
        }
      }
      
      if (typeof educationData !== 'object' || educationData === null) {
        educationData = {};
      }
      if (!educationData.university) educationData.university = '';
      if (!educationData.degree) educationData.degree = '';
      if (!educationData.dateOfCompletion) educationData.dateOfCompletion = '';
      if (!educationData.cgpa) educationData.cgpa = '';
      
      let skillsData = extractedData.skills || [];
      if (typeof skillsData === 'string' && skillsData) {
        skillsData = skillsData.split(',').map(s => s.trim()).filter(s => s);
      } else if (!Array.isArray(skillsData)) {
        skillsData = [];
      }

      let languagesData = extractedData.languages || [];
      if (typeof languagesData === 'string' && languagesData) {
        languagesData = languagesData.split(',').map(l => l.trim()).filter(l => l);
      } else if (!Array.isArray(languagesData)) {
        languagesData = [];
      }

      const result = {
        firstName: extractedData.firstName || '',
        lastName: extractedData.lastName || '',
        email: extractedData.email || '',
        phone: extractedData.phone || '',
        address: extractedData.address || '',
        education: educationData,
        experience: extractedData.experience || '',
        projects: extractedData.projects || '',
        skills: skillsData,
        languages: languagesData,
        certificates: extractedData.certificates || ''
      };

      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }

      res.json({
        success: true,
        extractedData: result
      });

    } catch (error) {
      console.error('Autofill CV error:', error);
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(500).json({ 
        error: 'Failed to process CV. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Autofill CV error:', error);
    res.status(500).json({ error: error.message || 'Failed to autofill CV' });
  }
}];

exports.upload = upload;
```

### `backend/services/cv_checker.py` (full)

```python
#!/usr/bin/env python3
"""
CV Format Checker
This script checks if an uploaded CV matches the required format template.
Uses basic PDF text extraction (PyMuPDF) for text extraction.
"""

import sys
import json
import os
from pathlib import Path

try:
    from docx import Document
    import fitz  # PyMuPDF for PDF processing
except ImportError as e:
    print(json.dumps({
        "isValid": False,
        "message": f"Missing required library: {str(e)}. Please install: pip install python-docx PyMuPDF"
    }), file=sys.stderr)
    sys.exit(1)

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file using PyMuPDF."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

def extract_text_from_docx(docx_path):
    """Extract text from DOCX file."""
    try:
        doc = Document(docx_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text
    except Exception as e:
        raise Exception(f"Failed to extract text from DOCX: {str(e)}")

def check_cv_format(cv_path, template_path):
    """Check if CV matches the template format."""
    try:
        cv_text = extract_text_from_pdf(cv_path)
        
        if not cv_text or len(cv_text.strip()) < 10:
            return {
                "isValid": False,
                "message": "CV file appears to be empty or could not be read. Please ensure the PDF contains text."
            }
        
        if not os.path.exists(template_path):
            has_required = validate_cv_structure(cv_text)
            if has_required:
                extracted_data = extract_basic_info(cv_text)
                return {
                    "isValid": True,
                    "extractedData": extracted_data,
                    "message": "CV format is valid"
                }
            else:
                return {
                    "isValid": False,
                    "message": "CV is missing required sections. Please use the provided template."
                }
        
        template_text = extract_text_from_docx(template_path)
        
        has_required = validate_cv_structure(cv_text)
        
        if has_required:
            extracted_data = extract_basic_info(cv_text)
            
            return {
                "isValid": True,
                "extractedData": extracted_data,
                "message": "CV format is valid"
            }
        else:
            return {
                "isValid": False,
                "message": "CV is missing required sections. Please use the provided template."
            }
                
    except Exception as e:
        return {
            "isValid": False,
            "message": f"Error processing CV: {str(e)}"
        }

def validate_cv_structure(cv_text):
    """Validate that CV has required sections."""
    cv_lower = cv_text.lower()
    
    has_name = any(keyword in cv_lower for keyword in ['name', 'full name', 'candidate'])
    has_email = '@' in cv_text or 'email' in cv_lower
    has_phone = any(keyword in cv_lower for keyword in ['phone', 'mobile', 'contact', 'tel'])
    has_education = any(keyword in cv_lower for keyword in ['education', 'qualification', 'degree', 'university'])
    has_experience = any(keyword in cv_lower for keyword in ['experience', 'work', 'employment', 'career'])
    
    return has_name and has_email and has_phone and has_education and has_experience

def extract_basic_info(cv_text):
    """Extract basic information from CV text using simple pattern matching."""
    import re
    
    data = {}
    
    email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', cv_text)
    if email_match:
        data['email'] = email_match.group(0)
    
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', cv_text)
    if phone_match:
        data['phone'] = phone_match.group(0)
    
    name_match = re.search(r'(?:name|full name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', cv_text, re.IGNORECASE)
    if name_match:
        data['name'] = name_match.group(1)
    else:
        first_line = cv_text.split('\n')[0].strip()
        if len(first_line) > 0 and len(first_line) < 50:
            data['name'] = first_line
    
    education_match = re.search(r'(?:education|qualification)[:\s]+(.*?)(?:\n\n|\n(?:experience|work|skills))', cv_text, re.IGNORECASE | re.DOTALL)
    if education_match:
        data['education'] = education_match.group(1).strip()
    
    experience_match = re.search(r'(?:experience|work history|employment)[:\s]+(.*?)(?:\n\n|\n(?:skills|projects|education))', cv_text, re.IGNORECASE | re.DOTALL)
    if experience_match:
        data['experience'] = experience_match.group(1).strip()
    
    skills_match = re.search(r'(?:skills|technical skills)[:\s]+(.*?)(?:\n\n|\n(?:languages|projects|education))', cv_text, re.IGNORECASE | re.DOTALL)
    if skills_match:
        data['skills'] = skills_match.group(1).strip()
    
    languages_match = re.search(r'(?:languages|language)[:\s]+(.*?)(?:\n\n|\n(?:projects|education|experience))', cv_text, re.IGNORECASE | re.DOTALL)
    if languages_match:
        data['languages'] = languages_match.group(1).strip()
    
    projects_match = re.search(r'(?:projects|project)[:\s]+(.*?)(?:\n\n|\n(?:education|experience|skills))', cv_text, re.IGNORECASE | re.DOTALL)
    if projects_match:
        data['projects'] = projects_match.group(1).strip()
    
    return data

def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "isValid": False,
            "message": "Usage: python cv_checker.py <cv_path> <template_path>"
        }))
        sys.exit(1)
    
    cv_path = sys.argv[1]
    template_path = sys.argv[2]
    
    if not os.path.exists(cv_path):
        print(json.dumps({
            "isValid": False,
            "message": f"CV file not found: {cv_path}"
        }))
        sys.exit(1)
    
    result = check_cv_format(cv_path, template_path)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
```

---

## 6. DATABASE MODEL / SCHEMA

### Full `backend/models/Application.js`

```javascript
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cvPath: {
    type: String,
    required: true
  },
  formData: {
    // Personal Information (Required)
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: '' },
    // Profile (Optional)
    education: { type: String, default: '' },
    cgpa: { type: String, default: '' },
    experience: { type: String, default: '' },
    projects: { type: String, default: '' },
    skills: { type: String, default: '' },
    languages: { type: String, default: '' },
    certificates: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'],
    default: 'pending'
  },
  extractedData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
    // Structure includes:
    // - education: { university, degree, dateOfCompletion, cgpa }
    // - skills: array
    // - experience, certificates: string
  },
  scores: {
    experience: { type: Number, default: 0 },
    projects: { type: Number, default: 0 },
    skills: { type: Number, default: 0 },
    certificates: { type: Number, default: 0 },
    education: { type: Number, default: 0 },
    languages: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  rankedAt: {
    type: Date,
    default: null
  },
  interviewInviteSentAt: { type: Date, default: null },
  selectedAsHire: { type: Boolean, default: false },
  trainingPlanPdfPath: { type: String, default: null },
}, {
  timestamps: true,
});

// Prevent duplicate applications
applicationSchema.index({ jobPost: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
```

### Most important fields

| Field | Why |
|--------|-----|
| **`formData`** | What the candidate **confirmed** in the UI (flat strings); required for display and fallback. |
| **`extractedData`** | **Structured** LLM output (nested education, skill **arrays**) used by **scoring** to compare against **JobPost** weighting. |
| **`cvPath`** | Stored path to uploaded PDF on disk for HR/audit (set on submit, not by CV module alone). |

---

## 7. API ENDPOINTS USED IN THIS MODULE

| Method | Endpoint | Controller function | Auth | Purpose |
|--------|----------|---------------------|------|---------|
| GET | `/api/cv/template` | `downloadCVTemplate` | **None** | Download **`CV-Template.docx`** |
| POST | `/api/cv/check-format` | `checkCVFormat` | Firebase Bearer | PDF + Python validation + regex **`extractedData`** |
| POST | `/api/cv/autofill` | `autofillCV` | Firebase Bearer | PDF → Python text → Bytez JSON → normalized **`extractedData`** |
| POST | `/api/applications/submit` | `submitApplication` | Firebase Bearer (route middleware) | Persists **`formData`**, **`extractedData`**, **`cvPath`** |

---

## 8. SLIDE-READY SUMMARY

- **One upload, smart forms:** Candidates drop a **PDF résumé** and the system **reads and structures** the content so fields **fill in automatically**—less typing, fewer mistakes.  
- **AI meets engineering:** Raw text is pulled out with **Python**, then a **large language model** turns it into **clean, structured data** names, contacts, education, and skills recruiters care about.  
- **Honest about bad files:** If the file is **not a real CV**, the system returns **no fake data**—users are nudged to **fix the document** or **type manually**.  
- **Ready for fair scoring:** The rich **parsed profile** is **saved with the application** so later **AI ranking** can judge each person against the **same job criteria**.  
- **Guided formatting:** A **free template download** helps applicants produce CVs that are **easier to read**—by people and by software.  
- **Secure handoff:** Only **logged-in candidates** can use **parse** endpoints; templates are **public** for convenience.

---

*End of document.*
