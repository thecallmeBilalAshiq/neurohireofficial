const admin = require('../config/firebase');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const pdfParse = require('pdf-parse');

const {
  isLlmAvailable,
  runLlm,
  LLM_UNAVAILABLE_MSG,
} = require('../services/openRouterService');

// Helper function to validate CV structure natively in JavaScript
function validateCvStructure(cvText) {
  const cvLower = cvText.toLowerCase();
  
  const hasName = ['name', 'full name', 'candidate'].some(keyword => cvLower.includes(keyword));
  const hasEmail = cvText.includes('@') || cvLower.includes('email');
  const hasPhone = ['phone', 'mobile', 'contact', 'tel'].some(keyword => cvLower.includes(keyword));
  const hasEducation = ['education', 'qualification', 'degree', 'university'].some(keyword => cvLower.includes(keyword));
  const hasExperience = ['experience', 'work', 'employment', 'career'].some(keyword => cvLower.includes(keyword));
  
  return hasName && hasEmail && hasPhone && hasEducation && hasExperience;
}

// Helper function to extract basic info natively in JavaScript
function extractBasicInfo(cvText) {
  const data = {};
  
  // Extract email
  const emailMatch = cvText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    data.email = emailMatch[0];
  }
  
  // Extract phone
  const phoneMatch = cvText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    data.phone = phoneMatch[0];
  }
  
  // Extract name
  const nameMatch = cvText.match(/(?:name|full name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (nameMatch) {
    data.name = nameMatch[1];
  } else {
    const firstLine = cvText.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length < 50) {
      data.name = firstLine;
    }
  }
  
  // Extract education
  const educationMatch = cvText.match(/(?:education|qualification)[:\s]+([\s\S]*?)(?:\n\s*\n|\n\s*(?:experience|work|skills|projects|languages))/i);
  if (educationMatch) {
    data.education = educationMatch[1].trim();
  }
  
  // Extract experience
  const experienceMatch = cvText.match(/(?:experience|work history|employment)[:\s]+([\s\S]*?)(?:\n\s*\n|\n\s*(?:skills|projects|education|languages))/i);
  if (experienceMatch) {
    data.experience = experienceMatch[1].trim();
  }
  
  // Extract skills
  const skillsMatch = cvText.match(/(?:skills|technical skills)[:\s]+([\s\S]*?)(?:\n\s*\n|\n\s*(?:languages|projects|education|experience))/i);
  if (skillsMatch) {
    data.skills = skillsMatch[1].trim();
  }
  
  // Extract languages
  const languagesMatch = cvText.match(/(?:languages|language)[:\s]+([\s\S]*?)(?:\n\s*\n|\n\s*(?:projects|education|experience|skills))/i);
  if (languagesMatch) {
    data.languages = languagesMatch[1].trim();
  }
  
  // Extract projects
  const projectsMatch = cvText.match(/(?:projects|project)[:\s]+([\s\S]*?)(?:\n\s*\n|\n\s*(?:education|experience|skills|languages))/i);
  if (projectsMatch) {
    data.projects = projectsMatch[1].trim();
  }
  
  return data;
}

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

// Configure multer for file uploads
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

// Check CV format using Node native PDF parser
exports.checkCVFormat = [verifyToken, upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CV file uploaded' });
    }

    const cvPath = req.file.path;
    const cvPathAbsolute = path.resolve(cvPath);

    if (!fs.existsSync(cvPathAbsolute)) {
      return res.status(400).json({ error: 'Uploaded CV file not found' });
    }

    try {
      const dataBuffer = fs.readFileSync(cvPathAbsolute);
      const data = await pdfParse(dataBuffer);
      const cvText = data.text;

      // Clean up uploaded file after reading
      fs.unlinkSync(cvPathAbsolute);

      if (!cvText || cvText.trim().length < 10) {
        return res.json({
          isValid: false,
          message: 'CV file appears to be empty or could not be read. Please ensure the PDF contains text.'
        });
      }

      // Check structure using JS helper
      const hasRequired = validateCvStructure(cvText);

      if (hasRequired) {
        const extractedData = extractBasicInfo(cvText);
        res.json({
          isValid: true,
          extractedData: extractedData,
          message: 'CV format is valid'
        });
      } else {
        res.json({
          isValid: false,
          message: 'CV is missing required sections (Name, Email, Phone, Education, and Experience). Please use the provided template.'
        });
      }
    } catch (error) {
      console.error('Error processing CV format:', error);
      if (fs.existsSync(cvPathAbsolute)) {
        fs.unlinkSync(cvPathAbsolute);
      }
      return res.status(500).json({ error: 'Failed to process CV. Please check if the PDF contains valid readable text.' });
    }
  } catch (error) {
    console.error('Check CV format error:', error);
    res.status(500).json({ error: error.message || 'Failed to check CV format' });
  }
}];

// Download CV template
exports.downloadCVTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../../CV_TEMPLATE.docx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'CV template not found' });
    }

    res.download(templatePath, 'CV-Template.docx', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download template' });
      }
    });
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({ error: error.message || 'Failed to download template' });
  }
};

// Autofill CV using OpenRouter LLM
exports.autofillCV = [
  verifyToken, 
  (req, res, next) => {
    // Multer error handler
    upload.single('cv')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (err.message === 'Only PDF files are allowed') {
          return res.status(400).json({ error: 'Only PDF files are allowed' });
        }
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!isLlmAvailable()) {
        return res.status(503).json({ 
          error: LLM_UNAVAILABLE_MSG
        });
      }

      // Debug logging
      console.log('Request received:', {
        hasFile: !!req.file,
        fileField: req.file?.fieldname,
        fileName: req.file?.originalname,
        bodyKeys: Object.keys(req.body || {}),
        contentType: req.headers['content-type']
      });

      if (!req.file) {
        const safeHeaders = { ...req.headers };
        ['authorization', 'cookie', 'x-api-key', 'token', 'x-auth-token', 'proxy-authorization'].forEach(h => delete safeHeaders[h]);
        console.error('No file in request:', {
          files: req.files,
          body: req.body,
          headers: safeHeaders
        });
        return res.status(400).json({ error: 'No CV file uploaded. Please ensure you are uploading a PDF file.' });
      }

    const cvPath = req.file.path;
    // Convert to absolute path
    const cvPathAbsolute = path.resolve(cvPath);
    
    // Verify file exists
    if (!fs.existsSync(cvPathAbsolute)) {
      return res.status(400).json({ error: 'Uploaded CV file not found' });
    }

    let cvText = '';
    try {
      const dataBuffer = fs.readFileSync(cvPathAbsolute);
      const data = await pdfParse(dataBuffer);
      cvText = data.text;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      // Clean up uploaded file
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(500).json({ error: 'Failed to extract text from CV. Please ensure the PDF contains readable text.' });
    }

    if (!cvText || cvText.length < 10) {
      // Clean up uploaded file
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(400).json({ error: 'CV file appears to be empty or could not be read' });
    }

    // Create prompt for the LLM to extract structured data
    const prompt = `You are a professional CV parser. Extract the following information from the CV text provided below and return ONLY a valid JSON object with the following structure. If any field is not found, use an empty string "" or empty array [].

Required JSON structure:
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "address": "string",
  "education": {
    "university": "string",
    "degree": "string",
    "dateOfCompletion": "string",
    "cgpa": "string"
  },
  "experience": "string",
  "projects": "string",
  "skills": ["skill1", "skill2", "skill3"],
  "languages": ["language1", "language2"],
  "certificates": "string"
}

Instructions:
1. Extract firstName and lastName from the name field (split if needed)
2. Extract email address
3. Extract phone number (any format)
4. Extract address if available
5. Extract education details as nested object with:
   - university: name of the institution (e.g., "MIT", "Stanford University", "NUST", "FAST")
   - degree: degree name/type (e.g., "Bachelor of Science in Computer Science", "Master's in Data Science")
   - dateOfCompletion: date or year of completion (e.g., "2020", "May 2020", "2020-05")
   - cgpa: CGPA or GPA value if mentioned (e.g., "3.8", "3.75", "4.0"). Extract the numeric value only (with decimal point if applicable). If not found, use empty string ""
   If multiple degrees, extract the most recent/highest one
   IMPORTANT: Education must be returned as a nested object with these exact field names: university, degree, dateOfCompletion, cgpa
6. Extract work experience (companies, roles, duration, responsibilities) as a string
7. Extract projects (personal projects, academic projects, portfolio projects) as a string. Include project names, descriptions, technologies used, and outcomes if available
8. Extract skills as an array of strings (technical skills, soft skills). Skills in the CV are usually comma-separated, so split them into individual array elements. For example: "Python, JavaScript, React" should become ["Python", "JavaScript", "React"]
9. Extract languages as an array of strings (e.g., ["English", "Urdu", "Spanish"]). Include proficiency levels if mentioned (e.g., "English (Fluent)", "Spanish (Basic)")
10. Extract certificates and certifications as a string
11. If a field is not found, use empty string "" for strings, empty object {} for education, or empty array [] for skills/languages
12. Return ONLY the JSON object, no additional text or explanation

CRITICAL: Invalid CV Detection
- If the provided text is NOT a valid CV (e.g., random text, corrupted content, non-CV document, insufficient information, or clearly not a resume/CV), you MUST return an empty JSON object: {}
- A valid CV should contain at least basic personal information (name, email, or phone) and some professional/educational content
- If the text appears to be a CV but is missing critical information and cannot be properly parsed, return an empty JSON object: {}
- Only return structured data if you can confidently extract meaningful information from a legitimate CV document

CV Text:
${cvText.substring(0, 8000)}`;

    try {
      const { error, output } = await runLlm([
        {
          "role": "user",
          "content": prompt
        }
      ]);

      if (error) {
        console.error('LLM Error:', error);
        // Clean up uploaded file
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
        return res.status(500).json({ 
          error: 'Failed to process CV with AI. Please try again.' 
        });
      }

      // Extract JSON from output
      let extractedData = {};
      let outputText = '';
      
      if (typeof output === 'string') {
        outputText = output;
      } else if (output && typeof output === 'object') {
        if (output.content) {
          outputText = typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
        } else if (output.text) {
          outputText = typeof output.text === 'string' ? output.text : JSON.stringify(output.text);
        } else {
          outputText = JSON.stringify(output);
        }
      } else {
        outputText = String(output || '');
      }

      // Try to extract JSON from the output
      try {
        // Remove markdown code blocks if present
        outputText = outputText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Try to find JSON object in the output
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          extractedData = JSON.parse(outputText);
        }
      } catch (parseError) {
        console.error('Error parsing LLM output:', parseError);
        console.error('Output text:', outputText);
        // Clean up uploaded file
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
        return res.status(500).json({ 
          error: 'Failed to parse extracted data. Please try again.' 
        });
      }

      // Check if extracted data is empty (invalid CV)
      // If the LLM returned an empty object or all fields are empty/missing, treat as invalid CV
      const isEmpty = !extractedData || 
        Object.keys(extractedData).length === 0 ||
        (
          (!extractedData.firstName || extractedData.firstName === '') &&
          (!extractedData.lastName || extractedData.lastName === '') &&
          (!extractedData.email || extractedData.email === '') &&
          (!extractedData.phone || extractedData.phone === '') &&
          (!extractedData.address || extractedData.address === '') &&
          (!extractedData.experience || extractedData.experience === '') &&
          (!extractedData.projects || extractedData.projects === '') &&
          (!extractedData.skills || (Array.isArray(extractedData.skills) && extractedData.skills.length === 0)) &&
          (!extractedData.languages || (Array.isArray(extractedData.languages) && extractedData.languages.length === 0)) &&
          (!extractedData.education || 
            (typeof extractedData.education === 'object' && 
             (!extractedData.education.university || extractedData.education.university === '') &&
             (!extractedData.education.degree || extractedData.education.degree === ''))) &&
          (!extractedData.certificates || extractedData.certificates === '')
        );

      if (isEmpty) {
        // Clean up uploaded file
        if (fs.existsSync(cvPath)) {
          fs.unlinkSync(cvPath);
        }
        // Return empty JSON to indicate invalid CV
        return res.json({
          success: true,
          extractedData: {}
        });
      }

      // Validate and set defaults for required fields
      // Handle education as object or string
      let educationData = extractedData.education || {};
      
      // Ensure education is an object with proper structure
      if (typeof educationData === 'string' && educationData) {
        // Try to parse if it's a JSON string
        try {
          educationData = JSON.parse(educationData);
        } catch {
          // If not JSON, create object with the string as degree
          educationData = { degree: educationData, university: '', dateOfCompletion: '', cgpa: '' };
        }
      }
      
      // Ensure education object has all required fields
      if (typeof educationData !== 'object' || educationData === null) {
        educationData = {};
      }
      if (!educationData.university) educationData.university = '';
      if (!educationData.degree) educationData.degree = '';
      if (!educationData.dateOfCompletion) educationData.dateOfCompletion = '';
      if (!educationData.cgpa) educationData.cgpa = '';
      
      // Handle skills as array or string
      let skillsData = extractedData.skills || [];
      if (typeof skillsData === 'string' && skillsData) {
        // Split by comma if it's a string
        skillsData = skillsData.split(',').map(s => s.trim()).filter(s => s);
      } else if (!Array.isArray(skillsData)) {
        skillsData = [];
      }

      // Handle languages as array or string
      let languagesData = extractedData.languages || [];
      if (typeof languagesData === 'string' && languagesData) {
        // Split by comma if it's a string
        languagesData = languagesData.split(',').map(l => l.trim()).filter(l => l);
      } else if (!Array.isArray(languagesData)) {
        languagesData = [];
      }

      const result = {
        firstName: extractedData.firstName || '',
        lastName: extractedData.lastName || '',
        email: extractedData.email || '',
        phone: extractedData.phone || '',
        address: extractedData.address || '',
        education: educationData,
        experience: extractedData.experience || '',
        projects: extractedData.projects || '',
        skills: skillsData,
        languages: languagesData,
        certificates: extractedData.certificates || ''
      };

      // Clean up uploaded file after processing
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }

      res.json({
        success: true,
        extractedData: result
      });

    } catch (error) {
      console.error('Autofill CV error:', error);
      // Clean up uploaded file
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(500).json({ 
        error: 'Failed to process CV. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Autofill CV error:', error);
    res.status(500).json({ error: error.message || 'Failed to autofill CV' });
  }
}];

// Export upload middleware for use in routes
exports.upload = upload;

