const express = require('express');
const router = express.Router();
const { 
  generateJobPostImage, 
  nanobananaWebhook, 
  checkImageResult 
} = require('../controllers/aiImageController');

// Generate AI image for job post
router.post('/generate', generateJobPostImage);

// Webhook endpoint for Nanobanana to send results (no auth required - webhook from external service)
router.post('/webhook/nanobanana', nanobananaWebhook);

// Check image result by taskId (for frontend polling)
router.get('/result/:taskId', checkImageResult);

// Debug endpoint to check all stored results (for testing)
router.get('/debug/results', (req, res) => {
  // Access the imageResults Map from the controller
  const controller = require('../controllers/aiImageController');
  // Note: We need to export imageResults from the controller
  // For now, this endpoint won't work until we export it properly
  res.json({ 
    message: 'Debug endpoint - check controller for imageResults export',
    note: 'Webhook at localhost cannot be reached by Nanobanana. Use ngrok or deploy to public URL.'
  });
});

module.exports = router;

