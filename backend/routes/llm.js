const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');

// Generate job description
router.post('/generate-job-description', llmController.generateJobDescription);

// Generate interview invitation email
router.post('/generate-interview-email', llmController.generateInterviewEmail);

// Send interview emails via n8n webhook
router.post('/send-interview-emails', llmController.sendInterviewEmails);

module.exports = router;

