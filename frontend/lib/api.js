import axios from 'axios';
import config from './config';

const API_BASE_URL = config.api.getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Bypass ngrok browser warning page
    'ngrok-skip-browser-warning': 'true',
  },
});

// Request interceptor to handle FormData properly and ensure ngrok header
api.interceptors.request.use((config) => {
  // Always add ngrok bypass header for ngrok URLs
  if (API_BASE_URL.includes('ngrok') || config.url?.includes('ngrok')) {
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  // If the data is FormData, remove Content-Type header to let axios set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Response interceptor to catch errors and handle ngrok HTML responses
api.interceptors.response.use(
  (response) => {
    // Check if response is HTML (ngrok warning page) instead of JSON
    const contentType = response.headers['content-type'] || '';
    const responseData = response.data;
    
    // Check if we got HTML instead of JSON (ngrok warning page)
    if (typeof responseData === 'string' && (
      responseData.trim().startsWith('<!DOCTYPE html>') || 
      responseData.trim().startsWith('<html') ||
      responseData.includes('ngrok') && responseData.includes('ERR_NGROK')
    )) {
      console.error('⚠️ Received HTML instead of JSON - ngrok warning page detected');
      console.error('Response preview:', responseData.substring(0, 200));
      
      // Create a proper error object
      const error = new Error('Service unavailable - ngrok warning page detected');
      error.response = {
        status: 503,
        statusText: 'Service Unavailable',
        data: {
          error: 'Service temporarily unavailable. ngrok is showing a warning page.',
          details: 'Please ensure the ngrok-skip-browser-warning header is being sent with requests.',
          htmlResponse: true
        },
        headers: response.headers
      };
      error.config = response.config;
      return Promise.reject(error);
    }
    
    return response;
  },
  (error) => {
    // Check if error response is HTML (ngrok warning page)
    const errorData = error.response?.data;
    if (typeof errorData === 'string' && errorData.trim().startsWith('<!DOCTYPE html>')) {
      console.error('Error response is HTML - ngrok warning page detected');
      error.response.data = {
        error: 'Service temporarily unavailable. ngrok warning page detected.',
        details: 'Please ensure the ngrok-skip-browser-warning header is being sent.'
      };
    }
    
    // Dispatch error event for notification system
    if (typeof window !== 'undefined') {
      const errorMessage = error.response?.data?.error || error.message || 'An error occurred';
      const errorType = error.response?.status >= 500 ? 'server' : 'error';
      
      window.dispatchEvent(new CustomEvent('systemError', {
        detail: {
          message: errorMessage,
          type: errorType,
          source: error.config?.url || 'API',
          status: error.response?.status
        }
      }));
    }
    return Promise.reject(error);
  }
);

// Signup API
export const signup = async (userData) => {
  try {
    const response = await api.post('/auth/signup', userData);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Signup failed',
    };
  }
};

// Login API
export const login = async (idToken) => {
  try {
    const response = await api.post('/auth/login', { idToken });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Login failed',
    };
  }
};

// Verify Email API
export const verifyEmail = async (idToken) => {
  try {
    const response = await api.post('/auth/verify-email', { idToken });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to verify email',
    };
  }
};

// Forgot Password API
export const forgotPassword = async (email) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to send reset email',
    };
  }
};

// Verify Token API
export const verifyToken = async (idToken) => {
  try {
    const response = await api.post('/auth/verify-token', { token: idToken });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Token verification failed',
    };
  }
};

// Job Posts API
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

export const getJobPostByIdForCandidate = async (id, idToken) => {
  try {
    const response = await api.get(`/job-posts/candidate/${id}`, {
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

// LLM API
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

// Social Media API
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

// Google Drive API removed - images are now sent directly to n8n

// AI Image Generation API
export const generateAIImage = async (jobData, description, idToken, customPrompt = null) => {
  try {
    const response = await api.post('/ai-image/generate', { 
      jobData, 
      description,
      customPrompt 
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

// Check AI Image Result (for polling)
export const checkAIImageResult = async (taskId, idToken) => {
  try {
    const response = await api.get(`/ai-image/result/${taskId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        // Ensure ngrok header is set
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    // Check if we got HTML instead of JSON (should be caught by interceptor, but double-check)
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
    
    // Ensure we have the correct response structure
    if (response.data && response.data.data) {
      return { success: true, data: response.data.data };
    } else if (response.data) {
      // Fallback: if data is directly in response.data
      return { success: true, data: response.data };
    } else {
      return {
        success: false,
        error: 'Invalid response structure',
        status: 'error',
      };
    }
  } catch (error) {
    // Handle ngrok HTML response errors
    if (error.response?.data?.htmlResponse || 
        (typeof error.response?.data === 'string' && error.response.data.includes('ngrok'))) {
      return {
        success: false,
        error: 'Service unavailable - ngrok warning page detected. Please ensure ngrok-skip-browser-warning header is set.',
        status: 'error',
      };
    }
    
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to check image result',
      status: error.response?.data?.status || 'error',
    };
  }
};


// Google Drive upload removed - images are now sent directly to n8n via URL

// Candidate Application API
export const getActiveJobsForCandidates = async (idToken) => {
  try {
    const response = await api.get('/applications/jobs', {
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

export const getMyApplications = async (idToken) => {
  try {
    const response = await api.get('/applications/my-applications', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch applications',
    };
  }
};

export const submitApplication = async (formData, idToken) => {
  try {
    const response = await api.post('/applications/submit', formData, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        // Don't set Content-Type - axios will set it automatically with the correct boundary
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to submit application',
    };
  }
};

export const checkCVFormat = async (formData, idToken) => {
  try {
    const response = await api.post('/cv/check-format', formData, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        // Don't set Content-Type - axios will set it automatically with the correct boundary
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

export const autofillCV = async (formData, idToken) => {
  try {
    const response = await api.post('/cv/autofill', formData, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        // Don't set Content-Type - axios will set it automatically with the correct boundary
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

export const downloadCVTemplate = async () => {
  try {
    const response = await api.get('/cv/template', {
      responseType: 'blob',
    });
    
    // Create blob link to download
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

// Get ranked candidates for a job (HR only)
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

// Get jobs for ranking selection (HR only)
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

// Evaluate all applications for a job after deadline (HR only)
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

// Get evaluated candidates (all with scores) so HR can send test emails (HR only)
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

// Get all applications for a job (HR only) - for instant ranking before/after deadline
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

// Evaluate one application instantly (HR only) - show 1 candidate ranking; rest after deadline
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

// Mark interview invite sent for selected applications (HR only)
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

// Mark selected hires (HR only)
export const markSelectedAsHire = async (jobId, applicationIds, idToken) => {
  try {
    const response = await api.post(`/applications/mark-hires/${jobId}`, { applicationIds }, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update hires',
    };
  }
};

// Finalize job as completed (HR only)
export const finalizeJob = async (jobId, idToken) => {
  try {
    const response = await api.post(`/applications/finalize-job/${jobId}`, {}, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to finalize job',
    };
  }
};

// Generate training plan PDF for a hire (HR only)
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

// Get base URL for API (for download links)
export const getApiBaseUrl = () => config.api.getBaseUrl();

// Get HR dashboard statistics
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

// Admin API Functions
export const adminLogin = async (email, password) => {
  try {
    const response = await api.post('/admin/login', { email, password });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Admin login failed',
    };
  }
};

export const createHR = async (hrData, adminToken) => {
  try {
    const response = await api.post('/admin/hr', hrData, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create HR account',
    };
  }
};

export const getAllHR = async (adminToken) => {
  try {
    const response = await api.get('/admin/hr', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch HR accounts',
    };
  }
};

export const getHRById = async (uid, adminToken) => {
  try {
    const response = await api.get(`/admin/hr/${uid}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch HR account',
    };
  }
};

export const updateHR = async (uid, hrData, adminToken) => {
  try {
    const response = await api.put(`/admin/hr/${uid}`, hrData, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update HR account',
    };
  }
};

export const blockHR = async (uid, adminToken) => {
  try {
    const response = await api.post(`/admin/hr/${uid}/block`, {}, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to block HR account',
    };
  }
};

export const activateHR = async (uid, adminToken) => {
  try {
    const response = await api.post(`/admin/hr/${uid}/activate`, {}, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to activate HR account',
    };
  }
};

export const deleteHR = async (uid, adminToken) => {
  try {
    const response = await api.delete(`/admin/hr/${uid}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete HR account',
    };
  }
};

// ==========================================
// Interview Email API Functions
// ==========================================

// Generate interview/test invitation email using GPT-4o
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

// Send interview emails via n8n webhook
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

// Prepare online test: generate MCQ pool and coding questions for a job (HR)
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

// ==========================================
// Online Test API (public - no auth)
// ==========================================

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

export const startTest = async (token) => {
  try {
    const response = await api.post('/test/start', { token });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to start test',
    };
  }
};

export const getTestAttempt = async (attemptId, token) => {
  try {
    const response = await api.get(`/test/attempt/${attemptId}`, { params: { token } });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to load attempt',
    };
  }
};

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

/** Run code during test (language, code, stdin). Public endpoint. */
export const runCode = async (language, code, stdin = '') => {
  try {
    const response = await api.post('/test/run-code', { language, code, stdin });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to run code',
      data: error.response?.data,
    };
  }
};

export default api;

