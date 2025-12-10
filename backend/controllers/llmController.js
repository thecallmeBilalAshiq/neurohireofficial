const dotenv = require('dotenv');
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

// Generate job description from form data
exports.generateJobDescription = async (req, res) => {
  try {
    if (!model) {
      return res.status(503).json({ 
        error: 'LLM service not available. Please ensure bytez.js is installed and BYTEZ_API_KEY is set.' 
      });
    }

    const { jobData, previousDescription, editInstructions } = req.body;

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

    const { error, output } = await model.run([
      {
        "role": "user",
        "content": prompt
      }
    ]);

    if (error) {
      console.error('LLM Error:', error);
      
      // Handle specific error types
      if (error.message && error.message.includes('Unauthorized')) {
        return res.status(401).json({ 
          error: 'API key is invalid or expired. Please check your BYTEZ_API_KEY.' 
        });
      }
      
      return res.status(500).json({ 
        error: error.message || 'Failed to generate job description',
        details: error 
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

