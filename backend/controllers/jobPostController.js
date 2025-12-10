const admin = require('../config/firebase');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const Application = require('../models/Application');
const { cleanJobDescription } = require('../utils/textCleaner');

// Helper function to update remarks based on deadline
const updateRemarksBasedOnDeadline = async (jobPost) => {
  const now = new Date();
  const deadline = new Date(jobPost.deadline);
  
  // If deadline has passed and remarks is still 'pending', update to 'completed'
  if (now >= deadline && jobPost.remarks === 'pending') {
    jobPost.remarks = 'completed';
    await jobPost.save();
  }
  
  return jobPost;
};

// Middleware to verify Firebase token and get user
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Get user from MongoDB
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

// Get all active job posts (only for the logged-in HR)
exports.getAllActiveJobPosts = [verifyToken, async (req, res) => {
  try {
    // Check if user is HR
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can view job posts' });
    }

    // Only show job posts created by this HR
    const jobPosts = await JobPost.find({ 
      activeStatus: true,
      createdBy: req.user._id 
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    // Update remarks based on deadline for each job post
    const updatedJobPosts = await Promise.all(
      jobPosts.map(jobPost => updateRemarksBasedOnDeadline(jobPost))
    );
    
    res.json(updatedJobPosts);
  } catch (error) {
    console.error('Get all job posts error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch job posts' });
  }
}];

// Get single job post by ID (only if created by the logged-in HR)
exports.getJobPostById = [verifyToken, async (req, res) => {
  try {
    // Check if user is HR
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can view job posts' });
    }

    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    })
      .populate('createdBy', 'name email');
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }
    
    // Update remarks based on deadline
    const updatedJobPost = await updateRemarksBasedOnDeadline(jobPost);
    
    res.json(updatedJobPost);
  } catch (error) {
    console.error('Get job post error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch job post' });
  }
}];

// Get single job post by ID for candidates (any active job)
exports.getJobPostByIdForCandidate = [verifyToken, async (req, res) => {
  try {
    // Check if user is candidate
    if (req.user.role !== 'candidate') {
      return res.status(403).json({ error: 'Only candidates can view this endpoint' });
    }

    const now = new Date();
    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      activeStatus: true,
      deadline: { $gte: now },
      remarks: { $ne: 'deleted' }
    })
      .populate('createdBy', 'name email');
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found or no longer available' });
    }
    
    res.json(jobPost);
  } catch (error) {
    console.error('Get job post for candidate error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch job post' });
  }
}];

// Create new job post
exports.createJobPost = [verifyToken, async (req, res) => {
  try {
    const {
      jobTitle,
      company,
      location,
      jobType,
      salary,
      description, // Backward compatibility
      keyResponsibilities,
      generatedDescription,
      templateImage,
      experience,
      education,
      deadline,
      skills,
      languages,
      candidateLocation,
      weightage,
      officialEmail,
      websiteUrl,
      contactNo,
    } = req.body;

    // Support both description and keyResponsibilities for backward compatibility
    const responsibilities = keyResponsibilities || description;

    // Validate required fields
    if (!jobTitle || !company || !location || !jobType || !responsibilities || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate location object
    if (!location.country || !location.city) {
      return res.status(400).json({ error: 'Location must include country and city' });
    }

    // Validate salary range if provided
    if (salary && salary.min !== null && salary.max !== null) {
      if (salary.min < 0 || salary.max < 0) {
        return res.status(400).json({ error: 'Salary values must be non-negative' });
      }
      if (salary.min > salary.max) {
        return res.status(400).json({ error: 'Minimum salary cannot be greater than maximum salary' });
      }
    }

    // Validate weightage sum (should be <= 100)
    if (weightage) {
      let total = 0;
      for (const key in weightage) {
        const value = weightage[key];
        if (typeof value === 'number' && !isNaN(value)) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ error: `Weightage for ${key} must be between 0 and 100` });
          }
          total += value;
        }
      }
      if (total > 100) {
        return res.status(400).json({ error: 'Weightage distribution must sum to less than or equal to 100' });
      }
    }

    // Check if user is HR
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can create job posts' });
    }

    const jobPost = new JobPost({
      jobTitle,
      company,
      officialEmail: officialEmail || '',
      websiteUrl: websiteUrl || '',
      contactNo: contactNo || '',
      location: {
        country: location.country,
        city: location.city,
        province: location.province || '',
        address: location.address || '',
      },
      jobType,
      salary: {
        min: salary?.min !== undefined && salary.min !== '' ? parseFloat(salary.min) : null,
        max: salary?.max !== undefined && salary.max !== '' ? parseFloat(salary.max) : null,
      },
      keyResponsibilities: responsibilities,
      generatedDescription: generatedDescription ? cleanJobDescription(generatedDescription) : '',
      templateImage: templateImage || '/job-posting-template.png',
      experience: experience || null,
      education: Array.isArray(education) 
        ? education 
        : (education ? (typeof education === 'string' ? education.split(',').map(e => e.trim()).filter(e => e) : [education]) : []),
      deadline: new Date(deadline),
      skills: skills || [],
      languages: languages || [],
      candidateLocation: Array.isArray(candidateLocation) 
        ? candidateLocation 
        : (candidateLocation ? [candidateLocation] : []),
      weightage: weightage || {
        skills: 0,
        education: 0,
        experience: 0,
        projects: 0,
        language: 0,
      },
      activeStatus: true,
      remarks: 'pending',
      createdBy: req.user._id,
    });

    await jobPost.save();
    
    // Update remarks based on deadline (in case deadline is already passed)
    const updatedJobPost = await updateRemarksBasedOnDeadline(jobPost);
    await updatedJobPost.populate('createdBy', 'name email');

    res.status(201).json(updatedJobPost);
  } catch (error) {
    console.error('Create job post error:', error);
    if (error.message.includes('Weightage')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to create job post' });
  }
}];

// Update job post
exports.updateJobPost = [verifyToken, async (req, res) => {
  try {
    const {
      jobTitle,
      company,
      location,
      jobType,
      salary,
      description, // Backward compatibility
      keyResponsibilities,
      generatedDescription,
      templateImage,
      experience,
      education,
      deadline,
      skills,
      languages,
      candidateLocation,
      weightage,
      officialEmail,
      websiteUrl,
      contactNo,
    } = req.body;

    // Check if user is HR
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can update job posts' });
    }

    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    });
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    // Validate salary range if provided
    if (salary) {
      if (salary.min !== undefined && salary.min !== null && salary.min !== '' && salary.min < 0) {
        return res.status(400).json({ error: 'Minimum salary must be non-negative' });
      }
      if (salary.max !== undefined && salary.max !== null && salary.max !== '' && salary.max < 0) {
        return res.status(400).json({ error: 'Maximum salary must be non-negative' });
      }
      if (salary.min !== undefined && salary.max !== undefined && 
          salary.min !== null && salary.max !== null && 
          salary.min !== '' && salary.max !== '' &&
          parseFloat(salary.min) > parseFloat(salary.max)) {
        return res.status(400).json({ error: 'Minimum salary cannot be greater than maximum salary' });
      }
    }

    // Validate weightage sum if provided (should be <= 100)
    if (weightage) {
      let total = 0;
      for (const key in weightage) {
        const value = weightage[key];
        if (typeof value === 'number' && !isNaN(value)) {
          if (value < 0 || value > 100) {
            return res.status(400).json({ error: `Weightage for ${key} must be between 0 and 100` });
          }
          total += value;
        }
      }
      if (total > 100) {
        return res.status(400).json({ error: 'Weightage distribution must sum to less than or equal to 100' });
      }
    }

    // Update fields
    if (jobTitle) jobPost.jobTitle = jobTitle;
    if (company) jobPost.company = company;
    if (officialEmail !== undefined) jobPost.officialEmail = officialEmail || '';
    if (websiteUrl !== undefined) jobPost.websiteUrl = websiteUrl || '';
    if (contactNo !== undefined) jobPost.contactNo = contactNo || '';
    if (location) {
      if (location.country) jobPost.location.country = location.country;
      if (location.city) jobPost.location.city = location.city;
      if (location.province !== undefined) jobPost.location.province = location.province;
      if (location.address !== undefined) jobPost.location.address = location.address;
    }
    if (jobType) jobPost.jobType = jobType;
    if (salary) {
      if (salary.min !== undefined) jobPost.salary.min = salary.min !== '' ? parseFloat(salary.min) : null;
      if (salary.max !== undefined) jobPost.salary.max = salary.max !== '' ? parseFloat(salary.max) : null;
    }
    // Support both description and keyResponsibilities for backward compatibility
    if (keyResponsibilities !== undefined) jobPost.keyResponsibilities = keyResponsibilities;
    else if (description !== undefined) jobPost.keyResponsibilities = description;
    if (generatedDescription !== undefined) jobPost.generatedDescription = cleanJobDescription(generatedDescription);
    if (templateImage !== undefined) jobPost.templateImage = templateImage;
    if (experience !== undefined) jobPost.experience = experience;
    if (education !== undefined) {
      jobPost.education = Array.isArray(education) 
        ? education 
        : (education ? (typeof education === 'string' ? education.split(',').map(e => e.trim()).filter(e => e) : [education]) : []);
    }
    if (deadline) jobPost.deadline = new Date(deadline);
    if (skills !== undefined) jobPost.skills = skills;
    if (languages !== undefined) jobPost.languages = languages;
    if (candidateLocation !== undefined) {
      jobPost.candidateLocation = Array.isArray(candidateLocation) 
        ? candidateLocation 
        : (candidateLocation ? [candidateLocation] : []);
    }
    if (weightage) {
      // Merge weightage fields dynamically
      jobPost.weightage = { ...jobPost.weightage, ...weightage };
    }

    await jobPost.save();
    
    // Update remarks based on deadline
    const updatedJobPost = await updateRemarksBasedOnDeadline(jobPost);
    await updatedJobPost.populate('createdBy', 'name email');

    res.json(updatedJobPost);
  } catch (error) {
    console.error('Update job post error:', error);
    if (error.message.includes('Weightage')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to update job post' });
  }
}];

// Delete job post (soft delete - set activeStatus to false and remarks to deleted)
exports.deleteJobPost = [verifyToken, async (req, res) => {
  try {
    // Check if user is HR
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can delete job posts' });
    }

    const jobPost = await JobPost.findOne({ 
      _id: req.params.id,
      createdBy: req.user._id 
    });
    
    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    // Soft delete: set activeStatus to false and remarks to deleted
    jobPost.activeStatus = false;
    jobPost.remarks = 'deleted';
    
    await jobPost.save();

    res.json({ message: 'Job post deleted successfully', jobPost });
  } catch (error) {
    console.error('Delete job post error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete job post' });
  }
}];

// Get HR dashboard statistics
exports.getDashboardStatistics = [verifyToken, async (req, res) => {
  try {
    // Check if user is HR
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can view dashboard statistics' });
    }

    const now = new Date();
    
    // Get all job posts created by this HR (excluding deleted)
    const allJobs = await JobPost.find({ 
      createdBy: req.user._id,
      remarks: { $ne: 'deleted' }
    });

    // Active jobs (activeStatus = true and deadline >= now)
    const activeJobsCount = await JobPost.countDocuments({
      createdBy: req.user._id,
      activeStatus: true,
      deadline: { $gte: now },
      remarks: { $ne: 'deleted' }
    });

    // Completed jobs (remarks = 'completed' or deadline < now)
    const completedJobsCount = await JobPost.countDocuments({
      createdBy: req.user._id,
      $or: [
        { remarks: 'completed' },
        { deadline: { $lt: now } }
      ],
      remarks: { $ne: 'deleted' }
    });

    // Get all job IDs created by this HR
    const jobIds = allJobs.map(job => job._id);

    // Total candidates applied (unique candidates across all jobs)
    const totalApplications = await Application.countDocuments({
      jobPost: { $in: jobIds }
    });

    // Total unique candidates
    const uniqueCandidates = await Application.distinct('candidate', {
      jobPost: { $in: jobIds }
    });
    const totalCandidatesCount = uniqueCandidates.length;

    // Hired candidates (applications with status = 'accepted')
    const hiredCandidatesCount = await Application.countDocuments({
      jobPost: { $in: jobIds },
      status: 'accepted'
    });

    // Get monthly data for charts (applications over time)
    const last12Months = [];
    const applicationsByMonth = [];
    const candidatesByMonth = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
      last12Months.push(monthName);
      
      const appsInMonth = await Application.countDocuments({
        jobPost: { $in: jobIds },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      applicationsByMonth.push(appsInMonth);
      
      const uniqueInMonth = await Application.distinct('candidate', {
        jobPost: { $in: jobIds },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      candidatesByMonth.push(uniqueInMonth.length);
    }

    res.json({
      activeJobs: activeJobsCount,
      completedJobs: completedJobsCount,
      hiredCandidates: hiredCandidatesCount,
      totalCandidates: totalCandidatesCount,
      totalApplications: totalApplications,
      monthlyData: {
        months: last12Months,
        applications: applicationsByMonth,
        candidates: candidatesByMonth
      }
    });
  } catch (error) {
    console.error('Get dashboard statistics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch dashboard statistics' });
  }
}];

