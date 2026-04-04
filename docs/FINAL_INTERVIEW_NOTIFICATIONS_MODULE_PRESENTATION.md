# Final Interview & Notifications Module — Complete Presentation Material

**Project:** NeuroHire  
**Purpose:** FYP / stakeholder documentation for **post–online-test** stages: **final / on-site interview invitations**, **automated candidate notifications** (congratulations & condolences), and **job closure** — integrated with **LLM-assisted email drafting** and **n8n** delivery.

---

## 1. MODULE OVERVIEW

### What is this module?

The **Final Interview & Notifications** module covers everything after the **online assessment**: HR selects candidates for a **physical or video “final” interview** (date, time, location/link), the system **emails personalized invites** to the shortlist and **polite update emails** to others who took the test, then—after interviews—HR **confirms who is hired**. The module sends **congratulations** to selected hires and **thoughtful rejection** messages to others who reached the final round, marks the **job as closed**, and exposes **onboarding** data for HR follow-up.

### What problem does it solve?

Hiring teams must **notify many candidates** at once with **consistent, professional** messaging, **track** who was invited to which stage, and **avoid manual errors** (wrong name, missing link). NeuroHire **centralizes** this in one pipeline: **templated + AI-drafted** content, **placeholder substitution**, **batch dispatch** through automation (n8n), and **MongoDB timestamps** so HR and audits know **what was sent and when**.

### 2–3 line summary (FYP slide)

> After the online test, NeuroHire supports **scheduling the final interview round**: HR picks candidates (manually or by rank), **generates professional invite emails** with an LLM, and **sends** them through **n8n**—along with **updates** for non-shortlisted candidates. When hiring ends, the system sends **offer congratulations** or **respectful declines**, **closes the job**, and lists **new hires** for **onboarding**.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Path | Role |
|------|------|
| `frontend/app/hr/finalize-hire/page.js` | Physical interview: date/time/location, mode (top N / manual), AI **Generate interview email**, send round, **Final hiring decision** (checkboxes, no-hire), **deadline** update via `updateJobPost` |
| `frontend/app/hr/hire-onboarding/page.js` | Lists **hired** candidates (`getOnboardingHires`) for post-offer follow-up |
| `frontend/lib/api.js` | `generateInterviewEmail`, `sendInterviewEmails`, `getTestParticipants`, `getTestParticipantDetail`, `sendPhysicalInterviewRound`, `completeFinalHire`, `getOnboardingHires`, `updateJobPost` (deadline on Finalize Hire) |

### Backend

| Path | Role |
|------|------|
| `backend/routes/hirePipeline.js` | `POST /physical-interview/:jobId`, `POST /final-hire/:jobId`, `GET /onboarding-hires` |
| `backend/routes/llm.js` | `POST /generate-interview-email`, `POST /send-interview-emails` (shared with other flows) |
| `backend/controllers/hirePipelineController.js` | `sendPhysicalInterviewRound`, `completeFinalHire`, `getOnboardingHires`, `personalizePhysicalBody`, participant list payloads |
| `backend/controllers/llmController.js` | `generateInterviewEmail` (Bytez LLM), `sendInterviewEmails` (n8n + optional test invites) |
| `backend/services/emailDispatchService.js` | `dispatchEmailBatch` → **n8n webhook** (`N8N_EMAIL_WEBHOOK_URL`) |
| `backend/middleware/verifyHr.js` | Firebase auth + HR role for protected routes |

### Database (Mongoose)

| Path | Role |
|------|------|
| `backend/models/JobPost.js` | `hirePipelineStage`, `physicalInterview*`, `physicalInterviewEmailSentAt`, `awaitingFinalHireSelection`, `finalHireCompletedAt`, `noHireSelected` |
| `backend/models/Application.js` | `physicalInterviewInvitedAt`, `selectedAsHire`, `condolenceAfterPhysicalSentAt`, `congratulationsHireSentAt`, `condolenceNotFinalHireSentAt`, etc. |

### Config / automation

| Path | Role |
|------|------|
| `backend/services/emailDispatchService.js` | `N8N_EMAIL_WEBHOOK_URL` env; batch payload shape for n8n |
| `backend/config/appConfig.js` | Referenced for frontend URL in email flows (via `llmController` patterns) |
| `docs/` (if present) | n8n workflow JSON for email webhooks (referenced in code comments) |

**Note:** No SQL migrations; schema is in Mongoose models.

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### Narrative (step-by-step)

1. **Prerequisites** → Online test invitations already sent (`JobPost.assessmentInviteSentAt`); **assessment deadline passed**; HR opens **Finalize Hire** → `getTestParticipants` loads candidates with test status/scores.

2. **Draft final-interview email** → HR clicks **Generate interview email** → `genPhysicalEmail` → `generateInterviewEmail` → **`POST /api/llm/generate-interview-email`** → `llmController.generateInterviewEmail` runs **Bytez** with job + `emailType: "interview"` → returns JSON `{ subject, body }` with placeholders like `[INTERVIEW_DATE]`, `[CANDIDATE_NAME]` → UI fills `physEmail` state.

3. **HR enters logistics** → types **date**, **time**, **location/video link** in form fields; may choose **top3 / top5 / top10** or **manual** selection; for manual, checks **eligible** candidates (excludes disqualified).

4. **Send physical interview round** → `sendPhysical` → `sendPhysicalInterviewRound` → **`POST /api/hire-pipeline/physical-interview/:jobId`** → `sendPhysicalInterviewRound`:
   - Loads **`TestInvitation`** + **`Application`** + **`TestAttempt`** (excludes **disqualified** from selection pool).
   - Sorts by **test score**; selects subset per **mode** or **manual IDs**.
   - **`personalizePhysicalBody`** replaces placeholders with HR + candidate name + date/time/location.
   - **`dispatchEmailBatch`** → **HTTP POST to n8n** with `{ emails, jobInfo, sentAt }` → **SMTP** (outside Node).
   - **`Application.updateMany`** sets **`physicalInterviewInvitedAt`** for selected.
   - Builds **condolence** emails for **not selected** (still in test pool) → second **`dispatchEmailBatch`** (`type: 'condolence_post_test'`) → sets **`condolenceAfterPhysicalSentAt`** on those apps.
   - **`JobPost`**: stores **physicalInterviewDate/Time/Location**, **`physicalInterviewEmailSentAt`**, **`hirePipelineStage = 'physical_invite_sent'`**, **`awaitingFinalHireSelection = true`**.
   - Response: **`invitedCount`**, **`condolenceCount`**.

5. **Final hiring decision** → After interviews, HR checks **hire** checkboxes (from pool with **`physicalInterviewInvitedAt`**) or chooses **no hire** → `submitHire` → `completeFinalHire` → **`POST /api/hire-pipeline/final-hire/:jobId`** → `completeFinalHire`:
   - **No hire (`applicationIds` empty):** sets **`JobPost.noHireSelected`**, **`finalHireCompletedAt`**, stage **`finished`** → **`dispatchEmailBatch`** condolence to **all** who had physical invite (`condolence_no_hire`) → **`condolenceNotFinalHireSentAt`** on applications.
   - **Hire selected:** clears then sets **`selectedAsHire`** on chosen IDs → **congratulations** batch (`congratulations_hire`) → **`congratulationsHireSentAt`**; **condolence** to other physical-round candidates (`condolence_not_final_hire`) → timestamps; **`JobPost`**: **`awaitingFinalHireSelection = false`**, **`finalHireCompletedAt`**, **`hirePipelineStage = 'finished'`**.

6. **Onboarding view** → HR opens **Hire onboarding** → `getOnboardingHires` → **`GET /api/hire-pipeline/onboarding-hires`** → returns applications with **`selectedAsHire: true**`, job/company, **`congratulationsHireSentAt`**, **`trainingPlanPdfPath`**.

### Separate diagram prompt

> Generate a **swimlane diagram**: **HR** → **Finalize Hire UI** → **POST generate-interview-email (LLM)** → **draft stored** → **POST physical-interview** → **MongoDB** (JobPost + Application updates) → **n8n webhook** → **email to shortlisted** + **condolence to others** → later **POST final-hire** → **congrats + reject batches** → **Job closed** → **GET onboarding-hires** for **HR onboarding list**.

---

## 4. KEY FRONTEND FUNCTIONS

### `generateInterviewEmail` — `frontend/lib/api.js`

**What it does:** Calls backend LLM to produce interview (or test) email **subject + body** template.

```javascript
export const generateInterviewEmail = async (candidates, jobInfo, emailType, idToken) => {
  try {
    const response = await api.post('/llm/generate-interview-email', {
      candidates,
      jobInfo,
      emailType, // 'online_test' or 'interview'
    }, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate interview email',
    };
  }
};
```

### `sendPhysicalInterviewRound` — `frontend/lib/api.js`

**What it does:** Sends the physical-interview round with logistics, mode, and email content.

```javascript
export const sendPhysicalInterviewRound = async (jobId, body, idToken) => {
  try {
    const response = await api.post(`/hire-pipeline/physical-interview/${jobId}`, body, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to send',
    };
  }
};
```

### `completeFinalHire` — `frontend/lib/api.js`

**What it does:** Completes hiring (selected IDs or empty for no-hire) and triggers notification emails on the server.

```javascript
export const completeFinalHire = async (jobId, body, idToken) => {
  try {
    const response = await api.post(`/hire-pipeline/final-hire/${jobId}`, body, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed',
    };
  }
};
```

### `genPhysicalEmail` — `frontend/app/hr/finalize-hire/page.js`

**What it does:** Uses first **eligible** candidate as sample and `emailType: "interview"` to populate physical-invite draft.

```javascript
const genPhysicalEmail = async () => {
  if (!jobId || !idToken || !considerationCandidates.length) return;
  const first = considerationCandidates[0];
  const r = await generateInterviewEmail(
    [{ _id: first._id, email: first.email, candidateName: first.candidateName }],
    { jobTitle: data.jobTitle, company: data.company },
    "interview",
    idToken
  );
  if (r.success) {
    setPhysEmail({ subject: r.data.email.subject, body: r.data.email.body });
    toast.success("Draft generated — add date/time if needed, then send.");
  } else toast.error(r.error);
};
```

### `sendPhysical` — `frontend/app/hr/finalize-hire/page.js`

**What it does:** Validates fields, then posts **mode**, **applicationIds** (manual), logistics, and email to **`sendPhysicalInterviewRound`**.

```javascript
const sendPhysical = async () => {
  if (!jobId || !idToken) return;
  if (!interviewDate || !interviewTime || !interviewLocation) {
    toast.warning("Enter interview date, time, and location / link.");
    return;
  }
  if (!physEmail.subject || !physEmail.body) {
    toast.warning("Generate or paste email content first.");
    return;
  }
  setPhysBusy(true);
  try {
    const user = auth.currentUser;
    const r = await sendPhysicalInterviewRound(
      jobId,
      {
        mode: mode === "manual" ? "manual" : mode,
        applicationIds: mode === "manual" ? Array.from(manualIds) : undefined,
        interviewDate,
        interviewTime,
        interviewLocation,
        emailSubject: physEmail.subject,
        emailBody: physEmail.body,
        hrInfo: {
          name: user?.displayName || "HR",
          title: "Human Resources",
          email: user?.email || "",
          phone: "",
        },
      },
      idToken
    );
    if (r.success) {
      toast.success(`Invited ${r.data.invitedCount}. Others notified.`);
      load();
    } else toast.error(r.error);
  } catch {
    toast.error("Failed");
  } finally {
    setPhysBusy(false);
  }
};
```

### `submitHire` — `frontend/app/hr/finalize-hire/page.js`

**What it does:** Calls **`completeFinalHire`** with either **empty** `applicationIds` (no hire) or selected IDs.

```javascript
const submitHire = async (noHire) => {
  if (!jobId || !idToken) return;
  setHireBusy(true);
  try {
    const user = auth.currentUser;
    const r = await completeFinalHire(
      jobId,
      {
        applicationIds: noHire ? [] : Array.from(hireIds),
        hrInfo: {
          name: user?.displayName || "HR",
          email: user?.email || "",
        },
      },
      idToken
    );
    if (r.success) {
      if (r.data.noHire) {
        toast.success("Role closed. Candidates were notified with care.");
      } else {
        toast.success(`Hire complete. ${r.data.hiredCount} offer email(s) sent.`);
      }
      load();
      setHireIds(new Set());
    } else toast.error(r.error);
  } catch {
    toast.error("Failed");
  } finally {
    setHireBusy(false);
  }
};
```

### `load` — `frontend/app/hr/finalize-hire/page.js`

**What it does:** Fetches test participants and job pipeline flags via **`getTestParticipants`** to drive the page state.

```javascript
const load = useCallback(async () => {
  if (!jobId || !idToken) {
    setData(null);
    return;
  }
  setLoading(true);
  try {
    const r = await getTestParticipants(jobId, idToken);
    if (r.success) setData(r.data);
    else {
      toast.error(r.error);
      setData(null);
    }
  } catch {
    toast.error("Failed to load");
  } finally {
    setLoading(false);
  }
}, [jobId, idToken]);
```

### `getTestParticipants` — `frontend/lib/api.js`

**What it does:** **`GET /hire-pipeline/test-participants/:jobId`** — loads candidates with test scores/status for shortlisting and UI gates (`canPhysical`, `awaitingHire`).

```javascript
export const getTestParticipants = async (jobId, idToken) => {
  try {
    const response = await api.get(`/hire-pipeline/test-participants/${jobId}`, {
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

### `getOnboardingHires` — `frontend/lib/api.js`

**What it does:** **`GET /hire-pipeline/onboarding-hires`** — lists **`selectedAsHire`** applications for the **Hire onboarding** page.

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

---

## 5. KEY BACKEND FUNCTIONS

### `personalizePhysicalBody` — `backend/controllers/hirePipelineController.js`

**What it does:** Replaces interview email placeholders with candidate + HR + logistics strings.

```javascript
function personalizePhysicalBody(body, hrInfo, jobInfo, candidateName, dateStr, timeStr, locStr) {
  return body
    .replace(/\[CANDIDATE_NAME\]/g, candidateName || 'Candidate')
    .replace(/\[HR_NAME\]/g, hrInfo?.name || 'HR Team')
    .replace(/\[HR_TITLE\]/g, hrInfo?.title || 'Human Resources')
    .replace(/\[COMPANY_NAME\]/g, jobInfo?.company || 'Our Company')
    .replace(/\[COMPANY_EMAIL\]/g, hrInfo?.email || 'hr@company.com')
    .replace(/\[COMPANY_PHONE\]/g, hrInfo?.phone || '')
    .replace(/\[INTERVIEW_DATE\]/g, dateStr || 'TBC')
    .replace(/\[DATE\]/g, dateStr || 'TBC')
    .replace(/\[INTERVIEW_TIME\]/g, timeStr || 'TBC')
    .replace(/\[TIME\]/g, timeStr || 'TBC')
    .replace(/\[INTERVIEW_LOCATION\/LINK\]/g, locStr || 'TBC')
    .replace(/\[INTERVIEW_LOCATION\]/g, locStr || 'TBC');
}
```

### `dispatchEmailBatch` — `backend/services/emailDispatchService.js`

**What it does:** POSTs batched emails to **n8n**; treats known n8n “last node” 500 responses as success when emails may have sent.

```javascript
async function dispatchEmailBatch(emails, jobInfo = {}) {
  if (!emails || !emails.length) return { sentCount: 0 };
  const payload = {
    emails,
    totalCount: emails.length,
    jobInfo,
    sentAt: new Date().toISOString(),
  };
  try {
    const res = await axios.post(N8N_EMAIL_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    return { sentCount: emails.length, n8nResponse: res.data };
  } catch (err) {
    if (isN8nLastNodeResponseBug(err)) {
      console.warn(
        '[emailDispatch] n8n returned 500 (lastNode response extraction). Treating as OK; add a Code/Respond node after Send email in n8n to fix the webhook response.',
        err.response?.data?.message
      );
      return {
        sentCount: emails.length,
        n8nResponse: err.response?.data,
        assumedSuccessDueToN8nResponseBug: true,
      };
    }
    throw err;
  }
}
```

### `generateInterviewEmail` — `backend/controllers/llmController.js`

**What it does:** Builds a recruiter prompt for **`interview`** vs **`online_test`**, parses JSON `{ subject, body }` from Bytez (with fallback if JSON parse fails).

```javascript
exports.generateInterviewEmail = async (req, res) => {
  try {
    if (!model) {
      return res.status(503).json({ 
        error: 'LLM service not available. Please ensure bytez.js is installed and BYTEZ_API_KEY is set.' 
      });
    }

    const { candidates, jobInfo, emailType, companyInfo } = req.body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'At least one candidate is required' });
    }

    if (!jobInfo || !jobInfo.jobTitle) {
      return res.status(400).json({ error: 'Job information is required' });
    }

    // Determine email type: 'online_test' or 'interview'
    const type = emailType || 'interview';
    const typeLabel = type === 'online_test' ? 'Online Assessment/Test' : 'Interview';

    // Create a sample candidate name for the template
    const sampleCandidate = candidates[0];

    const prompt = `You are a professional HR recruiter. Generate a formal, professional, and friendly ${typeLabel.toLowerCase()} invitation email template.

Job Details:
- Position: ${jobInfo.jobTitle}
- Company: ${jobInfo.company || companyInfo?.name || 'Our Company'}
${jobInfo.location ? `- Location: ${jobInfo.location}` : ''}

Email Type: ${typeLabel} Invitation

Please generate a complete, professional email with the following structure:

1. Subject Line: Create an appropriate subject line for the ${typeLabel.toLowerCase()} invitation

2. Email Body:
   - Professional greeting using [CANDIDATE_NAME] as placeholder
   - Express appreciation for their application
   - Congratulate them on being shortlisted
   - ${type === 'online_test' 
     ? 'Explain that they need to complete an online assessment as part of the selection process'
     : 'Invite them for an interview (mention date/time will be confirmed separately or use [DATE] and [TIME] placeholders)'}
   - ${type === 'online_test'
     ? 'Include placeholders: [TEST_LINK], [TEST_DEADLINE], [TEST_DURATION]'
     : 'Include placeholders: [INTERVIEW_DATE], [INTERVIEW_TIME], [INTERVIEW_LOCATION/LINK]'}
   - Mention what they should prepare or expect
   - Provide contact information for questions
   - Professional closing

3. Important Requirements:
   - Use [CANDIDATE_NAME] placeholder where the candidate's name should go
   - Keep the tone professional yet warm and encouraging
   - Make the email feel personalized even though it's a template
   - Include all necessary details a candidate would need
   - End with a professional signature block using [HR_NAME], [HR_TITLE], [COMPANY_NAME], [COMPANY_EMAIL], [COMPANY_PHONE] placeholders

Format the response as JSON with this structure:
{
  "subject": "Email subject line here",
  "body": "Full email body here with proper line breaks using \\n"
}

IMPORTANT: Return ONLY valid JSON, no additional text or markdown.`;

    let output, error;
    try {
      const result = await runBytez([
        {
          "role": "user",
          "content": prompt
        }
      ], 4096);
      
      if (result && typeof result === 'object') {
        error = result.error || null;
        output = result.output || result.content || result.text || result;
      } else {
        output = result;
      }
    } catch (apiError) {
      console.error('LLM API Error:', apiError);
      error = apiError;
    }

    if (error) {
      console.error('LLM Error:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to generate email',
        details: error.toString()
      });
    }

    // Parse the output
    let emailData;
    try {
      // Extract JSON from the response
      let jsonStr = typeof output === 'string' ? output : (output.content || output.text || JSON.stringify(output));
      
      // Clean up the response - remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      emailData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      // Fallback: create a basic email structure
      const bodyText = typeof output === 'string' ? output : (output.content || output.text || '');
      emailData = {
        subject: `${typeLabel} Invitation - ${jobInfo.jobTitle} at ${jobInfo.company || 'Our Company'}`,
        body: bodyText
      };
    }

    res.json({
      success: true,
      email: {
        subject: emailData.subject,
        body: emailData.body,
        type: type,
        candidateCount: candidates.length,
        candidates: candidates.map(c => ({
          name: c.candidateName || c.name,
          email: c.email
        }))
      }
    });
  } catch (error) {
    console.error('Generate interview email error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate interview email' });
  }
};
```

### `sendPhysicalInterviewRound` — `backend/controllers/hirePipelineController.js` (invites + condolence core)

**What it does:** Selects candidates, personalizes invites, **`dispatchEmailBatch`**, updates DB, sends **condolence** to non-selected test participants.

```javascript
    const emails = selected
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const body = personalizePhysicalBody(emailBody, hrInfo, jInfo, name, dateStr, timeStr, locStr);
        const subject = emailSubject.replace(/\[CANDIDATE_NAME\]/g, name);
        return { to: email, subject, body, candidateName: name, jobTitle: jInfo.jobTitle, company: jInfo.company };
      })
      .filter(Boolean);

    await dispatchEmailBatch(emails, { ...jInfo, type: 'physical_interview' });

    const physNow = new Date();
    await Application.updateMany(
      { _id: { $in: selected.map((a) => a._id) } },
      { $set: { physicalInterviewInvitedAt: physNow } }
    );

    const notSelected = applications.filter((a) => !selectedSet.has(a._id.toString()));
    // ... build condEmails ...
    if (condEmails.length) {
      await dispatchEmailBatch(condEmails, { ...jInfo, type: 'condolence_post_test' });
      await Application.updateMany(
        { _id: { $in: notSelected.map((a) => a._id) } },
        { $set: { condolenceAfterPhysicalSentAt: physNow } }
      );
    }

    job.physicalInterviewDate = dateStr;
    job.physicalInterviewTime = timeStr;
    job.physicalInterviewLocation = locStr;
    job.physicalInterviewEmailSentAt = physNow;
    job.hirePipelineStage = 'physical_invite_sent';
    job.awaitingFinalHireSelection = true;
    await job.save();

    res.json({
      success: true,
      invitedCount: emails.length,
      condolenceCount: condEmails.length,
    });
```

### `completeFinalHire` — `backend/controllers/hirePipelineController.js` (hire branch excerpt)

**What it does:** Sends **congratulations** to hires and **condolence** to other physical-round candidates; updates **`JobPost`** and **`Application`**.

```javascript
    const congrats = selectedApps
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const body =
          `Dear ${name},\n\n` +
          `Congratulations! We are delighted to confirm that you have been selected for the ${jInfo.jobTitle} position at ${jInfo.company}.\n\n` +
          `Further practical details (start date, documentation, and onboarding steps) will be shared with you directly by our HR team in a separate message.\n\n` +
          `We are excited about what you will bring to the team.\n\n` +
          `Warm congratulations,\n${hrInfo?.name || 'Human Resources'}\n${jInfo.company || ''}`;
        return {
          to: email,
          subject: `Congratulations — ${jInfo.jobTitle} at ${jInfo.company}`,
          body,
          candidateName: name,
          jobTitle: jInfo.jobTitle,
          company: jInfo.company,
        };
      })
      .filter(Boolean);
    if (congrats.length) await dispatchEmailBatch(congrats, { ...jInfo, type: 'congratulations_hire' });

    await Application.updateMany(
      { _id: { $in: ids } },
      { $set: { congratulationsHireSentAt: completedAt } }
    );

    const notChosen = physicalApps.filter((a) => !selectedSet.has(a._id.toString()));
    // ... condEmails for notChosen ...
    if (condEmails.length) {
      await dispatchEmailBatch(condEmails, { ...jInfo, type: 'condolence_not_final_hire' });
      await Application.updateMany(
        { _id: { $in: notChosen.map((a) => a._id) } },
        { $set: { condolenceNotFinalHireSentAt: completedAt } }
      );
    }

    job.awaitingFinalHireSelection = false;
    job.finalHireCompletedAt = completedAt;
    job.hirePipelineStage = 'finished';
    job.remarks = 'completed';
    job.noHireSelected = false;
    await job.save();

    res.json({ success: true, hiredCount: congrats.length });
```

---

## 6. DATABASE MODEL / SCHEMA

### Full file: `backend/models/JobPost.js`

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

**Fields most important for this module:** **`assessmentInviteSentAt`**, **`assessmentDeadline`** (gates when physical invites may send), **`physicalInterview*`** and **`physicalInterviewEmailSentAt`** (one-shot physical round), **`awaitingFinalHireSelection`**, **`finalHireCompletedAt`**, **`noHireSelected`**, **`hirePipelineStage`**.

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

**Fields most important for this module:** **`physicalInterviewInvitedAt`** (who reached final interview), **`selectedAsHire`** (onboarding), and the **`*SentAt`** condolence/congrats fields for **audit trail** of each email wave.

---

## 7. API ENDPOINTS USED IN THIS MODULE

| Method | Endpoint | Controller function | Purpose |
|--------|----------|---------------------|---------|
| POST | `/api/llm/generate-interview-email` | `llmController.generateInterviewEmail` | LLM draft for **interview** or **online_test** email |
| POST | `/api/llm/send-interview-emails` | `llmController.sendInterviewEmails` | Send batch via n8n (shared; can create test invites when `emailType` is online test) |
| GET | `/api/hire-pipeline/test-participants/:jobId` | `hirePipelineController.getTestParticipants` | Test pool + scores + pipeline flags for **Finalize Hire** |
| GET | `/api/hire-pipeline/test-participant/:applicationId` | `hirePipelineController.getTestParticipantDetail` | Drill-down breakdown (MCQ/coding) from **Finalize Hire** |
| POST | `/api/hire-pipeline/physical-interview/:jobId` | `hirePipelineController.sendPhysicalInterviewRound` | Final-round invites + post-test condolences |
| POST | `/api/hire-pipeline/final-hire/:jobId` | `hirePipelineController.completeFinalHire` | Congrats / reject / no-hire + close job |
| GET | `/api/hire-pipeline/onboarding-hires` | `hirePipelineController.getOnboardingHires` | List hires for **Hire onboarding** UI |

**Related on Finalize Hire:** `PUT` (or project-equivalent) **`/api/job-posts/:jobId`** via **`updateJobPost`** for **application `deadline`** (HR-facing field on the job post).

---

## 8. SLIDE-READY SUMMARY

- **One place to close the loop:** After the online test, HR moves candidates into a **final interview round** with **date, time, and location** (or video link) in one workflow.  
- **Professional communications at scale:** **AI-assisted drafts** help HR produce **consistent, polite** invitation emails; the system **fills in names and logistics** automatically.  
- **Fairness for everyone:** Candidates who are **not** shortlisted for the final round still receive a **respectful update**, not silence.  
- **Reliable delivery:** Messages go through **automation (n8n)** so batches are **trackable** and **repeatable** without pasting into dozens of mail clients.  
- **Clear outcomes:** Final selection triggers **congratulations** to new hires and **considerate declines** to others—then the **role is marked complete** and hires appear for **onboarding** follow-up.  
- **Audit-friendly:** **Timestamps** on applications record **which notification** was sent, supporting compliance and internal review.

---

*Document generated from the NeuroHire codebase. **n8n** must be configured with `N8N_EMAIL_WEBHOOK_URL` (or default localhost) for emails to leave the sandbox; LLM email generation requires **Bytez** / `bytez.js` as in `llmController`.*
