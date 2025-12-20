const admin = require('../config/firebase');
const Application = require('../models/Application');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { scoreCandidate } = require('../services/scoringService');

// Middleware to verify Firebase token and get user
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all active jobs for candidates (no HR restriction)
exports.getActiveJobsForCandidates = [verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const jobPosts = await JobPost.find({ 
      activeStatus: true,
      deadline: { $gte: now }, // Only jobs with future deadlines
      remarks: { $ne: 'deleted' }
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    // Check which jobs the candidate has already applied to
    const applications = await Application.find({ 
      candidate: req.user._id,
      jobPost: { $in: jobPosts.map(job => job._id) }
    }).select('jobPost');
    
    const appliedJobIds = new Set(applications.map(app => app.jobPost.toString()));
    
    // Add application status to each job
    const jobsWithStatus = jobPosts.map(job => ({
      ...job.toObject(),
      hasApplied: appliedJobIds.has(job._id.toString())
    }));
    
    res.json(jobsWithStatus);
  } catch (error) {
    console.error('Get active jobs error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch jobs' });
  }
}];

// Configure multer for file uploads in application controller
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/cvs/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Submit application - verifyToken is handled in route
exports.submitApplication = async (req, res) => {
  try {
    // Check if user is candidate
    if (req.user.role !== 'candidate') {
      return res.status(403).json({ error: 'Only candidates can submit applications' });
    }

    const { jobId, formData } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Check if job exists and is active
    const jobPost = await JobPost.findOne({
      _id: jobId,
      activeStatus: true,
      deadline: { $gte: new Date() }
    });

    if (!jobPost) {
      return res.status(404).json({ error: 'Job not found or deadline has passed' });
    }

    // Ensure jobPost has all required fields with defaults
    if (!jobPost.skills) jobPost.skills = [];
    if (!jobPost.weightage || typeof jobPost.weightage !== 'object') {
      jobPost.weightage = {
        skills: 35,
        experience: 25,
        education: 20,
        projects: 12,
        certificates: 5,
        languages: 3
      };
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      jobPost: jobId,
      candidate: req.user._id
    });

    if (existingApplication) {
      // Clean up uploaded file if exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'You have already applied for this job' });
    }

    // Handle file upload (CV)
    if (!req.file) {
      return res.status(400).json({ error: 'CV file is required' });
    }

    const cvPath = req.file.path;

    // Parse formData if it's a string
    let parsedFormData = formData;
    if (typeof formData === 'string') {
      try {
        parsedFormData = JSON.parse(formData);
      } catch (e) {
        // Clean up uploaded file
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
        return res.status(400).json({ error: 'Invalid form data format' });
      }
    }

    // Validate required fields
    if (!parsedFormData.firstName || !parsedFormData.lastName || !parsedFormData.email || !parsedFormData.phone) {
      // Clean up uploaded file
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, email, and phone are required' });
    }

    // Prepare extractedData (from CV parsing or form data)
    let extractedData = null;
    
    // Try to get extractedData from request body
    if (req.body.extractedData) {
      try {
        extractedData = typeof req.body.extractedData === 'string' 
          ? JSON.parse(req.body.extractedData) 
          : req.body.extractedData;
      } catch (e) {
        console.error('Error parsing extractedData:', e);
        extractedData = null;
      }
    }
    
      // If no extractedData, build it from formData
      if (!extractedData) {
        // Convert skills string to array if needed
        let skillsData = parsedFormData.skills || '';
        if (typeof skillsData === 'string' && skillsData) {
          skillsData = skillsData.split(',').map(s => s.trim()).filter(s => s);
        }
        
        // Convert languages string to array if needed
        let languagesData = parsedFormData.languages || '';
        if (typeof languagesData === 'string' && languagesData) {
          languagesData = languagesData.split(',').map(l => l.trim()).filter(l => l);
        }
        
        // Keep education as object if manually entered, include CGPA
        let educationData = parsedFormData.education || '';
        if (typeof educationData === 'string' && educationData) {
          // If education is a string, try to create an object with CGPA
          educationData = {
            university: '',
            degree: educationData,
            dateOfCompletion: '',
            cgpa: parsedFormData.cgpa || ''
          };
        } else if (typeof educationData === 'object' && educationData !== null) {
          // If it's already an object, ensure CGPA is included
          if (!educationData.cgpa && parsedFormData.cgpa) {
            educationData.cgpa = parsedFormData.cgpa;
          }
        }
        
        extractedData = {
          firstName: parsedFormData.firstName || '',
          lastName: parsedFormData.lastName || '',
          email: parsedFormData.email || '',
          phone: parsedFormData.phone || '',
          address: parsedFormData.address || '',
          education: educationData,
          experience: parsedFormData.experience || '',
          projects: parsedFormData.projects || '',
          skills: skillsData, // Array format
          languages: languagesData, // Array format
          certificates: parsedFormData.certificates || ''
        };
      } else {
        // Ensure extractedData has proper structure
        // Convert skills to array if it's a string
        if (extractedData.skills && typeof extractedData.skills === 'string') {
          extractedData.skills = extractedData.skills.split(',').map(s => s.trim()).filter(s => s);
        } else if (!Array.isArray(extractedData.skills)) {
          extractedData.skills = [];
        }
        
        // Convert languages to array if it's a string
        if (extractedData.languages && typeof extractedData.languages === 'string') {
          extractedData.languages = extractedData.languages.split(',').map(l => l.trim()).filter(l => l);
        } else if (!Array.isArray(extractedData.languages)) {
          extractedData.languages = [];
        }
        
        // Ensure education object has all fields including CGPA
        if (extractedData.education && typeof extractedData.education === 'object' && extractedData.education !== null) {
          if (!extractedData.education.university) extractedData.education.university = '';
          if (!extractedData.education.degree) extractedData.education.degree = '';
          if (!extractedData.education.dateOfCompletion) extractedData.education.dateOfCompletion = '';
          if (!extractedData.education.cgpa) extractedData.education.cgpa = '';
        }
      }

    const application = new Application({
      jobPost: jobId,
      candidate: req.user._id,
      cvPath: cvPath,
      formData: {
        firstName: parsedFormData.firstName || '',
        lastName: parsedFormData.lastName || '',
        email: parsedFormData.email || '',
        phone: parsedFormData.phone || '',
        address: parsedFormData.address || '',
        education: parsedFormData.education || '',
        cgpa: parsedFormData.cgpa || '',
        experience: parsedFormData.experience || '',
        projects: parsedFormData.projects || '',
        skills: parsedFormData.skills || '',
        languages: parsedFormData.languages || '',
        certificates: parsedFormData.certificates || ''
      },
      extractedData: extractedData,
      status: 'pending'
    });

    await application.save();
    
    // Score the candidate after saving
    try {
      console.log('Starting scoring process for application:', application._id);
      console.log('Job post ID:', jobPost._id);
      console.log('Application extractedData:', application.extractedData);
      console.log('Application formData:', application.formData);
      
      const scores = await scoreCandidate(application, jobPost);
      console.log('Received scores from scoring service:', scores);
      
      application.scores = scores;
      application.rankedAt = new Date();
      await application.save();
      
      console.log('Application saved with scores:', application.scores);
    } catch (error) {
      console.error('Error scoring candidate:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      // Continue even if scoring fails
      // Set default scores to ensure application is saved
      application.scores = {
        experience: 0,
        projects: 0,
        skills: 0,
        certificates: 0,
        education: 0,
        languages: 0,
        total: 0
      };
      await application.save();
    }
    
    await application.populate('jobPost', 'jobTitle company');
    await application.populate('candidate', 'name email');

    res.status(201).json(application);
  } catch (error) {
    console.error('Submit application error:', error);
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (error.code === 11000) {
      return res.status(400).json({ error: 'You have already applied for this job' });
    }
    res.status(500).json({ error: error.message || 'Failed to submit application' });
  }
};

// Get applications by candidate
exports.getMyApplications = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'candidate') {
      return res.status(403).json({ error: 'Only candidates can view their applications' });
    }

    const applications = await Application.find({ candidate: req.user._id })
      .populate('jobPost', 'jobTitle company location jobType deadline')
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch applications' });
  }
}];

// Get ranked candidates for a job post (HR only)
exports.getRankedCandidates = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can view ranked candidates' });
    }

    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Verify job exists and belongs to this HR user
    const jobPost = await JobPost.findOne({
      _id: jobId,
      createdBy: req.user._id
    });

    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    // Get all applications for this job with scores
    const applications = await Application.find({ jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ 'scores.total': -1, createdAt: -1 });

    // Format response
    const rankedCandidates = applications.map(app => ({
      _id: app._id,
      candidateName: app.candidate.name || `${app.formData.firstName} ${app.formData.lastName}`,
      email: app.candidate.email || app.formData.email,
      phone: app.formData.phone,
      experienceScore: app.scores.experience || 0,
      projectsScore: app.scores.projects || 0,
      skillsScore: app.scores.skills || 0,
      certificatesScore: app.scores.certificates || 0,
      educationScore: app.scores.education || 0,
      languagesScore: app.scores.languages || 0,
      totalScore: app.scores.total || 0,
      status: app.status,
      appliedAt: app.createdAt,
      rankedAt: app.rankedAt
    }));

    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      candidates: rankedCandidates
    });
  } catch (error) {
    console.error('Get ranked candidates error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch ranked candidates' });
  }
}];

// Get all jobs for HR to select from
exports.getJobsForRanking = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can view jobs' });
    }

    const jobs = await JobPost.find({
      createdBy: req.user._id,
      remarks: { $ne: 'deleted' }
    })
      .select('jobTitle company _id deadline')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    console.error('Get jobs for ranking error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch jobs' });
  }
}];

