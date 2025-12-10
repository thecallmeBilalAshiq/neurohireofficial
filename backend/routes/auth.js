const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Authentication routes
router.post('/signup', authController.signup);
router.post('/verify-email', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);

// Utility routes
router.post('/verify-token', authController.verifyToken);
router.post('/create-profile', authController.createUserProfile);

module.exports = router;