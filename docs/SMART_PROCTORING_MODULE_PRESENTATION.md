# Smart Proctoring Module — Complete Presentation Material

**Project:** NeuroHire  
**Purpose:** FYP / stakeholder documentation for the browser-based exam integrity layer (camera AI + focus rules + server-side disqualification).

---

## 1. MODULE OVERVIEW

### What is this module?

**Smart Proctoring** is the **integrity and monitoring layer** for NeuroHire’s online test. While the candidate answers MCQs and coding questions, the app runs **camera-based AI** (MediaPipe in the browser) to check **face presence, single person, face/eye framing**, and **forbidden objects** (e.g. phones). It also enforces **browser focus** via the **Page Visibility API** (tab switching). When rules are broken repeatedly or the candidate leaves the tab twice, the system can **end the attempt as disqualified** with **no score** and update **HR-facing** views so disqualified candidates are **not ranked or shortlisted**.

### What problem does it solve?

Remote tests are vulnerable to **impersonation, collusion, and unauthorized aids**. This module adds **automated, scalable checks** without a human proctor watching every stream: it **warns**, **pauses** the test when the face is missing, **records** policy violations, and **terminates** the assessment under clear rules—aligned with **fairness** for other applicants and **auditability** for HR.

### 2–3 line summary (FYP slide)

> **Smart Proctoring** uses **on-device computer vision** (MediaPipe) and **browser focus detection** to monitor candidates during online exams: one face in frame, eyes visible, no phones/books in view, and limited tab switching. **Violations** trigger warnings and can **disqualify** the attempt **without a score**, with results reflected in the **HR pipeline** so those candidates are **excluded from ranking and interview selection**.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Path | Role |
|------|------|
| `frontend/components/test/Proctoring.jsx` | Core proctoring: camera, MediaPipe models, detection loop, violations UI |
| `frontend/app/test/take/page.js` | Mounts `Proctoring`, prep overlay, face pause overlay, tab-switch flow, submit/DQ |
| `frontend/app/test/page.js` | Pre-test **Proctoring & rules** copy and consent checkbox |
| `frontend/app/test/done/page.js` | Disqualified vs normal completion messaging (`disqualified=1` query) |
| `frontend/lib/api.js` | `saveTestProgress`, `submitTest` (carry answers + optional `proctoringDisqualification`) |
| `frontend/package.json` | Dependency: `@mediapipe/tasks-vision` (loaded dynamically in `Proctoring.jsx`) |
| `frontend/app/hr/finalize-hire/page.js` | Shows disqualified vs eligible candidates; detail modal for DQ |

### Backend

| Path | Role |
|------|------|
| `backend/routes/test.js` | `PUT /attempt/:id` (save + optional `violationCount` / `proctoringEvent`), `POST .../submit` |
| `backend/controllers/testController.js` | `saveProgress` (violation threshold → disqualify), `submitTest` (`proctoringDisqualification`), `getAttempt` returns `violationCount` |
| `backend/controllers/hirePipelineController.js` | `getTestParticipants`, `getTestParticipantDetail`, physical round: exclude disqualified |

### Database (Mongoose)

| Path | Role |
|------|------|
| `backend/models/TestAttempt.js` | `proctoringEvents[]`, `violationCount`, `status` includes `disqualified` |
| `backend/models/TestInvitation.js` | `status` includes `disqualified` (invite invalidated after DQ) |

### Config / other

| Path | Role |
|------|------|
| *(none specific)* | Proctoring thresholds are **constants in code** (`Proctoring.jsx`: `MAX_VIOLATIONS = 3`; `testController.js`: `MAX_VIOLATIONS_BEFORE_DISQUALIFY = 5` for server-side count if sent) |

**Note:** No migrations/seeders dedicated to proctoring; fields live on existing `TestAttempt` / `TestInvitation` schemas.

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### Step-by-step narrative (paste into AI diagram tools)

1. **Candidate reads rules** → `TestEntryContent` on **`/test`** renders `PROCTORING_INSTRUCTIONS` → user checks agreement → **no proctoring API yet** (consent is UI-only before start).

2. **Candidate starts test** → `handleStartTest` → `POST /api/test/start` → attempt created (see Testing module); navigates to **`/test/take`** with `token` + `attemptId`.

3. **`TestTakeContent` mounts** → shows **prep overlay** (`PROCTORING_PREP_MS`) → `enableDetection={prepComplete}` so **camera + WASM load** before the main detection loop runs → timer also waits for `prepComplete`.

4. **`Proctoring` mounts** (`disabled={status !== "in_progress"}`) → `getUserMedia` video stream → dynamic `import("@mediapipe/tasks-vision")` → loads **FaceDetector**, **FaceLandmarker**, **ObjectDetector** from Google-hosted **.tflite / .task** assets + **CDN WASM** → `detectorReady` true.

5. **Detection loop** (`enableDetection` true) → each animation frame: `FaceDetector.detectForVideo` → if **0 faces**, parent `onFaceStatusChange(false)` → **TestTake** shows full-screen **“Test paused”** until face detected; if **>1 face** → `recordViolation()`; if **1 face** → check **bounding box** (center + size) → violation if out of bounds; **FaceLandmarker** on eye landmarks → violation if eyes outside margin; every N frames **ObjectDetector** → if label matches forbidden list (phone, book, laptop, …) with score ≥ 0.5 → `recordViolation()`. Violations are **debounced** (`VIOLATION_DEBOUNCE_MS`).

6. **Violation counter** in `Proctoring` reaches **`MAX_VIOLATIONS` (3)** → `onMaxViolations()` → **`TestTakeContent.handleMaxViolations`** → **`handleSubmit(true)`** → `saveProgress()` then **`submitTest(..., { proctoringDisqualification: true })`** → **`POST /api/test/attempt/:attemptId/submit`**.

7. **`submitTest` (backend)** sees `proctoringDisqualification === true` → sets **`TestAttempt.status = 'disqualified'`**, clears scores/breakdowns, sets **`TestInvitation.status = 'disqualified'`** → response `{ disqualified: true }` → frontend **toast** + redirect **`/test/done?...&disqualified=1`**.

8. **Tab switch** → `document.visibilitychange` in `Proctoring` → `onTabSwitch()` → **`handleTabSwitch`** in `take/page.js`: first hide → **`testPaused` overlay** (warning); second hide → **`handleSubmit(true)`** (same disqualification submit path as step 6–7).

9. **Periodic autosave** → `setInterval` → **`saveProgress`** → **`PUT /api/test/attempt/:attemptId`** with `mcqAnswers`, `codingSubmissions` (and *can* include `violationCount` / `proctoringEvent` if the client sends them). If body has **`violationCount >= MAX_VIOLATIONS_BEFORE_DISQUALIFY` (5)** → server sets attempt + invitation **disqualified** and returns **`disqualified: true`** → `TestTakeContent` sets error/disqualified UI.

10. **HR opens Finalize Hire** → **`GET /api/hire-pipeline/test-participants/:jobId`** → attempts with `status === 'disqualified'` appear as **`testStatus: 'disqualified'`**, **no score** → UI lists them under **“Not under consideration”** and excludes from manual shortlist; **`getTestParticipantDetail`** returns **disqualification message** instead of score tables.

### Separate diagram prompt (Whimsical / Eraser / etc.)

> Generate a **data flow diagram** with swimlanes: **Candidate**, **Browser (React)**, **MediaPipe (on-device)**, **REST API**, **MongoDB**. Show: **Camera video** → **FaceDetector / FaceLandmarker / ObjectDetector** → **violation counter** → **optional debounce** → **if max violations OR second tab switch** → **POST submit with proctoringDisqualification** → **TestAttempt + TestInvitation updated to disqualified** → **Done page**. Parallel path: **first tab switch** → **visibility API** → **warning modal only**. Another path: **no face** → **pause overlay** until face detected. HR lane: **GET test-participants** reads attempt status → **disqualified** branch **without scores**.

---

## 4. KEY FRONTEND FUNCTIONS

### `recordViolation` — `frontend/components/test/Proctoring.jsx`

**What it does:** Debounces rapid triggers, increments local violation count, and fires `onMaxViolations` when count reaches `MAX_VIOLATIONS`.

```javascript
const recordViolation = useCallback(() => {
  const now = Date.now();
  if (now - lastViolationTimeRef.current < VIOLATION_DEBOUNCE_MS) return;
  lastViolationTimeRef.current = now;
  setViolationCount((prev) => {
    const next = prev + 1;
    if (next >= MAX_VIOLATIONS) {
      setTimeout(() => notifyMaxViolations(), 0);
    }
    return next;
  });
}, [notifyMaxViolations]);
```

### Visibility / tab switch listener — `frontend/components/test/Proctoring.jsx`

**What it does:** Registers `visibilitychange`; when the document is hidden, calls `onTabSwitch` (parent implements warn vs disqualify).

```javascript
useEffect(() => {
  if (disabled || typeof onTabSwitch !== "function") return;
  const handleVisibility = () => {
    if (document.hidden) onTabSwitch();
  };
  document.addEventListener("visibilitychange", handleVisibility);
  return () => document.removeEventListener("visibilitychange", handleVisibility);
}, [disabled, onTabSwitch]);
```

### `handleTabSwitch` — `frontend/app/test/take/page.js`

**What it does:** First time leaving the tab → pause + warning modal; second time → submits with proctoring disqualification.

```javascript
const handleTabSwitch = useCallback(() => {
  tabSwitchCountRef.current += 1;
  const count = tabSwitchCountRef.current;
  if (count === 1) {
    setTestPaused(true);
  } else if (count >= 2) {
    setTestPaused(false);
    if (handleSubmitRef.current) {
      handleSubmitRef.current(true); // proctoring disqualification (tab switch)
    }
  }
}, []);
```

### `handleMaxViolations` — `frontend/app/test/take/page.js`

**What it does:** Bridges camera/object/face violations from `Proctoring` to the same disqualifying submit path.

```javascript
const handleMaxViolations = useCallback(() => {
  if (handleSubmitRef.current) {
    handleSubmitRef.current(true); // proctoring disqualification (camera / object rules)
  }
}, []);
```

### `handleSubmit` (proctoring branch) — `frontend/app/test/take/page.js`

**What it does:** Calls API with `proctoringDisqualification`; on disqualified response, redirects to done page with query flag.

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

### `saveProgress` (disqualified response handling) — `frontend/app/test/take/page.js`

**What it does:** After autosave, if server returns `disqualified` (e.g. high `violationCount` on `PUT`), updates local state to block further test UI.

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

---

## 5. KEY BACKEND FUNCTIONS

### `saveProgress` (proctoring-related parts) — `backend/controllers/testController.js`

**What it does:** Updates `violationCount`; if count ≥ server threshold, marks `TestAttempt` and `TestInvitation` disqualified; appends optional `proctoringEvent` audit entries.

```javascript
if (typeof violationCount === 'number' && violationCount >= 0) {
  attempt.violationCount = violationCount;
  if (violationCount >= MAX_VIOLATIONS_BEFORE_DISQUALIFY) {
    attempt.status = 'disqualified';
    attempt.submittedAt = new Date();
    await TestInvitation.updateOne({ _id: attempt.testInvitation._id }, { status: 'disqualified' });
  }
}
if (proctoringEvent && typeof proctoringEvent === 'object') {
  attempt.proctoringEvents.push({
    type: proctoringEvent.type,
    payload: proctoringEvent.payload || {},
  });
}
await attempt.save();

res.json({
  success: true,
  status: attempt.status,
  violationCount: attempt.violationCount,
  disqualified: attempt.status === 'disqualified',
});
```

### `submitTest` (proctoring disqualification branch) — `backend/controllers/testController.js`

**What it does:** Ends attempt without LLM evaluation; clears scores; syncs invitation status.

```javascript
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
```

### `getTestParticipantDetail` (disqualified response) — `backend/controllers/hirePipelineController.js`

**What it does:** For HR detail view, returns a **disqualification payload** instead of MCQ/coding score tables.

```javascript
if (attempt?.status === 'disqualified') {
  return res.json({
    applicationId: app._id,
    candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim(),
    email: app.candidate?.email || app.formData?.email,
    testScore: null,
    mcqTotal: null,
    mcqMax: 30,
    codingTotal: null,
    codingMax: 70,
    mcqBreakdown: [],
    codingBreakdown: [],
    status: 'disqualified',
    disqualifiedDueToProctoring: true,
    disqualificationMessage: 'Disqualified due to proctoring rules violation. Not eligible for ranking or interview shortlist by test score.',
    submittedAt: attempt?.submittedAt || null,
  });
}
```

---

## 6. DATABASE MODEL / SCHEMA

### Relevant excerpt — `backend/models/TestAttempt.js` (proctoring + status)

Proctoring primarily persists:

- **`status`**: `in_progress` | `submitted` | `disqualified` | `expired`
- **`violationCount`**: numeric tally (used when client sends updates on save)
- **`proctoringEvents`**: append-only log `{ type, timestamp, payload }` for audits
- **`submittedAt`**: set when disqualified via server rule or submit

```javascript
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'disqualified', 'expired'],
    default: 'in_progress',
  },
  // ...
  proctoringEvents: [{
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    payload: mongoose.Schema.Types.Mixed,
  }],
  violationCount: { type: Number, default: 0 },
```

**Why these matter:** `status` drives **HR lists** and **whether scores exist**; `proctoringEvents` supports **forensics**; `violationCount` supports **server-side threshold** alignment (if wired from client saves).

### Relevant excerpt — `backend/models/TestInvitation.js`

```javascript
  status: {
    type: String,
    enum: ['pending', 'attempted', 'expired', 'disqualified'],
    default: 'pending',
  },
```

**Why it matters:** After disqualification, **`validateToken`** rejects further access with a clear message so the same link cannot be reused as a normal attempt.

---

## 7. API ENDPOINTS USED IN THIS MODULE

Proctoring **does not add separate routes**; it uses the existing test API.

| Method | Endpoint | Controller function | Purpose |
|--------|----------|---------------------|---------|
| PUT | `/api/test/attempt/:attemptId` | `testController.saveProgress` | Autosave; optional `violationCount` / `proctoringEvent`; server DQ if count ≥ 5 |
| POST | `/api/test/attempt/:attemptId/submit` | `testController.submitTest` | Normal submit **or** `proctoringDisqualification: true` → DQ without scoring |
| GET | `/api/test/attempt/:attemptId` | `testController.getAttempt` | Returns `violationCount` (and full attempt if not in progress) |
| GET | `/api/hire-pipeline/test-participants/:jobId` | `hirePipelineController.getTestParticipants` | HR sees `testStatus: disqualified`, no score |
| GET | `/api/hire-pipeline/test-participant/:applicationId` | `hirePipelineController.getTestParticipantDetail` | HR detail: DQ message vs score breakdown |

**Indirect:** `GET /api/test/validate-token` reflects `TestInvitation.status === 'disqualified'` for blocked links.

---

## 8. SLIDE-READY SUMMARY

- **Eyes on integrity:** Combines **live camera checks** with **browser focus rules** so online exams behave more like a supervised room.  
- **AI in the browser:** Uses **MediaPipe** models running **on the candidate’s device** for face, eyes, and object cues—reducing need to stream video to a server.  
- **Clear consequences:** Repeated issues or **tab switching** can **end the test immediately** with **no score**, protecting fairness for other applicants.  
- **Candidate-friendly design:** **Warm-up time** before monitoring, **pause when no face is seen**, and a **first-warning** step before the harshest action on tab change.  
- **HR-ready outcomes:** Disqualified attempts are **labeled and separated** from ranked candidates so they are **not considered** for interview shortlists.  
- **Audit trail:** Optional **proctoring event logs** on the attempt record support **review** if a decision is questioned.

---

### Appendix: AI models used in the browser (detection)

| Model | URL / asset | Role |
|-------|-------------|------|
| Blaze Face (short range) | `blaze_face_short_range.tflite` | Face bounding boxes / count |
| Face Landmarker | `face_landmarker.task` | Eye landmark positions |
| EfficientDet Lite0 | `efficientdet_lite0.tflite` | Object labels (phones, books, etc.) |
| WASM runtime | `@mediapipe/tasks-vision` CDN | Executes models in the browser |

---

*Document generated from the NeuroHire codebase. **Implementation note:** client-side violation cap for auto-submit is **3** (`Proctoring.jsx`); server auto-disqualify on save uses **5** (`MAX_VIOLATIONS_BEFORE_DISQUALIFY`) **if** `violationCount` is sent in `PUT` body—the primary DQ path in current UI is **`proctoringDisqualification` on submit** after max client violations or second tab switch.*
