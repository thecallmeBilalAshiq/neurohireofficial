const axios = require('axios');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const admin = require('../config/firebase');
const config = require('../config/appConfig');

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

// Send job post to social media via n8n webhook
exports.postToSocialMedia = [verifyToken, async (req, res) => {
  try {
    // Check if user is HR
    if (req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Only HR users can post to social media' });
    }

    const { jobPostId } = req.body;

    if (!jobPostId) {
      return res.status(400).json({ error: 'Job post ID is required' });
    }

    // Get the job post
    const jobPost = await JobPost.findOne({ 
      _id: jobPostId,
      createdBy: req.user._id 
    }).populate('createdBy', 'name email');

    if (!jobPost) {
      return res.status(404).json({ error: 'Job post not found' });
    }

    // Get n8n webhook URL from environment variables
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!n8nWebhookUrl) {
      return res.status(500).json({ 
        error: 'N8N webhook URL not configured. Please set N8N_WEBHOOK_URL in environment variables.',
        hint: 'The N8N_WEBHOOK_URL should point to your n8n webhook endpoint, not your backend. Example: http://localhost:5678/webhook/job-post or https://your-n8n-ngrok-url.ngrok-free.app/webhook/job-post'
      });
    }
    
    // Validate that the URL doesn't point to the backend itself
    if (n8nWebhookUrl.includes('jose-revisitable-tracee.ngrok-free.dev') && !n8nWebhookUrl.includes('5678')) {
      console.error('⚠️  WARNING: N8N_WEBHOOK_URL appears to point to the backend server instead of n8n!');
      console.error('   Backend ngrok URL: https://jose-revisitable-tracee.ngrok-free.dev');
      console.error('   n8n typically runs on port 5678. Make sure you have a separate ngrok tunnel for n8n.');
    }

    // Format experience string
    let experienceStr = 'Relevant experience';
    if (jobPost.experience) {
      if (jobPost.experience === '10+' || (typeof jobPost.experience === 'number' && jobPost.experience > 10)) {
        experienceStr = '10+ years';
      } else if (typeof jobPost.experience === 'number') {
        experienceStr = `${jobPost.experience} ${jobPost.experience === 1 ? 'year' : 'years'}`;
      } else {
        experienceStr = String(jobPost.experience);
      }
    }

    // Format location string
    let locationStr = `${jobPost.location.city}, ${jobPost.location.province ? jobPost.location.province + ', ' : ''}${jobPost.location.country}`;
    if (jobPost.location.address) {
      locationStr += ` - ${jobPost.location.address}`;
    }

    // Format skills string
    const skillsStr = (jobPost.skills && Array.isArray(jobPost.skills) && jobPost.skills.length > 0)
      ? jobPost.skills.join(', ')
      : 'Various technical skills';

    // Get description (prefer generatedDescription, then keyResponsibilities, then description for backward compatibility)
    let description = (jobPost.generatedDescription && jobPost.generatedDescription.trim()) 
      ? jobPost.generatedDescription 
      : (jobPost.keyResponsibilities && jobPost.keyResponsibilities.trim())
      ? jobPost.keyResponsibilities
      : (jobPost.description || 'Job description not available');
    
    // Format description to add proper line breaks between paragraphs for social media
    // This ensures proper spacing when posted to Facebook/n8n
    const formatDescriptionForSocialMedia = (text) => {
      if (!text) return text;
      
      // First, normalize different line break formats (Windows \r\n, Mac \r, Unix \n)
      let formatted = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Split by section headers and ensure proper spacing
      // Look for common section headers and ensure they have spacing
      const sectionHeaders = [
        'About the Role:',
        'About NeuroHire:',
        'Key Responsibilities:',
        'Responsibilities:',
        'Requirements:',
        'Benefits:',
        'Language Requirements:',
        'Why NeuroHire?',
        'Application Process:',
        'Job Title:',
        'Company:',
        'Location:',
        'Job Type:',
        'Salary Range:',
        'Experience Required:',
        'Education:',
        'Required Skills:',
        'Preferred Languages:',
        'Candidate Location Requirement:'
      ];
      
      // Ensure section headers have proper spacing before them
      sectionHeaders.forEach(header => {
        const regex = new RegExp(`(${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        formatted = formatted.replace(regex, `\n\n$1`);
      });
      
      // Split by double newlines (paragraph breaks) and single newlines
      // Then join with double newlines to ensure proper spacing
      const paragraphs = formatted
        .split(/\n\s*\n/) // Split by double newlines (paragraph breaks)
        .map(para => para.trim()) // Trim each paragraph
        .filter(para => para.length > 0) // Remove empty paragraphs
        .map(para => {
          // Within each paragraph, preserve single line breaks but normalize spacing
          // Also ensure bullet points are properly formatted
          return para.split('\n')
            .map(line => {
              // Trim but preserve structure
              const trimmed = line.trim();
              // If it's a bullet point or list item, ensure it's on its own line
              if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/)) {
                return trimmed;
              }
              return trimmed;
            })
            .filter(line => line.length > 0)
            .join('\n');
        });
      
      // Join paragraphs with double newlines for proper spacing on social media
      // This ensures Facebook will display them with line breaks
      return paragraphs.join('\n\n');
    };
    
    description = formatDescriptionForSocialMedia(description);

    // Format languages string
    const languagesStr = (jobPost.languages && Array.isArray(jobPost.languages) && jobPost.languages.length > 0)
      ? jobPost.languages.join(', ')
      : null;

    // Format candidate location requirement
    let candidateLocationStr = 'Open to candidates from anywhere';
    if (jobPost.candidateLocation && Array.isArray(jobPost.candidateLocation) && jobPost.candidateLocation.length > 0) {
      candidateLocationStr = jobPost.candidateLocation.join(', ');
    } else if (jobPost.candidateLocation && typeof jobPost.candidateLocation === 'string') {
      // Backward compatibility: handle old string format
      if (jobPost.candidateLocation === 'same-country') {
        candidateLocationStr = 'Candidates must be located in the same country';
      } else if (jobPost.candidateLocation === 'same-city') {
        candidateLocationStr = 'Candidates must be located in the same city';
      } else {
        candidateLocationStr = jobPost.candidateLocation;
      }
    }

    // Handle image URLs - can be:
    // 1. Full HTTP/HTTPS URL (from AI generation or ngrok)
    // 2. Base64 data URI (from uploaded files or AI generation)
    // 3. Local template path (construct full URL with ngrok/public URL)
    let imageUrl = jobPost.templateImage || '/job-posting-template.png';
    
    // Get frontend URL from centralized config
    const frontendUrl = config.frontend.url;
    
    // If it's already a full URL (http/https), check if it's localhost and replace with ngrok URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // If it's localhost, replace with ngrok URL (n8n can't access localhost)
      if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
        // Extract the path from the localhost URL
        const urlPath = new URL(imageUrl).pathname;
        // Replace with ngrok URL
        imageUrl = `${frontendUrl}${urlPath}`;
        console.log(`⚠️  Replaced localhost image URL with ngrok URL: ${imageUrl}`);
      }
      // Otherwise use as is (already a public URL)
    } else if (imageUrl.startsWith('data:image')) {
      // It's a base64 data URI - n8n can handle this directly
      imageUrl = imageUrl;
    } else if (imageUrl.startsWith('/Temaple-') || imageUrl.startsWith('/Template-') || imageUrl.startsWith('/job-posting-template')) {
      // It's a local template, construct full URL using ngrok/public URL
      imageUrl = `${frontendUrl}${imageUrl}`;
    } else {
      // Default template
      imageUrl = `${frontendUrl}${imageUrl}`;
    }
    
    // Warn if still using localhost (n8n won't be able to access it)
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      console.warn('⚠️  WARNING: Image URL still contains localhost. n8n will not be able to access it!');
      console.warn(`   Image URL: ${imageUrl}`);
      console.warn(`   FRONTEND_URL: ${config.frontend.url}`);
      console.warn('   Please set FRONTEND_URL in backend .env file to your ngrok URL');
    }

    // Prepare the data to send to n8n
    // Remove null/undefined values to avoid issues in n8n JavaScript processing
    const socialMediaData = {
      jobPost: {
        id: jobPost._id.toString(),
        jobTitle: jobPost.jobTitle || '',
        company: jobPost.company || '',
        location: locationStr,
        jobType: jobPost.jobType || 'Full-time',
        salary: jobPost.salary?.min && jobPost.salary?.max 
          ? `$${jobPost.salary.min.toLocaleString()} - $${jobPost.salary.max.toLocaleString()}`
          : jobPost.salary?.min 
          ? `Starting from $${jobPost.salary.min.toLocaleString()}`
          : 'Competitive salary',
        experience: experienceStr,
        education: Array.isArray(jobPost.education) 
          ? (jobPost.education.length > 0 ? jobPost.education.join(', ') : 'Not specified')
          : (jobPost.education || 'Not specified'),
        skills: skillsStr,
        description: description,
        deadline: jobPost.deadline ? jobPost.deadline.toISOString().split('T')[0] : '',
        applicationUrl: config.getFrontendRoute('jobs') + `/${jobPost._id}`,
      },
      image: {
        url: imageUrl, // Full URL or base64 data URI - n8n will handle it
        isBase64: imageUrl.startsWith('data:image'), // Flag to help n8n know if it's base64
      },
      platforms: ['facebook'], // Platform to post to
      timestamp: new Date().toISOString(),
    };

    // Only add optional fields if they have values (to avoid null/undefined in n8n)
    if (languagesStr) {
      socialMediaData.jobPost.languages = languagesStr;
    }
    if (candidateLocationStr && candidateLocationStr !== 'Open to candidates from anywhere') {
      socialMediaData.jobPost.candidateLocation = candidateLocationStr;
    }

    // Send data to n8n webhook
    try {
      // Log the webhook URL being used (for debugging)
      console.log('📤 Sending job post to n8n webhook:', n8nWebhookUrl);
      console.log('📸 Image URL being sent:', imageUrl);
      
      // Check if using test webhook URL and provide helpful warning
      if (n8nWebhookUrl.includes('/webhook-test/')) {
        console.warn('⚠️  WARNING: Using n8n test webhook URL. Make sure to execute the workflow in n8n first!');
        console.warn('   Test webhooks only work after clicking "Execute workflow" in n8n.');
        console.warn('   For production, use: http://localhost:5678/webhook/job-post (without -test)');
      }
      
      // Validate webhook URL format
      if (!n8nWebhookUrl.startsWith('http://') && !n8nWebhookUrl.startsWith('https://')) {
        return res.status(500).json({
          success: false,
          error: 'Invalid N8N_WEBHOOK_URL format. Must start with http:// or https://',
          providedUrl: n8nWebhookUrl
        });
      }

      const response = await axios.post(n8nWebhookUrl, socialMediaData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      });

      // Don't update remarks here - remarks should only be 'completed' when deadline is reached
      // Remarks will be updated automatically based on deadline check

      res.json({ 
        success: true, 
        message: 'Job post sent to social media platforms successfully',
        data: response.data 
      });
    } catch (webhookError) {
      console.error('❌ N8N webhook error:', webhookError.message);
      console.error('N8N webhook error response:', webhookError.response?.data);
      console.error('N8N webhook error status:', webhookError.response?.status);
      console.error('N8N webhook URL used:', n8nWebhookUrl);
      
      // Don't fail the request if n8n is down, just log it
      if (webhookError.response) {
        const errorMessage = webhookError.response.data?.message || 
                            webhookError.response.data?.error || 
                            JSON.stringify(webhookError.response.data) ||
                            'Unknown error from n8n workflow';
        
        // Provide helpful error messages for common issues
        let helpfulHint = '';
        if (webhookError.response.status === 404) {
          if (n8nWebhookUrl.includes('/webhook-test/')) {
            helpfulHint = 'The webhook is not registered. In test mode, you must click "Execute workflow" in n8n first. For production, use /webhook/ instead of /webhook-test/ and ensure the workflow is active.';
          } else {
            helpfulHint = `The webhook endpoint was not found (404). This usually means:
1. The n8n workflow is not active - make sure it's turned ON in n8n
2. The webhook path is incorrect - check that the path in N8N_WEBHOOK_URL matches the webhook node path in n8n
3. You're using the wrong ngrok URL - make sure N8N_WEBHOOK_URL points to n8n (port 5678), not your backend
4. If using ngrok for n8n, make sure you have a separate ngrok tunnel running for n8n

Current URL: ${n8nWebhookUrl}
Expected format: http://localhost:5678/webhook/job-post (local) or https://your-n8n-ngrok-url/webhook/job-post (ngrok)`;
          }
        }
        
        return res.status(webhookError.response.status).json({ 
          success: false,
          error: 'Failed to send to social media platforms',
          details: errorMessage,
          hint: helpfulHint || webhookError.response.data?.hint,
          n8nResponse: webhookError.response.data,
          statusCode: webhookError.response.status,
          webhookUrl: n8nWebhookUrl,
          troubleshooting: {
            checkWorkflowActive: 'Make sure the n8n workflow is turned ON (not just saved)',
            checkWebhookPath: 'Verify the webhook path matches: /webhook/job-post',
            checkNgrokUrl: 'If using ngrok, ensure N8N_WEBHOOK_URL points to n8n (port 5678), not backend (port 5000)',
            checkSeparateTunnel: 'n8n needs its own ngrok tunnel if running locally'
          }
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: 'Failed to connect to n8n webhook',
        details: webhookError.message,
        code: webhookError.code,
        webhookUrl: n8nWebhookUrl,
        hint: 'Check if n8n is running and the webhook URL is correct. If using ngrok, make sure the tunnel is active.'
      });
    }
  } catch (error) {
    console.error('Post to social media error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to post to social media',
      details: error.stack
    });
  }
}];

