const admin = require('../config/firebase');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Import GPT-4o model from llmController
let Bytez, sdk, model;
try {
  Bytez = require('bytez.js');
  const key = process.env.BYTEZ_API_KEY || "8357654868fcca0cb5158f6a591937c3";
  if (key) {
    sdk = new Bytez(key);
    model = sdk.model("openai/gpt-4o");
  }
} catch (error) {
  console.error('LLM functionality will not work until bytez.js is installed.');
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

// Check CV format using Python script
exports.checkCVFormat = [verifyToken, upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CV file uploaded' });
    }

    const cvPath = req.file.path;
    const pythonScriptPath = path.join(__dirname, '../services/cv_checker.py');
    const templatePath = path.join(__dirname, '../../CV_TEMPLATE.docx');

    // Call Python script to check CV format
    // Try python3 first, then python (for cross-platform compatibility)
    let pythonCommand = 'python3';
    try {
      await execPromise('python3 --version');
    } catch {
      pythonCommand = 'python';
    }
    
    try {
      const { stdout, stderr } = await execPromise(
        `${pythonCommand} "${pythonScriptPath}" "${cvPath}" "${templatePath}"`
      );

      if (stderr && !stderr.includes('Warning')) {
        console.error('Python script error:', stderr);
        // Clean up uploaded file
        fs.unlinkSync(cvPath);
        return res.status(500).json({ error: 'Failed to process CV' });
      }

      // Parse the JSON output from Python script
      const result = JSON.parse(stdout.trim());
      
      // Clean up uploaded file after processing
      fs.unlinkSync(cvPath);

      if (result.isValid) {
        res.json({
          isValid: true,
          extractedData: result.extractedData,
          message: 'CV format is valid'
        });
      } else {
        res.json({
          isValid: false,
          message: result.message || 'CV format does not match the template'
        });
      }
    } catch (error) {
      console.error('Python script execution error:', error);
      // Clean up uploaded file
      if (fs.existsSync(cvPath)) {
        fs.unlinkSync(cvPath);
      }
      return res.status(500).json({ error: 'Failed to process CV. Please ensure Python and required libraries are installed.' });
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

// Autofill CV using GPT-4o
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
      if (!model) {
        return res.status(503).json({ 
          error: 'LLM service not available. Please ensure bytez.js is installed and BYTEZ_API_KEY is set.' 
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
        console.error('No file in request:', {
          files: req.files,
          body: req.body,
          headers: req.headers
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

    const pythonScriptPath = path.join(__dirname, '../services/cv_checker.py');

    // Extract text from PDF using Python script
    let pythonCommand = 'python3';
    try {
      await execPromise('python3 --version');
    } catch {
      pythonCommand = 'python';
    }

    let cvText = '';
    try {
      // Use Python to extract text - create inline script
      // Convert Windows path to Python-friendly format
      const cvPathForPython = cvPathAbsolute.replace(/\\/g, '/');
      const servicesPath = path.join(__dirname, '../services').replace(/\\/g, '/');
      
      const pythonScript = `# -*- coding: utf-8 -*-
import sys
import os
import io

# Set UTF-8 encoding for stdout and stderr on Windows
if sys.platform == 'win32':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

# Add services directory to path
services_dir = r"${servicesPath}"
sys.path.insert(0, services_dir)
from cv_checker import extract_text_from_pdf
try:
    pdf_path = r"${cvPathForPython}"
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    text = extract_text_from_pdf(pdf_path)
    # Clean text and output with UTF-8 encoding
    if text:
        # Normalize and clean text, replacing problematic characters
        text_clean = text.encode('utf-8', errors='replace').decode('utf-8')
        # Write directly to stdout buffer to avoid encoding issues
        try:
            sys.stdout.buffer.write(text_clean.encode('utf-8'))
        except (AttributeError, ValueError):
            # Fallback to print if buffer write fails
            print(text_clean, end='', flush=True)
except Exception as e:
    error_msg = str(e).encode('utf-8', errors='replace').decode('utf-8')
    print(f"Error: {error_msg}", file=sys.stderr)
    sys.exit(1)
`;
      
      // Write to temp file with UTF-8 encoding
      const tempScript = path.join(__dirname, '../temp_extract.py');
      fs.writeFileSync(tempScript, pythonScript, 'utf8');
      
      const projectRoot = path.join(__dirname, '../..');
      // Set environment variable for UTF-8 encoding
      const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
      const { stdout, stderr } = await execPromise(
        `"${pythonCommand}" "${tempScript}"`,
        { 
          cwd: projectRoot,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large PDFs
          env: env
        }
      );
      
      // Clean up temp script
      try {
        if (fs.existsSync(tempScript)) {
          fs.unlinkSync(tempScript);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      
      if (stderr && !stderr.includes('Warning') && stderr.trim()) {
        console.error('Python stderr:', stderr);
        throw new Error(stderr);
      }
      
      cvText = stdout.trim();
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

    // Create prompt for GPT-4o to extract structured data
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
      const { error, output } = await model.run([
        {
          "role": "user",
          "content": prompt
        }
      ]);

      if (error) {
        console.error('GPT-4o Error:', error);
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
        console.error('Error parsing GPT-4o output:', parseError);
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

