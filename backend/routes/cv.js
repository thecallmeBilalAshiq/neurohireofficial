const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cvController');

// Check CV format
router.post('/check-format', cvController.checkCVFormat);

// Autofill CV using Bytez LLM
router.post('/autofill', cvController.autofillCV);

// Download CV template
router.get('/template', cvController.downloadCVTemplate);

module.exports = router;

