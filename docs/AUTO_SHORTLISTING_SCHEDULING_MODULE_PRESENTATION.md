# NeuroHire — Auto Shortlisting & Scheduling Module — Presentation Pack

Single structured document for FYP slides, diagrams, and technical reference. Based on the repository source code.

---

## 1. MODULE OVERVIEW

### What is this module?

The **Auto Shortlisting & Scheduling** workflow sits on the **Ranked Candidates** HR screen after AI scoring. HR **selects** high-scoring applicants (the practical “shortlist”). The system uses an **LLM** to **draft professional invitation emails** that congratulate candidates on being **shortlisted**, with two channels: **Interview** (placeholders for date, time, location/link) or **Online test** (secure **token link**, **deadline**, **duration**). For **online tests**, the backend **automatically creates** **`TestInvitation`** records (unique token, **7-day expiry**), **ensures MCQ/coding question banks** exist, **personalizes** each email, and **queues delivery** via an **n8n webhook**. For **interviews**, after send the app can **stamp** **`interviewInviteSentAt`** on **`Application`**. **Test preparation** can be run ahead of time (**Prepare online test**) to **generate** and store question pools per job.

### What problem does it solve?

- **Speed:** HR does not write invitation emails from scratch—the **AI template** matches job and channel (interview vs test).
- **Operational scheduling for tests:** Each invite gets a **time-bounded** link (`expiresAt`), a **fixed communicated duration** (“2 hours”), and a **human-readable deadline** in the email body.
- **Integration:** Shortlisted test-takers appear in the **ranked board** with **CV scores + test outcomes** after they submit.

### FYP slide summary (2–3 lines)

> After **AI ranking**, HR **ticks the best candidates** and clicks **Send Email**. The system **writes a polished shortlist message** and, for **online assessments**, **issues personal links** with **automatic expiry** and **pre-generated questions**. **Interview** invites use **clear placeholders** HR can fill with **date, time, and venue** before sending—so **scheduling** is structured without losing human control.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Full path | Role |
|-----------|------|
| `frontend/app/hr/ranked-candidates/page.js` | **Send Email** flow: pick **interview** vs **online test**, **`generateInterviewEmail`**, edit modal, **`sendInterviewEmails`**, **`markInterviewInviteSent`** (interview only), **`prepareTestQuestions`**, **`handleMarkInterviewSent`** |
| `frontend/lib/api.js` | **`generateInterviewEmail`**, **`sendInterviewEmails`**, **`prepareTestQuestions`**, **`markInterviewInviteSent`** |
| `frontend/lib/config.js` | API base / LLM path usage via shared axios instance |
| `frontend/lib/firebase.js` | Bearer token for authenticated API calls |
| `frontend/lib/useHrDarkMode.js` | UI theming on ranked-candidates page |
| `frontend/components/ProtectedRoute.jsx` | HR-only access |
| `frontend/app/hr/dashboard/page.js` | Navigation to ranked candidates |
| `frontend/app/test/page.js` | Candidate lands with **`?token=`**; validates token, starts test |
| `frontend/app/test/take/page.js` | Proctored test UI (uses APIs from `api.js`) |
| `frontend/app/test/done/page.js` | Post-submit flow |

### Backend

| Full path | Role |
|-----------|------|
| `backend/controllers/llmController.js` | **`generateInterviewEmail`**, **`sendInterviewEmails`**, **`ensureTestQuestionsForJob`**, **`generateAndSaveMcqPool`**, **`generateAndSaveCodingQuestions`**, **`generateMcqPool`**, **`generateCodingQuestions`** |
| `backend/controllers/applicationController.js` | **`markInterviewInviteSent`**, **`getRankedCandidates`** (consumer of invitations) |
| `backend/routes/llm.js` | `POST /generate-interview-email`, `POST /send-interview-emails`, `POST /generate-mcq-pool/:jobId`, `POST /generate-coding-questions/:jobId` |
| `backend/routes/applications.js` | `POST /mark-interview-sent/:jobId` |
| `backend/routes/test.js` | Public test validate/start/submit (downstream of invitation) |
| `backend/controllers/testController.js` | Token validation, attempt lifecycle |
| `backend/index.js` | Mounts **`/api/llm`**, **`/api/applications`**, **`/api/test`** |
| `backend/config/appConfig.js` | **`frontend.url`** for building **`/test?token=`** links |

### Database

| Full path | Role |
|-----------|------|
| `backend/models/Application.js` | **`interviewInviteSentAt`**, **`status`** (enum includes `shortlisted`—see note in §6) |
| `backend/models/TestInvitation.js` | **Token**, **`expiresAt`**, job/application/candidate refs, **`status`**, **`invitationSentAt`** |
| `backend/models/TestMcqPool.js` | Per-job **MCQ bank** for online tests |
| `backend/models/CodingQuestion.js` | Per-job **coding problems** for online tests |
| `backend/models/TestAttempt.js` | Submitted attempts (linked to invitation) |

### Config / environment

| Variable / file | Role |
|-----------------|------|
| `N8N_EMAIL_WEBHOOK_URL` | Default `http://localhost:5678/webhook/send-interview-emails`; n8n receives **`emails[]`** payload |
| `FRONTEND_URL` / `NEXT_PUBLIC_FRONTEND_URL` | Base URL for **`[TEST_LINK]`** |
| `BYTEZ_API_KEY`, `BYTEZ_MODEL` | LLM for email text and question generation |

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### 3A — Narrative (step-by-step)

**A) Optional: prepare question banks (scheduling readiness)**

1. HR selects an **evaluated** job and clicks **Prepare online test** → **`prepareTestQuestions(jobId, idToken)`**.  
2. **Parallel** **`POST /api/llm/generate-mcq-pool/:jobId`** and **`POST /api/llm/generate-coding-questions/:jobId`**.  
3. LLM generates **MCQs** (stored in **`TestMcqPool`**) and **7 coding items** (**`CodingQuestion`**).  
4. Toast success; later sends can call **`ensureTestQuestionsForJob`** again if pools are thin.

**B) HR selects shortlist and opens email flow**

1. On **`/hr/ranked-candidates`**, HR checks candidates → **Send Email** → confirm modal → chooses **Interview** or **Online test**.  
2. **`confirmAndGenerateEmail`** → **`POST /api/llm/generate-interview-email`** with **`candidates`**, **`jobInfo`**, **`emailType`**.  
3. **`generateInterviewEmail`** (LLM) returns JSON **`subject`** + **`body`** with placeholders (`[CANDIDATE_NAME]`, `[TEST_LINK]` / `[INTERVIEW_DATE]`, etc.).  
4. HR edits body/subject in modal (e.g. replace interview date/time/location placeholders manually).

**C) Send online test invitations (auto token + deadline text + queue)**

1. **`handleSendEmails`** → **`POST /api/llm/send-interview-emails`** with **`emailType: 'online_test'`**, **`jobId`**, **`candidates`**, **`emailContent`**, **`hrInfo`**, **`jobInfo`**.  
2. **`sendInterviewEmails`** calls **`ensureTestQuestionsForJob(jobId)`**; on failure returns **503**.  
3. For each candidate: load **`Application`**, create **`TestInvitation`** (**`expiresAt` = now + 7 days**), **`save()`**, map **email → `{ token, expiresAt }`**.  
4. For each email: replace **`[CANDIDATE_NAME]`**, HR/company placeholders; if online test, set **`[TEST_LINK]`** = `{frontendUrl}/test?token={token}`, **`[TEST_DEADLINE]`** = formatted **`expiresAt`**, **`[TEST_DURATION]`** = **`'2 hours'`** (hardcoded in code).  
5. **POST** payload **`{ emails, totalCount, jobInfo, sentAt }`** to **n8n** webhook **`N8N_EMAIL_WEBHOOK_URL`**.  
6. Response **`sentCount`** → frontend toast, clear selection, **`fetchRankedCandidates`**.

**D) Send interview invitations (mark scheduling contact)**

1. Same **`sendInterviewEmails`** but **`emailType !== 'online_test'`** → **no** **`TestInvitation`** rows.  
2. Placeholders **`[INTERVIEW_DATE]`**, **`[INTERVIEW_TIME]`**, **`[INTERVIEW_LOCATION/LINK]`** are **not** auto-substituted in the backend—HR is expected to **edit** them in the modal before send.  
3. On success, frontend calls **`markInterviewInviteSent(jobId, applicationIds)`** → **`POST /api/applications/mark-interview-sent/:jobId`** → **`Application.updateMany`** sets **`interviewInviteSentAt`**.

**E) Candidate receives link and “schedule” is enforced by token**

1. Candidate opens **`/test?token=...`**.  
2. **`validateTestToken`** / **`startTest`** ( **`/api/test/...`** ) check **`TestInvitation`**, **`expiresAt`**, status.  
3. After submit, attempts link back for HR ranked view (test score column).

---

### 3B — Diagram tool prompt (copy-paste)

```
Generate a data flow diagram with swimlanes: HR (Ranked Candidates UI), Express API (LLM + Applications), MongoDB, Bytez LLM, n8n Email Webhook, Candidate Browser.

Optional prep:
HR clicks Prepare online test → parallel POST generate-mcq-pool and generate-coding-questions → TestMcqPool and CodingQuestion documents per JobPost

Shortlist + template:
HR selects candidates → POST generate-interview-email → LLM returns subject/body with placeholders → HR edits in modal

Online test send:
POST send-interview-emails with emailType online_test and jobId
→ ensureTestQuestionsForJob (generate pools if missing)
→ for each selected candidate: create TestInvitation with random token and expiresAt = now + 7 days
→ personalize email: TEST_LINK = frontend URL + /test?token=..., TEST_DEADLINE = formatted date, TEST_DURATION = 2 hours
→ POST JSON to n8n webhook to send emails

Interview send:
POST send-interview-emails without creating TestInvitation
→ personalize HR/candidate/company placeholders only
→ frontend calls mark-interview-sent → Application.interviewInviteSentAt updated

Candidate:
Opens test link → validate token and expiry → take test → results stored on TestAttempt for HR ranked view
```

---

## 4. KEY FRONTEND FUNCTIONS

### `generateInterviewEmail` — `frontend/lib/api.js`

**What it does:** Requests an LLM-generated interview or online-test email template.

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

### `sendInterviewEmails` — `frontend/lib/api.js`

**What it does:** Sends personalized emails through the backend (n8n); passes **`jobId`** and **`emailType`** for test-invite side effects.

```javascript
export const sendInterviewEmails = async (candidates, emailContent, jobInfo, hrInfo, idToken, options = {}) => {
  try {
    const { jobId, emailType } = options;
    const response = await api.post('/llm/send-interview-emails', {
      candidates,
      emailContent,
      jobInfo,
      hrInfo,
      jobId: jobId || null,
      emailType: emailType || null,
    }, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to send interview emails',
    };
  }
};
```

### `prepareTestQuestions` — `frontend/lib/api.js`

**What it does:** Triggers MCQ pool and coding-question generation for a job in parallel.

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

### `markInterviewInviteSent` — `frontend/lib/api.js`

**What it does:** Records that interview communications were sent for selected applications.

```javascript
export const markInterviewInviteSent = async (jobId, applicationIds, idToken) => {
  try {
    const response = await api.post(`/applications/mark-interview-sent/${jobId}`, { applicationIds }, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to mark interview sent',
    };
  }
};
```

### `handleGenerateEmail` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Validates selection and opens the confirmation modal before generation.

```javascript
  const handleGenerateEmail = async () => {
    if (selectedCandidates.length === 0) {
      toast.warning("Please select at least one candidate");
      return;
    }
    
    setShowConfirmModal(true);
  };
```

### `confirmAndGenerateEmail` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Calls **`generateInterviewEmail`** and loads the result into the email modal.

```javascript
  const confirmAndGenerateEmail = async () => {
    setShowConfirmModal(false);
    setIsGeneratingEmail(true);
    setShowEmailModal(true);

    try {
      const result = await generateInterviewEmail(
        selectedCandidates,
        jobInfo,
        emailType,
        idToken
      );

      if (result.success) {
        setGeneratedEmail({
          subject: result.data.email.subject,
          body: result.data.email.body
        });
        toast.success("Email generated successfully!");
      } else {
        toast.error(result.error || "Failed to generate email");
        setShowEmailModal(false);
      }
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error("Failed to generate email");
      setShowEmailModal(false);
    } finally {
      setIsGeneratingEmail(false);
    }
  };
```

### `handleSendEmails` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Posts to **`sendInterviewEmails`**; for **interview** type only, calls **`markInterviewInviteSent`** after success.

```javascript
  const handleSendEmails = async () => {
    if (!generatedEmail.subject || !generatedEmail.body) {
      toast.warning("Please generate an email first");
      return;
    }

    setIsSendingEmails(true);

    try {
      const result = await sendInterviewEmails(
        selectedCandidates,
        generatedEmail,
        jobInfo,
        hrInfo,
        idToken,
        { jobId: selectedJobId, emailType }
      );

      if (result.success) {
        toast.success(`Successfully sent ${result.data.sentCount} email(s)!`);
        if (emailType === "interview" && selectedJobId && selectedCandidates.length > 0) {
          const appIds = selectedCandidates.map((c) => c._id);
          await markInterviewInviteSent(selectedJobId, appIds, idToken);
        }
        setShowConfirmModal(false);
        setShowEmailModal(false);
        setGeneratedEmail({ subject: "", body: "" });
        setSelectedCandidates([]);
        setSelectAll(false);
        fetchRankedCandidates(selectedJobId);
      } else {
        toast.error(result.error || "Failed to send emails");
      }
    } catch (error) {
      console.error("Error sending emails:", error);
      toast.error("Failed to send emails");
    } finally {
      setIsSendingEmails(false);
    }
  };
```

### `handlePrepareTest` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Pre-generates MCQ and coding content before mass invites.

```javascript
  const handlePrepareTest = async () => {
    if (!selectedJobId || !idToken) {
      toast.warning("Please select a job first.");
      return;
    }
    setPreparingTest(true);
    try {
      const result = await prepareTestQuestions(selectedJobId, idToken);
      if (result.success) {
        toast.success("Test questions (MCQ pool + coding) are being generated. You can send online test emails now.");
      } else {
        toast.error(result.error || "Failed to prepare test questions");
      }
    } catch (e) {
      toast.error("Failed to prepare test questions");
    } finally {
      setPreparingTest(false);
    }
  };
```

### `handleMarkInterviewSent` — `frontend/app/hr/ranked-candidates/page.js`

**What it does:** Standalone action to mark invites sent (used from a dedicated handler path in the same page).

```javascript
  const handleMarkInterviewSent = async () => {
    if (!selectedJobId || !idToken || selectedCandidates.length === 0) return;
    setIsSendingEmails(true);
    try {
      const appIds = selectedCandidates.map((c) => c._id);
      const result = await markInterviewInviteSent(selectedJobId, appIds, idToken);
      if (result.success) {
        toast.success("Interview invite marked as sent.");
        setShowConfirmModal(false);
        setShowEmailModal(false);
        setSelectedCandidates([]);
        fetchRankedCandidates(selectedJobId);
      } else toast.error(result.error || "Failed");
    } catch (e) {
      toast.error("Failed to mark interview sent");
    } finally {
      setIsSendingEmails(false);
    }
  };
```

---

## 5. KEY BACKEND FUNCTIONS

### Route wiring — `backend/routes/llm.js` (module-relevant)

**What it does:** Exposes LLM email and test-bank endpoints.

```javascript
const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');

router.post('/generate-interview-email', llmController.generateInterviewEmail);
router.post('/send-interview-emails', llmController.sendInterviewEmails);
router.post('/generate-mcq-pool/:jobId', llmController.generateMcqPool);
router.post('/generate-coding-questions/:jobId', llmController.generateCodingQuestions);

module.exports = router;
```

### Route wiring — `backend/routes/applications.js` (excerpt)

```javascript
router.post('/mark-interview-sent/:jobId', applicationController.markInterviewInviteSent);
```

### `generateInterviewEmail` — `backend/controllers/llmController.js`

**What it does:** Uses Bytez to produce JSON **`subject`** / **`body`** with shortlist wording and placeholders for interview or online test.

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

    const type = emailType || 'interview';
    const typeLabel = type === 'online_test' ? 'Online Assessment/Test' : 'Interview';

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

    let emailData;
    try {
      let jsonStr = typeof output === 'string' ? output : (output.content || output.text || JSON.stringify(output));
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      emailData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
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

### `sendInterviewEmails` — `backend/controllers/llmController.js`

**What it does:** Creates **`TestInvitation`** rows for online tests, substitutes placeholders, posts to **n8n**. (Uses module-level **`N8N_EMAIL_WEBHOOK_URL`** defined at top of `llmController.js`.)

```javascript
exports.sendInterviewEmails = async (req, res) => {
  try {
    const { candidates, emailContent, jobInfo, hrInfo, jobId, emailType } = req.body;
    const Application = require('../models/Application');
    const TestInvitation = require('../models/TestInvitation');
    const config = require('../config/appConfig');

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'At least one candidate is required' });
    }

    if (!emailContent || !emailContent.subject || !emailContent.body) {
      return res.status(400).json({ error: 'Email content with subject and body is required' });
    }

    const isOnlineTest = emailType === 'online_test';
    const frontendUrl = (config.frontend && config.frontend.url) || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    const testExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
    const invitationMap = {};

    if (isOnlineTest && jobId) {
      try {
        await ensureTestQuestionsForJob(jobId);
      } catch (e) {
        console.error('ensureTestQuestionsForJob:', e);
        return res.status(503).json({
          error: 'Test could not be prepared (MCQ/coding questions generation failed). Please try again or contact support.',
        });
      }
      for (const c of candidates) {
        const applicationId = c._id;
        const app = await Application.findById(applicationId).populate('candidate', '_id');
        if (!app || !app.candidate) continue;
        const inv = new TestInvitation({
          jobPost: jobId,
          application: applicationId,
          candidate: app.candidate._id,
          expiresAt: testExpiresAt,
        });
        await inv.save();
        invitationMap[c.email] = { token: inv.token, expiresAt: testExpiresAt };
      }
    }

    const emailsToSend = candidates.map(candidate => {
      let personalizedBody = emailContent.body
        .replace(/\[CANDIDATE_NAME\]/g, candidate.candidateName || candidate.name || 'Candidate')
        .replace(/\[HR_NAME\]/g, hrInfo?.name || 'HR Team')
        .replace(/\[HR_TITLE\]/g, hrInfo?.title || 'Human Resources')
        .replace(/\[COMPANY_NAME\]/g, jobInfo?.company || 'Our Company')
        .replace(/\[COMPANY_EMAIL\]/g, hrInfo?.email || 'hr@company.com')
        .replace(/\[COMPANY_PHONE\]/g, hrInfo?.phone || '');

      if (isOnlineTest && invitationMap[candidate.email]) {
        const { token, expiresAt } = invitationMap[candidate.email];
        const testLink = `${frontendUrl.replace(/\/$/, '')}/test?token=${token}`;
        personalizedBody = personalizedBody
          .replace(/\[TEST_LINK\]/g, testLink)
          .replace(/\[TEST_DEADLINE\]/g, expiresAt.toLocaleDateString(undefined, { dateStyle: 'long' }))
          .replace(/\[TEST_DURATION\]/g, '2 hours');
      }

      let personalizedSubject = emailContent.subject
        .replace(/\[CANDIDATE_NAME\]/g, candidate.candidateName || candidate.name || 'Candidate');

      return {
        to: candidate.email,
        subject: personalizedSubject,
        body: personalizedBody,
        candidateName: candidate.candidateName || candidate.name,
        jobTitle: jobInfo?.jobTitle,
        company: jobInfo?.company
      };
    });

    try {
      const n8nResponse = await axios.post(N8N_EMAIL_WEBHOOK_URL, {
        emails: emailsToSend,
        totalCount: emailsToSend.length,
        jobInfo: jobInfo,
        sentAt: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      res.json({
        success: true,
        message: `Successfully queued ${emailsToSend.length} email(s) for sending`,
        sentCount: emailsToSend.length,
        n8nResponse: n8nResponse.data
      });
    } catch (webhookError) {
      console.error('n8n webhook error:', webhookError);
      if (webhookError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: 'Email service (n8n) is not available. Please ensure n8n is running and the webhook is configured.',
          details: 'Connection refused to n8n webhook URL',
          webhookUrl: N8N_EMAIL_WEBHOOK_URL
        });
      }
      return res.status(500).json({
        error: 'Failed to send emails via n8n webhook',
        details: webhookError.message
      });
    }
  } catch (error) {
    console.error('Send interview emails error:', error);
    res.status(500).json({ error: error.message || 'Failed to send interview emails' });
  }
};
```

### `ensureTestQuestionsForJob` (internal) — `backend/controllers/llmController.js`

**What it does:** Ensures **`TestMcqPool`** and **`CodingQuestion`** documents meet minimum size before invites go out.

```javascript
async function ensureTestQuestionsForJob(jobId) {
  const pool = await TestMcqPool.findOne({ jobPost: jobId });
  if (!pool || !pool.questions || pool.questions.length < 30) {
    try {
      await generateAndSaveMcqPool(jobId);
    } catch (e) {
      console.error('Background MCQ pool generation failed:', e);
    }
  }
  const coding = await CodingQuestion.findOne({ jobPost: jobId });
  if (!coding || !coding.questions || coding.questions.length < 7) {
    try {
      await generateAndSaveCodingQuestions(jobId);
    } catch (e) {
      console.error('Background coding questions generation failed:', e);
    }
  }
}
```

### `generateMcqPool` — `backend/controllers/llmController.js`

**What it does:** HR-triggered MCQ bank creation for a job.

```javascript
exports.generateMcqPool = async (req, res) => {
  try {
    if (!model) return res.status(503).json({ error: 'LLM service not available.' });
    const { jobId } = req.params;
    const JobPost = require('../models/JobPost');
    const job = await JobPost.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const result = await generateAndSaveMcqPool(jobId);
    if (!result.ok) {
      return res.status(500).json({ error: `LLM generated only ${result.count || 0} valid MCQs. Need at least 30.` });
    }
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Generate MCQ pool error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate MCQ pool' });
  }
};
```

### `generateCodingQuestions` — `backend/controllers/llmController.js`

**What it does:** HR-triggered coding-question set creation for a job.

```javascript
exports.generateCodingQuestions = async (req, res) => {
  try {
    if (!model) return res.status(503).json({ error: 'LLM service not available.' });
    const { jobId } = req.params;
    const JobPost = require('../models/JobPost');
    const job = await JobPost.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const result = await generateAndSaveCodingQuestions(jobId);
    if (!result.ok) {
      return res.status(500).json({ error: `LLM generated only ${result.count || 0} coding questions. Need 7.` });
    }
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Generate coding questions error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate coding questions' });
  }
};
```

### `markInterviewInviteSent` — `backend/controllers/applicationController.js`

**What it does:** Sets **`interviewInviteSentAt`** on selected applications for a job.

```javascript
exports.markInterviewInviteSent = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR' });
    const { jobId } = req.params;
    const { applicationIds } = req.body;
    if (!jobId || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ error: 'jobId and applicationIds array required' });
    }

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    await Application.updateMany(
      { _id: { $in: applicationIds }, jobPost: jobId },
      { $set: { interviewInviteSentAt: new Date() } }
    );
    res.json({ success: true, message: 'Interview invite sent marked', count: applicationIds.length });
  } catch (error) {
    console.error('Mark interview invite error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}];
```

### Security / auth note

**`backend/routes/llm.js`** does **not** register **`verifyToken`** middleware. The frontend sends **`Authorization`**, but **these LLM routes may be callable without Firebase verification** unless another layer protects them. **`mark-interview-sent`** uses **`verifyToken`** via the applications router pattern.

---

## 6. DATABASE MODEL / SCHEMA

### Full `backend/models/TestInvitation.js`

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

### Full `backend/models/TestMcqPool.js`

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

### Full `backend/models/CodingQuestion.js`

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

### Full `backend/models/Application.js` (fields central to this module)

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

### Most important fields (this module)

| Model | Field | Why |
|--------|--------|-----|
| **TestInvitation** | **`token`**, **`expiresAt`** | Unique test URL and **automatic scheduling window** for the online assessment. |
| **TestInvitation** | **`application`**, **`jobPost`**, **`candidate`** | Bind invite to the right person and role. |
| **TestInvitation** | **`status`** | Tracks pending / attempted / expired / disqualified. |
| **Application** | **`interviewInviteSentAt`** | Audit trail for **interview** outreach after successful send. |
| **TestMcqPool** / **CodingQuestion** | **`questions`**, **`jobPost`** | Content required before or during **`ensureTestQuestionsForJob`**. |

### Note on **`Application.status`**

The enum includes **`shortlisted`**, but **no controller in this repo sets `status` to `shortlisted`** when emails send. Shortlisting is **operational** (selection + email copy + **`TestInvitation`** / **`interviewInviteSentAt`**), not automatically mirrored in **`status`** unless you add that logic.

---

## 7. API ENDPOINTS USED IN THIS MODULE

| Method | Endpoint | Controller function | Purpose |
|--------|----------|---------------------|---------|
| POST | `/api/llm/generate-interview-email` | `generateInterviewEmail` | LLM draft email (interview or online test template) |
| POST | `/api/llm/send-interview-emails` | `sendInterviewEmails` | Create invitations (if test), personalize, **n8n** send |
| POST | `/api/llm/generate-mcq-pool/:jobId` | `generateMcqPool` | Build / refresh MCQ bank |
| POST | `/api/llm/generate-coding-questions/:jobId` | `generateCodingQuestions` | Build / refresh coding set |
| POST | `/api/applications/mark-interview-sent/:jobId` | `markInterviewInviteSent` | Stamp **`interviewInviteSentAt`** (used after **interview** send in UI) |

**Related (candidate test entry, not HR shortlist UI):** `GET/POST` under **`/api/test/...`** for **`validateTestToken`**, **`startTest`**, submit—see `backend/routes/test.js`.

---

## 8. SLIDE-READY SUMMARY

- **Smart shortlist messaging:** Pick top applicants from the **AI-ranked list**, and the system **drafts professional “you’re shortlisted” emails** tailored to **interviews** or **online tests**.  
- **Automatic test scheduling:** Online invites include a **personal secure link**, a **clear submission deadline** (one week in the current build), and a **stated test duration**—no manual link-building.  
- **Interview control:** For face-to-face steps, HR **fills date, time, and place** in the email editor so **scheduling stays accurate** without rigid calendar integration.  
- **Ready when you are:** HR can **pre-generate** large **MCQ and coding question banks** per job so **invite day is one click**, not a fire drill.  
- **Delivery you can automate:** Outbound mail is handed to **n8n**, so your team can plug in **SMTP, templates, and logging** without changing the core app.  
- **End-to-end visibility:** Invited test-takers flow back into the **ranked dashboard** with **scores**, closing the loop from **shortlist → assessment → decision**.

---

*End of document.*
