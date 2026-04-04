const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');
const { verifyToken, requireHR } = require('../middleware/verifyHr');

const hr = [verifyToken, requireHR];

// Generate job description
router.post('/generate-job-description', ...hr, llmController.generateJobDescription);

// Generate interview invitation email
router.post('/generate-interview-email', ...hr, llmController.generateInterviewEmail);

// Send interview emails via n8n webhook
router.post('/send-interview-emails', ...hr, llmController.sendInterviewEmails);

// Online test: generate MCQ pool (100) and coding questions (3) for a job
router.post('/generate-mcq-pool/:jobId', ...hr, llmController.generateMcqPool);
router.post('/generate-coding-questions/:jobId', ...hr, llmController.generateCodingQuestions);

// HR test editor + top-50 send
router.get('/job-test-content/:jobId', ...hr, llmController.getJobTestContent);
router.post('/save-job-test-content/:jobId', ...hr, llmController.saveJobTestContent);
router.post('/regenerate-job-test/:jobId', ...hr, llmController.regenerateJobTestWithInstruction);
router.post('/send-test-top50/:jobId', ...hr, llmController.sendTestInvitesTop50);

module.exports = router;
