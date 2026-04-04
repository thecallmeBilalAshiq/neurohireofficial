# AI Onboarding & Training Module — Complete Presentation Material

**Project:** NeuroHire  
**Scope:** Post-hire **HR onboarding workspace**, **AI-generated 3-month training plans** tailored to role and skills, **PDF generation and storage**, and **secure download** for selected hires only.

---

## 1. MODULE OVERVIEW

### What is this module?

The **AI Onboarding & Training** module is the **post-selection** step where HR sees **all candidates marked as hired** (`selectedAsHire`) across their jobs, then—per hire—can **generate a personalized three-month training roadmap** using the same **LLM stack** (Bytez) as the rest of NeuroHire. The system turns that text into a **PDF** (via **pdfkit**), saves it under **`uploads/training-plans`**, stores the path on the **Application** document, and lets HR **download** the file with **Firebase-authenticated** requests.

### What problem does it solve?

New hires need **structured ramp-up** aligned with the **actual role** and **required skills**, but writing bespoke 12-week plans for every hire is **slow and inconsistent**. NeuroHire **automates the first draft** from **job + candidate context**, produces a **shareable PDF**, and keeps a **single source of truth** on the application record so HR can **regenerate** (new file + path) or **retrieve** the latest plan without manual document management.

### 2–3 line summary (FYP slide)

> After final hire, NeuroHire’s **Hire onboarding** screen lists every **selected hire**. HR clicks **Generate training plan** to call an **AI specialist prompt** that outputs a **12-week, industry-style roadmap**; the backend **renders a PDF**, saves it, and links it on the **application**. HR then **downloads** the PDF for the candidate or internal L&D—**role-scoped, HR-only**, and tied to **real job skills**.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Path | Role |
|------|------|
| `frontend/app/hr/hire-onboarding/page.js` | **Hire onboarding** UI: load hires, filter by job, **Generate training plan**, **Download PDF** |
| `frontend/lib/api.js` | `generateTrainingPlan`, `getOnboardingHires`, `getApiBaseUrl` (download URL base) |
| `frontend/lib/useHrDarkMode.js` | Dark/light preference for HR pages (used on onboarding screen) |
| `frontend/components/ProtectedRoute.jsx` | Wraps page with **`requiredRole="HR"`** |
| `frontend/lib/config.js` | `getBaseUrl()` → `${backend}/api` used indirectly by `api` client |
| `frontend/lib/firebase.js` | Firebase auth; `onAuthStateChanged` + ID token for API calls |
| `frontend/app/hr/dashboard/page.js` | **Navigation** entry: link/button to **Hire candidates onboarding** |
| `frontend/app/hr/job-posting/page.js` | **Navigation** entry: same link to onboarding |

### Backend

| Path | Role |
|------|------|
| `backend/controllers/applicationController.js` | **`generateTrainingPlan`**, **`downloadTrainingPlan`**, inline **`verifyToken`**, PDF write, `Application` update |
| `backend/controllers/llmController.js` | **`generateTrainingPlanContent`**, **`runBytez`**, **`extractTextFromOutput`** (LLM I/O helpers) |
| `backend/controllers/hirePipelineController.js` | **`getOnboardingHires`** — aggregates hired applications for the list API |
| `backend/routes/applications.js` | `POST /generate-training-plan/:applicationId`, `GET /training-plan/:applicationId/download` |
| `backend/routes/hirePipeline.js` | `GET /onboarding-hires` |
| `backend/middleware/verifyHr.js` | **`verifyToken` + `requireHR`** on hire-pipeline routes (onboarding list) |
| `backend/config/firebase.js` | Admin SDK — token verification (via User lookup) |

### Database (Mongoose)

| Path | Role |
|------|------|
| `backend/models/Application.js` | **`selectedAsHire`**, **`trainingPlanPdfPath`**, **`formData`**, refs to job/candidate |
| `backend/models/JobPost.js` | **`jobTitle`**, **`company`**, **`skills`**, **`createdBy`** — context for LLM + ownership checks |

### Config / dependencies

| Path | Role |
|------|------|
| `backend/package.json` | **`pdfkit`** (optional load in controller: `try { PDFDocument = require('pdfkit') }`) |
| Environment | **`BYTEZ_API_KEY`**, **`BYTEZ_MODEL`** — required for AI plan text; without them, generation returns **503** |
| Filesystem | **`uploads/training-plans/`** — generated PDFs (created at runtime if missing) |

**Note:** No SQL migrations; schemas live in Mongoose models.

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### Narrative (step-by-step)

1. **Upstream (prerequisite)** → Another module (**Finalize hire**) sets **`Application.selectedAsHire = true`** for chosen candidates and completes the job; those rows become eligible for this module.

2. **HR opens onboarding** → User navigates to **`/hr/hire-onboarding`** → **`ProtectedRoute`** ensures role **HR** → **`HireOnboardingContent`** mounts → **`onAuthStateChanged`** obtains Firebase **ID token** → **`getOnboardingHires(idToken)`** runs.

3. **List hires** → Frontend **`api.get('/hire-pipeline/onboarding-hires')`** → **`GET /api/hire-pipeline/onboarding-hires`** → **`hirePipelineController.getOnboardingHires`** runs → **`verifyToken` + `requireHR`** attach **`req.user`** → queries **`JobPost`** where **`createdBy = req.user._id`** and not deleted → collects **`jobIds`** → queries **`Application`** where **`jobPost ∈ jobIds`** and **`selectedAsHire: true`**, populates **candidate** and **jobPost** → maps rows to **`applicationId`, `jobTitle`, `company`, `candidateName`, `email`, `phone`, `congratulationsHireSentAt`, `trainingPlanPdfPath`** → **`res.json({ hires })`** → frontend sets **`hires`** state and renders cards; **filter by job** is client-side on that array.

4. **Generate AI training plan** → HR clicks **Generate training plan** → **`genPlan(applicationId)`** → **`generateTrainingPlan(applicationId, idToken)`** → **`POST /api/applications/generate-training-plan/:applicationId`** with **Bearer** token → **`applicationController.generateTrainingPlan`** runs → **`verifyToken`** loads **`User`** from Firebase UID → checks **`req.user.role === 'HR'`** → **`Application.findById(applicationId).populate('candidate','name')`** → **`JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id })`** (ensures HR owns the job) → checks **`application.selectedAsHire`** → calls **`generateTrainingPlanContent(application, jobPost)`** in **`llmController`**, which builds a **specialist prompt** (name, title, company, **skills** from **`JobPost.skills`**) → **`runBytez`** returns text → **`extractTextFromOutput`** normalizes → if null/empty, **503**; if **`pdfkit`** missing, **503**; else **PDFDocument** streams to **`uploads/training-plans/training-plan-{applicationId}-{timestamp}.pdf`** → line-by-line **sanitize** + write → **`application.trainingPlanPdfPath = filePath`** → **`application.save()`** on **`Application`** collection → **`res.json({ success, pdfPath, downloadUrl })`** → frontend toast success → **`getOnboardingHires`** again to refresh **`trainingPlanPdfPath`** so **Download PDF** appears.

5. **Download PDF** → HR clicks **Download PDF** (only if **`trainingPlanPdfPath`** truthy) → **`downloadPlan(applicationId, name)`** → **`fetch(`${getApiBaseUrl()}/applications/training-plan/${applicationId}/download`, { headers: Authorization })`** → **`GET /api/applications/training-plan/:applicationId/download`** → **`downloadTrainingPlan`** → HR role + **`Application.findById`** + **`JobPost.findOne` (ownership)** + resolve **absolute path** → **`res.sendFile`** with **`Content-Disposition: attachment`** → browser saves **`training-plan-{name}.pdf`**.

### Separate diagram prompt

> Generate a **data flow diagram** showing: **HR user** → **Hire onboarding page (ProtectedRoute HR)** → **GET /api/hire-pipeline/onboarding-hires** → **MongoDB JobPost + Application (selectedAsHire)** → **JSON hires list** → **UI cards**. Branch: **Generate** → **POST /api/applications/generate-training-plan/:id** → **verify HR + own job + selectedAsHire** → **LLM (Bytez) generateTrainingPlanContent** using **job title, company, skills, candidate name** → **PDF file on disk** → **update Application.trainingPlanPdfPath** → **response**. Branch: **Download** → **GET /api/applications/training-plan/:id/download** → **same auth/ownership checks** → **stream PDF file** → **HR browser download**.

---

## 4. KEY FRONTEND FUNCTIONS

### `generateTrainingPlan` — `frontend/lib/api.js`

**What it does:** POSTs to the backend to **generate and persist** a training-plan PDF for the given application.

```javascript
export const generateTrainingPlan = async (applicationId, idToken) => {
  try {
    const response = await api.post(`/applications/generate-training-plan/${applicationId}`, {}, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate training plan',
    };
  }
};
```

### `getOnboardingHires` — `frontend/lib/api.js`

**What it does:** Fetches all **selected hires** for the logged-in HR user (used to populate the onboarding list).

```javascript
export const getOnboardingHires = async (idToken) => {
  try {
    const response = await api.get('/hire-pipeline/onboarding-hires', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch',
    };
  }
};
```

### `getApiBaseUrl` — `frontend/lib/api.js`

**What it does:** Returns the API base URL (**includes `/api`**) for building the **download** `fetch` URL.

```javascript
export const getApiBaseUrl = () => config.api.getBaseUrl();
```

### `genPlan` — `frontend/app/hr/hire-onboarding/page.js`

**What it does:** Triggers **AI PDF generation**, then **reloads** the hires list so **`trainingPlanPdfPath`** updates the UI.

```javascript
const genPlan = async (applicationId) => {
  if (!idToken) return;
  setGenId(applicationId);
  try {
    const r = await generateTrainingPlan(applicationId, idToken);
    if (r.success) {
      toast.success("Training plan generated.");
      const token = await auth.currentUser.getIdToken();
      const r2 = await getOnboardingHires(token);
      if (r2.success) setHires(r2.data.hires || []);
    } else toast.error(r.error);
  } catch {
    toast.error("Failed");
  } finally {
    setGenId(null);
  }
};
```

### `downloadPlan` — `frontend/app/hr/hire-onboarding/page.js`

**What it does:** **Authenticated GET** of the PDF as a **blob**, then triggers a browser **download**.

```javascript
const downloadPlan = (applicationId, name) => {
  if (!idToken) return;
  fetch(`${getApiBaseUrl()}/applications/training-plan/${applicationId}/download`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      "ngrok-skip-browser-warning": "true",
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error("fail");
      return res.blob();
    })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `training-plan-${name || applicationId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => toast.error("Download failed"));
};
```

---

## 5. KEY BACKEND FUNCTIONS

### `verifyToken` (middleware) — `backend/controllers/applicationController.js`

**What it does:** Validates **Firebase Bearer token**, loads **`User`** by **`firebaseUid`**, sets **`req.user`** for downstream handlers (**generate/download** training plan).

```javascript
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
```

### `generateTrainingPlanContent` — `backend/controllers/llmController.js`

**What it does:** Calls **Bytez** with an **HR training specialist** prompt; returns **plain text** for PDF layout (or **`null`** on failure / no model).

```javascript
exports.generateTrainingPlanContent = async (application, jobPost) => {
  if (!model) return null;
  const candidateName = application.formData?.firstName && application.formData?.lastName
    ? `${application.formData.firstName} ${application.formData.lastName}`
    : application.candidate?.name || 'Candidate';
  const jobTitle = jobPost.jobTitle || 'Role';
  const company = jobPost.company || 'Company';
  const skills = (jobPost.skills && jobPost.skills.length) ? jobPost.skills.join(', ') : 'role-specific skills';
  const prompt = `You are an HR training specialist. Generate a 3-month (12-week) training plan for a new hire to meet industry standard practices.

Candidate name: ${candidateName}
Job title: ${jobTitle}
Company: ${company}
Key skills for role: ${skills}

Output a clear, professional training plan with:
1. Title: "3-Month Training Plan - [Job Title]"
2. Objective (2-3 sentences)
3. Month 1: Orientation & foundations (weeks 1-4) - specific goals and deliverables
4. Month 2: Core competencies & projects (weeks 5-8) - specific goals and deliverables
5. Month 3: Independence & best practices (weeks 9-12) - specific goals and deliverables
6. Success criteria and review milestones

Use plain text with clear headings. Keep each section concise but actionable. No markdown code blocks.`;
  try {
    const result = await runBytez([{ role: 'user', content: prompt }], 2048);
    const output = result?.output ?? result?.content ?? result?.text ?? result;
    return extractTextFromOutput(output) || 'Training plan could not be generated.';
  } catch (e) {
    console.error('Training plan LLM error:', e);
    return null;
  }
};
```

### `extractTextFromOutput` — `backend/controllers/llmController.js`

**What it does:** Normalizes **heterogeneous LLM response shapes** into a **string** for PDF rendering.

```javascript
function extractTextFromOutput(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;
  const getStr = (v) => (typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : ''));
  if (output.content) return getStr(output.content);
  if (output.text) return getStr(output.text);
  if (output.result) return getStr(output.result);
  if (output.data) return getStr(output.data);
  if (output.message && output.message.content) return getStr(output.message.content);
  if (output.message) return getStr(output.message);
  if (Array.isArray(output)) return output.map(item => (typeof item === 'string' ? item : (item?.content ?? item?.text ?? JSON.stringify(item)))).join('\n');
  return JSON.stringify(output);
}
```

### `generateTrainingPlan` — `backend/controllers/applicationController.js`

**What it does:** **Authorizes** HR + job ownership + **`selectedAsHire`**, generates **LLM text**, builds **PDF** with **pdfkit**, saves file, updates **`Application.trainingPlanPdfPath`**.

```javascript
exports.generateTrainingPlan = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR' });
    const { applicationId } = req.params;
    if (!applicationId) return res.status(400).json({ error: 'applicationId required' });

    const application = await Application.findById(applicationId).populate('candidate', 'name');
    if (!application) return res.status(404).json({ error: 'Application not found' });
    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });
    if (!application.selectedAsHire) return res.status(400).json({ error: 'Application is not marked as selected hire' });

    const content = await generateTrainingPlanContent(application, jobPost);
    if (!content) return res.status(503).json({ error: 'Could not generate training plan content' });

    if (!PDFDocument) return res.status(503).json({ error: 'PDF generation not available (install pdfkit)' });

    const dir = 'uploads/training-plans';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `training-plan-${applicationId}-${Date.now()}.pdf`;
    const filePath = path.join(dir, filename);

    const stream = fs.createWriteStream(filePath);
    const doc = new PDFDocument({ margin: 50, autoFirstPage: true });

    const streamDone = new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    doc.pipe(stream);

    function sanitize(str) {
      if (str == null || typeof str !== 'string') return '';
      return str
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\r/g, '')
        .trim();
    }

    try {
      doc.fontSize(16).text('3-Month Training Plan', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10);
      const lines = content.split(/\n/);
      for (const line of lines) {
        const safe = sanitize(line) || ' ';
        if (safe.length > 0) {
          const isHeading = /^#+\s*/.test(line) || /^[A-Z][a-z]+.*:?\s*$/.test(safe);
          doc.fontSize(isHeading ? 11 : 10);
          doc.text(safe, { lineBreak: true });
        }
        doc.moveDown(0.3);
      }
    } catch (pdfErr) {
      stream.destroy();
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
      throw pdfErr;
    }
    doc.end();
    await streamDone;

    application.trainingPlanPdfPath = filePath;
    await application.save();

    res.json({ success: true, pdfPath: filePath, downloadUrl: `/api/applications/training-plan/${applicationId}/download` });
  } catch (error) {
    console.error('Generate training plan error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate training plan' });
  }
}];
```

### `downloadTrainingPlan` — `backend/controllers/applicationController.js`

**What it does:** Same **HR + ownership** rules; streams the **stored PDF** if path exists and file is on disk.

```javascript
exports.downloadTrainingPlan = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Forbidden' });
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId);
    if (!application || !application.trainingPlanPdfPath) return res.status(404).json({ error: 'Training plan not found' });
    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job not found' });

    const absPath = path.isAbsolute(application.trainingPlanPdfPath) ? application.trainingPlanPdfPath : path.join(process.cwd(), application.trainingPlanPdfPath);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'File not found' });
    const firstName = (application.formData?.firstName || 'candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const name = `training-plan-${firstName}-${applicationId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.sendFile(absPath, { maxAge: 0 }, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Failed to send file' });
    });
  } catch (error) {
    console.error('Download training plan error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}];
```

### `getOnboardingHires` — `backend/controllers/hirePipelineController.js`

**What it does:** Returns **all hired applications** for jobs **owned** by the HR user (includes **`trainingPlanPdfPath`** for UI).

```javascript
exports.getOnboardingHires = asHandlers(async (req, res) => {
  try {
    const jobs = await JobPost.find({
      createdBy: req.user._id,
      remarks: { $ne: 'deleted' },
    })
      .select('jobTitle company _id hirePipelineStage finalHireCompletedAt')
      .lean();
    const jobIds = jobs.map((j) => j._id);
    const hires = await Application.find({
      jobPost: { $in: jobIds },
      selectedAsHire: true,
    })
      .populate('candidate', 'name email')
      .populate('jobPost', 'jobTitle company')
      .sort({ updatedAt: -1 })
      .lean();

    const rows = hires.map((a) => ({
      applicationId: a._id,
      jobId: a.jobPost?._id,
      jobTitle: a.jobPost?.jobTitle,
      company: a.jobPost?.company,
      candidateName: a.candidate?.name || `${a.formData?.firstName || ''} ${a.formData?.lastName || ''}`.trim(),
      email: a.candidate?.email || a.formData?.email,
      phone: a.formData?.phone,
      congratulationsHireSentAt: a.congratulationsHireSentAt,
      trainingPlanPdfPath: a.trainingPlanPdfPath,
    }));

    res.json({ hires: rows });
  } catch (e) {
    console.error('getOnboardingHires:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});
```

### Routes — `backend/routes/applications.js` (training-plan lines)

**What it does:** Wires **HTTP** paths to the **application** controller handlers.

```javascript
router.post('/generate-training-plan/:applicationId', applicationController.generateTrainingPlan);
router.get('/training-plan/:applicationId/download', applicationController.downloadTrainingPlan);
```

---

## 6. DATABASE MODEL / SCHEMA

### Full file: `backend/models/Application.js`

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
  /** Condolence: not in CV top-50 when test invites sent */
  condolenceNotShortlistedForTestSentAt: { type: Date, default: null },
  /** Invited to on-site / video interview after online test */
  physicalInterviewInvitedAt: { type: Date, default: null },
  /** Condolence: had test but not selected for physical interview round */
  condolenceAfterPhysicalSentAt: { type: Date, default: null },
  /** Congratulations email when marked final hire */
  congratulationsHireSentAt: { type: Date, default: null },
  /** Condolence: attended physical round but not chosen as hire */
  condolenceNotFinalHireSentAt: { type: Date, default: null },
}, {
  timestamps: true,
});

// Prevent duplicate applications
applicationSchema.index({ jobPost: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
```

**Most important for this module:** **`selectedAsHire`** (gate for generation + list inclusion), **`trainingPlanPdfPath`** (stored artifact location), **`formData` / populated `candidate`** (name for LLM and download filename).

### Full file: `backend/models/JobPost.js`

*(Used for **jobTitle**, **company**, **skills**, and **`createdBy`** ownership checks.)*

```javascript
const mongoose = require('mongoose');

const jobPostSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true },
  company: { type: String, required: true },
  // Company contact information (optional)
  officialEmail: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },
  contactNo: { type: String, default: '' },
  // Company Location details
  location: {
    country: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, default: '' },
    address: { type: String, default: '' }, // Optional street address
  },
  jobType: { 
    type: String, 
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'],
    required: true 
  },
  // Salary range
  salary: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  keyResponsibilities: { type: String, required: true }, // Changed from description
  // Backward compatibility - description maps to keyResponsibilities
  description: { type: String, required: false },
  // Generated description from LLM
  generatedDescription: { type: String, default: '' },
  // Template image path (stored in public folder)
  templateImage: { type: String, default: '/job-posting-template.png' },
  // Experience - can be number (1-10) or string ("10+")
  experience: { type: mongoose.Schema.Types.Mixed, default: null },
  education: [{ type: String }], // Education as array of strings
  deadline: { type: Date, required: true },
  // Skills array
  skills: [{ type: String }],
  // Languages array
  languages: [{ type: String }],
  // Candidate location preference - array of location preferences
  candidateLocation: [{ type: String }],
  // Weightage distribution - supports dynamic fields
  weightage: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      skills: 0,
      education: 0,
      experience: 0,
      projects: 0,
      language: 0
    }
  },
  activeStatus: { type: Boolean, default: true },
  remarks: { 
    type: String, 
    enum: ['pending', 'completed', 'deleted'],
    default: 'pending' 
  },
  evaluatedAt: { type: Date, default: null },
  /** Hiring pipeline (Finalize Hire / onboarding flow) */
  hirePipelineStage: {
    type: String,
    enum: ['ranking', 'test_ready', 'test_sent', 'physical_invite_sent', 'awaiting_final_hire', 'finished'],
    default: 'ranking',
  },
  testContentFinalizedAt: { type: Date, default: null },
  assessmentInviteSentAt: { type: Date, default: null },
  /** End of the online test invite window (`TestInvitation.expiresAt`; currently ~10 min from send) */
  assessmentDeadline: { type: Date, default: null },
  physicalInterviewDate: { type: String, default: '' },
  physicalInterviewTime: { type: String, default: '' },
  physicalInterviewLocation: { type: String, default: '' },
  physicalInterviewEmailSentAt: { type: Date, default: null },
  awaitingFinalHireSelection: { type: Boolean, default: false },
  finalHireCompletedAt: { type: Date, default: null },
  /** HR explicitly chose no acceptable candidate at final step */
  noHireSelected: { type: Boolean, default: false },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
}, {
  timestamps: true,
});

// Handle backward compatibility for description field
jobPostSchema.pre('save', function(next) {
  // If description is provided but keyResponsibilities is not, copy it
  if (this.description && !this.keyResponsibilities) {
    this.keyResponsibilities = this.description;
  }
  // Always keep description in sync with keyResponsibilities
  if (this.keyResponsibilities) {
    this.description = this.keyResponsibilities;
  }
  next();
});

// Validate that weightage sum is exactly 100
jobPostSchema.pre('validate', function(next) {
  if (!this.weightage || typeof this.weightage !== 'object') {
    return next(new Error('Priority Weight Distribution is required'));
  }
  
  let total = 0;
  for (const key in this.weightage) {
    const value = this.weightage[key];
    if (typeof value === 'number' && !isNaN(value)) {
      total += value;
    }
  }
  
  if (total !== 100) {
    return next(new Error('Priority Weight Distribution must sum to exactly 100'));
  }
  next();
});

module.exports = mongoose.model('JobPost', jobPostSchema);
```

**Most important for this module:** **`skills`** (feeds the AI plan), **`jobTitle`**, **`company`**, **`createdBy`** (authorization boundary).

---

## 7. API ENDPOINTS USED IN THIS MODULE

| Method | Endpoint | Controller function | Purpose |
|--------|----------|---------------------|---------|
| GET | `/api/hire-pipeline/onboarding-hires` | `hirePipelineController.getOnboardingHires` | List **selected hires** + **`trainingPlanPdfPath`** for HR’s jobs |
| POST | `/api/applications/generate-training-plan/:applicationId` | `applicationController.generateTrainingPlan` | **LLM** text → **PDF** → save path on **Application** |
| GET | `/api/applications/training-plan/:applicationId/download` | `applicationController.downloadTrainingPlan` | **Download** stored PDF (**attachment**) |

**Auth:** All three require **`Authorization: Bearer <Firebase ID token>`**. Applications routes use **`applicationController`’s `verifyToken`**; hire-pipeline uses **`verifyHr`** (`verifyToken` + **`requireHR`**).

---

## 8. SLIDE-READY SUMMARY

- **One screen for every new hire:** After selection, HR sees **all hired candidates** in one place, filtered by job, without hunting through spreadsheets or email threads.  
- **AI-drafted onboarding roadmaps:** The system builds a **structured three-month plan** grounded in the **real job title, company, and skill tags** from the posting.  
- **Ready-to-share PDFs:** Plans are **rendered to professional PDF files** HR can **download** and hand to managers or new starters.  
- **Safe by design:** Only **HR accounts** can generate or download plans, and only for **their own jobs** and **confirmed hires**—not arbitrary applications.  
- **Persistent artifacts:** Each hire’s **latest plan path** is stored on the **application**, so the UI can show **Generate** vs **Download** without manual file tracking.  
- **Fits the NeuroHire story:** Uses the **same AI infrastructure** as job descriptions and assessments, showing an **end-to-end intelligent hiring platform** through **onboarding**.

---

*Document generated from the NeuroHire codebase. Ensure **`BYTEZ_API_KEY`** (and optional **`BYTEZ_MODEL`**) are set for AI generation, and **`pdfkit`** is installed for PDF output. Hires must have **`selectedAsHire: true`** (set by the **Finalize hire** flow).*
