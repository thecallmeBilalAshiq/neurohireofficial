const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
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

// HR endpoint to initiate 12-week JIRA onboarding
router.post('/initiate/:applicationId', verifyToken, onboardingController.initiateOnboarding);

// Unified endpoint to get onboarding tasks & progress (Both HR and Candidate)
router.get('/progress/:applicationId', verifyToken, onboardingController.getOnboardingProgress);

// Candidate endpoint to submit weekly deliverables
router.post('/submit/:applicationId/:weekNumber', verifyToken, onboardingController.submitWeeklyTask);

// HR endpoint to evaluate weekly performances and get AI coach report
router.post('/evaluate/:applicationId', verifyToken, onboardingController.evaluateOnboardingPerformance);

module.exports = router;
