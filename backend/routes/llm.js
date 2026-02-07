const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');

// Generate job description
router.post('/generate-job-description', llmController.generateJobDescription);

// Generate interview invitation email
router.post('/generate-interview-email', llmController.generateInterviewEmail);

// Send interview emails via n8n webhook
router.post('/send-interview-emails', llmController.sendInterviewEmails);

// Online test: generate MCQ pool (100) and coding questions (7) for a job
router.post('/generate-mcq-pool/:jobId', llmController.generateMcqPool);
router.post('/generate-coding-questions/:jobId', llmController.generateCodingQuestions);

module.exports = router;

