const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');

// Generate job description
router.post('/generate-job-description', llmController.generateJobDescription);

module.exports = router;

