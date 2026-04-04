const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config();


let Bytez, sdk, model;

try {
  Bytez = require('bytez.js');
  const key = process.env.BYTEZ_API_KEY;
  const modelId = process.env.BYTEZ_MODEL || 'openai/gpt-4o';

  if (!key) {
    console.error('Warning: BYTEZ_API_KEY not set. LLM functionality will not work.');
  } else {
    sdk = new Bytez(key);
    model = sdk.model(modelId);
  }
} catch (error) {
  console.error('LLM functionality will not work until bytez.js is installed.');
}

const BYTEZ_MODEL_ID_LOWER = (process.env.BYTEZ_MODEL || 'openai/gpt-4o').toLowerCase();
const { CODING_PROBLEM_COUNT, CODING_MARKS_CAPS } = require('../config/assessmentConfig');

/** Test link validity from invite send (`TestInvitation.expiresAt`, `JobPost.assessmentDeadline`). */
const TEST_INVITE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes (was 1 week)

function formatTestDeadlineForEmail(date) {
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Bytez returns errors if the model does not support max_completion_tokens (e.g. Gemma). */
function bytezMaxCompletionOption(maxTokens) {
  if (maxTokens == null || maxTokens <= 0) return undefined;
  if (BYTEZ_MODEL_ID_LOWER.includes('gemma')) return undefined;
  if (process.env.BYTEZ_DISABLE_MAX_COMPLETION_TOKENS === '1') return undefined;
  return { max_completion_tokens: maxTokens };
}

async function runBytez(messages, maxTokens) {
  if (!model) throw new Error('LLM model not initialized');
  const opts = bytezMaxCompletionOption(maxTokens);
  return opts ? model.run(messages, opts) : model.run(messages);
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
      const result = await runBytez([
        {
          "role": "user",
          "content": prompt
        }
      ], 4096);
      
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

// Generate interview invitation email using Bytez LLM
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
      const result = await runBytez([
        {
          "role": "user",
          "content": prompt
        }
      ], 4096);
      
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
    const { candidates, emailContent, jobInfo, hrInfo, jobId, emailType } = req.body;
    const Application = require('../models/Application');
    const TestInvitation = require('../models/TestInvitation');
    const config = require('../config/appConfig');

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'At least one candidate is required' });
    }

    if (!emailContent || !emailContent.subject || !emailContent.body) {
      return res.status(400).json({ error: 'Email content with subject and body is required' });
    }

    const isOnlineTest = emailType === 'online_test';
    const frontendUrl = (config.frontend && config.frontend.url) || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    const testExpiresAt = new Date(Date.now() + TEST_INVITE_WINDOW_MS);
    const invitationMap = {}; // candidate email -> { token, expiresAt } for building email body

    if (isOnlineTest && jobId) {
      // Prepare test first (MCQ pool + coding questions) so it's ready when candidates open the link
      try {
        await ensureTestQuestionsForJob(jobId);
      } catch (e) {
        console.error('ensureTestQuestionsForJob:', e);
        return res.status(503).json({
          error: 'Test could not be prepared (MCQ/coding questions generation failed). Please try again or contact support.',
        });
      }
      for (const c of candidates) {
        const applicationId = c._id; // _id in ranked list is application id
        const app = await Application.findById(applicationId).populate('candidate', '_id');
        if (!app || !app.candidate) continue;
        const inv = new TestInvitation({
          jobPost: jobId,
          application: applicationId,
          candidate: app.candidate._id,
          expiresAt: testExpiresAt,
        });
        await inv.save();
        invitationMap[c.email] = { token: inv.token, expiresAt: testExpiresAt };
      }
    }

    // Prepare email data for each candidate
    const emailsToSend = candidates.map(candidate => {
      let personalizedBody = emailContent.body
        .replace(/\[CANDIDATE_NAME\]/g, candidate.candidateName || candidate.name || 'Candidate')
        .replace(/\[HR_NAME\]/g, hrInfo?.name || 'HR Team')
        .replace(/\[HR_TITLE\]/g, hrInfo?.title || 'Human Resources')
        .replace(/\[COMPANY_NAME\]/g, jobInfo?.company || 'Our Company')
        .replace(/\[COMPANY_EMAIL\]/g, hrInfo?.email || 'hr@company.com')
        .replace(/\[COMPANY_PHONE\]/g, hrInfo?.phone || '');

      if (isOnlineTest && invitationMap[candidate.email]) {
        const { token, expiresAt } = invitationMap[candidate.email];
        const testLink = `${frontendUrl.replace(/\/$/, '')}/test?token=${token}`;
        personalizedBody = personalizedBody
          .replace(/\[TEST_LINK\]/g, testLink)
          .replace(/\[TEST_DEADLINE\]/g, formatTestDeadlineForEmail(expiresAt))
          .replace(/\[TEST_DURATION\]/g, '2 hours');
      }

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

// ----- Online Test: MCQ & Coding question generation -----

const TestMcqPool = require('../models/TestMcqPool');
const CodingQuestion = require('../models/CodingQuestion');

function extractTextFromOutput(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;
  const getStr = (v) => (typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : ''));
  if (output.content) return getStr(output.content);
  if (output.text) return getStr(output.text);
  if (output.result) return getStr(output.result);
  if (output.data) return getStr(output.data);
  if (output.message && output.message.content) return getStr(output.message.content);
  if (output.message) return getStr(output.message);
  if (Array.isArray(output)) return output.map(item => (typeof item === 'string' ? item : (item?.content ?? item?.text ?? JSON.stringify(item)))).join('\n');
  return JSON.stringify(output);
}

/** Extract a JSON array from LLM text (handles markdown code blocks and loose JSON). */
function parseMcqJsonFromLLM(text) {
  if (!text || typeof text !== 'string') return null;
  let raw = text.trim();
  // Strip markdown code blocks
  raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  // Find the first '[' and then matching ']' by bracket count
  const start = raw.indexOf('[');
  if (start !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '[') depth++;
      else if (raw[i] === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (e) {
        // fall through to object fallback
      }
    }
  }
  // Fallback: try parsing as object with "questions" or "problems" array
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return obj;
    if (obj && Array.isArray(obj.questions)) return obj.questions;
    if (obj && Array.isArray(obj.problems)) return obj.problems;
    if (obj && Array.isArray(obj.coding_questions)) return obj.coding_questions;
  } catch (e) {
    // try finding JSON object with array inside
    const objMatch = raw.match(/\{[\s\S]*"questions"[\s\S]*\[[\s\S]*\][\s\S]*\}/);
    if (objMatch) {
      try {
        const obj = JSON.parse(objMatch[0]);
        if (Array.isArray(obj.questions)) return obj.questions;
      } catch (err) {
        // ignore
      }
    }
  }
  return null;
}

async function generateAndSaveMcqPool(jobId, hrExtraInstruction = '') {
  const JobPost = require('../models/JobPost');
  const job = await JobPost.findById(jobId);
  if (!job) return { ok: false };
  const skillsStr = (job.skills && job.skills.length) ? job.skills.join(', ') : 'general programming';
  const desc = job.keyResponsibilities || job.generatedDescription || job.description || '';
  const extra = hrExtraInstruction
    ? `\n\nAdditional instructions from HR (follow closely):\n${hrExtraInstruction.slice(0, 2000)}\n`
    : '';
  const prompt = `You are an expert technical interviewer. Generate exactly 100 multiple-choice questions (MCQs) for an online coding/technical test.

Job context:
- Job title: ${job.jobTitle}
- Skills/stack: ${skillsStr}
- Key responsibilities/description: ${desc.slice(0, 1500)}
${extra}
Requirements:
- Each question must have exactly 4 options (A, B, C, D).
- Questions should cover: programming concepts, data structures, algorithms, language-specific knowledge (from the job stack), and problem-solving.
- Mix difficulty: easy, medium, hard.
- Return a JSON array of exactly 100 objects. Each object must have:
  "questionText": string (the question),
  "options": [string, string, string, string] (exactly 4 options),
  "correctIndex": number (0 to 3, index of the correct option in "options")

Output ONLY valid JSON array, no markdown or extra text. Example format:
[{"questionText":"What is the time complexity of binary search?","options":["O(n)","O(log n)","O(n^2)","O(1)"],"correctIndex":1}, ...]`;
  const result = await runBytez(
    [{ role: 'user', content: prompt }],
    16384
  );
  if (result && typeof result === 'object' && result.error) {
    console.error('MCQ pool LLM error:', result.error);
    return { ok: false, count: 0 };
  }
  const output = result?.output ?? result?.content ?? result?.text ?? result;
  const text = extractTextFromOutput(output);
  let arr = parseMcqJsonFromLLM(text);
  if (!Array.isArray(arr)) arr = [];
  const questions = arr
    .filter(q => q && q.questionText && Array.isArray(q.options) && q.options.length === 4 && typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3)
    .slice(0, 100)
    .map(q => ({ questionText: q.questionText, options: q.options, correctIndex: q.correctIndex }));
  if (questions.length < 30) return { ok: false, count: questions.length };
  await TestMcqPool.findOneAndUpdate({ jobPost: jobId }, { jobPost: jobId, questions }, { upsert: true, new: true });
  return { ok: true, count: questions.length };
}

async function ensureTestQuestionsForJob(jobId) {
  const pool = await TestMcqPool.findOne({ jobPost: jobId });
  if (!pool || !pool.questions || pool.questions.length < 30) {
    try {
      await generateAndSaveMcqPool(jobId);
    } catch (e) {
      console.error('Background MCQ pool generation failed:', e);
    }
  }
  const coding = await CodingQuestion.findOne({ jobPost: jobId });
  if (!coding || !coding.questions || coding.questions.length < CODING_PROBLEM_COUNT) {
    try {
      await generateAndSaveCodingQuestions(jobId);
    } catch (e) {
      console.error('Background coding questions generation failed:', e);
    }
  }
}

async function generateAndSaveCodingQuestions(jobId, hrExtraInstruction = '') {
  const JobPost = require('../models/JobPost');
  const job = await JobPost.findById(jobId);
  if (!job) return { ok: false };
  const skillsStr = (job.skills && job.skills.length) ? job.skills.join(', ') : 'algorithms and data structures';
  const extra = hrExtraInstruction
    ? `\n\nAdditional instructions from HR:\n${hrExtraInstruction.slice(0, 2000)}\n`
    : '';
  const prompt = `You are an expert competitive programmer. Generate exactly ${CODING_PROBLEM_COUNT} coding problems for an online test (LeetCode/Codeforces style).

Job: ${job.jobTitle}. Skills: ${skillsStr}.
${extra}
Rules:
- Output ONLY a valid JSON array of exactly ${CODING_PROBLEM_COUNT} objects. No markdown, no code fences, no explanation before or after.
- Each object must have these exact keys (all strings): "title", "statement", "inputFormat", "outputFormat", "sampleInput", "sampleOutput", "constraints", "difficulty".
- "statement" = full problem description. Set "difficulty" to "medium" for ALL problems — they must be medium-to-hard (not trivial, require DSA thinking).
- Cover data structures, algorithms, and problem-solving; avoid trick-only or pure memorization.

Example format for each object: {"title":"Two Sum","statement":"Given an array of integers, return indices of two numbers that add up to target.","inputFormat":"First line: n. Second line: array. Third: target","outputFormat":"Two space-separated indices","sampleInput":"4","sampleOutput":"0 1","constraints":"2 <= n <= 10000","difficulty":"medium"}

Reply with only the JSON array starting with [ and ending with ].`;
  const result = await runBytez(
    [{ role: 'user', content: prompt }],
    8192
  );
  if (result && typeof result === 'object' && result.error) {
    console.error('Coding questions LLM error:', result.error);
    return { ok: false, count: 0 };
  }
  const output = result?.output ?? result?.content ?? result?.text ?? result;
  const text = extractTextFromOutput(output);
  let arr = parseMcqJsonFromLLM(text);
  if (!Array.isArray(arr)) arr = [];
  if (arr.length === 0 && text) {
    console.warn('Coding questions: no array parsed. Response preview:', text.slice(0, 500));
  }
  const questions = arr
    .filter(q => q && (q.title || q.name) && (q.statement || q.description || q.problem || q.body))
    .slice(0, CODING_PROBLEM_COUNT)
    .map(q => ({
      title: q.title || q.name || 'Coding Problem',
      statement: q.statement || q.description || q.problem || q.body || '',
      inputFormat: q.inputFormat || q.input_format || '',
      outputFormat: q.outputFormat || q.output_format || '',
      sampleInput: q.sampleInput || q.sample_input || q.exampleInput || '',
      sampleOutput: q.sampleOutput || q.sample_output || q.exampleOutput || '',
      constraints: q.constraints || '',
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
    }));
  if (questions.length < CODING_PROBLEM_COUNT) return { ok: false, count: questions.length };
  await CodingQuestion.findOneAndUpdate({ jobPost: jobId }, { jobPost: jobId, questions }, { upsert: true, new: true });
  return { ok: true, count: questions.length };
}

// Generate 100 MCQs for a job (HR/manual trigger)
exports.generateMcqPool = async (req, res) => {
  try {
    if (!model) return res.status(503).json({ error: 'LLM service not available.' });
    const { jobId } = req.params;
    const JobPost = require('../models/JobPost');
    const job = await JobPost.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const result = await generateAndSaveMcqPool(jobId);
    if (!result.ok) {
      return res.status(500).json({ error: `LLM generated only ${result.count || 0} valid MCQs. Need at least 30.` });
    }
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Generate MCQ pool error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate MCQ pool' });
  }
};

// Generate coding questions for a job (HR/manual trigger)
exports.generateCodingQuestions = async (req, res) => {
  try {
    if (!model) return res.status(503).json({ error: 'LLM service not available.' });
    const { jobId } = req.params;
    const JobPost = require('../models/JobPost');
    const job = await JobPost.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const result = await generateAndSaveCodingQuestions(jobId);
    if (!result.ok) {
      return res.status(500).json({ error: `LLM generated only ${result.count || 0} coding questions. Need ${CODING_PROBLEM_COUNT}.` });
    }
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Generate coding questions error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate coding questions' });
  }
};

// ----- Online Test: LLM evaluation after submit -----
const TestAttempt = require('../models/TestAttempt');

/**
 * Evaluate a submitted test attempt: MCQ score (0-30) + LLM coding score (0-70), then save to attempt.
 * Called in background after submitTest. attemptId = TestAttempt._id.
 */
exports.evaluateTestAttempt = async (attemptId) => {
  const attempt = await TestAttempt.findById(attemptId).populate('testInvitation');
  if (!attempt || !attempt.testInvitation || attempt.status !== 'submitted') return;

  const jobId = attempt.testInvitation.jobPost;
  const mcqPool = await TestMcqPool.findOne({ jobPost: jobId });
  const codingDoc = await CodingQuestion.findOne({ jobPost: jobId });
  if (!mcqPool || !mcqPool.questions || !codingDoc || !codingDoc.questions) return;

  let mcqScore = 0;
  const mcqBreakdown = [];
  const mcqOrder = attempt.mcqOrder || [];
  const mcqAnswers = attempt.mcqAnswers || [];
  for (let i = 0; i < mcqOrder.length; i++) {
    const poolIdx = mcqOrder[i];
    const q = mcqPool.questions[poolIdx];
    if (!q || typeof q.correctIndex !== 'number') continue;
    const ans = mcqAnswers.find((a) => a.questionIndex === i);
    const selected = ans && typeof ans.selectedIndex === 'number' ? ans.selectedIndex : -1;
    const correct = selected === q.correctIndex;
    if (correct) mcqScore += 1;
    mcqBreakdown.push({
      orderIndex: i,
      marksObtained: correct ? 1 : 0,
      marksMax: 1,
      questionPreview: String(q.questionText || '').slice(0, 120),
    });
  }
  const maxMcq = 30;
  mcqScore = Math.min(mcqScore, maxMcq);

  let codingScore = 0;
  let evaluationSummary = '';
  let codingBreakdown = [];

  if (model && codingDoc.questions.length > 0 && attempt.codingSubmissions && attempt.codingSubmissions.length > 0) {
    const codingSubs = attempt.codingSubmissions;
    const nProblems = Math.min(CODING_PROBLEM_COUNT, codingDoc.questions.length);
    const parts = codingDoc.questions.slice(0, nProblems).map((q, i) => {
      const sub = codingSubs[i] || {};
      return `Problem ${i + 1} (${q.title}):\nStatement: ${(q.statement || '').slice(0, 500)}\nSample I/O: ${q.sampleInput || ''} -> ${q.sampleOutput || ''}\nCandidate code (${sub.language || 'javascript'}):\n${(sub.code || '').slice(0, 4000)}`;
    }).join('\n\n---\n\n');

    const caps = CODING_MARKS_CAPS.slice(0, nProblems);
    const capsStr = caps.map((c, i) => `problem ${i + 1} max ${c}`).join(', ');

    const prompt = `You are grading a coding test. The test has ${nProblems} problems. Score the candidate's solutions.

${parts}

Score each solution: ${capsStr} (total max 70). Use 0 if empty or nonsensical. Consider correctness, code quality, edge cases.
Reply with ONLY a JSON object (no markdown): { "scores": [s1, s2, s3], "totalCodingScore": number (sum, max 70), "feedback": "one short paragraph" }`;

    try {
      const result = await runBytez(
        [{ role: 'user', content: prompt }],
        1024
      );
      const output = result?.output ?? result?.content ?? result?.text ?? result;
      const text = extractTextFromOutput(output);
      let raw = text.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const obj = JSON.parse(objMatch[0]);
        const scores = obj.scores;
        if (Array.isArray(scores)) {
          codingBreakdown = [];
          for (let i = 0; i < nProblems; i++) {
            const cap = CODING_MARKS_CAPS[i] ?? 23;
            const cq = codingDoc.questions[i];
            const obtained = Math.min(cap, Math.max(0, Math.round(Number(scores[i]) || 0)));
            codingBreakdown.push({
              questionIndex: i,
              title: String(cq?.title || `Problem ${i + 1}`).slice(0, 120),
              marksObtained: obtained,
              marksMax: cap,
            });
          }
          codingScore = Math.min(70, codingBreakdown.reduce((s, r) => s + (r.marksObtained || 0), 0));
        } else if (typeof obj.totalCodingScore === 'number') {
          codingScore = Math.min(70, Math.max(0, Math.round(obj.totalCodingScore)));
          for (let i = 0; i < nProblems; i++) {
            const cq = codingDoc.questions[i];
            codingBreakdown.push({
              questionIndex: i,
              title: String(cq?.title || `Problem ${i + 1}`).slice(0, 120),
              marksObtained: null,
              marksMax: CODING_MARKS_CAPS[i] ?? 23,
            });
          }
        }
        if (typeof obj.feedback === 'string') evaluationSummary = obj.feedback.slice(0, 500);
      }
    } catch (e) {
      console.error('LLM coding evaluation error:', e);
      evaluationSummary = 'Evaluation could not be completed.';
    }
  }

  const totalScore = Math.min(100, mcqScore + codingScore);
  await TestAttempt.updateOne(
    { _id: attemptId },
    {
      mcqScore,
      codingScore,
      testScore: totalScore,
      evaluationSummary: evaluationSummary || null,
      evaluatedAt: new Date(),
      mcqBreakdown,
      codingBreakdown,
    }
  );
};

/**
 * Generate 3-month training plan text for a hired candidate (industry standard practices).
 * Used for PDF export. Returns plain text or markdown.
 */
exports.generateTrainingPlanContent = async (application, jobPost) => {
  if (!model) return null;
  const candidateName = application.formData?.firstName && application.formData?.lastName
    ? `${application.formData.firstName} ${application.formData.lastName}`
    : application.candidate?.name || 'Candidate';
  const jobTitle = jobPost.jobTitle || 'Role';
  const company = jobPost.company || 'Company';
  const skills = (jobPost.skills && jobPost.skills.length) ? jobPost.skills.join(', ') : 'role-specific skills';
  const prompt = `You are an HR training specialist. Generate a 3-month (12-week) training plan for a new hire to meet industry standard practices.

Candidate name: ${candidateName}
Job title: ${jobTitle}
Company: ${company}
Key skills for role: ${skills}

Output a clear, professional training plan with:
1. Title: "3-Month Training Plan - [Job Title]"
2. Objective (2-3 sentences)
3. Month 1: Orientation & foundations (weeks 1-4) - specific goals and deliverables
4. Month 2: Core competencies & projects (weeks 5-8) - specific goals and deliverables
5. Month 3: Independence & best practices (weeks 9-12) - specific goals and deliverables
6. Success criteria and review milestones

Use plain text with clear headings. Keep each section concise but actionable. No markdown code blocks.`;
  try {
    const result = await runBytez([{ role: 'user', content: prompt }], 2048);
    const output = result?.output ?? result?.content ?? result?.text ?? result;
    return extractTextFromOutput(output) || 'Training plan could not be generated.';
  } catch (e) {
    console.error('Training plan LLM error:', e);
    return null;
  }
};

// ----- HR test editor, top-50 invites, condolence (hire pipeline) -----
const { dispatchEmailBatch } = require('../services/emailDispatchService');
const appConfig = require('../config/appConfig');

function validateMcqList(arr) {
  if (!Array.isArray(arr) || arr.length < 30) return false;
  return arr.every(
    (q) =>
      q &&
      typeof q.questionText === 'string' &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      typeof q.correctIndex === 'number' &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3
  );
}

function validateCodingList(arr) {
  if (!Array.isArray(arr) || arr.length < CODING_PROBLEM_COUNT) return false;
  return arr.every(
    (q) =>
      q &&
      typeof (q.title || q.name) === 'string' &&
      (q.statement || q.description || q.problem || q.body)
  );
}

/** GET test pools for HR editing (must own job). req.user set by middleware. */
exports.getJobTestContent = async (req, res) => {
  try {
    const { jobId } = req.params;
    const JobPost = require('../models/JobPost');
    const job = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job post not found' });
    const pool = await TestMcqPool.findOne({ jobPost: jobId }).lean();
    const coding = await CodingQuestion.findOne({ jobPost: jobId }).lean();
    res.json({
      success: true,
      jobTitle: job.jobTitle,
      company: job.company,
      mcqQuestions: pool?.questions || [],
      codingQuestions: coding?.questions || [],
      hirePipelineStage: job.hirePipelineStage,
      assessmentInviteSentAt: job.assessmentInviteSentAt,
      testContentFinalizedAt: job.testContentFinalizedAt,
    });
  } catch (e) {
    console.error('getJobTestContent:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
};

/** Save HR-edited MCQ + coding; marks test ready. */
exports.saveJobTestContent = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { mcqQuestions, codingQuestions } = req.body;
    const JobPost = require('../models/JobPost');
    const job = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job post not found' });
    if (job.assessmentInviteSentAt) {
      return res.status(400).json({ error: 'Test invitations already sent; content is locked.' });
    }
    if (!validateMcqList(mcqQuestions)) {
      return res.status(400).json({ error: 'MCQs: need at least 30 valid items (4 options each, correctIndex 0-3).' });
    }
    if (!validateCodingList(codingQuestions)) {
      return res.status(400).json({ error: `Coding: need at least ${CODING_PROBLEM_COUNT} valid problems with title and statement.` });
    }
    const normalizedMcq = mcqQuestions.slice(0, 100).map((q) => ({
      questionText: String(q.questionText),
      options: q.options.map(String),
      correctIndex: q.correctIndex,
    }));
    const normalizedCoding = codingQuestions.slice(0, CODING_PROBLEM_COUNT).map((q) => ({
      title: q.title || q.name || 'Problem',
      statement: q.statement || q.description || q.problem || q.body || '',
      inputFormat: q.inputFormat || q.input_format || '',
      outputFormat: q.outputFormat || q.output_format || '',
      sampleInput: q.sampleInput || q.sample_input || '',
      sampleOutput: q.sampleOutput || q.sample_output || '',
      constraints: q.constraints || '',
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
    }));
    await TestMcqPool.findOneAndUpdate(
      { jobPost: jobId },
      { jobPost: jobId, questions: normalizedMcq },
      { upsert: true, new: true }
    );
    await CodingQuestion.findOneAndUpdate(
      { jobPost: jobId },
      { jobPost: jobId, questions: normalizedCoding },
      { upsert: true, new: true }
    );
    job.testContentFinalizedAt = new Date();
    job.hirePipelineStage = 'test_ready';
    await job.save();
    res.json({ success: true, message: 'Test content saved.' });
  } catch (e) {
    console.error('saveJobTestContent:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
};

/** Regenerate MCQ and/or coding using HR instructions (LLM). */
exports.regenerateJobTestWithInstruction = async (req, res) => {
  try {
    if (!model) {
      return res.status(503).json({ error: 'LLM service not available.' });
    }
    const { jobId } = req.params;
    const { instruction, scope = 'both' } = req.body;
    const JobPost = require('../models/JobPost');
    const job = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job post not found' });
    if (job.assessmentInviteSentAt) {
      return res.status(400).json({ error: 'Invitations already sent.' });
    }
    const instr = (instruction && String(instruction).trim()) || 'Improve relevance and clarity for this role.';
    if (scope === 'mcq' || scope === 'both') {
      const r = await generateAndSaveMcqPool(jobId, instr);
      if (!r.ok) return res.status(500).json({ error: `MCQ regeneration failed (got ${r.count || 0} questions).` });
    }
    if (scope === 'coding' || scope === 'both') {
      const r = await generateAndSaveCodingQuestions(jobId, instr);
      if (!r.ok) return res.status(500).json({ error: `Coding regeneration failed (got ${r.count || 0} problems).` });
    }
    const pool = await TestMcqPool.findOne({ jobPost: jobId }).lean();
    const coding = await CodingQuestion.findOne({ jobPost: jobId }).lean();
    res.json({
      success: true,
      mcqQuestions: pool?.questions || [],
      codingQuestions: coding?.questions || [],
    });
  } catch (e) {
    console.error('regenerateJobTestWithInstruction:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
};

const TOP_N_TEST = 50;

/** Create invitations for top 50 by CV total score, send test emails + condolence to remaining evaluated candidates. */
exports.sendTestInvitesTop50 = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { emailContent, hrInfo, jobInfo } = req.body;
    const JobPost = require('../models/JobPost');
    const Application = require('../models/Application');
    const TestInvitation = require('../models/TestInvitation');
    const job = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job post not found' });
    if (!job.evaluatedAt) {
      return res.status(400).json({ error: 'Evaluate applications first.' });
    }
    if (job.assessmentInviteSentAt) {
      return res.status(400).json({ error: 'Test invitations were already sent for this job.' });
    }
    if (!emailContent?.subject || !emailContent?.body) {
      return res.status(400).json({ error: 'emailContent.subject and emailContent.body required' });
    }
    try {
      await ensureTestQuestionsForJob(jobId);
    } catch (e) {
      console.error('ensureTestQuestionsForJob:', e);
      return res.status(503).json({ error: 'Test questions not ready. Save or generate test content first.' });
    }
    const pool = await TestMcqPool.findOne({ jobPost: jobId });
    const coding = await CodingQuestion.findOne({ jobPost: jobId });
    if (!pool?.questions?.length || pool.questions.length < 30 || !coding?.questions?.length || coding.questions.length < CODING_PROBLEM_COUNT) {
      return res.status(400).json({ error: `Finalize test content (MCQ ≥30, coding ≥${CODING_PROBLEM_COUNT}) before sending invites.` });
    }

    const allRanked = await Application.find({ jobPost: jobId, rankedAt: { $ne: null } })
      .populate('candidate', '_id name email')
      .sort({ 'scores.total': -1, createdAt: 1 })
      .lean();

    if (!allRanked.length) {
      return res.status(400).json({ error: 'No ranked applications for this job.' });
    }

    const top = allRanked.slice(0, TOP_N_TEST);
    const topIds = new Set(top.map((a) => a._id.toString()));
    const rest = allRanked.filter((a) => !topIds.has(a._id.toString()));

    const frontendUrl = (appConfig.frontend && appConfig.frontend.url) || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    const testExpiresAt = new Date(Date.now() + TEST_INVITE_WINDOW_MS);
    const invitationMap = {};

    for (const app of top) {
      if (!app.candidate?._id) continue;
      const inv = new TestInvitation({
        jobPost: jobId,
        application: app._id,
        candidate: app.candidate._id,
        expiresAt: testExpiresAt,
      });
      await inv.save();
      const email = app.candidate.email || app.formData?.email;
      if (email) invitationMap[email] = { token: inv.token, expiresAt: testExpiresAt };
    }

    const jInfo = jobInfo || { jobTitle: job.jobTitle, company: job.company };

    const testEmails = top
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email || !invitationMap[email]) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const { token, expiresAt } = invitationMap[email];
        const testLink = `${frontendUrl.replace(/\/$/, '')}/test?token=${token}`;
        let body = emailContent.body
          .replace(/\[CANDIDATE_NAME\]/g, name)
          .replace(/\[HR_NAME\]/g, hrInfo?.name || 'HR Team')
          .replace(/\[HR_TITLE\]/g, hrInfo?.title || 'Human Resources')
          .replace(/\[COMPANY_NAME\]/g, jInfo.company || job.company || 'Our Company')
          .replace(/\[COMPANY_EMAIL\]/g, hrInfo?.email || 'hr@company.com')
          .replace(/\[COMPANY_PHONE\]/g, hrInfo?.phone || '')
          .replace(/\[TEST_LINK\]/g, testLink)
          .replace(/\[TEST_DEADLINE\]/g, formatTestDeadlineForEmail(expiresAt))
          .replace(/\[TEST_DURATION\]/g, '2 hours');
        let subject = emailContent.subject.replace(/\[CANDIDATE_NAME\]/g, name);
        return {
          to: email,
          subject,
          body,
          candidateName: name,
          jobTitle: jInfo.jobTitle,
          company: jInfo.company,
        };
      })
      .filter(Boolean);

    const condolenceSubject = `Update on your application — ${jInfo.jobTitle || 'position'}`;
    const condolenceBodies = rest
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const body =
          `Dear ${name},\n\n` +
          `Thank you for your interest in the ${jInfo.jobTitle || 'role'} position at ${jInfo.company || 'our company'} and for the time you invested in your application.\n\n` +
          `After careful review, we will not be moving forward with your application at this stage. This decision is specific to the current opening and does not define your potential.\n\n` +
          `We genuinely encourage you to apply again for future roles that match your profile. Many strong candidates cross paths with us more than once.\n\n` +
          `Wishing you every success in your search.\n\n` +
          `Warm regards,\n${hrInfo?.name || 'The Hiring Team'}\n${jInfo.company || ''}`;
        return { to: email, subject: condolenceSubject, body, candidateName: name, jobTitle: jInfo.jobTitle, company: jInfo.company };
      })
      .filter(Boolean);

    await dispatchEmailBatch(testEmails, jInfo);
    if (condolenceBodies.length) {
      await dispatchEmailBatch(condolenceBodies, { ...jInfo, type: 'condolence_not_shortlisted' });
    }

    const now = new Date();
    await Application.updateMany(
      { _id: { $in: rest.map((a) => a._id) } },
      { $set: { condolenceNotShortlistedForTestSentAt: now } }
    );

    job.assessmentInviteSentAt = now;
    job.assessmentDeadline = testExpiresAt;
    job.hirePipelineStage = 'test_sent';
    await job.save();

    res.json({
      success: true,
      sentTestCount: testEmails.length,
      sentCondolenceCount: condolenceBodies.length,
      assessmentDeadline: testExpiresAt,
    });
  } catch (e) {
    console.error('sendTestInvitesTop50:', e);
    if (e.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Email service (n8n) unavailable.', details: e.message });
    }
    res.status(500).json({ error: e.message || 'Failed to send' });
  }
};
