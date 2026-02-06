const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config();


let Bytez, sdk, model;

try {
  Bytez = require('bytez.js');
  const key = process.env.BYTEZ_API_KEY || "8357654868fcca0cb5158f6a591937c3";
  
  if (!key) {
    console.error('Warning: BYTEZ_API_KEY not set. LLM functionality will not work.');
  } else {
    sdk = new Bytez(key);
    model = sdk.model("openai/gpt-4o");
  }
} catch (error) {
  console.error('LLM functionality will not work until bytez.js is installed.');
}

const { cleanJobDescription } = require('../utils/textCleaner');

// n8n Webhook URL for sending emails
const N8N_EMAIL_WEBHOOK_URL = process.env.N8N_EMAIL_WEBHOOK_URL || 'http://localhost:5678/webhook/send-interview-emails';

// Generate job description from form data
exports.generateJobDescription = async (req, res) => {
  try {
    if (!model) {
      return res.status(503).json({ 
        error: 'LLM service not available. Please ensure bytez.js is installed and BYTEZ_API_KEY is set.' 
      });
    }

    const { jobData, previousDescription, editInstructions } = req.body;

    // Validate jobData for initial generation
    if (!previousDescription && (!jobData || !jobData.jobTitle || !jobData.company)) {
      return res.status(400).json({ 
        error: 'Missing required fields: jobData with jobTitle and company are required for initial generation.' 
      });
    }

    let prompt;

    if (previousDescription && editInstructions) {
      // Regenerate with feedback
      let additionalContext = '';
      
      // Include new fields context if they exist
      if (jobData) {
        if (jobData.languages && jobData.languages.length > 0) {
          additionalContext += `\n\nPreferred Languages: ${jobData.languages.join(', ')} - Make sure language requirements are clearly stated.`;
        }
        if (jobData.candidateLocation) {
          let locationReq = 'Open to candidates from anywhere (remote/global applicants welcome).';
          if (Array.isArray(jobData.candidateLocation) && jobData.candidateLocation.length > 0) {
            locationReq = `Candidate location preferences: ${jobData.candidateLocation.join(', ')}`;
          } else if (typeof jobData.candidateLocation === 'string') {
            // Backward compatibility
            locationReq = jobData.candidateLocation === 'same-country' 
              ? 'Candidates must be located in the same country as the company.'
              : jobData.candidateLocation === 'same-city'
              ? 'Candidates must be located in the same city as the company.'
              : 'Open to candidates from anywhere (remote/global applicants welcome).';
          }
          additionalContext += `\n\nCandidate Location Requirement: ${locationReq}`;
        }
        if (jobData.education && Array.isArray(jobData.education) && jobData.education.length > 0) {
          additionalContext += `\n\nEducation Requirements: ${jobData.education.join(', ')} - Make sure education requirements are clearly stated.`;
        }
      }

      prompt = `You are a professional HR recruiter. You previously generated this job description:

${previousDescription}
${additionalContext}

The HR manager wants you to modify it with these instructions: ${editInstructions}

Please regenerate the job description incorporating the feedback while maintaining a professional and highly energetic tone. Make it compelling and attractive to potential candidates.

${jobData && jobData.languages && jobData.languages.length > 0 ? `IMPORTANT: Ensure language requirements (${jobData.languages.join(', ')}) are clearly mentioned in the updated description.` : ''}

CRITICAL FORMATTING REQUIREMENTS FOR SOCIAL MEDIA:
- You MUST add a blank line (double line break: \n\n) after EACH paragraph and section
- After each major section (About the Role, Responsibilities, Requirements, Benefits, etc.), add a blank line
- Use \n\n (double newline) to create visible paragraph breaks that will display correctly on Facebook
- DO NOT write everything in one continuous paragraph - break it up with proper spacing
- The text will be posted on Facebook, so formatting is critical for readability
- Each section should be separated by blank lines for proper visual spacing`;
    } else {
      // Initial generation
      const locationStr = `${jobData.location.city}, ${jobData.location.province ? jobData.location.province + ', ' : ''}${jobData.location.country}${jobData.location.address ? ' - ' + jobData.location.address : ''}`;
      const salaryStr = jobData.salary && jobData.salary.min && jobData.salary.max 
        ? `$${jobData.salary.min.toLocaleString()} - $${jobData.salary.max.toLocaleString()}`
        : jobData.salary && jobData.salary.min 
        ? `Starting from $${jobData.salary.min.toLocaleString()}`
        : 'Competitive salary';
      const skillsStr = jobData.skills && jobData.skills.length > 0 
        ? jobData.skills.join(', ')
        : 'Various technical skills';
      const experienceStr = jobData.experience 
        ? (jobData.experience === '10+' || jobData.experience > 10 ? '10+ years' : `${jobData.experience} ${jobData.experience === 1 ? 'year' : 'years'}`)
        : 'Relevant experience';
      const languagesStr = jobData.languages && jobData.languages.length > 0
        ? jobData.languages.join(', ')
        : null;
      // Handle education as array
      const educationStr = Array.isArray(jobData.education) && jobData.education.length > 0
        ? jobData.education.join(', ')
        : (typeof jobData.education === 'string' && jobData.education ? jobData.education : 'Not specified');
      // Handle candidateLocation as array
      let candidateLocationStr = 'Open to candidates from anywhere (remote/global applicants welcome)';
      if (Array.isArray(jobData.candidateLocation) && jobData.candidateLocation.length > 0) {
        candidateLocationStr = jobData.candidateLocation.join(', ');
      } else if (typeof jobData.candidateLocation === 'string') {
        // Backward compatibility
        candidateLocationStr = jobData.candidateLocation === 'same-country' 
          ? 'Candidates must be located in the same country as the company'
          : jobData.candidateLocation === 'same-city'
          ? 'Candidates must be located in the same city as the company'
          : 'Open to candidates from anywhere (remote/global applicants welcome)';
      }
      const keyResponsibilitiesStr = jobData.keyResponsibilities || jobData.description || 'See job requirements below';

      prompt = `You are a professional HR recruiter. Create a compelling, professional, and highly energetic job description for the following position:

Job Title: ${jobData.jobTitle}
Company: ${jobData.company}
Company Location: ${locationStr}
Job Type: ${jobData.jobType}
Salary Range: ${salaryStr}
Experience Required: ${experienceStr}
Education: ${educationStr}
Required Skills: ${skillsStr}
${languagesStr ? `Preferred Languages: ${languagesStr}` : ''}
Candidate Location Requirement: ${candidateLocationStr}
Key Responsibilities (from HR): ${keyResponsibilitiesStr}

Create a professional, energetic, and engaging job description that:
1. Highlights the exciting opportunities and growth potential
2. Emphasizes the company culture and benefits
3. Makes the role sound attractive and compelling
4. Uses professional yet energetic language
5. Includes key responsibilities and requirements
6. ${languagesStr ? 'Mentions the preferred languages and language requirements clearly' : ''}
7. ${(Array.isArray(jobData.candidateLocation) && jobData.candidateLocation.length > 0 && !jobData.candidateLocation.includes('Anywhere') && !jobData.candidateLocation.includes('Worldwide')) || (typeof jobData.candidateLocation === 'string' && (jobData.candidateLocation === 'same-country' || jobData.candidateLocation === 'same-city')) ? 'Clearly states the location requirement for candidates' : 'Emphasizes that remote/global candidates are welcome if applicable'}
8. Encourages qualified candidates to apply

${languagesStr ? `IMPORTANT: The job requires proficiency in: ${languagesStr}. Please mention language requirements prominently in the job description.` : ''}
${(Array.isArray(jobData.candidateLocation) && jobData.candidateLocation.length > 0 && !jobData.candidateLocation.includes('Anywhere') && !jobData.candidateLocation.includes('Worldwide')) || (typeof jobData.candidateLocation === 'string' && (jobData.candidateLocation === 'same-country' || jobData.candidateLocation === 'same-city')) ? `IMPORTANT: Please mention the candidate location requirements clearly: ${Array.isArray(jobData.candidateLocation) ? jobData.candidateLocation.join(', ') : (jobData.candidateLocation === 'same-country' ? 'Candidates must be located in the same country' : 'Candidates must be located in the same city')} as the company.` : ''}

CRITICAL FORMATTING REQUIREMENTS FOR SOCIAL MEDIA:
- You MUST add a blank line (double line break: \n\n) after EACH paragraph and section
- After "About the Role:" section, add a blank line before the next section
- After "Key Responsibilities:" section, add a blank line before the next section
- After "Requirements:" section, add a blank line before the next section
- After "Benefits:" section, add a blank line before the next section
- After "Language Requirements:" section, add a blank line before the next section
- After "Why NeuroHire?" section, add a blank line before the next section
- After "Application Process:" section, add a blank line before the next section
- Each bullet point in lists should be on its own line with proper spacing
- Use \n\n (double newline) to create visible paragraph breaks that will display correctly on Facebook
- DO NOT write everything in one continuous paragraph - break it up with proper spacing
- The text will be posted on Facebook, so formatting is critical for readability

Example of proper formatting:
About the Role:

[Content here]

Key Responsibilities:

[Content here]

Requirements:

[Content here]

Write a complete, polished job description that would attract top talent. CRITICAL: Make absolutely sure you add blank lines (\n\n) after each section and paragraph so it displays properly on social media platforms.`;
    }

    let output, error;
    try {
      const result = await model.run([
        {
          "role": "user",
          "content": prompt
        }
      ], {
        max_completion_tokens: 4096 // Limit response tokens to avoid exceeding model limits
      });
      
      // Handle different response formats from Bytez SDK
      if (result && typeof result === 'object') {
        error = result.error || null;
        output = result.output || result.content || result.text || result;
      } else {
        output = result;
      }
    } catch (apiError) {
      console.error('LLM API Error:', apiError);
      error = apiError;
    }

    if (error) {
      console.error('LLM Error:', error);
      
      // Handle specific error types
      if (error.message && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
        return res.status(401).json({ 
          error: 'API key is invalid or expired. Please check your BYTEZ_API_KEY.' 
        });
      }
      
      if (error.message && error.message.includes('fetch failed')) {
        return res.status(503).json({ 
          error: 'LLM service is currently unavailable. Please try again later.',
          details: 'Network connection to LLM service failed. Check your internet connection and BYTEZ_API_KEY.'
        });
      }
      
      return res.status(500).json({ 
        error: error.message || 'Failed to generate job description',
        details: error.toString()
      });
    }

    // Extract text from output - handle different response formats
    let descriptionText = '';
    if (typeof output === 'string') {
      descriptionText = output;
    } else if (output && typeof output === 'object') {
      // Handle object response - try common properties
      if (output.content) {
        descriptionText = typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
      } else if (output.text) {
        descriptionText = typeof output.text === 'string' ? output.text : JSON.stringify(output.text);
      } else if (output.message) {
        descriptionText = typeof output.message === 'string' ? output.message : JSON.stringify(output.message);
      } else if (Array.isArray(output)) {
        // If it's an array, join the content
        descriptionText = output.map(item => {
          if (typeof item === 'string') return item;
          if (item && item.content) return item.content;
          return JSON.stringify(item);
        }).join('\n');
      } else {
        // Fallback: stringify the object
        descriptionText = JSON.stringify(output, null, 2);
      }
    } else {
      descriptionText = String(output || 'Failed to generate description');
    }

    // Clean the description to remove comments, stars, and markdown artifacts
    const cleanedDescription = cleanJobDescription(descriptionText);

    res.json({ 
      success: true, 
      generatedDescription: cleanedDescription
    });
  } catch (error) {
    console.error('Generate job description error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate job description' });
  }
};

// Generate interview invitation email using GPT-4o
exports.generateInterviewEmail = async (req, res) => {
  try {
    if (!model) {
      return res.status(503).json({ 
        error: 'LLM service not available. Please ensure bytez.js is installed and BYTEZ_API_KEY is set.' 
      });
    }

    const { candidates, jobInfo, emailType, companyInfo } = req.body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'At least one candidate is required' });
    }

    if (!jobInfo || !jobInfo.jobTitle) {
      return res.status(400).json({ error: 'Job information is required' });
    }

    // Determine email type: 'online_test' or 'interview'
    const type = emailType || 'interview';
    const typeLabel = type === 'online_test' ? 'Online Assessment/Test' : 'Interview';

    // Create a sample candidate name for the template
    const sampleCandidate = candidates[0];

    const prompt = `You are a professional HR recruiter. Generate a formal, professional, and friendly ${typeLabel.toLowerCase()} invitation email template.

Job Details:
- Position: ${jobInfo.jobTitle}
- Company: ${jobInfo.company || companyInfo?.name || 'Our Company'}
${jobInfo.location ? `- Location: ${jobInfo.location}` : ''}

Email Type: ${typeLabel} Invitation

Please generate a complete, professional email with the following structure:

1. Subject Line: Create an appropriate subject line for the ${typeLabel.toLowerCase()} invitation

2. Email Body:
   - Professional greeting using [CANDIDATE_NAME] as placeholder
   - Express appreciation for their application
   - Congratulate them on being shortlisted
   - ${type === 'online_test' 
     ? 'Explain that they need to complete an online assessment as part of the selection process'
     : 'Invite them for an interview (mention date/time will be confirmed separately or use [DATE] and [TIME] placeholders)'}
   - ${type === 'online_test'
     ? 'Include placeholders: [TEST_LINK], [TEST_DEADLINE], [TEST_DURATION]'
     : 'Include placeholders: [INTERVIEW_DATE], [INTERVIEW_TIME], [INTERVIEW_LOCATION/LINK]'}
   - Mention what they should prepare or expect
   - Provide contact information for questions
   - Professional closing

3. Important Requirements:
   - Use [CANDIDATE_NAME] placeholder where the candidate's name should go
   - Keep the tone professional yet warm and encouraging
   - Make the email feel personalized even though it's a template
   - Include all necessary details a candidate would need
   - End with a professional signature block using [HR_NAME], [HR_TITLE], [COMPANY_NAME], [COMPANY_EMAIL], [COMPANY_PHONE] placeholders

Format the response as JSON with this structure:
{
  "subject": "Email subject line here",
  "body": "Full email body here with proper line breaks using \\n"
}

IMPORTANT: Return ONLY valid JSON, no additional text or markdown.`;

    let output, error;
    try {
      const result = await model.run([
        {
          "role": "user",
          "content": prompt
        }
      ], {
        max_completion_tokens: 4096 // Limit response tokens to avoid exceeding model limits
      });
      
      if (result && typeof result === 'object') {
        error = result.error || null;
        output = result.output || result.content || result.text || result;
      } else {
        output = result;
      }
    } catch (apiError) {
      console.error('LLM API Error:', apiError);
      error = apiError;
    }

    if (error) {
      console.error('LLM Error:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to generate email',
        details: error.toString()
      });
    }

    // Parse the output
    let emailData;
    try {
      // Extract JSON from the response
      let jsonStr = typeof output === 'string' ? output : (output.content || output.text || JSON.stringify(output));
      
      // Clean up the response - remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      emailData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      // Fallback: create a basic email structure
      const bodyText = typeof output === 'string' ? output : (output.content || output.text || '');
      emailData = {
        subject: `${typeLabel} Invitation - ${jobInfo.jobTitle} at ${jobInfo.company || 'Our Company'}`,
        body: bodyText
      };
    }

    res.json({
      success: true,
      email: {
        subject: emailData.subject,
        body: emailData.body,
        type: type,
        candidateCount: candidates.length,
        candidates: candidates.map(c => ({
          name: c.candidateName || c.name,
          email: c.email
        }))
      }
    });
  } catch (error) {
    console.error('Generate interview email error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate interview email' });
  }
};

// Send interview emails via n8n webhook
exports.sendInterviewEmails = async (req, res) => {
  try {
    const { candidates, emailContent, jobInfo, hrInfo } = req.body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'At least one candidate is required' });
    }

    if (!emailContent || !emailContent.subject || !emailContent.body) {
      return res.status(400).json({ error: 'Email content with subject and body is required' });
    }

    // Prepare email data for each candidate
    const emailsToSend = candidates.map(candidate => {
      // Replace placeholders in the email body
      let personalizedBody = emailContent.body
        .replace(/\[CANDIDATE_NAME\]/g, candidate.candidateName || candidate.name || 'Candidate')
        .replace(/\[HR_NAME\]/g, hrInfo?.name || 'HR Team')
        .replace(/\[HR_TITLE\]/g, hrInfo?.title || 'Human Resources')
        .replace(/\[COMPANY_NAME\]/g, jobInfo?.company || 'Our Company')
        .replace(/\[COMPANY_EMAIL\]/g, hrInfo?.email || 'hr@company.com')
        .replace(/\[COMPANY_PHONE\]/g, hrInfo?.phone || '');

      let personalizedSubject = emailContent.subject
        .replace(/\[CANDIDATE_NAME\]/g, candidate.candidateName || candidate.name || 'Candidate');

      return {
        to: candidate.email,
        subject: personalizedSubject,
        body: personalizedBody,
        candidateName: candidate.candidateName || candidate.name,
        jobTitle: jobInfo?.jobTitle,
        company: jobInfo?.company
      };
    });

    // Send to n8n webhook
    try {
      const n8nResponse = await axios.post(N8N_EMAIL_WEBHOOK_URL, {
        emails: emailsToSend,
        totalCount: emailsToSend.length,
        jobInfo: jobInfo,
        sentAt: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      res.json({
        success: true,
        message: `Successfully queued ${emailsToSend.length} email(s) for sending`,
        sentCount: emailsToSend.length,
        n8nResponse: n8nResponse.data
      });
    } catch (webhookError) {
      console.error('n8n webhook error:', webhookError);
      
      // Check if n8n is not running or webhook not configured
      if (webhookError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: 'Email service (n8n) is not available. Please ensure n8n is running and the webhook is configured.',
          details: 'Connection refused to n8n webhook URL',
          webhookUrl: N8N_EMAIL_WEBHOOK_URL
        });
      }

      return res.status(500).json({
        error: 'Failed to send emails via n8n webhook',
        details: webhookError.message
      });
    }
  } catch (error) {
    console.error('Send interview emails error:', error);
    res.status(500).json({ error: error.message || 'Failed to send interview emails' });
  }
};
