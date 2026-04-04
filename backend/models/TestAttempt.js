const mongoose = require('mongoose');

const testAttemptSchema = new mongoose.Schema({
  testInvitation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestInvitation',
    required: true,
    unique: true, // one attempt per invitation
  },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'disqualified', 'expired'],
    default: 'in_progress',
  },
  // For MCQs: order of question indices from pool (30 random indices)
  mcqOrder: [Number],
  mcqAnswers: [{
    questionIndex: Number, // index in mcqOrder
    selectedIndex: { type: Number, default: -1 }, // -1 = unanswered
  }],
  codingSubmissions: [{
    questionIndex: Number,
    code: { type: String, default: '' },
    language: { type: String, default: 'javascript' },
  }],
  proctoringEvents: [{
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    payload: mongoose.Schema.Types.Mixed,
  }],
  violationCount: { type: Number, default: 0 },
  // LLM evaluation (set after submit)
  testScore: { type: Number, default: null },       // 0-100 total
  mcqScore: { type: Number, default: null },         // 0-30
  codingScore: { type: Number, default: null },     // 0-70
  evaluationSummary: { type: String, default: null },
  evaluatedAt: { type: Date, default: null },
  /** Per MCQ (1 mark each, max 30); filled on evaluation or computable from answers */
  mcqBreakdown: [{
    orderIndex: Number,
    marksObtained: Number,
    marksMax: { type: Number, default: 1 },
    questionPreview: { type: String, default: '' },
  }],
  /** Per coding problem (variable caps per problem, max 70 total); filled when LLM returns scores */
  codingBreakdown: [{
    questionIndex: Number,
    title: { type: String, default: '' },
    marksObtained: Number,
    marksMax: { type: Number, default: 23 },
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
