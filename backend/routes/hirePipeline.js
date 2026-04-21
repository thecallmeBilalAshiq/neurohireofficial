const express = require('express');
const router = express.Router();
const hire = require('../controllers/hirePipelineController');

router.get('/cv-ranked/:jobId', ...hire.getCvRankedCandidates);
router.get('/test-participants/:jobId', ...hire.getTestParticipants);
router.get('/test-participant/:applicationId', ...hire.getTestParticipantDetail);
router.post('/physical-interview/:jobId', ...hire.sendPhysicalInterviewRound);
router.post('/final-hire/:jobId', ...hire.completeFinalHire);
router.get('/onboarding-hires', ...hire.getOnboardingHires);
router.post('/close-no-eligible/:jobId', ...hire.closeJobNoEligibleCandidates);

module.exports = router;
