const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cvPath: {
    type: String,
    required: true
  },
  formData: {
    // Personal Information (Required)
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: '' },
    // Profile (Optional)
    education: { type: String, default: '' },
    cgpa: { type: String, default: '' },
    experience: { type: String, default: '' },
    projects: { type: String, default: '' },
    skills: { type: String, default: '' },
    languages: { type: String, default: '' },
    certificates: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'],
    default: 'pending'
  },
  extractedData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
    // Structure includes:
    // - education: { university, degree, dateOfCompletion, cgpa }
    // - skills: array
    // - experience, certificates: string
  },
  scores: {
    experience: { type: Number, default: 0 },
    projects: { type: Number, default: 0 },
    skills: { type: Number, default: 0 },
    certificates: { type: Number, default: 0 },
    education: { type: Number, default: 0 },
    languages: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  rankedAt: {
    type: Date,
    default: null
  },
  interviewInviteSentAt: { type: Date, default: null },
  selectedAsHire: { type: Boolean, default: false },
  trainingPlanPdfPath: { type: String, default: null },
  /** Condolence: not in CV top-50 when test invites sent */
  condolenceNotShortlistedForTestSentAt: { type: Date, default: null },
  /** Invited to on-site / video interview after online test */
  physicalInterviewInvitedAt: { type: Date, default: null },
  /** Condolence: had test but not selected for physical interview round */
  condolenceAfterPhysicalSentAt: { type: Date, default: null },
  /** Congratulations email when marked final hire */
  congratulationsHireSentAt: { type: Date, default: null },
  /** Condolence: attended physical round but not chosen as hire */
  condolenceNotFinalHireSentAt: { type: Date, default: null },
}, {
  timestamps: true,
});

// Prevent duplicate applications
applicationSchema.index({ jobPost: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);

