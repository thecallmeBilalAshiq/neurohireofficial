import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to handle FormData properly
api.interceptors.request.use((config) => {
  // If the data is FormData, remove Content-Type header to let axios set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Response interceptor to catch errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
      },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
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

export default api;

