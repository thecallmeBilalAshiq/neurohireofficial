const TestInvitation = require('../models/TestInvitation');
const TestAttempt = require('../models/TestAttempt');
const TestMcqPool = require('../models/TestMcqPool');
const CodingQuestion = require('../models/CodingQuestion');
const JobPost = require('../models/JobPost');
const { runCode } = require('../services/codeRunService');
const { CODING_PROBLEM_COUNT } = require('../config/assessmentConfig');

const TEST_DURATION_MINUTES = 120;
const MAX_VIOLATIONS_BEFORE_DISQUALIFY = 5;

// Validate token and return test info (no auth required)
exports.validateToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Test token is required' });
    }
    const invitation = await TestInvitation.findOne({ token }).populate('jobPost', 'jobTitle company');
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired test link' });
    }
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        error: invitation.status === 'attempted' ? 'You have already attempted this test.' : invitation.status === 'disqualified' ? 'You have been disqualified from this test.' : 'This test link has expired.',
        status: invitation.status,
      });
    }
    if (new Date() > invitation.expiresAt) {
      await TestInvitation.updateOne({ _id: invitation._id }, { status: 'expired' });
      return res.status(400).json({ error: 'This test has expired. The deadline was 1 week from the invitation date.' });
    }
    const inProgressAttempt = await TestAttempt.findOne({
      testInvitation: invitation._id,
      status: 'in_progress',
    }).select('_id');
    res.json({
      valid: true,
      jobTitle: invitation.jobPost.jobTitle,
      company: invitation.jobPost.company,
      expiresAt: invitation.expiresAt,
      token,
      existingAttemptId: inProgressAttempt ? inProgressAttempt._id.toString() : null,
    });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate token' });
  }
};

// Start test: create attempt, return 30 random MCQs + coding questions (no auth; token in body)
exports.startTest = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Test token is required' });
    }
    const invitation = await TestInvitation.findOne({ token }).populate('jobPost', 'jobTitle company');
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired test link' });
    }
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'You have already started or completed this test.', status: invitation.status });
    }
    if (new Date() > invitation.expiresAt) {
      await TestInvitation.updateOne({ _id: invitation._id }, { status: 'expired' });
      return res.status(400).json({ error: 'This test has expired.' });
    }

    const jobId = invitation.jobPost._id;
    const mcqPool = await TestMcqPool.findOne({ jobPost: jobId });
    const codingDoc = await CodingQuestion.findOne({ jobPost: jobId });

    if (!mcqPool || !mcqPool.questions || mcqPool.questions.length < 30) {
      return res.status(503).json({
        error: 'Test questions are not ready yet. Please try again in a few minutes. If the problem persists, contact the recruiter.',
      });
    }
    if (!codingDoc || !codingDoc.questions || codingDoc.questions.length < CODING_PROBLEM_COUNT) {
      return res.status(503).json({
        error: 'Coding questions are not ready yet. Please try again in a few minutes.',
      });
    }

    // Shuffle and pick 30 MCQs
    const indices = mcqPool.questions.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const mcqOrder = indices.slice(0, 30);
    const mcqQuestions = mcqOrder.map(i => {
      const q = mcqPool.questions[i];
      return { questionText: q.questionText, options: q.options }; // do not send correctIndex
    });

    const codingPool = codingDoc.questions.slice(0, CODING_PROBLEM_COUNT);
    const codingQuestions = codingPool.map((q) => ({
      title: q.title,
      statement: q.statement,
      inputFormat: q.inputFormat,
      outputFormat: q.outputFormat,
      sampleInput: q.sampleInput,
      sampleOutput: q.sampleOutput,
      constraints: q.constraints,
      difficulty: q.difficulty,
    }));

    let attempt = await TestAttempt.findOne({ testInvitation: invitation._id });
    if (attempt) {
      if (attempt.status !== 'in_progress') {
        return res.status(400).json({ error: 'You have already submitted this test.', attemptId: attempt._id });
      }
    } else {
      attempt = new TestAttempt({
        testInvitation: invitation._id,
        mcqOrder,
        mcqAnswers: mcqOrder.map((_, i) => ({ questionIndex: i, selectedIndex: -1 })),
        codingSubmissions: codingPool.map((_, i) => ({ questionIndex: i, code: '', language: 'javascript' })),
      });
      await attempt.save();
      await TestInvitation.updateOne({ _id: invitation._id }, { status: 'attempted' });
    }

    res.json({
      success: true,
      attemptId: attempt._id,
      jobTitle: invitation.jobPost.jobTitle,
      company: invitation.jobPost.company,
      durationMinutes: TEST_DURATION_MINUTES,
      mcqQuestions,
      codingQuestions,
      startedAt: attempt.startedAt,
    });
  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({ error: error.message || 'Failed to start test' });
  }
};

// Get current attempt (for resuming / re-fetch questions without answers)
exports.getAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { token } = req.query;
    if (!attemptId || !token) {
      return res.status(400).json({ error: 'attemptId and token are required' });
    }
    const attempt = await TestAttempt.findOne({ _id: attemptId }).populate({
      path: 'testInvitation',
      populate: { path: 'jobPost', select: 'jobTitle company' },
    });
    if (!attempt || !attempt.testInvitation || attempt.testInvitation.token !== token) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (attempt.status !== 'in_progress') {
      return res.json({ attempt, status: attempt.status, submittedAt: attempt.submittedAt });
    }
    const mcqPool = await TestMcqPool.findOne({ jobPost: attempt.testInvitation.jobPost._id });
    const codingDoc = await CodingQuestion.findOne({ jobPost: attempt.testInvitation.jobPost._id });
    if (!mcqPool || !codingDoc) {
      return res.status(503).json({ error: 'Questions not available' });
    }
    const mcqQuestions = attempt.mcqOrder.map(i => {
      const q = mcqPool.questions[i];
      return { questionText: q.questionText, options: q.options };
    });
    const codingPool = codingDoc.questions.slice(0, CODING_PROBLEM_COUNT);
    const codingQuestions = codingPool.map((q) => ({
      title: q.title,
      statement: q.statement,
      inputFormat: q.inputFormat,
      outputFormat: q.outputFormat,
      sampleInput: q.sampleInput,
      sampleOutput: q.sampleOutput,
      constraints: q.constraints,
      difficulty: q.difficulty,
    }));
    const codingSubmissions = (attempt.codingSubmissions || []).slice(0, CODING_PROBLEM_COUNT);
    res.json({
      attemptId: attempt._id,
      status: attempt.status,
      durationMinutes: TEST_DURATION_MINUTES,
      startedAt: attempt.startedAt,
      mcqQuestions,
      codingQuestions,
      mcqAnswers: attempt.mcqAnswers,
      codingSubmissions,
      violationCount: attempt.violationCount,
    });
  } catch (error) {
    console.error('Get attempt error:', error);
    res.status(500).json({ error: error.message || 'Failed to get attempt' });
  }
};

// Save progress (MCQ answers, coding code) and/or proctoring events
exports.saveProgress = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { token, mcqAnswers, codingSubmissions, proctoringEvent, violationCount } = req.body;
    if (!attemptId || !token) {
      return res.status(400).json({ error: 'attemptId and token are required' });
    }
    const attempt = await TestAttempt.findOne({ _id: attemptId }).populate('testInvitation');
    if (!attempt || !attempt.testInvitation || attempt.testInvitation.token !== token) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'Test already submitted' });
    }

    if (Array.isArray(mcqAnswers)) {
      attempt.mcqAnswers = mcqAnswers;
    }
    if (Array.isArray(codingSubmissions)) {
      attempt.codingSubmissions = codingSubmissions.slice(0, CODING_PROBLEM_COUNT);
    }
    if (typeof violationCount === 'number' && violationCount >= 0) {
      attempt.violationCount = violationCount;
      if (violationCount >= MAX_VIOLATIONS_BEFORE_DISQUALIFY) {
        attempt.status = 'disqualified';
        attempt.submittedAt = new Date();
        await TestInvitation.updateOne({ _id: attempt.testInvitation._id }, { status: 'disqualified' });
      }
    }
    if (proctoringEvent && typeof proctoringEvent === 'object') {
      attempt.proctoringEvents.push({
        type: proctoringEvent.type,
        payload: proctoringEvent.payload || {},
      });
    }
    await attempt.save();

    res.json({
      success: true,
      status: attempt.status,
      violationCount: attempt.violationCount,
      disqualified: attempt.status === 'disqualified',
    });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: error.message || 'Failed to save progress' });
  }
};

// Run code (for candidate to test code during test). No auth; optional attemptId+token to rate-limit per attempt.
exports.runCode = async (req, res) => {
  try {
    const { language = 'javascript', code, stdin = '' } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }
    const result = await runCode(language, code, stdin);
    res.json({
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error || undefined,
    });
  } catch (error) {
    console.error('Run code error:', error);
    res.status(500).json({ error: error.message || 'Failed to run code' });
  }
};

// Submit test (then trigger background LLM evaluation), or end as disqualified (proctoring — no score)
exports.submitTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { token, mcqAnswers, codingSubmissions, proctoringDisqualification } = req.body;
    if (!attemptId || !token) {
      return res.status(400).json({ error: 'attemptId and token are required' });
    }
    const attempt = await TestAttempt.findOne({ _id: attemptId }).populate('testInvitation');
    if (!attempt || !attempt.testInvitation || attempt.testInvitation.token !== token) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (attempt.status !== 'in_progress') {
      return res.json({ success: true, status: attempt.status, message: 'Already submitted' });
    }

    if (Array.isArray(mcqAnswers)) attempt.mcqAnswers = mcqAnswers;
    if (Array.isArray(codingSubmissions)) attempt.codingSubmissions = codingSubmissions.slice(0, CODING_PROBLEM_COUNT);
    attempt.submittedAt = new Date();

    if (proctoringDisqualification === true) {
      attempt.status = 'disqualified';
      attempt.testScore = null;
      attempt.mcqScore = null;
      attempt.codingScore = null;
      attempt.evaluationSummary = null;
      attempt.evaluatedAt = null;
      attempt.mcqBreakdown = [];
      attempt.codingBreakdown = [];
      await attempt.save();
      await TestInvitation.updateOne({ _id: attempt.testInvitation._id }, { status: 'disqualified' });
      return res.json({
        success: true,
        status: 'disqualified',
        disqualified: true,
        submittedAt: attempt.submittedAt,
      });
    }

    attempt.status = 'submitted';
    await attempt.save();

    const evaluateTestAttempt = require('../controllers/llmController').evaluateTestAttempt;
    if (typeof evaluateTestAttempt === 'function') {
      setImmediate(() => {
        evaluateTestAttempt(attempt._id).catch((e) => console.error('Test evaluation error:', e));
      });
    }

    res.json({
      success: true,
      status: 'submitted',
      submittedAt: attempt.submittedAt,
    });
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit test' });
  }
};
