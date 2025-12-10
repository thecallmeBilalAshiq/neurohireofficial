const express = require('express');
const router = express.Router();
const socialMediaController = require('../controllers/socialMediaController');

// Debug middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`[Social Media Route] ${req.method} ${req.path}`);
  next();
});

// Post job post to social media platforms via n8n
router.post('/post', socialMediaController.postToSocialMedia);

module.exports = router;

