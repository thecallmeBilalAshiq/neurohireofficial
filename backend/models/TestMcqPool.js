const mongoose = require('mongoose');

const mcqItemSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }], // length 4
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
}, { _id: true });

const testMcqPoolSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true,
    unique: true,
  },
  questions: [mcqItemSchema], // 100 MCQs
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TestMcqPool', testMcqPoolSchema);
