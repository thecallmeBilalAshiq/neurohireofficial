const mongoose = require('mongoose');
const crypto = require('crypto');

const testInvitationSchema = new mongoose.Schema({
  jobPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPost',
    required: true,
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'attempted', 'expired', 'disqualified'],
    default: 'pending',
  },
  invitationSentAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// token already has unique: true; expiresAt already has index: true — no duplicate index()
testInvitationSchema.index({ candidate: 1, jobPost: 1 });

module.exports = mongoose.model('TestInvitation', testInvitationSchema);
