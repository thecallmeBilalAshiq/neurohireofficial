const dotenv = require('dotenv');
dotenv.config();

const admin = require('../config/firebase');
const User = require('../models/User');
const axios = require('axios');

// Nanobanana AI API token
const NANOBANANA_API_TOKEN = process.env.NANOBANANA_API_TOKEN;

// Temporary storage for completed images (in production, use MongoDB)
const imageResults = new Map();

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

// Generate AI image for job post
exports.generateJobPostImage = [
  verifyToken,
  async (req, res) => {
    try {
      // Check if user is HR
      if (req.user.role !== 'HR') {
        return res.status(403).json({ error: 'Only HR users can generate AI images' });
      }

      if (!NANOBANANA_API_TOKEN) {
        return res.status(503).json({ 
          error: 'AI Image generation service not available. Please ensure NANOBANANA_API_TOKEN is set.' 
        });
      }

      const { jobData, description, customPrompt } = req.body;

      if (!jobData) {
        return res.status(400).json({ error: 'Job data is required' });
      }

      // Build prompt from job data using the specified format
      let jobTitle = jobData.jobTitle || 'Job Position Here';
      let company = jobData.company || '';
      let location = '';
      if (jobData.location) {
        const parts = [];
        if (jobData.location.city) parts.push(jobData.location.city);
        if (jobData.location.province) parts.push(jobData.location.province);
        if (jobData.location.country) parts.push(jobData.location.country);
        location = parts.join(', ');
      }
      
      // Extract qualifications from multiple sources
      let qualificationsList = [];
      
      // From skills array
      if (jobData.skills && Array.isArray(jobData.skills) && jobData.skills.length > 0) {
        qualificationsList.push(...jobData.skills.slice(0, 3));
      }
      
      // From education
      if (jobData.education && jobData.education.trim()) {
        qualificationsList.push(jobData.education);
      } else if (jobData.educationLevel && jobData.educationLevel.trim()) {
        qualificationsList.push(jobData.educationLevel);
      }
      
      // From experience
      if (jobData.experience) {
        const expText = typeof jobData.experience === 'number' 
          ? `${jobData.experience} years experience`
          : `${jobData.experience} experience`;
        qualificationsList.push(expText);
      }
      
      // From description if no qualifications found yet
      if (qualificationsList.length === 0 && (description || jobData.generatedDescription)) {
        const desc = description || jobData.generatedDescription;
        // Extract bullet points or key requirements
        const lines = desc.split('\n').filter(line => 
          line.trim().startsWith('-') || 
          line.trim().startsWith('•') || 
          line.trim().startsWith('*') ||
          line.trim().match(/^\d+\./)
        );
        if (lines.length > 0) {
          qualificationsList = lines.slice(0, 5).map(line => line.replace(/^[-•*]\s*|\d+\.\s*/g, '').trim());
        }
      }
      
      // Format qualifications as bullet points
      let qualifications = qualificationsList.length > 0 
        ? qualificationsList.slice(0, 5).join(', ')
        : 'Relevant experience, Strong communication skills, Team player';
      
      // Extract contact information - prioritize job post fields, then fallback to defaults
      let recruitmentEmail = jobData.officialEmail || 
                           jobData.recruitmentEmail || 
                           jobData.email || 
                           req.user?.email || 
                           'Recruitmentmail@here.com';
      let customerSupport = jobData.contactNo || 
                           jobData.customerSupport || 
                           jobData.supportContact || 
                           'Customer Support';
      let officeAddress = jobData.officeAddress || 
                         (jobData.location?.address ? jobData.location.address : '') ||
                         location || 
                         'Office address';
      let websiteDomain = jobData.websiteUrl || 
                         jobData.websiteDomain || 
                         jobData.website || 
                         jobData.domain || 
                         'website domain';

      // Build the professional prompt with dynamic variables
      let prompt = `Professional job vacancy banner, 1:1 square format. Use a modern, clean,
      corporate, flat-design style with minimalist geometric elements. 
      The color theme must be dynamically chosen by the model for high contrast and variety in each generation,
      avoiding sticking to one dominant color scheme (e.g., contrasting background and accent colors, chosen randomly).
      Feature a large, curved abstract shape for visual interest. Text layout: 'WE'RE HIRING' (in a high-contrast neutral 
      color like white or black), 'JOIN OUR TEAM' (in a bold accent color), '${jobTitle}' (in a secondary neutral color).
      Include left-aligned bullet points for 'Qualifications:: ${qualifications}'.
      A prominent 'Apply Now' button (in a bold accent color). Footer elements: 'Send Your CV to:' and '${recruitmentEmail}' 
      (in an accent color), and small icons/text for '${customerSupport}', '${officeAddress}', and '${websiteDomain}'.`;

      // Add custom prompt modifications if provided (for regeneration)
      if (customPrompt && customPrompt.trim()) {
        prompt = `${prompt} Additional modifications requested: ${customPrompt}`;
      }

      //console.log('Generating AI image with prompt:', prompt.substring(0, 200) + '...');

      // IMPORTANT: Set callback URL for webhook
      // Use ngrok URL for webhook callback (Nanobanana needs public URL)
      const backendUrl = process.env.BACKEND_URL || 'https://nonprotective-kay-longanamous.ngrok-free.dev';
      const callbackUrl = `${backendUrl}/api/ai-image/webhook/nanobanana`;

      console.log('Sending request to Nanobanana with callback URL:', callbackUrl);

      // Call Nanobanana AI API with callback URL
      const nanobananaResponse = await axios.post(
        'https://api.nanobananaapi.ai/api/v1/nanobanana/generate',
        {
          prompt: prompt,
          numImages: 1,
          type: 'TEXTTOIAMGE',
          image_size: '1:1', // Square format for job banners
          callbackUrl: callbackUrl // REQUIRED - webhook URL
        },
        {
          headers: {
            'Authorization': `Bearer ${NANOBANANA_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Nanobanana API response:', JSON.stringify(nanobananaResponse.data).substring(0, 200));

      // Check if we got a taskId
      if (!nanobananaResponse.data || !nanobananaResponse.data.data || !nanobananaResponse.data.data.taskId) {
        return res.status(500).json({ 
          error: 'Nanobanana API did not return a taskId',
          response: nanobananaResponse.data 
        });
      }

      const taskId = nanobananaResponse.data.data.taskId;
      
      // Store placeholder in memory (will be updated by webhook)
      imageResults.set(taskId, { 
        status: 'pending',
        userId: req.user._id.toString(),
        createdAt: new Date()
      });

      console.log('Task created with taskId:', taskId);

      // Return taskId to frontend - frontend will poll for result
      return res.json({
        success: true,
        message: 'Image generation started. Please check back for the result.',
        data: {
          taskId: taskId,
          status: 'pending'
        }
      });

    } catch (error) {
      console.error('Generate AI image error:', error);
      res.status(500).json({ 
        error: error.response?.data?.message || error.message || 'Failed to generate AI image',
        details: error.response?.data 
      });
    }
  }
];

// Nanobanana Webhook Receiver
exports.nanobananaWebhook = async (req, res) => {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers).substring(0, 300));
    console.log('Body:', JSON.stringify(req.body).substring(0, 1000));
    console.log('========================');

    // Nanobanana sends the result in the webhook
    const webhookData = req.body;
    
    // Extract taskId and image data from various possible response formats
    const taskId = webhookData.taskId || webhookData.data?.taskId || webhookData.task_id;
    
    // Nanobanana sends image URL in data.info.resultImageUrl (check this first!)
    console.log('Extracting image URL from webhook...');
    console.log('webhookData.data?.info?.resultImageUrl:', webhookData.data?.info?.resultImageUrl);
    console.log('webhookData.data?.imageUrl:', webhookData.data?.imageUrl);
    console.log('webhookData.imageUrl:', webhookData.imageUrl);
    
    const imageUrl = webhookData.data?.info?.resultImageUrl ||  // Nanobanana format - check first!
                     webhookData.info?.resultImageUrl ||
                     webhookData.data?.imageUrl || 
                     webhookData.data?.url ||
                     webhookData.imageUrl || 
                     webhookData.url || 
                     webhookData.image;
    
    console.log('Extracted imageUrl:', imageUrl);
    
    const base64 = webhookData.base64 || 
                   webhookData.imageBase64 || 
                   webhookData.data?.base64 || 
                   webhookData.data?.imageBase64;

    if (!taskId) {
      console.error('Webhook missing taskId:', webhookData);
      return res.status(400).json({ error: 'taskId missing in webhook' });
    }

    // Prepare image data
    let imageData = null;
    if (imageUrl) {
      imageData = imageUrl;
      console.log('✅ Image URL found:', imageUrl);
    } else if (base64) {
      // Ensure base64 has proper data URI prefix
      if (typeof base64 === 'string') {
        imageData = base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
        console.log('✅ Base64 image found');
      }
    }

    if (!imageData) {
      console.error('❌ Webhook missing image data. Full webhook data:', JSON.stringify(webhookData, null, 2));
      return res.status(400).json({ error: 'No image data in webhook' });
    }

    // Update the stored result
    const existingResult = imageResults.get(taskId) || {};
    
    // If imageData is a URL, we'll need to fetch it and convert to base64 for frontend
    // Or we can return the URL directly and let frontend handle it
    imageResults.set(taskId, {
      status: 'completed',
      imageUrl: imageUrl || (imageData.startsWith('http') ? imageData : null),
      imageBase64: typeof imageData === 'string' && imageData.startsWith('data:image') ? imageData : null,
      imageData: imageData, // Store both URL and base64 for flexibility
      completedAt: new Date(),
      userId: existingResult.userId
    });

    console.log('✅ Webhook processed successfully for taskId:', taskId);
    console.log('✅ Stored image data - URL:', imageUrl || 'none', 'Base64:', typeof imageData === 'string' && imageData.startsWith('data:image') ? 'yes' : 'no');

    // Return success to Nanobanana
    res.json({ success: true, message: 'Webhook received' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
};

// Check Image Result (for frontend polling)
exports.checkImageResult = [
  verifyToken,
  async (req, res) => {
    try {
      const { taskId } = req.params;

      if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
      }

      // Check if result exists
      if (!imageResults.has(taskId)) {
        console.log(`Task ${taskId} not found in results. Available tasks:`, Array.from(imageResults.keys()));
        return res.status(404).json({ 
          success: false,
          status: 'not_found',
          message: 'Task not found. It may not have been created yet.' 
        });
      }

      const result = imageResults.get(taskId);
      
      console.log(`Checking result for taskId ${taskId}:`, {
        status: result.status,
        hasImageUrl: !!result.imageUrl,
        hasImageBase64: !!result.imageBase64,
        hasImageData: !!result.imageData
      });

      // Verify user owns this task (optional security check)
      if (result.userId && result.userId !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You do not have access to this task' });
      }

      // Return the current status
      // If we have a URL but no base64, return the URL - frontend can use it directly
      let imageData = null;
      if (result.imageBase64) {
        imageData = result.imageBase64;
      } else if (result.imageUrl) {
        imageData = result.imageUrl;
      } else if (result.imageData) {
        imageData = result.imageData;
      }
      
      return res.json({
        success: true,
        data: {
          taskId: taskId,
          status: result.status,
          imageUrl: result.imageUrl || null,
          imageBase64: result.imageBase64 || null,
          imageData: imageData, // Include imageData for URL or base64
          createdAt: result.createdAt,
          completedAt: result.completedAt
        }
      });

    } catch (error) {
      console.error('Check image result error:', error);
      res.status(500).json({ error: error.message || 'Failed to check image result' });
    }
  }
];
