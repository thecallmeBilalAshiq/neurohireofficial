const mongoose = require('mongoose');

const jobPostSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true },
  company: { type: String, required: true },
  // Company contact information (optional)
  officialEmail: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },
  contactNo: { type: String, default: '' },
  // Company Location details
  location: {
    country: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, default: '' },
    address: { type: String, default: '' }, // Optional street address
  },
  jobType: { 
    type: String, 
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'],
    required: true 
  },
  // Salary range
  salary: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  keyResponsibilities: { type: String, required: true }, // Changed from description
  // Backward compatibility - description maps to keyResponsibilities
  description: { type: String, required: false },
  // Generated description from LLM
  generatedDescription: { type: String, default: '' },
  // Template image path (stored in public folder)
  templateImage: { type: String, default: '/job-posting-template.png' },
  // Experience - can be number (1-10) or string ("10+")
  experience: { type: mongoose.Schema.Types.Mixed, default: null },
  education: [{ type: String }], // Education as array of strings
  deadline: { type: Date, required: true },
  // Skills array
  skills: [{ type: String }],
  // Languages array
  languages: [{ type: String }],
  // Candidate location preference - array of location preferences
  candidateLocation: [{ type: String }],
  // Weightage distribution - supports dynamic fields
  weightage: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      skills: 0,
      education: 0,
      experience: 0,
      projects: 0,
      language: 0
    }
  },
  activeStatus: { type: Boolean, default: true },
  remarks: { 
    type: String, 
    enum: ['pending', 'completed', 'deleted'],
    default: 'pending' 
  },
  evaluatedAt: { type: Date, default: null },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
}, {
  timestamps: true,
});

// Handle backward compatibility for description field
jobPostSchema.pre('save', function(next) {
  // If description is provided but keyResponsibilities is not, copy it
  if (this.description && !this.keyResponsibilities) {
    this.keyResponsibilities = this.description;
  }
  // Always keep description in sync with keyResponsibilities
  if (this.keyResponsibilities) {
    this.description = this.keyResponsibilities;
  }
  next();
});

// Validate that weightage sum is exactly 100
jobPostSchema.pre('validate', function(next) {
  if (!this.weightage || typeof this.weightage !== 'object') {
    return next(new Error('Priority Weight Distribution is required'));
  }
  
  let total = 0;
  for (const key in this.weightage) {
    const value = this.weightage[key];
    if (typeof value === 'number' && !isNaN(value)) {
      total += value;
    }
  }
  
  if (total !== 100) {
    return next(new Error('Priority Weight Distribution must sum to exactly 100'));
  }
  next();
});

module.exports = mongoose.model('JobPost', jobPostSchema);

