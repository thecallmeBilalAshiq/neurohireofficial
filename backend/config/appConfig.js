/**
 * Centralized Application Configuration
 * All service URLs and endpoints should be configured here
 * Update these values in one place and they will be used throughout the application
 */

require('dotenv').config();

const config = {
  // Backend Configuration
  backend: {
    port: process.env.PORT || 5000,
    url: process.env.BACKEND_URL || 'http://localhost:5000',
    apiBasePath: '/api',
  },

  // Frontend Configuration
  frontend: {
    url: process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
    // For CORS - allow requests from frontend
    corsOrigin: process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  },

  // API Endpoints (constructed from base URLs)
  endpoints: {
    // Backend API endpoints
    api: {
      auth: '/api/auth',
      jobPosts: '/api/job-posts',
      llm: '/api/llm',
      socialMedia: '/api/social-media',
      aiImage: '/api/ai-image',
      applications: '/api/applications',
      cv: '/api/cv',
    },
    // Webhook endpoints
    webhooks: {
      nanobanana: '/api/ai-image/webhook/nanobanana',
    },
    // Frontend routes
    frontend: {
      jobs: '/jobs',
      jobPosting: '/hr/job-posting',
    },
  },

  // Helper functions to get full URLs
  getBackendUrl: (path = '') => {
    return `${config.backend.url}${path}`;
  },

  getFrontendUrl: (path = '') => {
    return `${config.frontend.url}${path}`;
  },

  getApiUrl: (endpoint) => {
    return `${config.backend.url}${config.endpoints.api[endpoint] || endpoint}`;
  },

  getWebhookUrl: (webhookName) => {
    return `${config.backend.url}${config.endpoints.webhooks[webhookName] || webhookName}`;
  },

  getFrontendRoute: (route) => {
    return `${config.frontend.url}${config.endpoints.frontend[route] || route}`;
  },
};

module.exports = config;

