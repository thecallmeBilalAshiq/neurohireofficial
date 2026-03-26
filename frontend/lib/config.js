/**
 * Centralized Frontend Configuration
 * All service URLs and endpoints should be configured here
 * Update these values in one place and they will be used throughout the application
 */

// Helper function to get API base URL
const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  return `${backendUrl}/api`;
};

const config = {
  // Backend API Configuration
  api: {
    getBaseUrl: getApiBaseUrl,
  },

  // Frontend Configuration
  frontend: {
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  },

  // API Endpoints (paths only, base URL is prepended)
  endpoints: {
    auth: {
      signup: '/auth/signup',
      login: '/auth/login',
      verifyEmail: '/auth/verify-email',
      forgotPassword: '/auth/forgot-password',
      verifyToken: '/auth/verify-token',
    },
    jobPosts: {
      list: '/job-posts',
      get: (id) => `/job-posts/${id}`,
      create: '/job-posts',
      update: (id) => `/job-posts/${id}`,
      delete: (id) => `/job-posts/${id}`,
      dashboardStats: '/job-posts/dashboard/statistics',
    },
    llm: {
      generateJobDescription: '/llm/generate-job-description',
    },
    socialMedia: {
      post: '/social-media/post',
    },
    aiImage: {
      generate: '/ai-image/generate',
      checkResult: (taskId) => `/ai-image/result/${taskId}`,
    },
    applications: {
      jobs: '/applications/jobs',
      myApplications: '/applications/my-applications',
      submit: '/applications/submit',
      ranked: (jobId) => `/applications/ranked/${jobId}`,
      jobsForRanking: '/applications/jobs-for-ranking',
    },
    cv: {
      checkFormat: '/cv/check-format',
      autofill: '/cv/autofill',
      template: '/cv/template',
    },
    contact: {
      submit: '/contact',
    },
  },

  // Frontend Routes
  routes: {
    auth: {
      login: '/auth/login',
      signup: '/auth/signup',
      forgotPassword: '/auth/forgot-password',
    },
    hr: {
      dashboard: '/hr/dashboard',
      jobPosting: '/hr/job-posting',
      rankedCandidates: '/hr/ranked-candidates',
    },
    candidate: {
      dashboard: '/candidate/dashboard',
      apply: (jobId) => `/candidate/apply/${jobId}`,
      jobs: '/candidate/apply',
    },
    jobs: {
      view: (jobId) => `/jobs/${jobId}`,
    },
  },

  // Helper functions
  getApiUrl: (endpoint) => {
    const baseUrl = config.api.getBaseUrl();
    // Remove leading /api if endpoint already includes it
    const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : endpoint;
    return `${baseUrl}${cleanEndpoint}`;
  },

  getFullUrl: (path) => {
    return `${config.frontend.url}${path}`;
  },
};

export default config;

