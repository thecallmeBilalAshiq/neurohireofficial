const Bytez = require('bytez.js');

let sdk, model;

try {
  const key = process.env.BYTEZ_API_KEY;
  const modelId = process.env.BYTEZ_MODEL || 'openai/gpt-4o';
  if (key) {
    sdk = new Bytez(key);
    model = sdk.model(modelId);
  }
} catch (error) {
  console.error('LLM functionality will not work until bytez.js is installed.');
}

/**
 * Helper function to extract text from Bytez SDK output
 */
function extractOutputText(output) {
  if (typeof output === 'string') {
    return output;
  } else if (output && typeof output === 'object') {
    // Handle object response - try common properties
    if (output.content) {
      return typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
    } else if (output.text) {
      return typeof output.text === 'string' ? output.text : JSON.stringify(output.text);
    } else if (output.message) {
      return typeof output.message === 'string' ? output.message : JSON.stringify(output.message);
    } else if (Array.isArray(output)) {
      // If it's an array, join the content
      return output.map(item => {
        if (typeof item === 'string') return item;
        if (item && item.content) return item.content;
        return JSON.stringify(item);
      }).join('\n');
    } else {
      // Fallback: stringify the object
      return JSON.stringify(output, null, 2);
    }
  } else {
    return String(output || '');
  }
}

/**
 * Helper function to parse score from LLM output
 */
function parseScoreFromOutput(outputText, fieldName, allowDecimals = false) {
  try {
    // Clean up markdown code blocks if present
    let cleanedText = outputText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to find JSON object in the output
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        // Try different possible field names
        let score = 0;
        if (allowDecimals) {
          // For education, allow decimal values
          score = parseFloat(result.score) || parseFloat(result.Score) || parseFloat(result.SCORE) || 0;
        } else {
          // For other fields, use integer
          score = parseInt(result.score) || parseInt(result.Score) || parseInt(result.SCORE) || 0;
        }
        const finalScore = allowDecimals 
          ? Math.max(0, Math.min(10, Math.round(score * 10) / 10))  // Round to 1 decimal for education
          : Math.max(0, Math.min(10, score));  // Integer for others
        if (finalScore > 0 || fieldName === 'education') {
          console.log(`Successfully parsed ${fieldName} score:`, finalScore);
        }
        return finalScore;
      } catch (parseError) {
        console.error(`Error parsing JSON for ${fieldName}:`, parseError);
        console.error('JSON string:', jsonMatch[0].substring(0, 200));
      }
    }
    
    // Fallback: Try to extract number directly from text
    if (allowDecimals) {
      const decimalMatch = outputText.match(/\b([0-9]+\.[0-9]+|[0-9]|10)\b/);
      if (decimalMatch) {
        const score = parseFloat(decimalMatch[0]);
        const finalScore = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
        if (finalScore > 0 || fieldName === 'education') {
          console.log(`Extracted ${fieldName} score from text:`, finalScore);
        }
        return finalScore;
      }
    } else {
      const numberMatch = outputText.match(/\b([0-9]|10)\b/);
      if (numberMatch) {
        const score = parseInt(numberMatch[0]);
        const finalScore = Math.max(0, Math.min(10, score));
        if (finalScore > 0) {
          console.log(`Extracted ${fieldName} score from text:`, finalScore);
        }
        return finalScore;
      }
    }
    
    console.error(`Could not parse ${fieldName} score from output:`, outputText.substring(0, 300));
    return 0;
  } catch (error) {
    console.error(`Error parsing ${fieldName} score:`, error);
    return 0;
  }
}

/**
 * Score candidate's experience using LLM
 */
async function scoreExperience(experience, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  const prompt = `Rate the following candidate's experience on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the experience aligns with the job's needs, quality, recency, and depth.

Job Requirements: ${jobDescription}

Few-Shot Examples for Experience:
- Candidate Experience: "2 years as Junior Developer in PHP." Job Req: "5+ years in full-stack JavaScript." Score: 4 - The experience is in a different tech stack and too short, but shows basic development skills.
- Candidate Experience: "4 years in React and Node.js at a tech startup, led 2 projects." Job Req: "3+ years in React/Node.js with leadership." Score: 9 - Strong match in tech and duration, with relevant leadership adding value.
- Candidate Experience: "No experience listed." Job Req: "Any." Score: 0 - Complete lack of experience, no value added.

Now evaluate this candidate's experience: ${experience || 'No experience listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for experience scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for experience scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'experience');
  } catch (error) {
    console.error('Error scoring experience:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

/**
 * Score candidate's projects using LLM
 */
async function scoreProjects(projects, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  const prompt = `Rate the following candidate's projects on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the projects align with the job's needs, quality, recency, and depth.

Job Requirements: ${jobDescription}

Few-Shot Examples for Projects:
- Candidate Projects: "Personal blog using HTML." Job Req: "AI/ML projects." Score: 2 - Basic web project with no AI relevance, low complexity.
- Candidate Projects: "Built ML model for image recognition using Python." Job Req: "AI projects with real-world application." Score: 8 - Directly relevant to AI, demonstrates technical skills, but lacks deployment details.
- Candidate Projects: "None." Job Req: "Portfolio required." Score: 0 - No projects provided, zero alignment.

Now evaluate this candidate's projects: ${projects || 'No projects listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for projects scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for projects scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'projects');
  } catch (error) {
    console.error('Error scoring projects:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

/**
 * Score candidate's certificates using LLM
 */
async function scoreCertificates(certificates, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  const prompt = `Rate the following candidate's certificates on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the certificates align with the job's needs, quality, recency, and depth.

Job Requirements: ${jobDescription}

Few-Shot Examples for Certificates:
- Candidate Certificates: "High School Diploma." Job Req: "AWS Certified Developer." Score: 1 - Irrelevant to tech role, no professional value.
- Candidate Certificates: "AWS Solutions Architect and Google Cloud Associate." Job Req: "Cloud certifications like AWS or GCP." Score: 10 - Perfect match with high-quality, relevant certs from top providers.
- Candidate Certificates: "Empty." Job Req: "Optional but preferred." Score: 0 - No certificates, misses opportunity for bonus points.

Now evaluate this candidate's certificates: ${certificates || 'No certificates listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for certificates scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for certificates scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'certificates');
  } catch (error) {
    console.error('Error scoring certificates:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

/**
 * Score candidate's skills using LLM
 */
async function scoreSkills(candidateSkills, requiredSkills, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  // Convert skills to readable format
  let candidateSkillsText = '';
  if (Array.isArray(candidateSkills)) {
    candidateSkillsText = candidateSkills.join(', ');
  } else if (typeof candidateSkills === 'string') {
    candidateSkillsText = candidateSkills;
  } else {
    candidateSkillsText = '';
  }

  const requiredSkillsText = Array.isArray(requiredSkills) 
    ? requiredSkills.join(', ') 
    : (requiredSkills || '');

  const prompt = `Rate the following candidate's skills on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the candidate's skills match the required skills listed. Check what skills are required and what skills the candidate has, then calculate a score based on the match percentage and quality.

Job Requirements: ${jobDescription}

Required Skills: ${requiredSkillsText || 'Not specified'}

Few-Shot Examples for Skills:
- Candidate Skills: "HTML, CSS." Required Skills: "React, Node.js, Python." Score: 2 - Basic web skills but missing all required technologies, very low match.
- Candidate Skills: "React, Node.js, Python, MongoDB." Required Skills: "React, Node.js, Python, MongoDB." Score: 10 - Perfect match with all required skills (100% match).
- Candidate Skills: "JavaScript, React, Express." Required Skills: "React, Node.js, TypeScript." Score: 7 - Good overlap with React (exact match) and JavaScript/Express (similar to Node.js), but missing TypeScript (about 66% match).
- Candidate Skills: "Python, Django, MySQL." Required Skills: "Python, Flask, PostgreSQL." Score: 6 - Has Python (exact match) and similar frameworks/databases, but not exact matches (about 60% match).

Scoring Guidelines:
- 10: All required skills match perfectly
- 8-9: Most required skills match (80-90%)
- 6-7: Many required skills match or similar equivalents (60-70%)
- 4-5: Some required skills match (40-50%)
- 2-3: Few required skills match (20-30%)
- 0-1: No relevant skills or very minimal match (0-10%)

Now evaluate this candidate's skills: ${candidateSkillsText || 'No skills listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for skills scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for skills scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'skills');
  } catch (error) {
    console.error('Error scoring skills:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

/**
 * Score candidate's languages using LLM
 */
async function scoreLanguages(languages, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  // Handle languages as array or string
  let languagesText = '';
  if (Array.isArray(languages)) {
    languagesText = languages.join(', ');
  } else if (typeof languages === 'string') {
    languagesText = languages;
  } else {
    languagesText = '';
  }

  const prompt = `Rate the following candidate's languages on a scale of 0-10 for relevance and value to the job requirements provided below. Score based on how well the languages align with the job's needs, number of languages, and proficiency levels.

Job Requirements: ${jobDescription}

Few-Shot Examples for Languages:
- Candidate Languages: "English (Basic)". Job Req: "English fluency required." Score: 3 - Basic English may not meet fluency requirement, limited value.
- Candidate Languages: "English (Fluent), Urdu (Native), Spanish (Conversational)". Job Req: "Multilingual preferred, English required." Score: 9 - Multiple languages including required English, high value for international roles.
- Candidate Languages: "English (Native), French (Fluent)". Job Req: "English required, French preferred." Score: 10 - Perfect match with both required and preferred languages at high proficiency.
- Candidate Languages: "None listed." Job Req: "English required." Score: 0 - No languages listed, cannot assess.

Scoring Guidelines:
- 10: All required languages at high proficiency (Native/Fluent)
- 8-9: Required languages present, multiple languages, good proficiency
- 6-7: Required languages present but basic proficiency, or some relevant languages
- 4-5: Some relevant languages but missing required ones, or very basic proficiency
- 2-3: Limited languages, low proficiency, or minimal relevance
- 0-1: No languages listed or completely irrelevant

Now evaluate this candidate's languages: ${languagesText || 'No languages listed'}

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <integer between 0 and 10>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for languages scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for languages scoring:', outputText.substring(0, 200));
    
    return parseScoreFromOutput(outputText, 'languages');
  } catch (error) {
    console.error('Error scoring languages:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

/**
 * Score candidate's education using LLM
 */
async function scoreEducation(education, jobDescription) {
  if (!model) {
    throw new Error('LLM service not available');
  }

  // Handle education as object or string
  let educationText = '';
  let university = '';
  let degree = '';
  let dateOfCompletion = '';
  let cgpa = '';
  
  if (education && typeof education === 'object') {
    university = education.university || '';
    degree = education.degree || '';
    dateOfCompletion = education.dateOfCompletion || '';
    cgpa = education.cgpa || '';
    educationText = `${university} - ${degree} (${dateOfCompletion})`;
    // If CGPA is in the education object, use it directly
    if (!cgpa) {
      // Fallback: Try to extract CGPA from degree or other fields
      const fullText = JSON.stringify(education);
      const cgpaMatch = fullText.match(/[Cc][Gg][Pp][Aa][\s:]*([0-9]+\.[0-9]+|[0-9]+)/);
      if (cgpaMatch) {
        cgpa = cgpaMatch[1];
      }
    }
  } else {
    educationText = education || 'No education listed';
    // Try to extract university and CGPA from text
    const cgpaMatch = educationText.match(/[Cc][Gg][Pp][Aa][\s:]*([0-9]+\.[0-9]+|[0-9]+)/);
    if (cgpaMatch) {
      cgpa = cgpaMatch[1];
    }
  }

  const prompt = `Evaluate the following candidate's education and calculate a score out of 10 using the exact criteria below.

Candidate Education: ${educationText}
${cgpa ? `CGPA: ${cgpa}` : ''}

Job Requirements: ${jobDescription}

SCORING CRITERIA (Total: 40 points, converted to 10-point scale):

[1] University Evaluation (25 points):
- Top 500 Institutes (globally ranked) = 25 points
- FAST, NUST, GIKI, LUMS = 20 points
- COMSATS, ITU, PIEAS = 15 points
- AIR, BAHRIA, IIUI, QA, IQRA, PU, UCP = 10 points
- Other universities = 5 points

[2] CGPA Evaluation (15 points):
- CGPA >= 3.8 = 15 points
- CGPA >= 3.5 = 13 points
- CGPA >= 3.0 = 10 points
- CGPA >= 2.5 = 5 points
- CGPA < 2.5 = 0 points

CALCULATION STEPS:
1. Determine university score (0-25 points) based on the university name
2. Determine CGPA score (0-15 points) based on CGPA value. If CGPA is not provided, use 0 points.
3. Total raw score = university_score + cgpa_score (max 40 points)
4. Convert to 10-point scale: final_score = (total_raw_score / 40) * 10
5. Round to 1 decimal place

EXAMPLES:
- University: "NUST" (20 points), CGPA: 3.6 (13 points) → Raw: 33 → Final: (33/40)*10 = 8.25
- University: "COMSATS" (15 points), CGPA: 3.2 (10 points) → Raw: 25 → Final: (25/40)*10 = 6.25
- University: "Other University" (5 points), CGPA: 2.4 (0 points) → Raw: 5 → Final: (5/40)*10 = 1.25
- University: "FAST" (20 points), CGPA: 3.9 (15 points) → Raw: 35 → Final: (35/40)*10 = 8.75

IMPORTANT INSTRUCTIONS:
- Identify the university name from the candidate's education text
- Extract CGPA if mentioned (look for "CGPA", "GPA", or grade point patterns)
- If CGPA is not found, assign 0 points for CGPA
- Apply the exact university rankings listed above
- Calculate the final score using the formula: (university_score + cgpa_score) / 40 * 10

IMPORTANT: You must return ONLY a valid JSON object in this exact format with no additional text:
{"score": <number between 0 and 10, with 1 decimal place>}`;

  try {
    const { error, output } = await model.run([
      { role: "user", content: prompt }
    ]);

    if (error) {
      console.error('LLM Error for education scoring:', error);
      return 0;
    }

    const outputText = extractOutputText(output);
    console.log('Raw output for education scoring:', outputText.substring(0, 200));
    
    // Allow decimal values for education score
    return parseScoreFromOutput(outputText, 'education', true);
  } catch (error) {
    console.error('Error scoring education:', error);
    console.error('Error stack:', error.stack);
    return 0;
  }
}

/**
 * Calculate total weighted score
 */
function calculateTotalScore(scores, weightage) {
  if (!weightage || typeof weightage !== 'object') {
    // Default weights if not provided
    weightage = {
      skills: 40,
      experience: 30,
      education: 20,
      projects: 15,
      certificates: 5
    };
  }

  // Normalize weights to sum to 100
  // Weightage may use 'skills', 'experience', 'education', 'projects', 'certificates', 'languages'
  const totalWeight = (weightage.skills || 0) + (weightage.experience || 0) + 
                     (weightage.education || 0) + (weightage.projects || 0) + 
                     (weightage.certificates || 0) + (weightage.languages || 0);
  
  if (totalWeight === 0) {
    // Use default weights if not provided
    weightage = {
      skills: 35,
      experience: 25,
      education: 20,
      projects: 12,
      certificates: 5,
      languages: 3
    };
  } else if (totalWeight !== 100) {
    // Normalize to 100 if sum is not 100
    const factor = 100 / totalWeight;
    weightage = {
      skills: (weightage.skills || 0) * factor,
      experience: (weightage.experience || 0) * factor,
      education: (weightage.education || 0) * factor,
      projects: (weightage.projects || 0) * factor,
      certificates: (weightage.certificates || 0) * factor,
      languages: (weightage.languages || 0) * factor
    };
  }

  const totalScore = 
    (scores.skills * ((weightage.skills || 0) / 100)) +
    (scores.experience * ((weightage.experience || 0) / 100)) +
    (scores.education * ((weightage.education || 0) / 100)) +
    (scores.projects * ((weightage.projects || 0) / 100)) +
    (scores.certificates * ((weightage.certificates || 0) / 100)) +
    (scores.languages * ((weightage.languages || 0) / 100));

  return Math.round(totalScore * 10) / 10; // Round to 1 decimal place
}

/**
 * Score a candidate application
 */
async function scoreCandidate(application, jobPost) {
  try {
    console.log('Starting scoring for application:', application._id);
    console.log('Job Post:', jobPost._id, jobPost.jobTitle);
    
    // Build comprehensive job description
    const jobDescriptionParts = [];
    if (jobPost.generatedDescription) jobDescriptionParts.push(jobPost.generatedDescription);
    if (jobPost.description) jobDescriptionParts.push(jobPost.description);
    if (jobPost.keyResponsibilities) jobDescriptionParts.push(`Key Responsibilities: ${jobPost.keyResponsibilities}`);
    if (jobPost.skills && jobPost.skills.length > 0) {
      jobDescriptionParts.push(`Required Skills: ${jobPost.skills.join(', ')}`);
    }
    if (jobPost.experience) {
      jobDescriptionParts.push(`Required Experience: ${jobPost.experience} years`);
    }
    if (jobPost.education && jobPost.education.length > 0) {
      jobDescriptionParts.push(`Required Education: ${jobPost.education.join(', ')}`);
    }
    
    const jobDescription = jobDescriptionParts.join('\n\n') || 'No job description available';
    
    console.log('Job description length:', jobDescription.length);
    
    // Get candidate data - prefer extractedData over formData
    const candidateData = application.extractedData || application.formData || {};
    console.log('Candidate data keys:', Object.keys(candidateData));
    
    const experience = candidateData.experience || '';
    let projects = candidateData.projects || '';
    // If no projects field, use experience as fallback
    if (!projects && experience) {
      projects = experience;
    }
    const certificates = candidateData.certificates || '';
    const education = candidateData.education || '';
    
    // Handle skills - could be array or string
    let skills = candidateData.skills || '';
    if (!skills && candidateData.skills === '') {
      skills = '';
    }
    
    // Handle languages - could be array or string
    let languages = candidateData.languages || [];
    if (typeof languages === 'string' && languages) {
      languages = languages.split(',').map(l => l.trim()).filter(l => l);
    } else if (!Array.isArray(languages)) {
      languages = [];
    }
    
    const requiredSkills = jobPost.skills || [];

    console.log('Scoring components:');
    console.log('- Experience:', experience ? experience.substring(0, 50) + '...' : 'empty');
    console.log('- Projects:', projects ? projects.substring(0, 50) + '...' : 'empty');
    console.log('- Skills:', skills);
    console.log('- Languages:', languages);
    console.log('- Certificates:', certificates ? certificates.substring(0, 50) + '...' : 'empty');
    console.log('- Education:', education);
    console.log('- Required Skills:', requiredSkills);

    // Check if model is available
    if (!model) {
      console.error('LLM model not available');
      throw new Error('LLM service not available');
    }

    // Score each component with better error handling
    console.log('Starting to score experience...');
    const experienceScore = await scoreExperience(experience, jobDescription);
    console.log('Experience score:', experienceScore);
    
    console.log('Starting to score projects...');
    const projectsScore = await scoreProjects(projects || experience, jobDescription);
    console.log('Projects score:', projectsScore);
    
    console.log('Starting to score skills...');
    const skillsScore = await scoreSkills(skills, requiredSkills, jobDescription);
    console.log('Skills score:', skillsScore);
    
    console.log('Starting to score certificates...');
    const certificatesScore = await scoreCertificates(certificates, jobDescription);
    console.log('Certificates score:', certificatesScore);
    
    console.log('Starting to score education...');
    const educationScore = await scoreEducation(education, jobDescription);
    console.log('Education score:', educationScore);
    
    console.log('Starting to score languages...');
    const languagesScore = await scoreLanguages(languages, jobDescription);
    console.log('Languages score:', languagesScore);

    const scores = {
      experience: experienceScore,
      projects: projectsScore,
      skills: skillsScore,
      certificates: certificatesScore,
      education: educationScore,
      languages: languagesScore
    };

    // Calculate total score using job weightage
    console.log('Job weightage:', jobPost.weightage);
    scores.total = calculateTotalScore(scores, jobPost.weightage);
    console.log('Total score:', scores.total);

    console.log('Final scores:', scores);
    return scores;
  } catch (error) {
    console.error('Error scoring candidate:', error);
    console.error('Error stack:', error.stack);
    // Return zero scores on error
    return {
      experience: 0,
      projects: 0,
      skills: 0,
      certificates: 0,
      education: 0,
      languages: 0,
      total: 0
    };
  }
}

module.exports = {
  scoreCandidate,
  scoreExperience,
  scoreProjects,
  scoreCertificates,
  scoreSkills,
  scoreEducation,
  scoreLanguages,
  calculateTotalScore
};

