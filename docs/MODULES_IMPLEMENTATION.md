# NeuroHire — Module-by-Module Description & Implementation

This document describes the **10 original modules** of NeuroHire, what each module does, and **how it is implemented in the current codebase** (frontend + backend), including the key functions, routes, and data models involved.

---

## Module 1 — Manage Job Posting

### What this module does
- Allows HR to **create, edit, and delete (soft delete)** job posts.
- Stores job requirements (skills, education, responsibilities, weights, deadline, etc.).
- Optionally generates a richer “generated description” using an LLM for better job ad content.
- Controls whether a job is visible to candidates using:
  - `activeStatus` (true/false)
  - `remarks` (`pending`, `completed`, `deleted`)
  - `deadline` (candidate portal only shows jobs whose deadline has not passed)

### How it’s implemented
- **Frontend (HR UI)**
  - Job creation/edit UI: `frontend/app/hr/job-posting/page.js`
  - Uses API helpers from `frontend/lib/api.js`:
    - `createJobPost(jobData, idToken)`
    - `updateJobPost(id, jobData, idToken)`
    - `deleteJobPost(id, idToken)`
    - `generateJobDescription(...)` (LLM)

- **Backend (API)**
  - Routes: `backend/routes/jobPosts.js`
    - `GET /job-posts` (HR list)
    - `GET /job-posts/:id` (HR details)
    - `GET /job-posts/candidate/:id` (candidate-safe details)
    - `POST /job-posts` (create)
    - `PUT /job-posts/:id` (update)
    - `DELETE /job-posts/:id` (soft delete)
    - `GET /job-posts/dashboard/statistics` (HR analytics)
  - Controller: `backend/controllers/jobPostController.js`
  - Model: `backend/models/JobPost.js`

### Key functions performed
- **Validation & normalization**
  - Ensures required fields exist (title, company, location, responsibilities, deadline).
  - Enforces weightage constraints (schema validates sum to 100).
- **Persistence**
  - Creates/updates `JobPost` documents in MongoDB.
- **Candidate visibility control**
  - Candidate jobs list is *filtered* by `activeStatus`, `remarks != 'deleted'`, and `deadline`.

---

## Module 2 — Upload Resume and Autofill Application

### What this module does
- Candidates upload a CV (PDF).
- System can:
  - **Check CV format** vs template
  - **Extract structured fields** (name, email, skills, education, etc.)
  - Autofill the application form with extracted data
- Candidate then submits an application with:
  - CV file
  - manual form fields (or autofilled fields)
  - extracted structured data (when available)

### How it’s implemented
- **Frontend (Candidate UI)**
  - Candidate jobs browsing: `frontend/app/candidate/apply/page.js`
  - Candidate dashboard uses active jobs count: `frontend/app/candidate/dashboard/page.js`
  - API helpers in `frontend/lib/api.js`:
    - `checkCVFormat(formData, idToken)` → `POST /cv/check-format`
    - `autofillCV(formData, idToken)` → `POST /cv/autofill`
    - `downloadCVTemplate()` → `GET /cv/template`
    - `submitApplication(formData, idToken)` → `POST /applications/submit`

- **Backend (CV processing)**
  - CV routes: `backend/routes/cv.js`
    - `POST /cv/check-format`
    - `POST /cv/autofill`
    - `GET /cv/template`
  - CV controller: `backend/controllers/cvController.js`
    - Uses `multer` to accept PDF uploads
    - Uses Python (via `child_process`) for extraction/format checking (`backend/services/cv_checker.py`)
    - Uses an LLM (Bytez → GPT-4o) to return clean structured JSON for autofill

- **Backend (Application submission)**
  - Application routes: `backend/routes/applications.js`
    - `POST /applications/submit` (token + PDF upload)
  - Controller: `backend/controllers/applicationController.js`
  - Model: `backend/models/Application` (referenced throughout the app)

### Key functions performed
- **File upload & validation**
  - Only PDF is accepted for CV upload.
- **CV parsing**
  - Python extracts text / validates template match.
  - LLM converts CV text into normalized JSON fields for autofill.
- **Application storage**
  - Saves both raw `formData` and `extractedData` so scoring can use the best available data.

---

## Module 3 — Evaluate Candidates

### What this module does
Implements the platform’s core evaluation workflow:
- **No scoring at application submission** (applications are just stored).
- After the deadline passes, HR can run **batch evaluation** to score all applications.
- HR can optionally run **instant ranking** for a single application before the deadline.
- HR views candidates in different modes:
  - Applicants (unranked / pre-deadline)
  - Evaluated candidates (scored but not test-invited yet)
  - Ranked candidates (test-invited; test status/score visible)

### How it’s implemented
- **Frontend (HR UI)**
  - HR evaluation/ranking UI: `frontend/app/hr/ranked-candidates/page.js`
  - API helpers in `frontend/lib/api.js`:
    - `getJobsForRanking(idToken)`
    - `getApplicationsByJob(jobId, idToken)` (pre-deadline view)
    - `evaluateOneApplication(applicationId, idToken)` (instant)
    - `evaluateJobApplications(jobId, idToken)` (batch)
    - `getEvaluatedCandidates(jobId, idToken)`
    - `getRankedCandidates(jobId, idToken)`

- **Backend (Evaluation logic)**
  - Application routes: `backend/routes/applications.js`
    - `POST /applications/evaluate-job/:jobId`
    - `POST /applications/evaluate-one/:applicationId`
    - `GET /applications/by-job/:jobId`
    - `GET /applications/evaluated-candidates/:jobId`
    - `GET /applications/ranked/:jobId`
  - Controller: `backend/controllers/applicationController.js`
    - `evaluateJobApplications` batches scoring
    - `evaluateOneApplication` scores one application
  - Scoring service: `backend/services/scoringService.js`
    - Uses LLM prompts to score:
      - experience, projects, skills, certificates, languages, education
    - Computes a weighted total using job weightage

### Key functions performed
- **Batch scoring**
  - Scores each application and writes `scores` + `rankedAt`.
  - Sets `jobPost.evaluatedAt` when finished.
- **Instant scoring**
  - Scores one candidate immediately; the rest can wait until deadline.

---

## Module 4 — Automate Shortlisting and Scheduling

### What this module does
- HR selects candidates and sends:
  - **Online test invitations**
  - **Interview invitations**
- Email content is generated using an LLM, then actually delivered via an automation webhook (n8n).
- Maintains state flags so the UI can show what has already been done.

### How it’s implemented
- **Frontend (HR)**
  - Candidate selection + email modal: `frontend/app/hr/ranked-candidates/page.js`
  - API helpers: `frontend/lib/api.js`
    - `generateInterviewEmail(candidates, jobInfo, emailType, idToken)`
    - `sendInterviewEmails(candidates, emailContent, jobInfo, hrInfo, idToken, { jobId, emailType })`
    - `markInterviewInviteSent(jobId, applicationIds, idToken)` (for interview emails)

- **Backend**
  - LLM + email controller: `backend/controllers/llmController.js`
    - `generateInterviewEmail` produces subject/body template JSON
    - `sendInterviewEmails` personalizes placeholders and calls `N8N_EMAIL_WEBHOOK_URL`
    - For **online tests**, it also:
      - ensures the test question bank exists
      - creates `TestInvitation` tokens for each candidate
      - injects `[TEST_LINK]`, `[TEST_DEADLINE]`, `[TEST_DURATION]` into the email

### Key functions performed
- **Shortlisting mechanics**
  - Shortlisting is represented by “who HR selected to email” (and later by hire selection).
- **Scheduling**
  - “Scheduling” is currently implemented via email templates/placeholders and automation (n8n). Calendar integration can be added later if needed.

---

## Module 5 — Take Online Test

### What this module does
Candidates can take a proctored online test that includes:
- 30 MCQs (30 marks)
- 7 coding questions (70 marks)
- 2-hour timer
- Save progress periodically
- Submit test at the end (manual or auto-submit on rule violations)
- Run code while solving coding questions

### How it’s implemented
- **Frontend (public test pages)**
  - Test entry: `frontend/app/test/page.js`
    - Validates token and shows rules
  - Test taking UI: `frontend/app/test/take/page.js`
    - MCQ + coding editor (textarea-based)
    - “Run code” button calls `/test/run-code`
  - Done screen: `frontend/app/test/done/page.js`
  - API helpers: `frontend/lib/api.js`
    - `validateTestToken(token)`
    - `startTest(token)`
    - `getTestAttempt(attemptId, token)`
    - `saveTestProgress(attemptId, token, payload)`
    - `submitTest(attemptId, token, payload)`
    - `runCode(language, code, stdin)`

- **Backend**
  - Test routes: `backend/routes/test.js`
    - `GET /test/validate-token`
    - `POST /test/start`
    - `GET /test/attempt/:attemptId`
    - `PUT /test/attempt/:attemptId`
    - `POST /test/attempt/:attemptId/submit`
    - `POST /test/run-code`
  - Controller: `backend/controllers/testController.js`
  - Models:
    - `backend/models/TestInvitation.js` (invitation token + expiry)
    - `backend/models/TestAttempt.js` (attempt state, answers, submissions, violations)
    - `backend/models/TestMcqPool.js` (MCQ bank)
    - `backend/models/CodingQuestion.js` (coding bank)
  - Code runner: `backend/services/codeRunService.js`
    - Uses Piston API, with Node fallback for JS

### Key functions performed
- Token-based access control (public link, no login required).
- Question selection and attempt creation.
- Periodic saving.
- Submission triggers evaluation.

---

## Module 6 — Monitor and Proctor Test Behavior

### What this module does
Monitors candidate behavior during the test and flags violations such as:
- Face not detected
- Multiple faces
- Tab switching / leaving the test
- Detected disallowed objects (e.g., phone)

After enough violations, the attempt is **auto-disqualified** and submitted.

### How it’s implemented
- **Frontend**
  - Proctoring component: `frontend/components/test/Proctoring.jsx`
  - Mounted in: `frontend/app/test/take/page.js`
  - Sends proctoring updates as part of `saveTestProgress(...)`:
    - `violationCount`
    - `proctoringEvent` payloads

- **Backend**
  - `backend/controllers/testController.js`
    - `saveProgress` stores:
      - `proctoringEvents[]`
      - `violationCount`
    - If `violationCount >= MAX_VIOLATIONS_BEFORE_DISQUALIFY`, attempt becomes `disqualified` and invitation is updated.

### Key functions performed
- Provides “pause until face detected” behavior in the UI.
- Records events to the attempt for auditability.

---

## Module 7 — Scoring and Feedback

### What this module does
Produces scores and explanations at multiple stages:
- **Application scoring** (CV + form data) → used to rank candidates post-deadline.
- **Online test scoring** (MCQ + coding):
  - MCQ score is deterministic (correctIndex)
  - Coding score is evaluated by LLM with feedback summary

### How it’s implemented
- **Application scoring**
  - Service: `backend/services/scoringService.js`
  - Triggered by:
    - `applicationController.evaluateJobApplications`
    - `applicationController.evaluateOneApplication`

- **Online test scoring**
  - Triggered after submit:
    - `backend/controllers/testController.js` calls `llmController.evaluateTestAttempt(attemptId)` in background
  - Evaluator:
    - `backend/controllers/llmController.js` → `evaluateTestAttempt`
      - MCQ: computes score from `mcqOrder` + `mcqAnswers`
      - Coding: prompts LLM to score 7 solutions (0–10 each), total max 70
      - Stores:
        - `mcqScore`, `codingScore`, `testScore`, `evaluationSummary`, `evaluatedAt`

### Key functions performed
- Produces a **single test score (0–100)** plus an evaluation summary.
- HR view shows:
  - `Pending` when test is submitted but evaluation hasn’t finished yet
  - Score after evaluation

---

## Module 8 — Conduct Interview and Notify Candidates

### What this module does
- HR sends interview invitation emails.
- HR can mark interview invites as sent for selected candidates.
- HR selects final hires.
- System maintains per-application flags for downstream modules (training plan, finalization).

### How it’s implemented
- **Frontend (HR ranked candidates view)**
  - Interview email generation and sending: `frontend/app/hr/ranked-candidates/page.js`
  - Uses:
    - `generateInterviewEmail(...)`
    - `sendInterviewEmails(...)` (emailType = `interview`)
    - `markInterviewInviteSent(jobId, applicationIds, idToken)`
    - `markSelectedAsHire(jobId, applicationIds, idToken)`

- **Backend**
  - `applicationController.markInterviewInviteSent`
    - Sets `Application.interviewInviteSentAt = new Date()`
  - `applicationController.markSelectedAsHire`
    - Clears previous selections then sets `Application.selectedAsHire = true` for chosen apps

### Key functions performed
- “Notify candidates” is handled by the same n8n-powered email sending mechanism used for tests.
- Interview scheduling is handled as email content/placeholder-based process (expandable to a calendar integration later).

---

## Module 9 — Generate Onboarding Plan

### What this module does
After a candidate is selected as a final hire:
- Generates a **3-month (12-week) onboarding/training plan** using an LLM.
- Exports the plan to a **PDF**.
- Lets HR download the PDF.
- HR can finalize the job as “completed”.

### How it’s implemented
- **Frontend**
  - UI: `frontend/app/hr/ranked-candidates/page.js`
  - API:
    - `generateTrainingPlan(applicationId, idToken)` → `POST /applications/generate-training-plan/:applicationId`
    - Download uses `getApiBaseUrl()`:
      - `GET /applications/training-plan/:applicationId/download`

- **Backend**
  - Controller: `backend/controllers/applicationController.js`
    - `generateTrainingPlan`
      - Calls `llmController.generateTrainingPlanContent(application, jobPost)`
      - Builds PDF using `pdfkit`
      - Writes to `uploads/training-plans/...pdf`
      - Stores path in `Application.trainingPlanPdfPath`
    - `downloadTrainingPlan`
      - Streams the generated PDF
  - LLM function: `backend/controllers/llmController.js`
    - `generateTrainingPlanContent(...)`

### Key functions performed
- Ensures only `selectedAsHire` applications can generate onboarding plans.
- Produces a downloadable PDF with consistent formatting and sanitization.

---

## Module 10 — User Signup/Login

### What this module does
- Provides authentication and role-based access:
  - HR portal pages are restricted to `role = HR`
  - Candidate portal pages are restricted to `role = candidate`
- Uses Firebase Authentication on the frontend and verifies Firebase ID tokens on the backend.
- Keeps a MongoDB `User` record for role + profile information.

### How it’s implemented
- **Frontend**
  - Firebase Client SDK is used (login/signup flows live in the frontend auth pages).
  - The app stores a `user` object and uses route protection via:
    - `frontend/components/ProtectedRoute`
  - API calls attach `Authorization: Bearer <idToken>`.

- **Backend**
  - Auth routes: `backend/routes/auth.js`
    - `POST /auth/signup` (validates request; frontend creates Firebase user)
    - `POST /auth/verify-email` (creates Mongo user after verification)
    - `POST /auth/login` (verifies token, syncs role/custom claims)
    - `POST /auth/forgot-password`
    - `POST /auth/verify-token`
  - Controller: `backend/controllers/authController.js`
  - Model: `backend/models/User.js`

### Key functions performed
- **Token verification**: `admin.auth().verifyIdToken(...)`
- **Role sync**:
  - Reads Firebase custom claims (`role`) when present
  - Stores role in MongoDB `User.role`

---

## Notes on the overall workflow (how modules connect)

- **Job posting (Module 1)** creates jobs with requirements and deadlines.
- **Candidate CV upload + application submit (Module 2)** stores applications without scoring.
- **Evaluation (Module 3)** runs after deadline (batch) or instantly (single).
- **Shortlisting + test invites (Module 4 → Module 5)** creates `TestInvitation` tokens and sends links.
- **Proctoring (Module 6)** runs during test and can disqualify.
- **Scoring/feedback (Module 7)** updates application/test results shown to HR.
- **Interview + hire selection (Module 8)** moves candidates into hiring decision stage.
- **Onboarding plan (Module 9)** generates PDF plan for selected hires.
- **Auth (Module 10)** secures all HR/candidate actions with role-based access.

