# AI Testing Platform Module — Complete Presentation Material

**Project:** NeuroHire  
**Document purpose:** FYP / stakeholder presentation — single structured reference for the online assessment + proctoring + HR pipeline slice.

---

## 1. MODULE OVERVIEW

### What is this module?

The **AI Testing Platform** is the end-to-end **online technical assessment** subsystem: HR (or the system) prepares **MCQ and coding** content (often **LLM-generated**), invites ranked candidates via **personal links**, candidates take a **timed test** with optional **AI-assisted proctoring** (camera + browser rules), code runs on the **server (Piston/Node)**, and submissions are **scored** (deterministic MCQ + **LLM-graded coding**). HR then **reviews results**, runs **physical interview** shortlisting, and **final hire** steps using the same data.

### What problem does it solve?

NeuroHire needs to **scale screening** beyond CV ranking: many applicants, consistent rubric, less manual grading, and a **single score** (e.g. out of 100) to compare candidates. It also reduces cheating risk via **proctoring** and **link expiry**, and ties assessments to **jobs** and **applications** in one pipeline.

### 2–3 line summary (FYP slide)

> **AI-powered online testing** integrates with NeuroHire’s hiring pipeline: HR finalizes **MCQ + coding** items, top candidates receive **secure test links**, and the app delivers a **proctored, timed exam** with **automated scoring** (rules-based MCQ + **LLM evaluation** of code). Results feed **HR dashboards** for shortlisting and final decisions.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Path | Role |
|------|------|
| `frontend/app/test/page.js` | Landing: validate token, instructions, start/resume test |
| `frontend/app/test/take/page.js` | Main exam UI: MCQ, coding (Monaco), timer, submit, proctoring integration |
| `frontend/app/test/done/page.js` | Post-submit / disqualified confirmation |
| `frontend/components/test/Proctoring.jsx` | MediaPipe: face + eyes + object detection; tab visibility; violations |
| `frontend/app/hr/ranked-candidates/page.js` | Test wizard: generate/load/save/regenerate content, send top-50 invites |
| `frontend/app/hr/finalize-hire/page.js` | Test participants, scores, physical interview, deadline update, final hire |
| `frontend/lib/api.js` | Axios wrappers: `/test/*`, `/llm/*` test routes, `/hire-pipeline/*` |

### Backend

| Path | Role |
|------|------|
| `backend/routes/test.js` | Public test API routes |
| `backend/controllers/testController.js` | Token validation, start, get attempt, save, submit, run code |
| `backend/routes/llm.js` | HR: generate MCQ/coding, CRUD test content, send test invites |
| `backend/controllers/llmController.js` | Bytez/LLM: generation, `sendTestInvitesTop50`, `evaluateTestAttempt`, etc. |
| `backend/routes/hirePipeline.js` | HR: CV rank, test participants, detail, physical, final hire, onboarding |
| `backend/controllers/hirePipelineController.js` | Aggregates invitations + attempts; MCQ/coding breakdown; physical round filters |
| `backend/services/codeRunService.js` | Piston API + Node fallback for JS |
| `backend/services/emailDispatchService.js` | Batch emails (test invites, condolence, etc.) |
| `backend/middleware/verifyHr.js` | Firebase token + HR role for protected routes |
| `backend/config/assessmentConfig.js` | `CODING_PROBLEM_COUNT`, `CODING_MARKS_CAPS` |
| `backend/index.js` | Mounts `/api/test`, `/api/llm`, `/api/hire-pipeline` |

### Database (Mongoose models)

| Path | Role |
|------|------|
| `backend/models/TestInvitation.js` | Per-candidate invite: token, expiry, status |
| `backend/models/TestAttempt.js` | One attempt per invite: answers, code, proctoring, scores, breakdowns |
| `backend/models/TestMcqPool.js` | Job-scoped MCQ bank (e.g. 100; 30 sampled per attempt) |
| `backend/models/CodingQuestion.js` | Job-scoped coding problems (3 active per assessment config) |
| `backend/models/JobPost.js` | `hirePipelineStage`, `assessmentInviteSentAt`, `assessmentDeadline`, etc. |
| `backend/models/Application.js` | Candidate application; linked to invitations and pipeline |

### Config / docs

| Path | Role |
|------|------|
| `backend/config/assessmentConfig.js` | Central numbers for coding section |
| `docs/AI_TESTING_PLATFORM_MODULE_PRESENTATION.md` | This file |

**Note:** No dedicated migration/seed files were found for this module; schema is defined in Mongoose models.

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### Narrative flow (paste-friendly for AI diagram tools)

1. **HR opens Ranked Candidates** → `RankedCandidates` page loads jobs and CV-ranked list → may call `prepareTestQuestions(jobId)` → **parallel** `POST /api/llm/generate-mcq-pool/:jobId` and `POST /api/llm/generate-coding-questions/:jobId` → `llmController.generateMcqPool` / `generateCodingQuestions` run Bytez → results saved to **`TestMcqPool`** and **`CodingQuestion`** (linked to **`JobPost`**) → response OK.

2. **HR edits & saves test** → `getJobTestContent` → `GET /api/llm/job-test-content/:jobId` → reads pools → UI shows JSON/editor → `saveJobTestContent` → `POST /api/llm/save-job-test-content/:jobId` → validates MCQs (≥30) and coding (≥3) → upserts **`TestMcqPool`** + **`CodingQuestion`**, sets **`JobPost.testContentFinalizedAt`** / stage.

3. **HR sends test to top 50** → `sendTestTop50` → `POST /api/llm/send-test-top50/:jobId` → `sendTestInvitesTop50` loads ranked **`Application`**s → creates **`TestInvitation`** rows (token, `expiresAt` from `TEST_INVITE_WINDOW_MS`) → personalizes email → `dispatchEmailBatch` → updates **`JobPost`** (`assessmentInviteSentAt`, `assessmentDeadline`, stage) → non-shortlisted get condolence flow as implemented.

4. **Candidate opens email link** → `/test?token=…` → `validateTestToken` → `GET /api/test/validate-token?token=` → `validateToken` reads **`TestInvitation`** (+ **`JobPost`**) → returns validity, expiry, optional `existingAttemptId`.

5. **Candidate starts test** → `startTest` → `POST /api/test/start` `{ token }` → `startTest` loads **`TestMcqPool`** / **`CodingQuestion`**, shuffles 30 MCQ indices, creates **`TestAttempt`** if needed (links to invitation), sets invitation **attempted** → returns `attemptId`, questions (no correct answers), coding prompts.

6. **During test** → `getTestAttempt` periodically / on resume → `GET /api/test/attempt/:attemptId?token=` → `getAttempt` rebuilds question text from pool + attempt’s `mcqOrder` → returns answers + code drafts.

7. **Autosave / proctoring** → `saveTestProgress` → `PUT /api/test/attempt/:attemptId` → `saveProgress` updates **`TestAttempt`** (`mcqAnswers`, `codingSubmissions`, optional `proctoringEvent`, `violationCount`); if violations ≥ threshold → sets **`TestAttempt.status`** = `disqualified` and **`TestInvitation.status`** = `disqualified` → JSON includes `disqualified: true`.

8. **Run code** → `runCode` (frontend) → `POST /api/test/run-code` → `testController.runCode` → **`codeRunService.runCode`** (Piston or Node for JS) → stdout/stderr back to UI (Monaco + output panel).

9. **Submit (normal)** → `submitTest` → `POST /api/test/attempt/:attemptId/submit` → `submitTest` sets **`TestAttempt`** to `submitted`, saves answers → `setImmediate(evaluateTestAttempt)` → `evaluateTestAttempt` loads pool + coding doc + submission → scores MCQs deterministically → calls Bytez for coding rubric → writes **`TestAttempt`**: `mcqScore`, `codingScore`, `testScore`, `mcqBreakdown`, `codingBreakdown`, `evaluationSummary`, `evaluatedAt`.

10. **Submit (proctoring disqualification)** → same endpoint with `proctoringDisqualification: true` → attempt + invitation marked disqualified, scores cleared, **no** `evaluateTestAttempt`.

11. **HR reviews** → Finalize Hire → `getTestParticipants` → `GET /api/hire-pipeline/test-participants/:jobId` → joins **`TestInvitation`**, **`TestAttempt`**, **`Application`** → list with status/scores; disqualified excluded from “consideration” in UI; detail → `GET /api/hire-pipeline/test-participant/:applicationId` → `getTestParticipantDetail` returns breakdowns or disqualification-only payload.

12. **Physical interview round** → `POST /api/hire-pipeline/physical-interview/:jobId` → excludes disqualified from pool; uses submitted scores for ranking → emails → updates **`Application`** / **`JobPost`**.

### Separate diagram prompt (Whimsical / Eraser / etc.)

> Generate a **data flow diagram** showing: **HR User** → **Next.js HR pages** → **REST API** (`/api/llm`, `/api/hire-pipeline`) → **MongoDB collections** (`JobPost`, `TestMcqPool`, `CodingQuestion`, `Application`, `TestInvitation`) → **Email service** → **Candidate** opens link → **Next.js `/test`** → **GET/POST `/api/test`** → **`TestAttempt`** read/write → optional **Piston** for code execution → on submit → **LLM (Bytez)** for coding grades → **`TestAttempt`** updated with scores → **HR Finalize Hire** reads **`TestInvitation` + `TestAttempt`** → **Physical interview** branch. Use swimlanes: *Candidate*, *Frontend*, *API*, *Database*, *External (LLM, Piston, Email)*.

---

## 4. KEY FRONTEND FUNCTIONS

### `validateTestToken` — `frontend/lib/api.js`

**What it does:** Calls backend to check if the emailed test token is valid and returns job metadata / resume hint.

```javascript
export const validateTestToken = async (token) => {
  try {
    const response = await api.get('/test/validate-token', { params: { token } });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Invalid or expired link',
      status: error.response?.data?.status,
    };
  }
};
```

### `saveTestProgress` — `frontend/lib/api.js`

**What it does:** Persists MCQ answers, coding submissions, and optional proctoring payload to the server.

```javascript
export const saveTestProgress = async (attemptId, token, payload) => {
  try {
    const response = await api.put(`/test/attempt/${attemptId}`, { attemptId, token, ...payload });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to save progress',
    };
  }
};
```

### `submitTest` — `frontend/lib/api.js`

**What it does:** Final submit; supports `proctoringDisqualification` flag for violation path.

```javascript
export const submitTest = async (attemptId, token, payload = {}) => {
  try {
    const response = await api.post(`/test/attempt/${attemptId}/submit`, { attemptId, token, ...payload });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to submit test',
    };
  }
};
```

### `saveProgress` (inside `TestTakeContent`) — `frontend/app/test/take/page.js`

**What it does:** Wraps API save; if server returns disqualified, updates local UI state.

```javascript
const saveProgress = useCallback(
  async (extra = {}) => {
    if (!attemptId || !token || status !== "in_progress") return;
    const res = await saveTestProgress(attemptId, token, {
      mcqAnswers,
      codingSubmissions,
      ...extra,
    });
    if (res.success && res.data?.disqualified) {
      setStatus("disqualified");
      setDisqualified(true);
      setError(
        "Disqualified due to proctoring rules violation. Your attempt is not scored and will not be considered for ranking."
      );
    }
  },
  [attemptId, token, status, mcqAnswers, codingSubmissions]
);
```

### `handleSubmit` (inside `TestTakeContent`) — `frontend/app/test/take/page.js`

**What it does:** Submits test; routes disqualified candidates to done page with query flag; normal submit redirects to success done page.

```javascript
const handleSubmit = useCallback(async (proctoringDisqualification = false) => {
  if (status !== "in_progress") return;
  await saveProgress();
  const result = await submitTest(attemptId, token, {
    mcqAnswers,
    codingSubmissions,
    proctoringDisqualification: !!proctoringDisqualification,
  });
  if (result.success) {
    const disq = result.data?.disqualified === true || result.data?.status === "disqualified";
    if (disq) {
      setStatus("disqualified");
      setDisqualified(true);
      toast.warning("Disqualified due to proctoring rules violation. Your attempt will not be scored.");
      router.push(
        `/test/done?token=${encodeURIComponent(token)}&attemptId=${attemptId}&disqualified=1`
      );
    } else {
      setStatus("submitted");
      toast.success("Test submitted successfully.");
      router.push(`/test/done?token=${encodeURIComponent(token)}&attemptId=${attemptId}`);
    }
  } else {
    toast.error(result.error || "Failed to submit");
  }
}, [status, attemptId, token, mcqAnswers, codingSubmissions, saveProgress, router]);
```

### `prepareTestQuestions` — `frontend/lib/api.js`

**What it does:** HR one-click to generate both MCQ pool and coding set via LLM endpoints.

```javascript
export const prepareTestQuestions = async (jobId, idToken) => {
  try {
    await Promise.all([
      api.post(`/llm/generate-mcq-pool/${jobId}`, {}, { headers: { Authorization: `Bearer ${idToken}` } }),
      api.post(`/llm/generate-coding-questions/${jobId}`, {}, { headers: { Authorization: `Bearer ${idToken}` } }),
    ]);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to prepare test questions',
    };
  }
};
```

---

## 5. KEY BACKEND FUNCTIONS

### `validateToken` — `backend/controllers/testController.js`

**What it does:** Validates invite token, expiry, and invitation status; returns job info and in-progress attempt id if any.

```javascript
exports.validateToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Test token is required' });
    }
    const invitation = await TestInvitation.findOne({ token }).populate('jobPost', 'jobTitle company');
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired test link' });
    }
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        error: invitation.status === 'attempted' ? 'You have already attempted this test.' : invitation.status === 'disqualified' ? 'You have been disqualified from this test.' : 'This test link has expired.',
        status: invitation.status,
      });
    }
    if (new Date() > invitation.expiresAt) {
      await TestInvitation.updateOne({ _id: invitation._id }, { status: 'expired' });
      return res.status(400).json({ error: 'This test has expired. The deadline was 1 week from the invitation date.' });
    }
    const inProgressAttempt = await TestAttempt.findOne({
      testInvitation: invitation._id,
      status: 'in_progress',
    }).select('_id');
    res.json({
      valid: true,
      jobTitle: invitation.jobPost.jobTitle,
      company: invitation.jobPost.company,
      expiresAt: invitation.expiresAt,
      token,
      existingAttemptId: inProgressAttempt ? inProgressAttempt._id.toString() : null,
    });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate token' });
  }
};
```

### `startTest` — `backend/controllers/testController.js`

**What it does:** Creates `TestAttempt` with random 30 MCQ order and 3 coding slots; returns sanitized questions.

```javascript
exports.startTest = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Test token is required' });
    }
    const invitation = await TestInvitation.findOne({ token }).populate('jobPost', 'jobTitle company');
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired test link' });
    }
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'You have already started or completed this test.', status: invitation.status });
    }
    if (new Date() > invitation.expiresAt) {
      await TestInvitation.updateOne({ _id: invitation._id }, { status: 'expired' });
      return res.status(400).json({ error: 'This test has expired.' });
    }

    const jobId = invitation.jobPost._id;
    const mcqPool = await TestMcqPool.findOne({ jobPost: jobId });
    const codingDoc = await CodingQuestion.findOne({ jobPost: jobId });

    if (!mcqPool || !mcqPool.questions || mcqPool.questions.length < 30) {
      return res.status(503).json({
        error: 'Test questions are not ready yet. Please try again in a few minutes. If the problem persists, contact the recruiter.',
      });
    }
    if (!codingDoc || !codingDoc.questions || codingDoc.questions.length < CODING_PROBLEM_COUNT) {
      return res.status(503).json({
        error: 'Coding questions are not ready yet. Please try again in a few minutes.',
      });
    }

    const indices = mcqPool.questions.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const mcqOrder = indices.slice(0, 30);
    const mcqQuestions = mcqOrder.map(i => {
      const q = mcqPool.questions[i];
      return { questionText: q.questionText, options: q.options };
    });

    const codingPool = codingDoc.questions.slice(0, CODING_PROBLEM_COUNT);
    const codingQuestions = codingPool.map((q) => ({
      title: q.title,
      statement: q.statement,
      inputFormat: q.inputFormat,
      outputFormat: q.outputFormat,
      sampleInput: q.sampleInput,
      sampleOutput: q.sampleOutput,
      constraints: q.constraints,
      difficulty: q.difficulty,
    }));

    let attempt = await TestAttempt.findOne({ testInvitation: invitation._id });
    if (attempt) {
      if (attempt.status !== 'in_progress') {
        return res.status(400).json({ error: 'You have already submitted this test.', attemptId: attempt._id });
      }
    } else {
      attempt = new TestAttempt({
        testInvitation: invitation._id,
        mcqOrder,
        mcqAnswers: mcqOrder.map((_, i) => ({ questionIndex: i, selectedIndex: -1 })),
        codingSubmissions: codingPool.map((_, i) => ({ questionIndex: i, code: '', language: 'javascript' })),
      });
      await attempt.save();
      await TestInvitation.updateOne({ _id: invitation._id }, { status: 'attempted' });
    }

    res.json({
      success: true,
      attemptId: attempt._id,
      jobTitle: invitation.jobPost.jobTitle,
      company: invitation.jobPost.company,
      durationMinutes: TEST_DURATION_MINUTES,
      mcqQuestions,
      codingQuestions,
      startedAt: attempt.startedAt,
    });
  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({ error: error.message || 'Failed to start test' });
  }
};
```

### `submitTest` — `backend/controllers/testController.js`

**What it does:** Finalizes attempt as `submitted` (triggers async LLM evaluation) or `disqualified` (no scoring).

```javascript
exports.submitTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { token, mcqAnswers, codingSubmissions, proctoringDisqualification } = req.body;
    if (!attemptId || !token) {
      return res.status(400).json({ error: 'attemptId and token are required' });
    }
    const attempt = await TestAttempt.findOne({ _id: attemptId }).populate('testInvitation');
    if (!attempt || !attempt.testInvitation || attempt.testInvitation.token !== token) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (attempt.status !== 'in_progress') {
      return res.json({ success: true, status: attempt.status, message: 'Already submitted' });
    }

    if (Array.isArray(mcqAnswers)) attempt.mcqAnswers = mcqAnswers;
    if (Array.isArray(codingSubmissions)) attempt.codingSubmissions = codingSubmissions.slice(0, CODING_PROBLEM_COUNT);
    attempt.submittedAt = new Date();

    if (proctoringDisqualification === true) {
      attempt.status = 'disqualified';
      attempt.testScore = null;
      attempt.mcqScore = null;
      attempt.codingScore = null;
      attempt.evaluationSummary = null;
      attempt.evaluatedAt = null;
      attempt.mcqBreakdown = [];
      attempt.codingBreakdown = [];
      await attempt.save();
      await TestInvitation.updateOne({ _id: attempt.testInvitation._id }, { status: 'disqualified' });
      return res.json({
        success: true,
        status: 'disqualified',
        disqualified: true,
        submittedAt: attempt.submittedAt,
      });
    }

    attempt.status = 'submitted';
    await attempt.save();

    const evaluateTestAttempt = require('../controllers/llmController').evaluateTestAttempt;
    if (typeof evaluateTestAttempt === 'function') {
      setImmediate(() => {
        evaluateTestAttempt(attempt._id).catch((e) => console.error('Test evaluation error:', e));
      });
    }

    res.json({
      success: true,
      status: 'submitted',
      submittedAt: attempt.submittedAt,
    });
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit test' });
  }
};
```

### `evaluateTestAttempt` — `backend/controllers/llmController.js`

**What it does:** Computes MCQ score + breakdown; calls LLM for coding scores; persists totals and `testScore`.

```javascript
exports.evaluateTestAttempt = async (attemptId) => {
  const attempt = await TestAttempt.findById(attemptId).populate('testInvitation');
  if (!attempt || !attempt.testInvitation || attempt.status !== 'submitted') return;

  const jobId = attempt.testInvitation.jobPost;
  const mcqPool = await TestMcqPool.findOne({ jobPost: jobId });
  const codingDoc = await CodingQuestion.findOne({ jobPost: jobId });
  if (!mcqPool || !mcqPool.questions || !codingDoc || !codingDoc.questions) return;

  let mcqScore = 0;
  const mcqBreakdown = [];
  const mcqOrder = attempt.mcqOrder || [];
  const mcqAnswers = attempt.mcqAnswers || [];
  for (let i = 0; i < mcqOrder.length; i++) {
    const poolIdx = mcqOrder[i];
    const q = mcqPool.questions[poolIdx];
    if (!q || typeof q.correctIndex !== 'number') continue;
    const ans = mcqAnswers.find((a) => a.questionIndex === i);
    const selected = ans && typeof ans.selectedIndex === 'number' ? ans.selectedIndex : -1;
    const correct = selected === q.correctIndex;
    if (correct) mcqScore += 1;
    mcqBreakdown.push({
      orderIndex: i,
      marksObtained: correct ? 1 : 0,
      marksMax: 1,
      questionPreview: String(q.questionText || '').slice(0, 120),
    });
  }
  const maxMcq = 30;
  mcqScore = Math.min(mcqScore, maxMcq);

  let codingScore = 0;
  let evaluationSummary = '';
  let codingBreakdown = [];

  if (model && codingDoc.questions.length > 0 && attempt.codingSubmissions && attempt.codingSubmissions.length > 0) {
    const codingSubs = attempt.codingSubmissions;
    const nProblems = Math.min(CODING_PROBLEM_COUNT, codingDoc.questions.length);
    const parts = codingDoc.questions.slice(0, nProblems).map((q, i) => {
      const sub = codingSubs[i] || {};
      return `Problem ${i + 1} (${q.title}):\nStatement: ${(q.statement || '').slice(0, 500)}\nSample I/O: ${q.sampleInput || ''} -> ${q.sampleOutput || ''}\nCandidate code (${sub.language || 'javascript'}):\n${(sub.code || '').slice(0, 4000)}`;
    }).join('\n\n---\n\n');

    const caps = CODING_MARKS_CAPS.slice(0, nProblems);
    const capsStr = caps.map((c, i) => `problem ${i + 1} max ${c}`).join(', ');

    const prompt = `You are grading a coding test. The test has ${nProblems} problems. Score the candidate's solutions.

${parts}

Score each solution: ${capsStr} (total max 70). Use 0 if empty or nonsensical. Consider correctness, code quality, edge cases.
Reply with ONLY a JSON object (no markdown): { "scores": [s1, s2, s3], "totalCodingScore": number (sum, max 70), "feedback": "one short paragraph" }`;

    try {
      const result = await runBytez(
        [{ role: 'user', content: prompt }],
        1024
      );
      const output = result?.output ?? result?.content ?? result?.text ?? result;
      const text = extractTextFromOutput(output);
      let raw = text.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const obj = JSON.parse(objMatch[0]);
        const scores = obj.scores;
        if (Array.isArray(scores)) {
          codingBreakdown = [];
          for (let i = 0; i < nProblems; i++) {
            const cap = CODING_MARKS_CAPS[i] ?? 23;
            const cq = codingDoc.questions[i];
            const obtained = Math.min(cap, Math.max(0, Math.round(Number(scores[i]) || 0)));
            codingBreakdown.push({
              questionIndex: i,
              title: String(cq?.title || `Problem ${i + 1}`).slice(0, 120),
              marksObtained: obtained,
              marksMax: cap,
            });
          }
          codingScore = Math.min(70, codingBreakdown.reduce((s, r) => s + (r.marksObtained || 0), 0));
        } else if (typeof obj.totalCodingScore === 'number') {
          codingScore = Math.min(70, Math.max(0, Math.round(obj.totalCodingScore)));
          for (let i = 0; i < nProblems; i++) {
            const cq = codingDoc.questions[i];
            codingBreakdown.push({
              questionIndex: i,
              title: String(cq?.title || `Problem ${i + 1}`).slice(0, 120),
              marksObtained: null,
              marksMax: CODING_MARKS_CAPS[i] ?? 23,
            });
          }
        }
        if (typeof obj.feedback === 'string') evaluationSummary = obj.feedback.slice(0, 500);
      }
    } catch (e) {
      console.error('LLM coding evaluation error:', e);
      evaluationSummary = 'Evaluation could not be completed.';
    }
  }

  const totalScore = Math.min(100, mcqScore + codingScore);
  await TestAttempt.updateOne(
    { _id: attemptId },
    {
      mcqScore,
      codingScore,
      testScore: totalScore,
      evaluationSummary: evaluationSummary || null,
      evaluatedAt: new Date(),
      mcqBreakdown,
      codingBreakdown,
    }
  );
};
```

### `runCode` — `backend/services/codeRunService.js`

**What it does:** Executes candidate code via Piston (or Node for JavaScript path).

```javascript
async function runCode(language, code, stdin = '') {
  if (!code || typeof code !== 'string') {
    return { stdout: '', stderr: '', exitCode: -1, error: 'No code provided' };
  }
  if (code.length > MAX_CODE_LENGTH) {
    return { stdout: '', stderr: '', exitCode: -1, error: `Code too long (max ${MAX_CODE_LENGTH} chars)` };
  }
  if (stdin.length > MAX_STDIN_LENGTH) {
    return { stdout: '', stderr: '', exitCode: -1, error: `Input too long (max ${MAX_STDIN_LENGTH} chars)` };
  }

  const lang = LANGUAGE_MAP[language?.toLowerCase()] || 'javascript';

  if (lang === 'javascript') {
    const nodeResult = await runJavaScriptNode(code, String(stdin));
    if (nodeResult.exitCode >= 0) return nodeResult;
  }

  const { name, language: pistonLang } = pistonFileFor(lang);

  try {
    const response = await axios.post(
      `${PISTON_URL}/execute`,
      {
        language: pistonLang,
        version: '*',
        files: [{ name, content: code }],
        stdin: String(stdin),
      },
      { timeout: RUN_TIMEOUT_MS }
    );

    const data = response.data || {};
    return {
      stdout: data.run?.stdout != null ? String(data.run.stdout) : '',
      stderr: data.run?.stderr != null ? String(data.run.stderr) : '',
      exitCode: data.run?.code != null ? Number(data.run.code) : 0,
    };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
      if (lang === 'javascript') {
        return runJavaScriptNode(code, String(stdin));
      }
      return {
        stdout: '',
        stderr: '',
        exitCode: -1,
        error: 'Code execution service is temporarily unavailable. Try again later.',
      };
    }
    const msg = err.response?.data?.message || err.message || 'Execution failed';
    return { stdout: '', stderr: msg, exitCode: -1, error: msg };
  }
}
```

---

## 6. DATABASE MODEL / SCHEMA

### `backend/config/assessmentConfig.js`

```javascript
/** Online test: coding section (MCQ section stays 30 marks; coding totals 70). */
module.exports = {
  CODING_PROBLEM_COUNT: 3,
  /** Per-problem caps; must sum to 70 (matches LLM grading). */
  CODING_MARKS_CAPS: [24, 23, 23],
};
```

**Important fields:** `CODING_PROBLEM_COUNT` drives how many problems are served, saved, and graded; `CODING_MARKS_CAPS` must stay aligned with the LLM rubric and UI totals.

### `backend/models/TestInvitation.js` (full)

```javascript
const mongoose = require('mongoose');
const crypto = require('crypto');

const testInvitationSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true,
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'attempted', 'expired', 'disqualified'],
    default: 'pending',
  },
  invitationSentAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

testInvitationSchema.index({ candidate: 1, jobPost: 1 });

module.exports = mongoose.model('TestInvitation', testInvitationSchema);
```

**Key fields:** `token` + `expiresAt` (secure access window); `status` (lifecycle including disqualification).

### `backend/models/TestAttempt.js` (full)

```javascript
const mongoose = require('mongoose');

const testAttemptSchema = new mongoose.Schema({
  testInvitation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestInvitation',
    required: true,
    unique: true,
  },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'disqualified', 'expired'],
    default: 'in_progress',
  },
  mcqOrder: [Number],
  mcqAnswers: [{
    questionIndex: Number,
    selectedIndex: { type: Number, default: -1 },
  }],
  codingSubmissions: [{
    questionIndex: Number,
    code: { type: String, default: '' },
    language: { type: String, default: 'javascript' },
  }],
  proctoringEvents: [{
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    payload: mongoose.Schema.Types.Mixed,
  }],
  violationCount: { type: Number, default: 0 },
  testScore: { type: Number, default: null },
  mcqScore: { type: Number, default: null },
  codingScore: { type: Number, default: null },
  evaluationSummary: { type: String, default: null },
  evaluatedAt: { type: Date, default: null },
  mcqBreakdown: [{
    orderIndex: Number,
    marksObtained: Number,
    marksMax: { type: Number, default: 1 },
    questionPreview: { type: String, default: '' },
  }],
  codingBreakdown: [{
    questionIndex: Number,
    title: { type: String, default: '' },
    marksObtained: Number,
    marksMax: { type: Number, default: 23 },
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
```

**Key fields:** `mcqOrder` + `mcqAnswers` (bind to pool without leaking keys); `codingSubmissions` (source for LLM grading); `status` / `violationCount` / `proctoringEvents`; `testScore`, `mcqBreakdown`, `codingBreakdown` for HR views.

### `backend/models/TestMcqPool.js` (full)

```javascript
const mongoose = require('mongoose');

const mcqItemSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
}, { _id: true });

const testMcqPoolSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true,
    unique: true,
  },
  questions: [mcqItemSchema],
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TestMcqPool', testMcqPoolSchema);
```

### `backend/models/CodingQuestion.js` (full)

```javascript
const mongoose = require('mongoose');

const codingQuestionItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  statement: { type: String, required: true },
  inputFormat: { type: String, default: '' },
  outputFormat: { type: String, default: '' },
  sampleInput: { type: String, default: '' },
  sampleOutput: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  constraints: { type: String, default: '' },
}, { _id: true });

const codingQuestionSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true,
    unique: true,
  },
  questions: [codingQuestionItemSchema],
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
```

---

## 7. API ENDPOINTS USED IN THIS MODULE

Base URLs: **`/api/test`** (public), **`/api/llm`** (HR auth), **`/api/hire-pipeline`** (HR auth).

| Method | Endpoint | Controller / handler | Purpose |
|--------|----------|----------------------|---------|
| GET | `/api/test/validate-token` | `testController.validateToken` | Validate invite link |
| POST | `/api/test/start` | `testController.startTest` | Begin exam; create/load attempt |
| GET | `/api/test/attempt/:attemptId` | `testController.getAttempt` | Resume / sync questions + answers |
| PUT | `/api/test/attempt/:attemptId` | `testController.saveProgress` | Autosave; proctoring events; DQ threshold |
| POST | `/api/test/attempt/:attemptId/submit` | `testController.submitTest` | Submit or proctoring disqualify |
| POST | `/api/test/run-code` | `testController.runCode` | Execute code (Piston/Node) |
| POST | `/api/llm/generate-mcq-pool/:jobId` | `llmController.generateMcqPool` | LLM generate MCQ bank |
| POST | `/api/llm/generate-coding-questions/:jobId` | `llmController.generateCodingQuestions` | LLM generate coding set |
| GET | `/api/llm/job-test-content/:jobId` | `llmController.getJobTestContent` | HR fetch pools for editing |
| POST | `/api/llm/save-job-test-content/:jobId` | `llmController.saveJobTestContent` | HR save finalized content |
| POST | `/api/llm/regenerate-job-test/:jobId` | `llmController.regenerateJobTestWithInstruction` | Regenerate with HR instruction |
| POST | `/api/llm/send-test-top50/:jobId` | `llmController.sendTestInvitesTop50` | Create invites + send emails |
| GET | `/api/hire-pipeline/cv-ranked/:jobId` | `hirePipelineController.getCvRankedCandidates` | CV-ranked list (pipeline) |
| GET | `/api/hire-pipeline/test-participants/:jobId` | `hirePipelineController.getTestParticipants` | Post-invite participant list |
| GET | `/api/hire-pipeline/test-participant/:applicationId` | `hirePipelineController.getTestParticipantDetail` | Score breakdown / DQ detail |
| POST | `/api/hire-pipeline/physical-interview/:jobId` | `hirePipelineController.sendPhysicalInterviewRound` | Next pipeline stage |
| POST | `/api/hire-pipeline/final-hire/:jobId` | `hirePipelineController.completeFinalHire` | Close hiring |
| GET | `/api/hire-pipeline/onboarding-hires` | `hirePipelineController.getOnboardingHires` | Hired list |

**Related (HR job update on Finalize Hire page):** `updateJobPost` in frontend typically hits your jobs API (not listed in `test.js`) for **application deadline** — wire as per your `api.js` job routes.

**Internal (not HTTP):** `llmController.evaluateTestAttempt` — invoked from `submitTest` via `setImmediate`.

---

## 8. SLIDE-READY SUMMARY

- **Smarter screening at scale:** Turns CV ranking into a **structured technical test** so many candidates can be compared fairly on the same job-specific content.  
- **AI-assisted content & grading:** Uses an LLM to help produce **large MCQ banks** and **coding problems**, and to **score free-form code** alongside automatic MCQ marking.  
- **Secure candidate experience:** **Unique links**, **time limits**, and **optional proctoring** (camera + focus rules) reduce cheating and support academic integrity.  
- **Hands-on coding environment:** In-browser **Monaco editor** with **live code execution** on the server for realistic problem solving.  
- **End-to-end hiring fit:** Results flow into **HR dashboards** for shortlisting, **interview rounds**, and **final hire** — one continuous pipeline from test to offer.  
- **Clear outcomes:** Each attempt yields a **total score** and **per-section breakdown**, while **disqualified** attempts are flagged **without** ranking scores.

---

*Generated from the NeuroHire codebase structure as of the documented implementation. Adjust timings/copy (e.g. validate-token expiry message) if you align all user-facing strings with the 10-minute invite window.*
