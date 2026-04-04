# NeuroHire — Smart Candidate Ranking (All Criteria) — Presentation Pack

Single structured document for FYP slides, diagrams, and technical reference. Based on the repository source code.

---

## 1. MODULE OVERVIEW

### What is this module?

The **Smart Candidate Ranking** module scores each **job application** against the **job post** using an **LLM** (Bytez, default `openai/gpt-4o`). It produces **six sub-scores** (0–10 scale each): **experience**, **projects**, **skills**, **certificates**, **education**, and **languages**, then combines them into a **weighted total** using the **Priority Weight Distribution** defined when HR creates the job. Scores are stored on **`Application.scores`** with **`rankedAt`** timestamps. HR triggers **batch evaluation after the application deadline** or **instant evaluation** for a single applicant before the deadline; the **Ranked Candidates** UI lists people sorted by **total score** and (in the “ranked” view) merges **online test** results for shortlisted candidates.

### What problem does it solve?

- **Fair, consistent comparison:** Many applicants are judged with the **same rubric** and **same job context**, instead of ad-hoc reading.
- **Multi-criteria hiring:** Recruiters choose **how much each dimension matters** (weights must sum to 100%).
- **Operational workflow:** Clear path from **deadline → evaluate → shortlist → test → ranked board** with scores visible per criterion.

### FYP slide summary (2–3 lines)

> Each application is scored by **AI** on **six dimensions**—skills, experience, education, projects, certificates, and languages—using the **full job description** and the candidate’s **parsed profile**. HR sets **percentage weights** so the **final score** reflects what the role truly needs. Results drive an **ordered candidate list** and integrate with **online tests** for the next hiring stage.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Full path | Role |
|-----------|------|
| `frontend/app/hr/ranked-candidates/page.js` | **Ranked Candidates** UI: job picker, **Evaluate applications**, **instant ranking** per row, fetches ranked/evaluated/applicants views, displays **per-criterion scores** and total |
| `frontend/lib/api.js` | `getJobsForRanking`, `getRankedCandidates`, `getEvaluatedCandidates`, `getApplicationsByJob`, `evaluateJobApplications`, `evaluateOneApplication` |
| `frontend/lib/config.js` | Endpoint helpers (e.g. `ranked: (jobId) => ...`) |
| `frontend/lib/useHrDarkMode.js` | Shared dark mode for HR pages including ranked candidates |
| `frontend/components/ProtectedRoute.jsx` | HR-only access to `/hr/ranked-candidates` |
| `frontend/lib/firebase.js` | Firebase auth → Bearer token for APIs |
| `frontend/app/hr/dashboard/page.js` | Navigation link to ranked candidates |
| `frontend/app/hr/job-posting/page.js` | **Weightage** inputs (must sum 100%), link to ranked candidates |

### Backend

| Full path | Role |
|-----------|------|
| `backend/services/scoringService.js` | **`scoreCandidate`**, **`calculateTotalScore`**, LLM prompts for each criterion (`scoreExperience`, `scoreProjects`, …) |
| `backend/controllers/applicationController.js` | **`evaluateJobApplications`**, **`evaluateOneApplication`**, **`getApplicationsByJob`**, **`getEvaluatedCandidates`**, **`getRankedCandidates`**, **`getJobsForRanking`** |
| `backend/routes/applications.js` | Routes under `/api/applications` for evaluate, by-job, evaluated, ranked, jobs-for-ranking |
| `backend/index.js` | `app.use('/api/applications', applicationRoutes)` |

### Database

| Full path | Role |
|-----------|------|
| `backend/models/Application.js` | **`scores`** (per dimension + **`total`**), **`rankedAt`**, **`extractedData`** / **`formData`** (input to scoring) |
| `backend/models/JobPost.js` | **`weightage`** (Mixed), **`evaluatedAt`**, job text fields used to build the scoring context |

### Related (ranked list enrichment, not core “all criteria” scoring)

| Full path | Role |
|-----------|------|
| `backend/models/TestInvitation.js` | Filters who appears in **`getRankedCandidates`** |
| `backend/models/TestAttempt.js` | **Test scores** appended in ranked view |

### Config / environment

| Item | Role |
|------|------|
| `BYTEZ_API_KEY`, `BYTEZ_MODEL` (optional) | LLM access for `scoringService.js` |

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### 3A — Narrative (step-by-step)

**A) HR defines criteria weights (upstream of ranking)**

1. HR completes **Priority Weight Distribution** on **Job Posting** (skills, education, experience, projects, language, optional custom keys) → must sum to **100%**.  
2. **`POST/PUT` job APIs** persist **`JobPost.weightage`** and job text (**`generatedDescription`**, **`keyResponsibilities`**, **`skills`**, **`experience`**, **`education`**, etc.).

**B) Candidate data enters scoring (upstream)**

1. Candidate applies → **`Application`** stores **`formData`**, optional **`extractedData`** (from CV parsing).  
2. **`scoreCandidate`** prefers **`application.extractedData`** over **`formData`** for richer structure (e.g. education object, skill arrays).

**C) Batch ranking after deadline**

1. HR opens **`/hr/ranked-candidates`**, selects a job → **`getJobsForRanking`** may have already loaded the job list.  
2. When **deadline has passed** and **`evaluatedAt`** is not set, HR clicks **Evaluate applications** → **`evaluateJobApplications(selectedJobId, idToken)`** → **`POST /api/applications/evaluate-job/:jobId`** with Bearer token.  
3. **`evaluateJobApplications`** checks **HR role**, loads **`JobPost`** by **`jobId`** and **owner**, rejects if **`deadline` > now**.  
4. **`Application.find({ jobPost })`**, filter **`!rankedAt`**.  
5. In **batches of 5** (`BATCH_SIZE`), for each app: **`scoreCandidate(app, jobPost)`** → six LLM calls inside **`scoringService`** (parallel sub-scores conceptually sequential per candidate in code) → **`calculateTotalScore(scores, jobPost.weightage)`** → assign **`app.scores`**, **`app.rankedAt = now`**, **`save()`**. On failure: zero scores + still set **`rankedAt`**.  
6. **`jobPost.evaluatedAt = now`**, **`save()`**.  
7. Response **`{ success, evaluated }`** → frontend **toast** and **`fetchRankedCandidates`**.

**D) Instant ranking (one application, before or after deadline)**

1. In **applicants** view, HR clicks **Show instant ranking** on a row → **`evaluateOneApplication(applicationId, idToken)`** → **`POST /api/applications/evaluate-one/:applicationId`**.  
2. Controller loads **`Application`**, verifies **`JobPost`** belongs to HR, runs **`scoreCandidate`**, saves **`scores`** + **`rankedAt`**, returns per-dimension breakdown.

**E) Fetching lists for the UI**

1. **`getRankedCandidates(jobId)`** → **`GET /api/applications/ranked/:jobId`**.  
2. Controller loads **`TestInvitation`** for that job; **only applications with an invitation** are returned (shortlist path). Sort by **`scores.total`** desc. Joins **`TestAttempt`** for **test** column.  
3. If that list is empty but job was evaluated, frontend falls back to **`getEvaluatedCandidates`** → **`GET .../evaluated-candidates/:jobId`** (all apps with scores, **`jobPost.evaluatedAt`** required).  
4. If still empty, fallback **`getApplicationsByJob`** → **`GET .../by-job/:jobId`** for raw applicants + any existing scores.

**F) Frontend display**

1. **`fetchRankedCandidates`** merges API results, sorts by **`totalScore`**, sets **`viewMode`**: **`ranked` | `evaluated` | `applicants`**.  
2. Cards show **Exp, Proj, Skills, Cert, Edu, Lang** (and **Test** when present).

---

### 3B — Diagram tool prompt (copy-paste)

```
Generate a data flow diagram with swimlanes: HR Browser, Next.js Ranked Candidates Page, Express API, Scoring Service (LLM Bytez), MongoDB.

Job setup (before ranking):
HR sets weight percentages on Job Post → JobPost document saved (weightage sum 100, job description, skills, education requirements)

Application:
Candidate submit → Application with formData and optional extractedData

Batch evaluate after deadline:
HR clicks Evaluate → POST /api/applications/evaluate-job/:jobId + Firebase token
→ verify HR owns JobPost, deadline must be past
→ find Applications for job where rankedAt is null
→ for each (batched): scoreCandidate(application, jobPost)
  → build jobDescription text from JobPost fields
  → read candidate from extractedData or formData
  → LLM: score experience, projects, skills, certificates, education, languages (0-10 each)
  → calculateTotalScore weighted by jobPost.weightage
  → write Application.scores and rankedAt
→ set JobPost.evaluatedAt
→ JSON response

Instant evaluate:
POST /api/applications/evaluate-one/:applicationId → same scoreCandidate path for one row

Read lists:
GET ranked/:jobId → invitations filter + sort by total score + attach test attempts
GET evaluated-candidates/:jobId → all applications sorted by total (after evaluatedAt set)
GET by-job/:jobId → all applications for job with optional partial scores

UI:
fetchRankedCandidates tries ranked then evaluated then by-job; render cards with criterion scores and total
```

---

## 4. KEY FRONTEND FUNCTIONS

### `getJobsForRanking` — `frontend/lib/api.js`

**What it does:** Loads HR’s non-deleted jobs for the ranked-candidates dropdown.

```javascript
export const getJobsForRanking = async (idToken) => {
  try {
    const response = await api.get('/applications/jobs-for-ranking', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch jobs',
    };
  }
};
```

### `getRankedCandidates` — `frontend/lib/api.js`

**What it does:** Fetches shortlisted (test-invited) candidates with CV scores and optional test scores.

```javascript
export const getRankedCandidates = async (jobId, idToken) => {
  try {
    const response = await api.get(`/applications/ranked/${jobId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch ranked candidates',
    };
  }
};
```

### `getEvaluatedCandidates` — `frontend/lib/api.js`

**What it does:** Returns all evaluated applications for a job (sorted by total score) after **`evaluatedAt`** is set.

```javascript
export const getEvaluatedCandidates = async (jobId, idToken) => {
  try {
    const response = await api.get(`/applications/evaluated-candidates/${jobId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch candidates',
    };
  }
};
```

### `getApplicationsByJob` — `frontend/lib/api.js`

**What it does:** Lists all applicants for a job (used for pre-deadline / instant-ranking UI).

```javascript
export const getApplicationsByJob = async (jobId, idToken) => {
  try {
    const response = await api.get(`/applications/by-job/${jobId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch applications',
    };
  }
};
```

### `evaluateJobApplications` — `frontend/lib/api.js`

**What it does:** Triggers post-deadline batch scoring for all unranked applications.

```javascript
export const evaluateJobApplications = async (jobId, idToken) => {
  try {
    const response = await api.post(`/applications/evaluate-job/${jobId}`, {}, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to evaluate applications',
    };
  }
};
```

### `evaluateOneApplication` — `frontend/lib/api.js`

**What it does:** Scores a single application immediately (instant ranking).

```javascript
export const evaluateOneApplication = async (applicationId, idToken) => {
  try {
    const response = await api.post(`/applications/evaluate-one/${applicationId}`, {}, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to evaluate',
    };
  }
};
```

### `fetchRankedCandidates` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Orchestrates **ranked → evaluated → applicants** fallback and updates **`viewMode`** and sorted **`candidates`**.

```javascript
  const fetchRankedCandidates = async (jobId) => {
    if (!jobId) {
      setCandidates([]);
      setJobInfo(null);
      setJobMeta(null);
      setViewMode("ranked");
      setCurrentPage(1);
      setSelectedCandidates([]);
      setSelectAll(false);
      return;
    }

    try {
      setLoading(true);
      const result = await getRankedCandidates(jobId, idToken);
      if (result.success) {
        const list = result.data.candidates || [];
        setJobMeta({
          deadline: result.data.deadline,
          evaluatedAt: result.data.evaluatedAt,
          remarks: result.data.remarks,
        });
        setJobInfo({
          jobTitle: result.data.jobTitle,
          company: result.data.company,
        });
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
          setCandidates(sorted);
          setViewMode("ranked");
        } else if (result.data.evaluatedAt) {
          const evalResult = await getEvaluatedCandidates(jobId, idToken);
          if (evalResult.success && (evalResult.data.candidates || []).length > 0) {
            setCandidates(evalResult.data.candidates || []);
            setViewMode("evaluated");
          } else {
            setCandidates([]);
            setViewMode("ranked");
          }
        } else {
          const byJobResult = await getApplicationsByJob(jobId, idToken);
          if (byJobResult.success && (byJobResult.data.candidates || []).length > 0) {
            const apps = (byJobResult.data.candidates || []).sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
            setCandidates(apps);
            setViewMode("applicants");
          } else {
            setCandidates([]);
            setViewMode("ranked");
          }
        }
        setCurrentPage(1);
        setSelectedCandidates([]);
        setSelectAll(false);
      } else {
        toast.error(result.error || "Failed to fetch ranked candidates");
        setCandidates([]);
        setJobInfo(null);
        setJobMeta(null);
      }
    } catch (error) {
      console.error("Error fetching ranked candidates:", error);
      toast.error("Failed to fetch ranked candidates");
      setCandidates([]);
      setJobInfo(null);
      setJobMeta(null);
    } finally {
      setLoading(false);
    }
  };
```

### `handleEvaluateJob` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Runs batch evaluation after deadline, then refreshes jobs and candidate list.

```javascript
  const handleEvaluateJob = async () => {
    if (!selectedJobId || !idToken) return;
    setEvaluating(true);
    try {
      const result = await evaluateJobApplications(selectedJobId, idToken);
      if (result.success) {
        toast.success(result.data?.message || "Applications evaluated.");
        fetchJobs(idToken);
        fetchRankedCandidates(selectedJobId);
      } else {
        toast.error(result.error || "Evaluation failed");
      }
    } catch (e) {
      toast.error("Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };
```

### `handleShowInstantRanking` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Calls single-application evaluate and refreshes the list.

```javascript
  const handleShowInstantRanking = async (applicationId) => {
    if (!idToken) return;
    setEvaluatingOneId(applicationId);
    try {
      const result = await evaluateOneApplication(applicationId, idToken);
      if (result.success) {
        toast.success("Instant ranking done. This candidate is scored; rest will be ranked after deadline.");
        fetchRankedCandidates(selectedJobId);
      } else {
        toast.error(result.error || "Evaluation failed");
      }
    } catch (e) {
      toast.error("Evaluation failed");
    } finally {
      setEvaluatingOneId(null);
    }
  };
```

---

## 5. KEY BACKEND FUNCTIONS

### Route wiring — `backend/routes/applications.js` (ranking-related excerpt)

**What it does:** Maps HTTP paths to **`applicationController`** ranking handlers.

```javascript
// Evaluate all applications for a job after deadline (HR only)
router.post('/evaluate-job/:jobId', applicationController.evaluateJobApplications);

// Get all applications for a job (HR only) - for instant ranking / pre-deadline view
router.get('/by-job/:jobId', applicationController.getApplicationsByJob);

// Evaluate one application instantly (HR only) - show 1 candidate ranking; rest ranked after deadline
router.post('/evaluate-one/:applicationId', applicationController.evaluateOneApplication);

// Get all evaluated candidates for a job so HR can send test emails (HR only)
router.get('/evaluated-candidates/:jobId', applicationController.getEvaluatedCandidates);

// Get ranked candidates (only those sent test invite) (HR only)
router.get('/ranked/:jobId', applicationController.getRankedCandidates);

// Get all jobs for ranking selection (HR only)
router.get('/jobs-for-ranking', applicationController.getJobsForRanking);
```

### `evaluateJobApplications` — `backend/controllers/applicationController.js`

**What it does:** After **deadline**, scores all applications without **`rankedAt`**, in **parallel batches of 5**, sets **`JobPost.evaluatedAt`**.

```javascript
const BATCH_SIZE = 5;
exports.evaluateJobApplications = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can evaluate applications' });
    }
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    const now = new Date();
    if (new Date(jobPost.deadline) > now) {
      return res.status(400).json({ error: 'Application deadline has not passed yet. Evaluate after the deadline.' });
    }

    const applications = await Application.find({ jobPost: jobId }).populate('candidate', 'name email');
    const toEvaluate = applications.filter((app) => !app.rankedAt);
    if (toEvaluate.length === 0) {
      return res.json({ success: true, message: 'No applications left to evaluate (all already ranked).', evaluated: 0 });
    }

    for (let i = 0; i < toEvaluate.length; i += BATCH_SIZE) {
      const batch = toEvaluate.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (app) => {
          try {
            const scores = await scoreCandidate(app, jobPost);
            app.scores = scores;
            app.rankedAt = new Date();
            await app.save();
          } catch (err) {
            console.error('Scoring failed for application', app._id, err);
            app.scores = { experience: 0, projects: 0, skills: 0, certificates: 0, education: 0, languages: 0, total: 0 };
            app.rankedAt = new Date();
            await app.save();
          }
        })
      );
    }

    jobPost.evaluatedAt = new Date();
    await jobPost.save();

    res.json({
      success: true,
      message: `Evaluated ${toEvaluate.length} application(s)`,
      evaluated: toEvaluate.length,
    });
  } catch (error) {
    console.error('Evaluate job error:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate applications' });
  }
}];
```

### `getApplicationsByJob` — `backend/controllers/applicationController.js`

**What it does:** Returns every applicant with score fields (null until evaluated) for HR table/cards.

```javascript
exports.getApplicationsByJob = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR can view applications' });
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    const applications = await Application.find({ jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ rankedAt: -1, 'scores.total': -1, createdAt: -1 });

    const candidates = applications.map((app) => ({
      _id: app._id,
      candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'N/A',
      email: app.candidate?.email || app.formData?.email,
      phone: app.formData?.phone,
      totalScore: app.scores?.total ?? null,
      experienceScore: app.scores?.experience ?? null,
      projectsScore: app.scores?.projects ?? null,
      skillsScore: app.scores?.skills ?? null,
      certificatesScore: app.scores?.certificates ?? null,
      educationScore: app.scores?.education ?? null,
      languagesScore: app.scores?.languages ?? null,
      rankedAt: app.rankedAt || null,
    }));

    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      deadline: jobPost.deadline,
      evaluatedAt: jobPost.evaluatedAt,
      candidates,
    });
  } catch (error) {
    console.error('Get applications by job error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch applications' });
  }
}];
```

### `evaluateOneApplication` — `backend/controllers/applicationController.js`

**What it does:** Instant **`scoreCandidate`** for one **`applicationId`**.

```javascript
exports.evaluateOneApplication = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR can evaluate' });
    const { applicationId } = req.params;
    if (!applicationId) return res.status(400).json({ error: 'applicationId required' });

    const application = await Application.findById(applicationId).populate('candidate', 'name email');
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    try {
      const scores = await scoreCandidate(application, jobPost);
      application.scores = scores;
      application.rankedAt = new Date();
      await application.save();
    } catch (err) {
      console.error('Instant scoring failed', applicationId, err);
      application.scores = { experience: 0, projects: 0, skills: 0, certificates: 0, education: 0, languages: 0, total: 0 };
      application.rankedAt = new Date();
      await application.save();
    }

    res.json({
      success: true,
      message: 'Candidate evaluated (instant ranking).',
      candidate: {
        _id: application._id,
        totalScore: application.scores?.total ?? 0,
        experienceScore: application.scores?.experience ?? 0,
        projectsScore: application.scores?.projects ?? 0,
        skillsScore: application.scores?.skills ?? 0,
        certificatesScore: application.scores?.certificates ?? 0,
        educationScore: application.scores?.education ?? 0,
        languagesScore: application.scores?.languages ?? 0,
      },
    });
  } catch (error) {
    console.error('Evaluate one error:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate' });
  }
}];
```

### `getRankedCandidates` — `backend/controllers/applicationController.js`

**What it does:** Returns applications that have a **test invitation**, sorted by **total score**, enriched with **test attempt** scores.

```javascript
exports.getRankedCandidates = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can view ranked candidates' });
    }

    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const jobPost = await JobPost.findOne({
      _id: jobId,
      createdBy: req.user._id
    });

    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    const invitations = await TestInvitation.find({ jobPost: jobId }).lean();
    const appIds = invitations.map((inv) => inv.application);
    if (appIds.length === 0) {
      return res.json({
        jobTitle: jobPost.jobTitle,
        company: jobPost.company,
        deadline: jobPost.deadline,
        evaluatedAt: jobPost.evaluatedAt,
        candidates: [],
        message: 'No candidates sent test yet. Evaluate applications (after deadline), then send test emails to see ranked candidates here.',
      });
    }

    const applications = await Application.find({ _id: { $in: appIds }, jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ 'scores.total': -1, createdAt: -1 });

    const invByApp = {};
    invitations.forEach((inv) => { invByApp[inv.application.toString()] = inv; });
    const invIds = invitations.map((i) => i._id);
    const attempts = await TestAttempt.find({
      testInvitation: { $in: invIds },
      status: 'submitted',
    }).select('testInvitation testScore mcqScore codingScore evaluationSummary').lean();
    const attemptByInv = {};
    attempts.forEach((a) => { attemptByInv[a.testInvitation.toString()] = a; });

    const rankedCandidates = applications.map((app) => {
      const inv = invByApp[app._id.toString()];
      const attempt = inv ? attemptByInv[inv._id.toString()] : null;
      const hasTestScore = attempt != null && typeof attempt.testScore === 'number';
      return {
        _id: app._id,
        candidateName: app.candidate.name || `${app.formData.firstName} ${app.formData.lastName}`,
        email: app.candidate.email || app.formData.email,
        phone: app.formData.phone,
        experienceScore: app.scores.experience || 0,
        projectsScore: app.scores.projects || 0,
        skillsScore: app.scores.skills || 0,
        certificatesScore: app.scores.certificates || 0,
        educationScore: app.scores.education || 0,
        languagesScore: app.scores.languages || 0,
        totalScore: app.scores.total || 0,
        testScore: hasTestScore ? attempt.testScore : null,
        testStatus: hasTestScore ? attempt.testScore : 'pending',
        testMcqScore: attempt != null && typeof attempt.mcqScore === 'number' ? attempt.mcqScore : null,
        testCodingScore: attempt != null && typeof attempt.codingScore === 'number' ? attempt.codingScore : null,
        testEvaluationSummary: attempt?.evaluationSummary || null,
        interviewInviteSentAt: app.interviewInviteSentAt || null,
        selectedAsHire: app.selectedAsHire || false,
        trainingPlanPdfPath: app.trainingPlanPdfPath || null,
        status: app.status,
        appliedAt: app.createdAt,
        rankedAt: app.rankedAt,
      };
    });

    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      deadline: jobPost.deadline,
      evaluatedAt: jobPost.evaluatedAt,
      remarks: jobPost.remarks,
      candidates: rankedCandidates,
    });
  } catch (error) {
    console.error('Get ranked candidates error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch ranked candidates' });
  }
}];
```

### `getEvaluatedCandidates` — `backend/controllers/applicationController.js`

**What it does:** After **`evaluatedAt`** is set, lists **all** applications with scores for shortlisting / test emails.

```javascript
exports.getEvaluatedCandidates = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR can view' });
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });
    if (!jobPost.evaluatedAt) return res.status(400).json({ error: 'Job not evaluated yet. Run evaluation after application deadline.' });

    const applications = await Application.find({ jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ 'scores.total': -1, createdAt: -1 });

    const candidates = applications.map((app) => ({
      _id: app._id,
      candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'N/A',
      email: app.candidate?.email || app.formData?.email,
      phone: app.formData?.phone,
      totalScore: app.scores?.total ?? 0,
      experienceScore: app.scores?.experience ?? 0,
      projectsScore: app.scores?.projects ?? 0,
      skillsScore: app.scores?.skills ?? 0,
      certificatesScore: app.scores?.certificates ?? 0,
      educationScore: app.scores?.education ?? 0,
      languagesScore: app.scores?.languages ?? 0,
    }));

    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      candidates,
    });
  } catch (error) {
    console.error('Get evaluated candidates error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch' });
  }
}];
```

### `getJobsForRanking` — `backend/controllers/applicationController.js`

**What it does:** Job picker source for the ranking page.

```javascript
exports.getJobsForRanking = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can view jobs' });
    }

    const jobs = await JobPost.find({
      createdBy: req.user._id,
      remarks: { $ne: 'deleted' }
    })
      .select('jobTitle company _id deadline evaluatedAt remarks')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    console.error('Get jobs for ranking error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch jobs' });
  }
}];
```

### Full `backend/services/scoringService.js`

**What it does:** All LLM-based criterion scorers, **`calculateTotalScore`**, and **`scoreCandidate`** orchestration.

See the complete file on disk at **`backend/services/scoringService.js`** (671 lines). It is identical in scope to the repository version and includes:

- `extractOutputText`, `parseScoreFromOutput`
- `scoreExperience`, `scoreProjects`, `scoreCertificates`, `scoreSkills`, `scoreLanguages`, `scoreEducation`
- `calculateTotalScore(scores, weightage)` — normalizes weights to sum to 100 when needed
- `scoreCandidate(application, jobPost)` — builds job description, reads `extractedData` / `formData`, runs six scorers, sets `scores.total`

```javascript
const Bytez = require('bytez.js');

let sdk, model;

try {
  const key = process.env.BYTEZ_API_KEY;
  const modelId = process.env.BYTEZ_MODEL || 'openai/gpt-4o';
  if (key) {
    sdk = new Bytez(key);
    model = sdk.model(modelId);
  }
} catch (error) {
  console.error('LLM functionality will not work until bytez.js is installed.');
}

function extractOutputText(output) {
  if (typeof output === 'string') {
    return output;
  } else if (output && typeof output === 'object') {
    if (output.content) {
      return typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
    } else if (output.text) {
      return typeof output.text === 'string' ? output.text : JSON.stringify(output.text);
    } else if (output.message) {
      return typeof output.message === 'string' ? output.message : JSON.stringify(output.message);
    } else if (Array.isArray(output)) {
      return output.map(item => {
        if (typeof item === 'string') return item;
        if (item && item.content) return item.content;
        return JSON.stringify(item);
      }).join('\n');
    } else {
      return JSON.stringify(output, null, 2);
    }
  } else {
    return String(output || '');
  }
}

function parseScoreFromOutput(outputText, fieldName, allowDecimals = false) {
  try {
    let cleanedText = outputText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        let score = 0;
        if (allowDecimals) {
          score = parseFloat(result.score) || parseFloat(result.Score) || parseFloat(result.SCORE) || 0;
        } else {
          score = parseInt(result.score) || parseInt(result.Score) || parseInt(result.SCORE) || 0;
        }
        const finalScore = allowDecimals 
          ? Math.max(0, Math.min(10, Math.round(score * 10) / 10))
          : Math.max(0, Math.min(10, score));
        if (finalScore > 0 || fieldName === 'education') {
          console.log(`Successfully parsed ${fieldName} score:`, finalScore);
        }
        return finalScore;
      } catch (parseError) {
        console.error(`Error parsing JSON for ${fieldName}:`, parseError);
        console.error('JSON string:', jsonMatch[0].substring(0, 200));
      }
    }
    if (allowDecimals) {
      const decimalMatch = outputText.match(/\b([0-9]+\.[0-9]+|[0-9]|10)\b/);
      if (decimalMatch) {
        const score = parseFloat(decimalMatch[0]);
        const finalScore = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
        if (finalScore > 0 || fieldName === 'education') {
          console.log(`Extracted ${fieldName} score from text:`, finalScore);
        }
        return finalScore;
      }
    } else {
      const numberMatch = outputText.match(/\b([0-9]|10)\b/);
      if (numberMatch) {
        const score = parseInt(numberMatch[0]);
        const finalScore = Math.max(0, Math.min(10, score));
        if (finalScore > 0) {
          console.log(`Extracted ${fieldName} score from text:`, finalScore);
        }
        return finalScore;
      }
    }
    console.error(`Could not parse ${fieldName} score from output:`, outputText.substring(0, 300));
    return 0;
  } catch (error) {
    console.error(`Error parsing ${fieldName} score:`, error);
    return 0;
  }
}

async function scoreExperience(experience, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  const prompt = `Rate the following candidate's experience on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the experience aligns with the job's needs, quality, recency, and depth.

Job Requirements: ${jobDescription}

Few-Shot Examples for Experience:
- Candidate Experience: "2 years as Junior Developer in PHP." Job Req: "5+ years in full-stack JavaScript." Score: 4 - The experience is in a different tech stack and too short, but shows basic development skills.
- Candidate Experience: "4 years in React and Node.js at a tech startup, led 2 projects." Job Req: "3+ years in React/Node.js with leadership." Score: 9 - Strong match in tech and duration, with relevant leadership adding value.
- Candidate Experience: "No experience listed." Job Req: "Any." Score: 0 - Complete lack of experience, no value added.

Now evaluate this candidate's experience: ${experience || 'No experience listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for experience scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for experience scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'experience');
  } catch (error) {
    console.error('Error scoring experience:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

async function scoreProjects(projects, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  const prompt = `Rate the following candidate's projects on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the projects align with the job's needs, quality, recency, and depth.

Job Requirements: ${jobDescription}

Few-Shot Examples for Projects:
- Candidate Projects: "Personal blog using HTML." Job Req: "AI/ML projects." Score: 2 - Basic web project with no AI relevance, low complexity.
- Candidate Projects: "Built ML model for image recognition using Python." Job Req: "AI projects with real-world application." Score: 8 - Directly relevant to AI, demonstrates technical skills, but lacks deployment details.
- Candidate Projects: "None." Job Req: "Portfolio required." Score: 0 - No projects provided, zero alignment.

Now evaluate this candidate's projects: ${projects || 'No projects listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for projects scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for projects scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'projects');
  } catch (error) {
    console.error('Error scoring projects:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

async function scoreCertificates(certificates, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  const prompt = `Rate the following candidate's certificates on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the certificates align with the job's needs, quality, recency, and depth.

Job Requirements: ${jobDescription}

Few-Shot Examples for Certificates:
- Candidate Certificates: "High School Diploma." Job Req: "AWS Certified Developer." Score: 1 - Irrelevant to tech role, no professional value.
- Candidate Certificates: "AWS Solutions Architect and Google Cloud Associate." Job Req: "Cloud certifications like AWS or GCP." Score: 10 - Perfect match with high-quality, relevant certs from top providers.
- Candidate Certificates: "Empty." Job Req: "Optional but preferred." Score: 0 - No certificates, misses opportunity for bonus points.

Now evaluate this candidate's certificates: ${certificates || 'No certificates listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for certificates scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for certificates scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'certificates');
  } catch (error) {
    console.error('Error scoring certificates:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

async function scoreSkills(candidateSkills, requiredSkills, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  let candidateSkillsText = '';
  if (Array.isArray(candidateSkills)) {
    candidateSkillsText = candidateSkills.join(', ');
  } else if (typeof candidateSkills === 'string') {
    candidateSkillsText = candidateSkills;
  } else {
    candidateSkillsText = '';
  }

  const requiredSkillsText = Array.isArray(requiredSkills) 
    ? requiredSkills.join(', ') 
    : (requiredSkills || '');

  const prompt = `Rate the following candidate's skills on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the candidate's skills match the required skills listed. Check what skills are required and what skills the candidate has, then calculate a score based on the match percentage and quality.

Job Requirements: ${jobDescription}

Required Skills: ${requiredSkillsText || 'Not specified'}

Few-Shot Examples for Skills:
- Candidate Skills: "HTML, CSS." Required Skills: "React, Node.js, Python." Score: 2 - Basic web skills but missing all required technologies, very low match.
- Candidate Skills: "React, Node.js, Python, MongoDB." Required Skills: "React, Node.js, Python, MongoDB." Score: 10 - Perfect match with all required skills (100% match).
- Candidate Skills: "JavaScript, React, Express." Required Skills: "React, Node.js, TypeScript." Score: 7 - Good overlap with React (exact match) and JavaScript/Express (similar to Node.js), but missing TypeScript (about 66% match).
- Candidate Skills: "Python, Django, MySQL." Required Skills: "Python, Flask, PostgreSQL." Score: 6 - Has Python (exact match) and similar frameworks/databases, but not exact matches (about 60% match).

Scoring Guidelines:
- 10: All required skills match perfectly
- 8-9: Most required skills match (80-90%)
- 6-7: Many required skills match or similar equivalents (60-70%)
- 4-5: Some required skills match (40-50%)
- 2-3: Few required skills match (20-30%)
- 0-1: No relevant skills or very minimal match (0-10%)

Now evaluate this candidate's skills: ${candidateSkillsText || 'No skills listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for skills scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for skills scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'skills');
  } catch (error) {
    console.error('Error scoring skills:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

async function scoreLanguages(languages, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  let languagesText = '';
  if (Array.isArray(languages)) {
    languagesText = languages.join(', ');
  } else if (typeof languages === 'string') {
    languagesText = languages;
  } else {
    languagesText = '';
  }

  const prompt = `Rate the following candidate's languages on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the languages align with the job's needs, number of languages, and proficiency levels.

Job Requirements: ${jobDescription}

Few-Shot Examples for Languages:
- Candidate Languages: "English (Basic)". Job Req: "English fluency required." Score: 3 - Basic English may not meet fluency requirement, limited value.
- Candidate Languages: "English (Fluent), Urdu (Native), Spanish (Conversational)". Job Req: "Multilingual preferred, English required." Score: 9 - Multiple languages including required English, high value for international roles.
- Candidate Languages: "English (Native), French (Fluent)". Job Req: "English required, French preferred." Score: 10 - Perfect match with both required and preferred languages at high proficiency.
- Candidate Languages: "None listed." Job Req: "English required." Score: 0 - No languages listed, cannot assess.

Scoring Guidelines:
- 10: All required languages at high proficiency (Native/Fluent)
- 8-9: Required languages present, multiple languages, good proficiency
- 6-7: Required languages present but basic proficiency, or some relevant languages
- 4-5: Some relevant languages but missing required ones, or very basic proficiency
- 2-3: Limited languages, low proficiency, or minimal relevance
- 0-1: No languages listed or completely irrelevant

Now evaluate this candidate's languages: ${languagesText || 'No languages listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for languages scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for languages scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'languages');
  } catch (error) {
    console.error('Error scoring languages:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

async function scoreEducation(education, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  let educationText = '';
  let university = '';
  let degree = '';
  let dateOfCompletion = '';
  let cgpa = '';
  
  if (education && typeof education === 'object') {
    university = education.university || '';
    degree = education.degree || '';
    dateOfCompletion = education.dateOfCompletion || '';
    cgpa = education.cgpa || '';
    educationText = `${university} - ${degree} (${dateOfCompletion})`;
    if (!cgpa) {
      const fullText = JSON.stringify(education);
      const cgpaMatch = fullText.match(/[Cc][Gg][Pp][Aa][\s:]*([0-9]+\.[0-9]+|[0-9]+)/);
      if (cgpaMatch) {
        cgpa = cgpaMatch[1];
      }
    }
  } else {
    educationText = education || 'No education listed';
    const cgpaMatch = educationText.match(/[Cc][Gg][Pp][Aa][\s:]*([0-9]+\.[0-9]+|[0-9]+)/);
    if (cgpaMatch) {
      cgpa = cgpaMatch[1];
    }
  }

  const prompt = `Evaluate the following candidate's education and calculate a score out of 10 using the exact criteria below.

Candidate Education: ${educationText}
${cgpa ? `CGPA: ${cgpa}` : ''}

Job Requirements: ${jobDescription}

SCORING CRITERIA (Total: 40 points, converted to 10-point scale):

[1] University Evaluation (25 points):
- Top 500 Institutes (globally ranked) = 25 points
- FAST, NUST, GIKI, LUMS = 20 points
- COMSATS, ITU, PIEAS = 15 points
- AIR, BAHRIA, IIUI, QA, IQRA, PU, UCP = 10 points
- Other universities = 5 points

[2] CGPA Evaluation (15 points):
- CGPA >= 3.8 = 15 points
- CGPA >= 3.5 = 13 points
- CGPA >= 3.0 = 10 points
- CGPA >= 2.5 = 5 points
- CGPA < 2.5 = 0 points

CALCULATION STEPS:
1. Determine university score (0-25 points) based on the university name
2. Determine CGPA score (0-15 points) based on CGPA value. If CGPA is not provided, use 0 points.
3. Total raw score = university_score + cgpa_score (max 40 points)
4. Convert to 10-point scale: final_score = (total_raw_score / 40) * 10
5. Round to 1 decimal place

EXAMPLES:
- University: "NUST" (20 points), CGPA: 3.6 (13 points) → Raw: 33 → Final: (33/40)*10 = 8.25
- University: "COMSATS" (15 points), CGPA: 3.2 (10 points) → Raw: 25 → Final: (25/40)*10 = 6.25
- University: "Other University" (5 points), CGPA: 2.4 (0 points) → Raw: 5 → Final: (5/40)*10 = 1.25
- University: "FAST" (20 points), CGPA: 3.9 (15 points) → Raw: 35 → Final: (35/40)*10 = 8.75

IMPORTANT INSTRUCTIONS:
- Identify the university name from the candidate's education text
- Extract CGPA if mentioned (look for "CGPA", "GPA", or grade point patterns)
- If CGPA is not found, assign 0 points for CGPA
- Apply the exact university rankings listed above
- Calculate the final score using the formula: (university_score + cgpa_score) / 40 * 10

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <number between 0 and 10, with 1 decimal place>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for education scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for education scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'education', true);
  } catch (error) {
    console.error('Error scoring education:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

function calculateTotalScore(scores, weightage) {
  if (!weightage || typeof weightage !== 'object') {
    weightage = {
      skills: 40,
      experience: 30,
      education: 20,
      projects: 15,
      certificates: 5
    };
  }

  const totalWeight = (weightage.skills || 0) + (weightage.experience || 0) + 
                     (weightage.education || 0) + (weightage.projects || 0) + 
                     (weightage.certificates || 0) + (weightage.languages || 0);
  
  if (totalWeight === 0) {
    weightage = {
      skills: 35,
      experience: 25,
      education: 20,
      projects: 12,
      certificates: 5,
      languages: 3
    };
  } else if (totalWeight !== 100) {
    const factor = 100 / totalWeight;
    weightage = {
      skills: (weightage.skills || 0) * factor,
      experience: (weightage.experience || 0) * factor,
      education: (weightage.education || 0) * factor,
      projects: (weightage.projects || 0) * factor,
      certificates: (weightage.certificates || 0) * factor,
      languages: (weightage.languages || 0) * factor
    };
  }

  const totalScore = 
    (scores.skills * ((weightage.skills || 0) / 100)) +
    (scores.experience * ((weightage.experience || 0) / 100)) +
    (scores.education * ((weightage.education || 0) / 100)) +
    (scores.projects * ((weightage.projects || 0) / 100)) +
    (scores.certificates * ((weightage.certificates || 0) / 100)) +
    (scores.languages * ((weightage.languages || 0) / 100));

  return Math.round(totalScore * 10) / 10;
}

async function scoreCandidate(application, jobPost) {
  try {
    console.log('Starting scoring for application:', application._id);
    console.log('Job Post:', jobPost._id, jobPost.jobTitle);
    
    const jobDescriptionParts = [];
    if (jobPost.generatedDescription) jobDescriptionParts.push(jobPost.generatedDescription);
    if (jobPost.description) jobDescriptionParts.push(jobPost.description);
    if (jobPost.keyResponsibilities) jobDescriptionParts.push(`Key Responsibilities: ${jobPost.keyResponsibilities}`);
    if (jobPost.skills && jobPost.skills.length > 0) {
      jobDescriptionParts.push(`Required Skills: ${jobPost.skills.join(', ')}`);
    }
    if (jobPost.experience) {
      jobDescriptionParts.push(`Required Experience: ${jobPost.experience} years`);
    }
    if (jobPost.education && jobPost.education.length > 0) {
      jobDescriptionParts.push(`Required Education: ${jobPost.education.join(', ')}`);
    }
    
    const jobDescription = jobDescriptionParts.join('\n\n') || 'No job description available';
    
    console.log('Job description length:', jobDescription.length);
    
    const candidateData = application.extractedData || application.formData || {};
    console.log('Candidate data keys:', Object.keys(candidateData));
    
    const experience = candidateData.experience || '';
    let projects = candidateData.projects || '';
    if (!projects && experience) {
      projects = experience;
    }
    const certificates = candidateData.certificates || '';
    const education = candidateData.education || '';
    
    let skills = candidateData.skills || '';
    if (!skills && candidateData.skills === '') {
      skills = '';
    }
    
    let languages = candidateData.languages || [];
    if (typeof languages === 'string' && languages) {
      languages = languages.split(',').map(l => l.trim()).filter(l => l);
    } else if (!Array.isArray(languages)) {
      languages = [];
    }
    
    const requiredSkills = jobPost.skills || [];

    console.log('Scoring components:');
    console.log('- Experience:', experience ? experience.substring(0, 50) + '...' : 'empty');
    console.log('- Projects:', projects ? projects.substring(0, 50) + '...' : 'empty');
    console.log('- Skills:', skills);
    console.log('- Languages:', languages);
    console.log('- Certificates:', certificates ? certificates.substring(0, 50) + '...' : 'empty');
    console.log('- Education:', education);
    console.log('- Required Skills:', requiredSkills);

    if (!model) {
      console.error('LLM model not available');
      throw new Error('LLM service not available');
    }

    console.log('Starting to score experience...');
    const experienceScore = await scoreExperience(experience, jobDescription);
    console.log('Experience score:', experienceScore);
    
    console.log('Starting to score projects...');
    const projectsScore = await scoreProjects(projects || experience, jobDescription);
    console.log('Projects score:', projectsScore);
    
    console.log('Starting to score skills...');
    const skillsScore = await scoreSkills(skills, requiredSkills, jobDescription);
    console.log('Skills score:', skillsScore);
    
    console.log('Starting to score certificates...');
    const certificatesScore = await scoreCertificates(certificates, jobDescription);
    console.log('Certificates score:', certificatesScore);
    
    console.log('Starting to score education...');
    const educationScore = await scoreEducation(education, jobDescription);
    console.log('Education score:', educationScore);
    
    console.log('Starting to score languages...');
    const languagesScore = await scoreLanguages(languages, jobDescription);
    console.log('Languages score:', languagesScore);

    const scores = {
      experience: experienceScore,
      projects: projectsScore,
      skills: skillsScore,
      certificates: certificatesScore,
      education: educationScore,
      languages: languagesScore
    };

    console.log('Job weightage:', jobPost.weightage);
    scores.total = calculateTotalScore(scores, jobPost.weightage);
    console.log('Total score:', scores.total);

    console.log('Final scores:', scores);
    return scores;
  } catch (error) {
    console.error('Error scoring candidate:', error);
    console.error('Error stack:', error.stack);
    return {
      experience: 0,
      projects: 0,
      skills: 0,
      certificates: 0,
      education: 0,
      languages: 0,
      total: 0
    };
  }
}

module.exports = {
  scoreCandidate,
  scoreExperience,
  scoreProjects,
  scoreCertificates,
  scoreSkills,
  scoreEducation,
  scoreLanguages,
  calculateTotalScore
};
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
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: '' },
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

applicationSchema.index({ jobPost: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
```

### Full `backend/models/JobPost.js`

```javascript
const mongoose = require('mongoose');

const jobPostSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true },
  company: { type: String, required: true },
  officialEmail: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },
  contactNo: { type: String, default: '' },
  location: {
    country: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  jobType: { 
    type: String, 
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'],
    required: true 
  },
  salary: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  keyResponsibilities: { type: String, required: true },
  description: { type: String, required: false },
  generatedDescription: { type: String, default: '' },
  templateImage: { type: String, default: '/job-posting-template.png' },
  experience: { type: mongoose.Schema.Types.Mixed, default: null },
  education: [{ type: String }],
  deadline: { type: Date, required: true },
  skills: [{ type: String }],
  languages: [{ type: String }],
  candidateLocation: [{ type: String }],
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
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
}, {
  timestamps: true,
});

jobPostSchema.pre('save', function(next) {
  if (this.description && !this.keyResponsibilities) {
    this.keyResponsibilities = this.description;
  }
  if (this.keyResponsibilities) {
    this.description = this.keyResponsibilities;
  }
  next();
});

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

### Most important fields (ranking)

| Location | Field | Why |
|----------|--------|-----|
| **Application** | **`extractedData`** / **`formData`** | Source text/structure for all six LLM scores; **`extractedData`** preferred. |
| **Application** | **`scores.*`** and **`scores.total`** | Persisted criterion grades and weighted outcome. |
| **Application** | **`rankedAt`** | Marks evaluated applications; batch job skips if set. |
| **JobPost** | **`weightage`** | Drives **`calculateTotalScore`** (intended: per-dimension importance). |
| **JobPost** | **`generatedDescription`**, **`skills`**, **`education`**, **`experience`**, **`keyResponsibilities`** | Combined into **`jobDescription`** for every LLM call. |
| **JobPost** | **`evaluatedAt`** | Unlocks **`getEvaluatedCandidates`**; set after batch evaluate. |

### Implementation note (weight key names)

The job posting UI saves **`weightage.language`**, while **`calculateTotalScore`** only reads **`weightage.languages`** (and **`certificates`**). The **`language`** key is **not** included in the total-weight sum inside **`scoringService.js`**, so in the default five-field UI the **languages** portion of the weighted formula may stay **0** unless weights are also stored under **`languages`** (or the service is updated to map **`language` → `languages`**). **`certificates`** can be added via **custom weightage** fields from the job form if configured.

---

## 7. API ENDPOINTS USED IN THIS MODULE

Base path: **`/api/applications`**. All listed routes use **`verifyToken`** from **`routes/applications.js`** except where the controller array adds its own (same pattern).

| Method | Endpoint | Controller function | Purpose |
|--------|----------|----------------------|---------|
| GET | `/api/applications/jobs-for-ranking` | `getJobsForRanking` | List HR jobs for dropdown |
| POST | `/api/applications/evaluate-job/:jobId` | `evaluateJobApplications` | Score all unranked applications after deadline |
| POST | `/api/applications/evaluate-one/:applicationId` | `evaluateOneApplication` | Score one application (instant) |
| GET | `/api/applications/by-job/:jobId` | `getApplicationsByJob` | All applicants + optional scores |
| GET | `/api/applications/evaluated-candidates/:jobId` | `getEvaluatedCandidates` | All scored candidates after `evaluatedAt` |
| GET | `/api/applications/ranked/:jobId` | `getRankedCandidates` | Test-invited subset, sorted by total + test data |

---

## 8. SLIDE-READY SUMMARY

- **Six lenses, one score:** Every applicant is graded on **experience, projects, skills, certificates, education, and languages**—then those grades are **combined using the job’s own priority percentages**.  
- **Powered by context-aware AI:** Scoring uses the **real job description** and **required skills**, not generic keywords, so fit to the role is explicit.  
- **Fair timing:** **Bulk ranking** runs **after the application deadline** so everyone is measured the same way; **instant preview** lets HR sanity-check **one** profile early.  
- **Transparent breakdown:** Recruiters see **each dimension** separately, not just a black-box number—easier to explain and defend.  
- **From ranking to testing:** The same scores feed a **sorted shortlist**; candidates who receive an **online test** appear in the **full ranked board** with **CV score + test score** side by side.  
- **Tied to how you hire:** When creating the job, HR sets **what matters most** (e.g. skills vs. education), and the system **honors that mix** in the final rank order.

---

*End of document.*
