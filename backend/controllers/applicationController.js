const admin = require('../config/firebase');
const Application = require('../models/Application');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const TestInvitation = require('../models/TestInvitation');
const TestAttempt = require('../models/TestAttempt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { scoreCandidate } = require('../services/scoringService');
const { generateTrainingPlanContent } = require('./llmController');
const { candidateOpenForApplicationsFilter } = require('../utils/jobCandidateVisibility');
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (_) {}

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
    // Deadline + closed-hiring rules: see candidateOpenForApplicationsFilter()
    const jobPosts = await JobPost.find({
      ...candidateOpenForApplicationsFilter(),
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

    // Check if job exists and still accepts new applications (not closed / hiring finished)
    const jobPost = await JobPost.findOne({
      _id: jobId,
      ...candidateOpenForApplicationsFilter(),
    });

    if (!jobPost) {
      return res.status(404).json({
        error: 'Job not found, deadline has passed, or this position is closed and no longer accepting applications.',
      });
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
    // Do not evaluate/score on submit; scoring runs in batch when application deadline is reached

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

// Evaluate (score) all applications for a job after deadline (HR only). Runs in batches.
const BATCH_SIZE = 5;
exports.evaluateJobApplications = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can evaluate applications' });
    }
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    const now = new Date();
    if (new Date(jobPost.deadline) > now) {
      return res.status(400).json({ error: 'Application deadline has not passed yet. Evaluate after the deadline.' });
    }

    const applications = await Application.find({ jobPost: jobId }).populate('candidate', 'name email');
    const toEvaluate = applications.filter((app) => !app.rankedAt);
    if (toEvaluate.length === 0) {
      return res.json({ success: true, message: 'No applications left to evaluate (all already ranked).', evaluated: 0 });
    }

    for (let i = 0; i < toEvaluate.length; i += BATCH_SIZE) {
      const batch = toEvaluate.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (app) => {
          try {
            const scores = await scoreCandidate(app, jobPost);
            app.scores = scores;
            app.rankedAt = new Date();
            await app.save();
          } catch (err) {
            console.error('Scoring failed for application', app._id, err);
            app.scores = { experience: 0, projects: 0, skills: 0, certificates: 0, education: 0, languages: 0, total: 0 };
            app.rankedAt = new Date();
            await app.save();
          }
        })
      );
    }

    jobPost.evaluatedAt = new Date();
    await jobPost.save();

    res.json({
      success: true,
      message: `Evaluated ${toEvaluate.length} application(s)`,
      evaluated: toEvaluate.length,
    });
  } catch (error) {
    console.error('Evaluate job error:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate applications' });
  }
}];

// Get all applications for a job (HR only). Use before or after deadline to show applicants; instant-ranked ones have rankedAt/scores.
exports.getApplicationsByJob = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR can view applications' });
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    const applications = await Application.find({ jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ rankedAt: -1, 'scores.total': -1, createdAt: -1 });

    const candidates = applications.map((app) => ({
      _id: app._id,
      candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'N/A',
      email: app.candidate?.email || app.formData?.email,
      phone: app.formData?.phone,
      totalScore: app.scores?.total ?? null,
      experienceScore: app.scores?.experience ?? null,
      projectsScore: app.scores?.projects ?? null,
      skillsScore: app.scores?.skills ?? null,
      certificatesScore: app.scores?.certificates ?? null,
      educationScore: app.scores?.education ?? null,
      languagesScore: app.scores?.languages ?? null,
      rankedAt: app.rankedAt || null,
    }));

    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      deadline: jobPost.deadline,
      evaluatedAt: jobPost.evaluatedAt,
      candidates,
    });
  } catch (error) {
    console.error('Get applications by job error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch applications' });
  }
}];

// Evaluate one application instantly (HR only). Rest will be ranked after deadline.
exports.evaluateOneApplication = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR can evaluate' });
    const { applicationId } = req.params;
    if (!applicationId) return res.status(400).json({ error: 'applicationId required' });

    const application = await Application.findById(applicationId).populate('candidate', 'name email');
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    try {
      const scores = await scoreCandidate(application, jobPost);
      application.scores = scores;
      application.rankedAt = new Date();
      await application.save();
    } catch (err) {
      console.error('Instant scoring failed', applicationId, err);
      application.scores = { experience: 0, projects: 0, skills: 0, certificates: 0, education: 0, languages: 0, total: 0 };
      application.rankedAt = new Date();
      await application.save();
    }

    res.json({
      success: true,
      message: 'Candidate evaluated (instant ranking).',
      candidate: {
        _id: application._id,
        totalScore: application.scores?.total ?? 0,
        experienceScore: application.scores?.experience ?? 0,
        projectsScore: application.scores?.projects ?? 0,
        skillsScore: application.scores?.skills ?? 0,
        certificatesScore: application.scores?.certificates ?? 0,
        educationScore: application.scores?.education ?? 0,
        languagesScore: application.scores?.languages ?? 0,
      },
    });
  } catch (error) {
    console.error('Evaluate one error:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate' });
  }
}];

// Get ranked candidates for a job post (HR only). Only returns candidates who were sent a test invite.
exports.getRankedCandidates = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can view ranked candidates' });
    }

    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const jobPost = await JobPost.findOne({
      _id: jobId,
      createdBy: req.user._id
    });

    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    // Only applications that have a test invitation (were sent test email)
    const invitations = await TestInvitation.find({ jobPost: jobId }).lean();
    const appIds = invitations.map((inv) => inv.application);
    if (appIds.length === 0) {
      return res.json({
        jobTitle: jobPost.jobTitle,
        company: jobPost.company,
        deadline: jobPost.deadline,
        evaluatedAt: jobPost.evaluatedAt,
        candidates: [],
        message: 'No candidates sent test yet. Evaluate applications (after deadline), then send test emails to see ranked candidates here.',
      });
    }

    const applications = await Application.find({ _id: { $in: appIds }, jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ 'scores.total': -1, createdAt: -1 });

    const invByApp = {};
    invitations.forEach((inv) => { invByApp[inv.application.toString()] = inv; });
    const invIds = invitations.map((i) => i._id);
    const attempts = await TestAttempt.find({
      testInvitation: { $in: invIds },
      status: 'submitted',
    }).select('testInvitation testScore mcqScore codingScore evaluationSummary').lean();
    const attemptByInv = {};
    attempts.forEach((a) => { attemptByInv[a.testInvitation.toString()] = a; });

    const rankedCandidates = applications.map((app) => {
      const inv = invByApp[app._id.toString()];
      const attempt = inv ? attemptByInv[inv._id.toString()] : null;
      const hasTestScore = attempt != null && typeof attempt.testScore === 'number';
      return {
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
        testScore: hasTestScore ? attempt.testScore : null,
        testStatus: hasTestScore ? attempt.testScore : 'pending',
        testMcqScore: attempt != null && typeof attempt.mcqScore === 'number' ? attempt.mcqScore : null,
        testCodingScore: attempt != null && typeof attempt.codingScore === 'number' ? attempt.codingScore : null,
        testEvaluationSummary: attempt?.evaluationSummary || null,
        interviewInviteSentAt: app.interviewInviteSentAt || null,
        selectedAsHire: app.selectedAsHire || false,
        trainingPlanPdfPath: app.trainingPlanPdfPath || null,
        status: app.status,
        appliedAt: app.createdAt,
        rankedAt: app.rankedAt,
      };
    });

    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      deadline: jobPost.deadline,
      evaluatedAt: jobPost.evaluatedAt,
      remarks: jobPost.remarks,
      candidates: rankedCandidates,
    });
  } catch (error) {
    console.error('Get ranked candidates error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch ranked candidates' });
  }
}];

// Get all applications for a job after evaluation (so HR can select and send test emails). All applications with scores.
exports.getEvaluatedCandidates = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR can view' });
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });
    if (!jobPost.evaluatedAt) return res.status(400).json({ error: 'Job not evaluated yet. Run evaluation after application deadline.' });

    const applications = await Application.find({ jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ 'scores.total': -1, createdAt: -1 });

    const candidates = applications.map((app) => ({
      _id: app._id,
      candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'N/A',
      email: app.candidate?.email || app.formData?.email,
      phone: app.formData?.phone,
      totalScore: app.scores?.total ?? 0,
      experienceScore: app.scores?.experience ?? 0,
      projectsScore: app.scores?.projects ?? 0,
      skillsScore: app.scores?.skills ?? 0,
      certificatesScore: app.scores?.certificates ?? 0,
      educationScore: app.scores?.education ?? 0,
      languagesScore: app.scores?.languages ?? 0,
    }));

    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      candidates,
    });
  } catch (error) {
    console.error('Get evaluated candidates error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch' });
  }
}];

// Get all jobs for HR to select from (include deadline and evaluatedAt for UI)
exports.getJobsForRanking = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR can view jobs' });
    }

    const jobs = await JobPost.find({
      createdBy: req.user._id,
      remarks: { $ne: 'deleted' }
    })
      .select(
        'jobTitle company _id deadline evaluatedAt remarks hirePipelineStage assessmentInviteSentAt assessmentDeadline awaitingFinalHireSelection finalHireCompletedAt noHireSelected testContentFinalizedAt'
      )
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    console.error('Get jobs for ranking error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch jobs' });
  }
}];

// Mark applications as interview invite sent (HR only)
exports.markInterviewInviteSent = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR' });
    const { jobId } = req.params;
    const { applicationIds } = req.body;
    if (!jobId || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ error: 'jobId and applicationIds array required' });
    }

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    await Application.updateMany(
      { _id: { $in: applicationIds }, jobPost: jobId },
      { $set: { interviewInviteSentAt: new Date() } }
    );
    res.json({ success: true, message: 'Interview invite sent marked', count: applicationIds.length });
  } catch (error) {
    console.error('Mark interview invite error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}];

// Mark applications as selected for hire (HR only)
exports.markSelectedAsHire = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR' });
    const { jobId } = req.params;
    const { applicationIds } = req.body;
    if (!jobId || !Array.isArray(applicationIds)) {
      return res.status(400).json({ error: 'jobId and applicationIds array required' });
    }

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    await Application.updateMany({ jobPost: jobId }, { $set: { selectedAsHire: false } });
    if (applicationIds.length > 0) {
      await Application.updateMany(
        { _id: { $in: applicationIds }, jobPost: jobId },
        { $set: { selectedAsHire: true } }
      );
    }
    res.json({ success: true, message: 'Selected hires updated', count: applicationIds.length });
  } catch (error) {
    console.error('Mark selected hire error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}];

// Finalize job (mark as completed) after hires are selected (HR only)
exports.finalizeJob = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR' });
    const { jobId } = req.params;

    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });

    jobPost.remarks = 'completed';
    await jobPost.save();
    res.json({ success: true, message: 'Job finalized and marked as completed' });
  } catch (error) {
    console.error('Finalize job error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}];

// Generate 3-month training plan PDF for a hire (HR only)
exports.generateTrainingPlan = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Only HR' });
    const { applicationId } = req.params;
    if (!applicationId) return res.status(400).json({ error: 'applicationId required' });

    const application = await Application.findById(applicationId).populate('candidate', 'name');
    if (!application) return res.status(404).json({ error: 'Application not found' });
    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });
    if (!application.selectedAsHire) return res.status(400).json({ error: 'Application is not marked as selected hire' });

    const content = await generateTrainingPlanContent(application, jobPost);
    if (!content) return res.status(503).json({ error: 'Could not generate training plan content' });

    if (!PDFDocument) return res.status(503).json({ error: 'PDF generation not available (install pdfkit)' });

    const dir = 'uploads/training-plans';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `training-plan-${applicationId}-${Date.now()}.pdf`;
    const filePath = path.join(dir, filename);

    const stream = fs.createWriteStream(filePath);
    const doc = new PDFDocument({ margin: 50, autoFirstPage: true });

    const streamDone = new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    doc.pipe(stream);

    function sanitize(str) {
      if (str == null || typeof str !== 'string') return '';
      return str
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\r/g, '')
        .trim();
    }

    try {
      doc.fontSize(16).text('3-Month Training Plan', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10);
      const lines = content.split(/\n/);
      for (const line of lines) {
        const safe = sanitize(line) || ' ';
        if (safe.length > 0) {
          const isHeading = /^#+\s*/.test(line) || /^[A-Z][a-z]+.*:?\s*$/.test(safe);
          doc.fontSize(isHeading ? 11 : 10);
          doc.text(safe, { lineBreak: true });
        }
        doc.moveDown(0.3);
      }
    } catch (pdfErr) {
      stream.destroy();
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
      throw pdfErr;
    }
    doc.end();
    await streamDone;

    application.trainingPlanPdfPath = filePath;
    await application.save();

    res.json({ success: true, pdfPath: filePath, downloadUrl: `/api/applications/training-plan/${applicationId}/download` });
  } catch (error) {
    console.error('Generate training plan error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate training plan' });
  }
}];

// Download training plan PDF (HR only)
exports.downloadTrainingPlan = [verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'HR') return res.status(403).json({ error: 'Forbidden' });
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId);
    if (!application || !application.trainingPlanPdfPath) return res.status(404).json({ error: 'Training plan not found' });
    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job not found' });

    const absPath = path.isAbsolute(application.trainingPlanPdfPath) ? application.trainingPlanPdfPath : path.join(process.cwd(), application.trainingPlanPdfPath);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'File not found' });
    const firstName = (application.formData?.firstName || 'candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const name = `training-plan-${firstName}-${applicationId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.sendFile(absPath, { maxAge: 0 }, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Failed to send file' });
    });
  } catch (error) {
    console.error('Download training plan error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}];

