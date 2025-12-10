const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['candidate', 'HR'], default: 'candidate' },
  emailVerified: { type: Boolean, default: false },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);