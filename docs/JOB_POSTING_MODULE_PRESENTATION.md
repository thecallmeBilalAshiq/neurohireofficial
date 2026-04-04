# NeuroHire — Job Posting Module — Presentation Pack

Single structured document for FYP slides, diagrams, and technical reference. Based on the repository source code.

---

## 1. MODULE OVERVIEW

### What is this module?

The **Job Posting module** is the HR-facing workflow to **create, list, edit, and retire job openings**, persist them in **MongoDB**, and optionally enrich them with an **AI-generated description** (Bytez LLM), **AI job images** (Nanobanana via `/api/ai-image`), and **social distribution** (n8n webhook). It ties each job to the **logged-in HR user** (`createdBy`). A related **dashboard statistics** API aggregates job and application metrics for the same HR user.

### What problem does it solve?

- **Structured hiring pipeline:** Standardizes job data (title, company, location, salary, skills, deadlines, scoring **weightage**) so downstream **candidate applications** and **AI ranking** use consistent fields.
- **Faster publishing:** HR enters core facts once; the system can **draft marketing-ready descriptions** and push posts to external automation.
- **Multi-tenant safety:** Each HR only sees and edits **their own** job posts (enforced in the controller queries).

### FYP slide summary (2–3 lines)

> Recruiters define roles through a rich **job form** with **priority weights** that later drive candidate scoring. The platform stores jobs in **MongoDB**, uses **AI** to generate polished descriptions and visuals, and can **publish to social channels** through **n8n**. Candidates only see **active** jobs that are still **open**, loaded via a separate authenticated API.

---

## 2. ALL FILES INVOLVED IN THIS MODULE

### Frontend

| Full path | Role |
|-----------|------|
| `frontend/app/hr/job-posting/page.js` | Main HR UI: list jobs, create/edit form, LLM modal, template/AI image flow, social post + retry |
| `frontend/app/hr/dashboard/page.js` | Uses `getDashboardStatistics` (job/application metrics for charts) |
| `frontend/components/ProtectedRoute.jsx` | Wraps HR routes; ensures Firebase session + backend role |
| `frontend/components/BrandLogo.jsx` | Branding on HR pages |
| `frontend/lib/api.js` | `getJobPosts`, `getJobPostById`, `createJobPost`, `updateJobPost`, `deleteJobPost`, `generateJobDescription`, `postToSocialMedia`, `generateAIImage`, `checkAIImageResult`, `getDashboardStatistics` |
| `frontend/lib/config.js` | `endpoints.jobPosts.*`, `getFullUrl` for template image URLs |
| `frontend/lib/firebase.js` | Firebase `auth` for ID tokens |
| `frontend/lib/useHrDarkMode.js` | Dark mode persistence for HR UI |

**Note:** `frontend/app/hr/job-posting/page.js` **imports** `getCompanyInfo` and `updateCompanyInfo` from `api.js`, but **no other references** to those functions appear in that file (likely unused / dead imports in current code).

### Backend — job posts core

| Full path | Role |
|-----------|------|
| `backend/routes/jobPosts.js` | Express routes under `/api/job-posts` |
| `backend/controllers/jobPostController.js` | CRUD, HR/candidate getters, dashboard stats; inline `verifyToken` |
| `backend/models/JobPost.js` | Mongoose schema + weightage validation |
| `backend/utils/textCleaner.js` | `cleanJobDescription` used when saving `generatedDescription` |

### Backend — supporting APIs invoked from job posting UI

| Full path | Role |
|-----------|------|
| `backend/routes/llm.js` | `POST /generate-job-description` |
| `backend/controllers/llmController.js` | `generateJobDescription` (Bytez), `cleanJobDescription` import |
| `backend/routes/socialMedia.js` | `POST /post` |
| `backend/controllers/socialMediaController.js` | Loads `JobPost`, POSTs payload to **n8n** |
| `backend/routes/aiImage.js` | `POST /generate`, `GET /result/:taskId` |
| `backend/controllers/aiImageController.js` | Nanobanana integration for job post images |
| `backend/index.js` | Mounts `jobPosts`, `llm`, `socialMedia`, `aiImage` routers |
| `backend/config/firebase.js` | Firebase Admin for `verifyIdToken` |
| `backend/config/appConfig.js` | URL helpers (referenced from other modules) |

### Database

| Full path | Role |
|-----------|------|
| `backend/models/JobPost.js` | Primary persistence for job postings |
| `backend/models/User.js` | Referenced by `createdBy` on `JobPost` |
| `backend/models/Application.js` | Used in `getDashboardStatistics` for counts (not job CRUD) |

### Config / env (relevant)

- `BYTEZ_API_KEY`, `BYTEZ_MODEL` — LLM job description  
- `N8N_WEBHOOK_URL` — social posting from `socialMediaController`  
- `NANOBANANA_API_TOKEN`, `BACKEND_URL` / `FRONTEND_URL` — AI image + absolute URLs for templates  
- `MONGO_URI` — MongoDB  

**No migrations/seeders** for `JobPost` in this repo.

---

## 3. DATA FLOW DESCRIPTION (FOR DIAGRAM GENERATION)

### 3A — Narrative (step-by-step)

**Flow A — HR opens Job Posting page and loads their jobs**

1. User (HR) opens **`/hr/job-posting`** inside **`ProtectedRoute`** → Firebase session active.  
2. **`JobPostingContent`** in **`frontend/app/hr/job-posting/page.js`** runs **`onAuthStateChanged`** → obtains Firebase **`idToken`**.  
3. **`fetchJobPosts(token)`** calls **`getJobPosts(token)`** in **`frontend/lib/api.js`**.  
4. **HTTP `GET /api/job-posts`** with **`Authorization: Bearer <idToken>`**.  
5. **`jobPostController.verifyToken`** verifies token, loads **`User`**, attaches **`req.user`**.  
6. **`getAllActiveJobPosts`** checks **`req.user.role === 'HR'`**, then **`JobPost.find({ activeStatus: true, createdBy: req.user._id })`**, **`.populate('createdBy')`**, sorts by **`createdAt`**.  
7. Mongo returns documents → controller **`res.json(jobPosts)`**.  
8. Frontend **`setJobPosts(result.data)`** and renders the list/table.

**Flow B — HR creates a new job (with AI description + save + social)**

1. User fills the form and submits → **`handleSubmit`** (same page).  
2. Client validates **weightage sum = 100** and required fields.  
3. For **new** jobs (not edit): builds **`jobData`** object → **`generateJobDescription(jobData, null, null, idToken)`** → **`POST /api/llm/generate-job-description`** (body: `jobData`, optional `previousDescription` / `editInstructions`).  
4. **`llmController.generateJobDescription`** builds a prompt from **`jobData`**, calls **Bytez** via **`runBytez`**, cleans output with **`cleanJobDescription`**, returns **`{ success, generatedDescription }`**.  
5. Frontend shows modal with generated text; user may **regenerate** with **`handleRegenerateDescription`** → same endpoint with **`previousDescription`** + **`editInstructions`**.  
6. User confirms (**`handleLooksGood`**): merges **`generatedDescription`** and **`templateImage`** URL into payload → **`createJobPost(jobData, idToken)`** → **`POST /api/job-posts`**.  
7. **`createJobPost`** in **`jobPostController`**: HR check, validates fields, applies **`cleanJobDescription`** to **`generatedDescription`**, **`new JobPost({... createdBy: req.user._id })`**, **`save()`** (Mongoose **`pre('validate')`** enforces **weightage total = 100** on the document).  
8. Response includes saved **`JobPost`** with **`_id`**.  
9. Frontend calls **`postToSocialMedia(jobPostId, idToken)`** → **`POST /api/social-media/post`** **`{ jobPostId }`**.  
10. **`socialMediaController`**: verifies HR, loads **`JobPost`** by id + **`createdBy`**, builds payload, **`axios.post(N8N_WEBHOOK_URL, …)`**.  
11. Success or failure toast; on failure, **`socialPostRetryJobId`** allows **retry** (`handleRetrySocialPost`).

**Flow C — HR edits or deletes a job**

1. **Edit:** **`handleEdit`** → **`getJobPostById(id, idToken)`** → **`GET /api/job-posts/:id`** → **`getJobPostById`** ensures **`createdBy`** matches HR → populates form.  
2. Submit as edit: **`updateJobPut`** path in **`handleSubmit`** → **`PUT /api/job-posts/:id`** → **`updateJobPost`** updates fields and **`save()`**.  
3. **Delete:** **`handleDelete`** → **`deleteJobPost`** → **`DELETE /api/job-posts/:id`** → **`deleteJobPost`** sets **`activeStatus: false`**, **`remarks: 'deleted'`** (soft delete).

**Flow D — HR dashboard statistics (job-centric)**

1. User opens **`/hr/dashboard`** → **`getDashboardStatistics(token)`** → **`GET /api/job-posts/dashboard/statistics`**.  
2. **`getDashboardStatistics`** counts jobs/applications for **`createdBy: req.user._id`** and returns aggregates + monthly series.

**Flow E — Candidate views a job (consumer of JobPost)**

1. Candidate on apply flow uses **`getJobPostByIdForCandidate(id, idToken)`** → **`GET /api/job-posts/candidate/:id`**.  
2. **`getJobPostByIdForCandidate`** requires **candidate** role; returns job only if **active**, **deadline ≥ now**, **`remarks !== 'deleted'`**.

**Implementation note (routing):** In **`backend/routes/jobPosts.js`**, **`GET /:id`** is registered **before** **`GET /dashboard/statistics`**. In Express, **`GET /api/job-posts/dashboard/statistics`** may be captured as **`GET /:id`** with **`id = "dashboard"`**, so the dashboard statistics route may be **unreachable** at that path unless the router order is fixed. The **frontend** still calls **`/job-posts/dashboard/statistics`** (`api.js`).

---

### 3B — Diagram tool prompt (copy-paste)

```
Generate a data flow diagram with swimlanes: HR Browser, Next.js (job-posting page), Express API, MongoDB, Bytez LLM, n8n, (optional) Nanobanana.

Flow 1 - List jobs:
HR opens /hr/job-posting → ProtectedRoute → Firebase idToken
→ GET /api/job-posts + Bearer token
→ verifyToken → User.findOne → JobPost.find({ activeStatus, createdBy })
→ JSON array → UI list

Flow 2 - New job with AI + social:
HR submits form → validate weightage 100%
→ POST /api/llm/generate-job-description { jobData }
→ Bytez model.run → cleanJobDescription → JSON generatedDescription
→ Modal review / optional regenerate with editInstructions
→ POST /api/job-posts { job fields, generatedDescription, templateImage }
→ JobPost.save (Mongoose validates weightage sum 100)
→ POST /api/social-media/post { jobPostId }
→ JobPost.findOne → axios POST to N8N_WEBHOOK_URL

Flow 3 - Edit/Delete:
GET /api/job-posts/:id (HR owner) OR PUT /api/job-posts/:id OR DELETE (soft delete remarks deleted)

Flow 4 - Dashboard stats:
GET /api/job-posts/dashboard/statistics → aggregates JobPost + Application counts

Flow 5 - Candidate read:
GET /api/job-posts/candidate/:id (candidate token, active job, future deadline)

Optional branch: AI image
POST /api/ai-image/generate → poll GET /api/ai-image/result/:taskId → use URL in templateImage before createJobPost
```

---

## 4. KEY FRONTEND FUNCTIONS

### `getJobPosts` — `frontend/lib/api.js`

**What it does:** Fetches all **active** job posts for the authenticated HR.

```javascript
export const getJobPosts = async (idToken) => {
  try {
    const response = await api.get('/job-posts', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch job posts',
    };
  }
};
```

### `getJobPostById` — `frontend/lib/api.js`

**What it does:** Fetches one job post **owned by** the HR (for edit screen).

```javascript
export const getJobPostById = async (id, idToken) => {
  try {
    const response = await api.get(`/job-posts/${id}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch job post',
    };
  }
};
```

### `createJobPost` — `frontend/lib/api.js`

**What it does:** Creates a new **`JobPost`** document.

```javascript
export const createJobPost = async (jobData, idToken) => {
  try {
    const response = await api.post('/job-posts', jobData, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create job post',
    };
  }
};
```

### `updateJobPost` — `frontend/lib/api.js`

**What it does:** Updates an existing job post **owned by** the HR.

```javascript
export const updateJobPost = async (id, jobData, idToken) => {
  try {
    const response = await api.put(`/job-posts/${id}`, jobData, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update job post',
    };
  }
};
```

### `deleteJobPost` — `frontend/lib/api.js`

**What it does:** Soft-deletes a job post (`activeStatus` false, `remarks` deleted).

```javascript
export const deleteJobPost = async (id, idToken) => {
  try {
    const response = await api.delete(`/job-posts/${id}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete job post',
    };
  }
};
```

### `generateJobDescription` — `frontend/lib/api.js`

**What it does:** Requests AI-generated (or regenerated) job description text from the LLM API.

```javascript
export const generateJobDescription = async (jobData, previousDescription, editInstructions, idToken) => {
  try {
    const response = await api.post('/llm/generate-job-description', {
      jobData,
      previousDescription,
      editInstructions,
    }, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate job description',
    };
  }
};
```

### `postToSocialMedia` — `frontend/lib/api.js`

**What it does:** Triggers n8n workflow to publish a saved job post.

```javascript
export const postToSocialMedia = async (jobPostId, idToken) => {
  try {
    const response = await api.post('/social-media/post', { jobPostId }, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to post to social media',
    };
  }
};
```

### `generateAIImage` / `checkAIImageResult` — `frontend/lib/api.js`

**What it does:** Start async AI image job and poll for result (used from job-posting page for visuals).

```javascript
export const generateAIImage = async (jobData, description, idToken, customPrompt = null, options = {}) => {
  const theme = options.theme === 'dark' ? 'dark' : 'light';
  try {
    const response = await api.post('/ai-image/generate', { 
      jobData, 
      description,
      customPrompt,
      theme,
    }, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate AI image',
    };
  }
};

export const checkAIImageResult = async (taskId, idToken) => {
  try {
    const response = await api.get(`/ai-image/result/${taskId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        'ngrok-skip-browser-warning': 'true',
      },
    });
    if (typeof response.data === 'string' && (
      response.data.trim().startsWith('<!DOCTYPE html>') || 
      response.data.trim().startsWith('<html') ||
      (response.data.includes('ngrok') && response.data.includes('ERR_NGROK'))
    )) {
      console.error('⚠️ Received HTML in checkAIImageResult - ngrok warning page');
      return {
        success: false,
        error: 'Service unavailable - ngrok warning page detected. Please check your API configuration.',
        status: 'error',
      };
    }
    if (response.data && response.data.data) {
      return { success: true, data: response.data.data };
    } else if (response.data) {
      return { success: true, data: response.data };
    } else {
      return {
        success: false,
        error: 'Invalid response structure',
        status: 'error',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to check image result',
      status: 'error',
    };
  }
};
```

### `getDashboardStatistics` — `frontend/lib/api.js`

**What it does:** Loads HR dashboard metrics tied to their jobs and applications.

```javascript
export const getDashboardStatistics = async (idToken) => {
  try {
    const response = await api.get('/job-posts/dashboard/statistics', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch dashboard statistics',
    };
  }
};
```

### `fetchJobPosts` — `frontend/app/hr/job-posting/page.js`

**What it does:** Loads job list into component state after **`getJobPosts`**.

```javascript
  const fetchJobPosts = async (token) => {
    try {
      setLoading(true);
      const result = await getJobPosts(token);
      if (result.success) {
        setJobPosts(Array.isArray(result.data) ? result.data : []);
      } else {
        toast.error(result.error || 'Failed to fetch job posts');
        setJobPosts([]);
      }
    } catch (error) {
      toast.error('Failed to fetch job posts');
      console.error('Error fetching job posts:', error);
      setJobPosts([]);
    } finally {
      setLoading(false);
    }
  };
```

### `handleSubmit` — `frontend/app/hr/job-posting/page.js`

**What it does:** Validates form; on **edit** calls **`updateJobPost`**; on **create** calls **`generateJobDescription`** then opens review modal.

```javascript
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!idToken) {
      toast.error("Authentication required");
      return;
    }

    const weightageTotal = getWeightageTotal();
    if (weightageTotal !== 100) {
      toast.error(`Priority Weight Distribution must sum to exactly 100%. Current sum: ${weightageTotal}%`);
      return;
    }

    if (formData.salary.min && formData.salary.max) {
      const minSalary = parseFloat(formData.salary.min);
      const maxSalary = parseFloat(formData.salary.max);
      if (minSalary < 0 || maxSalary < 0) {
        toast.error("Salary values must be non-negative");
        return;
      }
      if (minSalary > maxSalary) {
        toast.error("Minimum salary cannot be greater than maximum salary");
        return;
      }
    }

    if (!formData.company || !formData.location.country || !formData.location.city || 
        !formData.jobTitle || !formData.keyResponsibilities || !formData.deadline) {
      toast.error("Please fill in all required fields (Company, Location, Job Title, Key Responsibilities, Deadline)");
      return;
    }

    try {
      const jobData = {
        company: formData.company,
        officialEmail: formData.officialEmail || '',
        websiteUrl: formData.websiteUrl || '',
        contactNo: formData.contactNo || '',
        location: {
          country: formData.location.country,
          city: formData.location.city,
          province: formData.location.province || '',
          address: formData.location.address || '',
        },
        jobTitle: formData.jobTitle,
        jobType: formData.jobType,
        salary: {
          min: formData.salary.min ? parseFloat(formData.salary.min) : null,
          max: formData.salary.max ? parseFloat(formData.salary.max) : null,
        },
        keyResponsibilities: formData.keyResponsibilities,
        experience: formData.experience || null,
        education: Array.isArray(formData.education) ? formData.education.join(', ') : (formData.education || ''),
        deadline: formData.deadline,
        skills: formData.skills || [],
        languages: formData.languages || [],
        candidateLocation: formData.candidateLocation || 'anywhere',
        templateImage: '/job-posting-template.png',
        weightage: {
          skills: parseInt(formData.weightage.skills) || 0,
          education: parseInt(formData.weightage.education) || 0,
          experience: parseInt(formData.weightage.experience) || 0,
          projects: parseInt(formData.weightage.projects) || 0,
          language: parseInt(formData.weightage.language) || 0,
          ...Object.fromEntries(
            (formData.customWeightageFields || []).map(f => [f.fieldName, f.value || 0])
          ),
        },
      };

      if (editingJobPost) {
        jobData.templateImage = editingJobPost.templateImage || '/job-posting-template.png';
        const result = await updateJobPost(editingJobPost._id, jobData, idToken);
        if (result.success) {
          toast.success("Job post updated successfully!", { autoClose: 3000 });
          setShowForm(false);
          setEditingJobPost(null);
          handleClear();
          fetchJobPosts(idToken);
        } else {
          toast.error(result.error || 'Failed to update job post');
        }
        return;
      }

      setPendingJobData(jobData);
      setIsGenerating(true);
      const llmResult = await generateJobDescription(jobData, null, null, idToken);
      setIsGenerating(false);

      if (llmResult.success) {
        const description = llmResult.data?.generatedDescription || llmResult.data?.output || '';
        const descriptionText = typeof description === 'string' 
          ? description 
          : (description?.content || description?.text || JSON.stringify(description));
        
        setGeneratedDescription(descriptionText);
        setSocialPostRetryJobId(null);
        setShowGeneratedModal(true);
        setShowEditFeedback(false);
        setEditFeedback("");
      } else {
        toast.error(llmResult.error || 'Failed to generate job description');
      }
    } catch (error) {
      setIsGenerating(false);
      toast.error('Failed to generate job description');
      console.error('Error generating job description:', error);
    }
  };
```

### `handleLooksGood` — `frontend/app/hr/job-posting/page.js`

**What it does:** Persists job with **`generatedDescription`** and **`templateImage`**, then calls **`postToSocialMedia`**.

```javascript
  const handleLooksGood = async () => {
    if (!pendingJobData || !idToken) {
      toast.error("Missing data");
      return;
    }

    if (socialPostRetryJobId) {
      return;
    }

    if (showTemplateSelection && !selectedTemplate) {
      toast.error("Please select an image template or upload an image");
      return;
    }

    try {
      setIsSavingJobPost(true);
      let finalImageUrl = selectedTemplate || '/job-posting-template.png';
      
      if (showTemplateSelection && selectedTemplate && (selectedTemplate.startsWith('/Temaple-') || selectedTemplate.startsWith('/Template-') || selectedTemplate.startsWith('/job-posting-template'))) {
        finalImageUrl = config.getFullUrl(selectedTemplate);
      }

      const jobData = {
        ...pendingJobData,
        generatedDescription: generatedDescription,
        templateImage: finalImageUrl,
      };

      let result;
      if (editingJobPost) {
        result = await updateJobPost(editingJobPost._id, jobData, idToken);
      } else {
        result = await createJobPost(jobData, idToken);
      }

      if (result.success) {
        const jobPostId = result.data._id || result.data.id;
        
        toast.info("Posting to social media platforms...", { autoClose: 2000 });
        const socialMediaResult = await postToSocialMedia(jobPostId, idToken);
        
        if (socialMediaResult.success) {
          toast.success(editingJobPost ? "Job post updated and posted to social media!" : "Job post created and posted to social media!", { autoClose: 5000 });
          finalizeJobPostingFlow();
        } else {
          toast.warning(editingJobPost ? "Job post updated, but social media posting failed." : "Job post saved, but social media posting failed. Use Retry below.", { autoClose: 6000 });
          console.error('Social media posting error:', socialMediaResult.error);
          setSocialPostRetryJobId(jobPostId);
          if (idToken) fetchJobPosts(idToken);
        }
      } else {
        toast.error(result.error || 'Failed to save job post');
      }
    } catch (error) {
      toast.error('Failed to save job post');
      console.error('Error saving job post:', error);
    } finally {
      setIsSavingJobPost(false);
    }
  };
```

---

## 5. KEY BACKEND FUNCTIONS

### `backend/routes/jobPosts.js` (full)

**What it does:** Registers all **`/api/job-posts`** HTTP endpoints.

```javascript
const express = require('express');
const router = express.Router();
const jobPostController = require('../controllers/jobPostController');

router.get('/', jobPostController.getAllActiveJobPosts);
router.get('/candidate/:id', jobPostController.getJobPostByIdForCandidate);
router.get('/:id', jobPostController.getJobPostById);
router.post('/', jobPostController.createJobPost);
router.put('/:id', jobPostController.updateJobPost);
router.delete('/:id', jobPostController.deleteJobPost);
router.get('/dashboard/statistics', jobPostController.getDashboardStatistics);

module.exports = router;
```

### `verifyToken` + all exports — `backend/controllers/jobPostController.js`

**What it does:** Firebase token verification; HR-scoped CRUD; candidate read; soft delete; dashboard aggregates.

The complete file is **511 lines**. It is reproduced below in full as in the repository:

```javascript
const admin = require('../config/firebase');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const Application = require('../models/Application');
const { cleanJobDescription } = require('../utils/textCleaner');

const updateRemarksBasedOnDeadline = async (jobPost) => {
  return jobPost;
};

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

exports.getAllActiveJobPosts = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can view job posts' });
    }

    const jobPosts = await JobPost.find({ 
      activeStatus: true,
      createdBy: req.user._id 
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    const updatedJobPosts = await Promise.all(
      jobPosts.map(jobPost => updateRemarksBasedOnDeadline(jobPost))
    );
    
    res.json(updatedJobPosts);
  } catch (error) {
    console.error('Get all job posts error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch job posts' });
  }
}];

exports.getJobPostById = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can view job posts' });
    }

    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    })
      .populate('createdBy', 'name email');
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }
    
    const updatedJobPost = await updateRemarksBasedOnDeadline(jobPost);
    
    res.json(updatedJobPost);
  } catch (error) {
    console.error('Get job post error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch job post' });
  }
}];

exports.getJobPostByIdForCandidate = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'candidate') {
      return res.status(403).json({ error: 'Only candidates can view this endpoint' });
    }

    const now = new Date();
    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      activeStatus: true,
      deadline: { $gte: now },
      remarks: { $ne: 'deleted' }
    })
      .populate('createdBy', 'name email');
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found or no longer available' });
    }
    
    res.json(jobPost);
  } catch (error) {
    console.error('Get job post for candidate error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch job post' });
  }
}];

exports.createJobPost = [verifyToken, async (req, res) => {
  try {
    const {
      jobTitle,
      company,
      location,
      jobType,
      salary,
      description,
      keyResponsibilities,
      generatedDescription,
      templateImage,
      experience,
      education,
      deadline,
      skills,
      languages,
      candidateLocation,
      weightage,
      officialEmail,
      websiteUrl,
      contactNo,
    } = req.body;

    const responsibilities = keyResponsibilities || description;

    if (!jobTitle || !company || !location || !jobType || !responsibilities || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!location.country || !location.city) {
      return res.status(400).json({ error: 'Location must include country and city' });
    }

    if (salary && salary.min !== null && salary.max !== null) {
      if (salary.min < 0 || salary.max < 0) {
        return res.status(400).json({ error: 'Salary values must be non-negative' });
      }
      if (salary.min > salary.max) {
        return res.status(400).json({ error: 'Minimum salary cannot be greater than maximum salary' });
      }
    }

    if (weightage) {
      let total = 0;
      for (const key in weightage) {
        const value = weightage[key];
        if (typeof value === 'number' && !isNaN(value)) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ error: `Weightage for ${key} must be between 0 and 100` });
          }
          total += value;
        }
      }
      if (total > 100) {
        return res.status(400).json({ error: 'Weightage distribution must sum to less than or equal to 100' });
      }
    }

    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can create job posts' });
    }

    const jobPost = new JobPost({
      jobTitle,
      company,
      officialEmail: officialEmail || '',
      websiteUrl: websiteUrl || '',
      contactNo: contactNo || '',
      location: {
        country: location.country,
        city: location.city,
        province: location.province || '',
        address: location.address || '',
      },
      jobType,
      salary: {
        min: salary?.min !== undefined && salary.min !== '' ? parseFloat(salary.min) : null,
        max: salary?.max !== undefined && salary.max !== '' ? parseFloat(salary.max) : null,
      },
      keyResponsibilities: responsibilities,
      generatedDescription: generatedDescription ? cleanJobDescription(generatedDescription) : '',
      templateImage: templateImage || '/job-posting-template.png',
      experience: experience || null,
      education: Array.isArray(education) 
        ? education 
        : (education ? (typeof education === 'string' ? education.split(',').map(e => e.trim()).filter(e => e) : [education]) : []),
      deadline: new Date(deadline),
      skills: skills || [],
      languages: languages || [],
      candidateLocation: Array.isArray(candidateLocation) 
        ? candidateLocation 
        : (candidateLocation ? [candidateLocation] : []),
      weightage: weightage || {
        skills: 0,
        education: 0,
        experience: 0,
        projects: 0,
        language: 0,
      },
      activeStatus: true,
      remarks: 'pending',
      createdBy: req.user._id,
    });

    await jobPost.save();
    
    const updatedJobPost = await updateRemarksBasedOnDeadline(jobPost);
    await updatedJobPost.populate('createdBy', 'name email');

    res.status(201).json(updatedJobPost);
  } catch (error) {
    console.error('Create job post error:', error);
    if (error.message.includes('Weightage')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to create job post' });
  }
}];

exports.updateJobPost = [verifyToken, async (req, res) => {
  try {
    const {
      jobTitle,
      company,
      location,
      jobType,
      salary,
      description,
      keyResponsibilities,
      generatedDescription,
      templateImage,
      experience,
      education,
      deadline,
      skills,
      languages,
      candidateLocation,
      weightage,
      officialEmail,
      websiteUrl,
      contactNo,
    } = req.body;

    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can update job posts' });
    }

    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    });
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    if (salary) {
      if (salary.min !== undefined && salary.min !== null && salary.min !== '' && salary.min < 0) {
        return res.status(400).json({ error: 'Minimum salary must be non-negative' });
      }
      if (salary.max !== undefined && salary.max !== null && salary.max !== '' && salary.max < 0) {
        return res.status(400).json({ error: 'Maximum salary must be non-negative' });
      }
      if (salary.min !== undefined && salary.max !== undefined && 
          salary.min !== null && salary.max !== null && 
          salary.min !== '' && salary.max !== '' &&
          parseFloat(salary.min) > parseFloat(salary.max)) {
        return res.status(400).json({ error: 'Minimum salary cannot be greater than maximum salary' });
      }
    }

    if (weightage) {
      let total = 0;
      for (const key in weightage) {
        const value = weightage[key];
        if (typeof value === 'number' && !isNaN(value)) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ error: `Weightage for ${key} must be between 0 and 100` });
          }
          total += value;
        }
      }
      if (total > 100) {
        return res.status(400).json({ error: 'Weightage distribution must sum to less than or equal to 100' });
      }
    }

    if (jobTitle) jobPost.jobTitle = jobTitle;
    if (company) jobPost.company = company;
    if (officialEmail !== undefined) jobPost.officialEmail = officialEmail || '';
    if (websiteUrl !== undefined) jobPost.websiteUrl = websiteUrl || '';
    if (contactNo !== undefined) jobPost.contactNo = contactNo || '';
    if (location) {
      if (location.country) jobPost.location.country = location.country;
      if (location.city) jobPost.location.city = location.city;
      if (location.province !== undefined) jobPost.location.province = location.province;
      if (location.address !== undefined) jobPost.location.address = location.address;
    }
    if (jobType) jobPost.jobType = jobType;
    if (salary) {
      if (salary.min !== undefined) jobPost.salary.min = salary.min !== '' ? parseFloat(salary.min) : null;
      if (salary.max !== undefined) jobPost.salary.max = salary.max !== '' ? parseFloat(salary.max) : null;
    }
    if (keyResponsibilities !== undefined) jobPost.keyResponsibilities = keyResponsibilities;
    else if (description !== undefined) jobPost.keyResponsibilities = description;
    if (generatedDescription !== undefined) jobPost.generatedDescription = cleanJobDescription(generatedDescription);
    if (templateImage !== undefined) jobPost.templateImage = templateImage;
    if (experience !== undefined) jobPost.experience = experience;
    if (education !== undefined) {
      jobPost.education = Array.isArray(education) 
        ? education 
        : (education ? (typeof education === 'string' ? education.split(',').map(e => e.trim()).filter(e => e) : [education]) : []);
    }
    if (deadline) jobPost.deadline = new Date(deadline);
    if (skills !== undefined) jobPost.skills = skills;
    if (languages !== undefined) jobPost.languages = languages;
    if (candidateLocation !== undefined) {
      jobPost.candidateLocation = Array.isArray(candidateLocation) 
        ? candidateLocation 
        : (candidateLocation ? [candidateLocation] : []);
    }
    if (weightage) {
      jobPost.weightage = { ...jobPost.weightage, ...weightage };
    }

    await jobPost.save();
    
    const updatedJobPost = await updateRemarksBasedOnDeadline(jobPost);
    await updatedJobPost.populate('createdBy', 'name email');

    res.json(updatedJobPost);
  } catch (error) {
    console.error('Update job post error:', error);
    if (error.message.includes('Weightage')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to update job post' });
  }
}];

exports.deleteJobPost = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can delete job posts' });
    }

    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    });
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    jobPost.activeStatus = false;
    jobPost.remarks = 'deleted';
    
    await jobPost.save();

    res.json({ message: 'Job post deleted successfully', jobPost });
  } catch (error) {
    console.error('Delete job post error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete job post' });
  }
}];

exports.getDashboardStatistics = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can view dashboard statistics' });
    }

    const now = new Date();
    
    const allJobs = await JobPost.find({ 
      createdBy: req.user._id,
      remarks: { $ne: 'deleted' }
    });

    const activeJobsCount = await JobPost.countDocuments({
      createdBy: req.user._id,
      activeStatus: true,
      deadline: { $gte: now },
      remarks: { $ne: 'deleted' }
    });

    const completedJobsCount = await JobPost.countDocuments({
      createdBy: req.user._id,
      $or: [
        { remarks: 'completed' },
        { deadline: { $lt: now } }
      ],
      remarks: { $ne: 'deleted' }
    });

    const jobIds = allJobs.map(job => job._id);

    const totalApplications = await Application.countDocuments({
      jobPost: { $in: jobIds }
    });

    const uniqueCandidates = await Application.distinct('candidate', {
      jobPost: { $in: jobIds }
    });
    const totalCandidatesCount = uniqueCandidates.length;

    const hiredCandidatesCount = await Application.countDocuments({
      jobPost: { $in: jobIds },
      status: 'accepted'
    });

    const last12Months = [];
    const applicationsByMonth = [];
    const candidatesByMonth = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
      last12Months.push(monthName);
      
      const appsInMonth = await Application.countDocuments({
        jobPost: { $in: jobIds },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      applicationsByMonth.push(appsInMonth);
      
      const uniqueInMonth = await Application.distinct('candidate', {
        jobPost: { $in: jobIds },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      candidatesByMonth.push(uniqueInMonth.length);
    }

    res.json({
      activeJobs: activeJobsCount,
      completedJobs: completedJobsCount,
      hiredCandidates: hiredCandidatesCount,
      totalCandidates: totalCandidatesCount,
      totalApplications: totalApplications,
      monthlyData: {
        months: last12Months,
        applications: applicationsByMonth,
        candidates: candidatesByMonth
      }
    });
  } catch (error) {
    console.error('Get dashboard statistics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch dashboard statistics' });
  }
}];
```

### `cleanJobDescription` — `backend/utils/textCleaner.js` (full)

**What it does:** Strips markdown/HTML noise from LLM output before persisting **`generatedDescription`**.

```javascript
function cleanJobDescription(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text;
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`[^`]+`/g, (match) => match.replace(/`/g, ''));
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  cleaned = cleaned.replace(/^\s*\*+\s*/gm, '');
  cleaned = cleaned.replace(/\s*\*+\s*$/gm, '');
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  cleaned = cleaned.replace(/[ \t]{3,}/g, '  ');
  cleaned = cleaned.replace(/^\s+/gm, '');
  cleaned = cleaned.replace(/\s+$/gm, '');
  cleaned = cleaned.trim();
  return cleaned;
}

module.exports = { cleanJobDescription };
```

### `exports.generateJobDescription` — `backend/controllers/llmController.js` (abridged)

**What it does:** Builds recruiter prompt from **`jobData`**, calls **Bytez**, normalizes output, **`cleanJobDescription`**, returns JSON.

*The function is long (~240 lines). Below: opening validation, core `runBytez` call, and successful response path. For the full prompt-building branches, see `backend/controllers/llmController.js` lines 45–284.*

```javascript
exports.generateJobDescription = async (req, res) => {
  try {
    if (!model) {
      return res.status(503).json({ 
        error: 'LLM service not available. Please ensure bytez.js is installed and BYTEZ_API_KEY is set.' 
      });
    }

    const { jobData, previousDescription, editInstructions } = req.body;

    if (!previousDescription && (!jobData || !jobData.jobTitle || !jobData.company)) {
      return res.status(400).json({ 
        error: 'Missing required fields: jobData with jobTitle and company are required for initial generation.' 
      });
    }

    let prompt;
    // ... builds `prompt` from jobData (initial) or previousDescription + editInstructions (regenerate)

    let output, error;
    try {
      const result = await runBytez([{ "role": "user", "content": prompt }], 4096);
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
      /* ... maps Bytez errors to 401/503/500 ... */
    }

    let descriptionText = '';
    if (typeof output === 'string') {
      descriptionText = output;
    } else if (output && typeof output === 'object') {
      /* ... extract content/text/message/array ... */
    } else {
      descriptionText = String(output || 'Failed to generate description');
    }

    const cleanedDescription = cleanJobDescription(descriptionText);

    res.json({ 
      success: true, 
      generatedDescription: cleanedDescription
    });
  } catch (error) {
    console.error('Generate job description error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate job description' });
  }
};
```

### `exports.postToSocialMedia` — `backend/controllers/socialMediaController.js` (excerpt)

**What it does:** Verifies HR, loads **`JobPost`**, POSTs formatted payload to **`N8N_WEBHOOK_URL`**.

```javascript
exports.postToSocialMedia = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can post to social media' });
    }

    const { jobPostId } = req.body;

    if (!jobPostId) {
      return res.status(400).json({ error: 'Job post ID is required' });
    }

    const jobPost = await JobPost.findOne({ 
      _id: jobPostId,
      createdBy: req.user._id 
    }).populate('createdBy', 'name email');

    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!n8nWebhookUrl) {
      return res.status(500).json({ 
        error: 'N8N webhook URL not configured. Please set N8N_WEBHOOK_URL in environment variables.',
        hint: 'The N8N_WEBHOOK_URL should point to your n8n webhook endpoint, not your backend.'
      });
    }

    // ... format description, skills, image URL, build socialMediaData ...

    // const response = await axios.post(n8nWebhookUrl, socialMediaData, { ... });
    // res.json({ success: true, ... });
  } catch (error) {
    /* ... */
  }
}];
```

*(The remainder of the handler formats text, resolves image URLs, and calls `axios.post`; see `socialMediaController.js` from line ~88 onward.)*

### LLM route — `backend/routes/llm.js` (relevant line)

```javascript
router.post('/generate-job-description', llmController.generateJobDescription);
```

### Social route — `backend/routes/socialMedia.js`

```javascript
router.post('/post', socialMediaController.postToSocialMedia);
```

---

## 6. DATABASE MODEL / SCHEMA

### Full file — `backend/models/JobPost.js`

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

### Most important fields

| Field | Why |
|-------|-----|
| **`createdBy`** | Scopes every query to the owning HR user. |
| **`deadline`** | Drives candidate visibility (`deadline >= now`) and dashboard “completed” heuristics. |
| **`activeStatus` / `remarks`** | Listing uses **active** jobs; soft delete sets **`remarks: 'deleted'`** and **`activeStatus: false`**. |
| **`weightage`** | Must sum to **100** in Mongoose validation — feeds **application scoring** elsewhere. |
| **`keyResponsibilities` / `generatedDescription`** | HR-authored duties vs **AI-polished** copy for display and social posting. |
| **`skills`, `languages`, `education`, `experience`** | Structured inputs for LLM prompts and ranking. |

---

## 7. API ENDPOINTS USED IN THIS MODULE

Base paths: **`/api/job-posts`**, **`/api/llm`**, **`/api/social-media`**, **`/api/ai-image`** (from `backend/index.js`).

| Method | Endpoint | Controller / handler | Purpose |
|--------|----------|-------------------------|---------|
| GET | `/api/job-posts` | `getAllActiveJobPosts` | HR: list **active** jobs for **current user** |
| GET | `/api/job-posts/:id` | `getJobPostById` | HR: get one job **if owner** |
| GET | `/api/job-posts/candidate/:id` | `getJobPostByIdForCandidate` | Candidate: public job detail (active, not past deadline, not deleted) |
| POST | `/api/job-posts` | `createJobPost` | HR: create job |
| PUT | `/api/job-posts/:id` | `updateJobPost` | HR: update **own** job |
| DELETE | `/api/job-posts/:id` | `deleteJobPost` | HR: **soft** delete **own** job |
| GET | `/api/job-posts/dashboard/statistics` | `getDashboardStatistics` | HR: analytics (**note: route order may shadow this** — see §3) |
| POST | `/api/llm/generate-job-description` | `generateJobDescription` | AI job description (Bytez) |
| POST | `/api/social-media/post` | `postToSocialMedia` | Send job payload to **n8n** |
| POST | `/api/ai-image/generate` | `generateJobPostImage` | Start AI image task |
| GET | `/api/ai-image/result/:taskId` | `checkImageResult` | Poll image result |

**Security note:** `POST /api/llm/generate-job-description` has **no** router-level Firebase middleware in `routes/llm.js`; the frontend still sends a Bearer token, but the handler does not verify it in that file.

---

## 8. SLIDE-READY SUMMARY

- **Smart job publishing:** Recruiters enter structured role details once; the system can **draft a full, share-ready description** automatically using AI.  
- **Fair, transparent scoring setup:** Each role defines **priority weights** (skills, experience, education, etc.) that **must total 100%**, aligning later candidate evaluation with what matters for that job.  
- **Your jobs, your data:** Every listing is tied to the **HR who created it**, so teams only manage their own openings—no accidental cross-access.  
- **From desk to social feed:** After saving, the platform can **hand off** the job to **automation (n8n)** to reach candidates on social channels, with **retry** if the handoff fails.  
- **Rich, professional output:** Optional **AI-generated images** and cleaned text help posts look polished and consistent with your brand.  
- **Live pipeline visibility:** A **dashboard** summarizes **open roles, completed roles, applications, and hires** so management can see hiring health at a glance.

---

*End of document.*
