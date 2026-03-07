const express = require('express');
const router = express.Router();
const multer = require('multer');
const applicationController = require('../controllers/applicationController');
const admin = require('../config/firebase');
const User = require('../models/User');

// Middleware to verify Firebase token and get user
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/cvs/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Get all active jobs for candidates
router.get('/jobs', applicationController.getActiveJobsForCandidates);

// Submit application - order: verifyToken -> upload -> controller
router.post('/submit', verifyToken, upload.single('cv'), applicationController.submitApplication);

// Get my applications
router.get('/my-applications', applicationController.getMyApplications);

// Evaluate all applications for a job after deadline (HR only)
router.post('/evaluate-job/:jobId', applicationController.evaluateJobApplications);

// Get all applications for a job (HR only) - for instant ranking / pre-deadline view
router.get('/by-job/:jobId', applicationController.getApplicationsByJob);

// Evaluate one application instantly (HR only) - show 1 candidate ranking; rest ranked after deadline
router.post('/evaluate-one/:applicationId', applicationController.evaluateOneApplication);

// Get all evaluated candidates for a job so HR can send test emails (HR only)
router.get('/evaluated-candidates/:jobId', applicationController.getEvaluatedCandidates);

// Get ranked candidates (only those sent test invite) (HR only)
router.get('/ranked/:jobId', applicationController.getRankedCandidates);

// Get all jobs for ranking selection (HR only)
router.get('/jobs-for-ranking', applicationController.getJobsForRanking);

// Mark applications as interview invite sent (HR only)
router.post('/mark-interview-sent/:jobId', applicationController.markInterviewInviteSent);

// Mark selected hires (HR only)
router.post('/mark-hires/:jobId', applicationController.markSelectedAsHire);

// Finalize job as completed (HR only)
router.post('/finalize-job/:jobId', applicationController.finalizeJob);

// Generate 3-month training plan PDF for a hire (HR only)
router.post('/generate-training-plan/:applicationId', applicationController.generateTrainingPlan);

// Download training plan PDF (HR only)
router.get('/training-plan/:applicationId/download', applicationController.downloadTrainingPlan);

module.exports = router;

