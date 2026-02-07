const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

// Public: validate test link (GET ?token=)
router.get('/validate-token', testController.validateToken);

// Public: start test (POST { token })
router.post('/start', testController.startTest);

// Public: get attempt (resume) - requires token in query
router.get('/attempt/:attemptId', testController.getAttempt);

// Public: save progress - token in body
router.put('/attempt/:attemptId', testController.saveProgress);

// Public: submit test
router.post('/attempt/:attemptId/submit', testController.submitTest);

module.exports = router;
