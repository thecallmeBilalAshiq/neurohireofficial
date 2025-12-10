const express = require('express');
const router = express.Router();
const jobPostController = require('../controllers/jobPostController');

// Get all active job posts
router.get('/', jobPostController.getAllActiveJobPosts);

// Get single job post by ID for candidates (must be before /:id route)
router.get('/candidate/:id', jobPostController.getJobPostByIdForCandidate);

// Get single job post by ID
router.get('/:id', jobPostController.getJobPostById);

// Create new job post
router.post('/', jobPostController.createJobPost);

// Update job post
router.put('/:id', jobPostController.updateJobPost);

// Delete job post (soft delete)
router.delete('/:id', jobPostController.deleteJobPost);

// Get HR dashboard statistics
router.get('/dashboard/statistics', jobPostController.getDashboardStatistics);

module.exports = router;

