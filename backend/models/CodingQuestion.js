const mongoose = require('mongoose');

const codingQuestionItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  statement: { type: String, required: true },
  inputFormat: { type: String, default: '' },
  outputFormat: { type: String, default: '' },
  sampleInput: { type: String, default: '' },
  sampleOutput: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  constraints: { type: String, default: '' },
}, { _id: true });

const codingQuestionSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true,
    unique: true,
  },
  questions: [codingQuestionItemSchema], // 7 questions
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
