"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { toast } from "react-toastify";
import { getJobPosts, createJobPost, updateJobPost, deleteJobPost, getJobPostById, generateJobDescription, postToSocialMedia, generateAIImage, checkAIImageResult, getCompanyInfo, updateCompanyInfo } from "../../../lib/api";
import config from "../../../lib/config";

function JobPostingContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMenuItems, setShowMenuItems] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [errors, setErrors] = useState([]);

  // Load dark mode preference from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  // Save dark mode preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Load errors from localStorage on mount
  useEffect(() => {
    const savedErrors = localStorage.getItem('systemErrors');
    if (savedErrors) {
      try {
        setErrors(JSON.parse(savedErrors));
      } catch (e) {
        console.error('Error parsing saved errors:', e);
      }
    }

    // Listen for errors from API interceptor
    const handleError = (event) => {
      const errorData = event.detail;
      const newError = {
        id: Date.now(),
        message: errorData.message || 'An error occurred',
        type: errorData.type || 'error',
        timestamp: new Date().toISOString(),
        source: errorData.source || 'System',
        status: errorData.status
      };
      setErrors(prev => {
        const updated = [newError, ...prev].slice(0, 50);
        localStorage.setItem('systemErrors', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('systemError', handleError);
    return () => window.removeEventListener('systemError', handleError);
  }, []);

  const [jobPosts, setJobPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJobPost, setEditingJobPost] = useState(null);
  const [idToken, setIdToken] = useState(null);
  // LLM Modal states
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showEditFeedback, setShowEditFeedback] = useState(false);
  const [editFeedback, setEditFeedback] = useState("");
  const [pendingJobData, setPendingJobData] = useState(null);
  const [showTemplateSelection, setShowTemplateSelection] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeneratingAIImage, setIsGeneratingAIImage] = useState(false);
  const [aiGeneratedImageUrl, setAiGeneratedImageUrl] = useState(null);
  const [showAIImagePreview, setShowAIImagePreview] = useState(false);
  const [aiImageBase64, setAiImageBase64] = useState(null);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regenerateDescription, setRegenerateDescription] = useState("");
  const [aiImageTaskId, setAiImageTaskId] = useState(null);
  const [isPollingForImage, setIsPollingForImage] = useState(false);
  // Autocomplete suggestions
  const jobTitleSuggestions = [
    "Software Engineer", "Senior Software Engineer", "Full Stack Developer",
    "Frontend Developer", "Backend Developer", "DevOps Engineer", "Data Scientist",
    "Machine Learning Engineer", "Product Manager", "Project Manager",
    "UI/UX Designer", "Graphic Designer", "Marketing Manager", "Sales Manager",
    "HR Manager", "Accountant", "Business Analyst", "Quality Assurance Engineer"
  ];
  
  const educationSuggestions = [
    "High School Diploma", "Associate's Degree", "Bachelor's Degree",
    "Master's Degree", "PhD", "Bachelor's in Computer Science",
    "Bachelor's in Engineering", "Bachelor's in Business Administration",
    "Master's in Computer Science", "Master's in Business Administration",
    "Bachelor's in Information Technology", "Bachelor's in Data Science"
  ];
  
  const skillsSuggestions = [
    "JavaScript", "Python", "Java", "React", "Node.js", "Angular", "Vue.js",
    "SQL", "MongoDB", "PostgreSQL", "AWS", "Docker", "Kubernetes", "Git",
    "HTML", "CSS", "TypeScript", "C++", "C#", "PHP", "Ruby", "Go", "Swift",
    "Machine Learning", "Deep Learning", "Data Analysis", "Project Management",
    "Agile", "Scrum", "Communication", "Leadership", "Problem Solving"
  ];

  const languageSuggestions = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese", "Dutch",
    "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Russian", "Turkish",
    "Polish", "Swedish", "Norwegian", "Danish", "Finnish", "Greek", "Hebrew",
    "Mandarin", "Cantonese", "Urdu", "Bengali", "Tamil", "Telugu", "Marathi"
  ];

  const countrySuggestions = [
    "United States", "Canada", "United Kingdom", "Australia", "Germany",
    "France", "Italy", "Spain", "Netherlands", "Belgium", "Switzerland",
    "Sweden", "Norway", "Denmark", "Finland", "Poland", "Portugal",
    "Ireland", "Austria", "Greece", "Czech Republic", "Romania", "Hungary",
    "India", "China", "Japan", "South Korea", "Singapore", "Malaysia",
    "Thailand", "Philippines", "Indonesia", "Vietnam", "Taiwan", "Hong Kong",
    "United Arab Emirates", "Saudi Arabia", "Israel", "Turkey", "South Africa",
    "Brazil", "Mexico", "Argentina", "Chile", "Colombia", "Peru", "New Zealand"
  ];

  const citySuggestions = [
    // United States
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "San Francisco", "Columbus", "Fort Worth", "Charlotte", "Seattle", "Denver",
    "Washington", "Boston", "El Paso", "Detroit", "Nashville", "Portland",
    // Canada
    "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa",
    "Winnipeg", "Quebec City", "Hamilton", "Kitchener",
    // United Kingdom
    "London", "Manchester", "Birmingham", "Glasgow", "Liverpool", "Leeds",
    "Edinburgh", "Bristol", "Cardiff", "Belfast",
    // Australia
    "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast",
    // Germany
    "Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart",
    // Other major cities
    "Paris", "Rome", "Madrid", "Amsterdam", "Brussels", "Vienna", "Zurich",
    "Stockholm", "Copenhagen", "Oslo", "Dublin", "Warsaw", "Prague", "Budapest",
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune",
    "Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Tokyo", "Osaka", "Seoul",
    "Singapore", "Kuala Lumpur", "Bangkok", "Manila", "Jakarta", "Ho Chi Minh City",
    "Dubai", "Abu Dhabi", "Riyadh", "Tel Aviv", "Istanbul", "Cairo", "Johannesburg",
    "São Paulo", "Rio de Janeiro", "Buenos Aires", "Mexico City", "Santiago", "Bogotá",
    "Auckland", "Wellington"
  ];

  const candidateLocationSuggestions = [
    // Common preferences
    "Same City", "Same Country", "Same Region", "Same State", "Same Province",
    "Remote", "Hybrid", "On-site", "Anywhere", "Worldwide",
    // Specific regions
    "North America", "South America", "Europe", "Asia", "Africa", "Oceania",
    "Middle East", "Southeast Asia", "Eastern Europe", "Western Europe",
    // Countries (from countrySuggestions)
    ...countrySuggestions,
    // Major cities (from citySuggestions - top cities)
    "New York", "Los Angeles", "London", "Toronto", "Sydney", "Berlin",
    "Paris", "Tokyo", "Singapore", "Dubai", "Mumbai", "Bangalore"
  ];

  const [formData, setFormData] = useState({
    company: "", // Company name first
    officialEmail: "", // Official Email (optional)
    websiteUrl: "", // Website URL (optional)
    contactNo: "", // Contact No (optional)
    location: {
      country: "",
      city: "",
      province: "",
      address: "", // Optional street address
    },
    jobTitle: "",
    jobType: "Full-time",
    salary: {
      min: "",
      max: "",
    },
    keyResponsibilities: "", // Changed from description
    experience: "",
    education: [],
    deadline: "",
    skills: [],
    languages: [],
    candidateLocation: [], // Array of location preferences
    weightage: {
      skills: 0,
      education: 0,
      experience: 0,
      projects: 0,
      language: 0,
    },
    customWeightageFields: [], // Array of { fieldName: string, value: number }
  });

  // Autocomplete states
  const [jobTitleSuggestionsOpen, setJobTitleSuggestionsOpen] = useState(false);
  const [educationSuggestionsOpen, setEducationSuggestionsOpen] = useState(false);
  const [skillsSuggestionsOpen, setSkillsSuggestionsOpen] = useState(false);
  const [countrySuggestionsOpen, setCountrySuggestionsOpen] = useState(false);
  const [citySuggestionsOpen, setCitySuggestionsOpen] = useState(false);
  const [currentSkillInput, setCurrentSkillInput] = useState("");
  const [currentLanguageInput, setCurrentLanguageInput] = useState("");
  const [currentEducationInput, setCurrentEducationInput] = useState("");
  const [currentCandidateLocationInput, setCurrentCandidateLocationInput] = useState("");
  const [languagesSuggestionsOpen, setLanguagesSuggestionsOpen] = useState(false);
  const [candidateLocationSuggestionsOpen, setCandidateLocationSuggestionsOpen] = useState(false);

  // Fetch job posts
  const fetchJobPosts = async (token) => {
    try {
      setLoading(true);
      const result = await getJobPosts(token);
      if (result.success) {
        // Ensure result.data is always an array
        setJobPosts(Array.isArray(result.data) ? result.data : []);
      } else {
        toast.error(result.error || 'Failed to fetch job posts');
        setJobPosts([]); // Set to empty array on error
      }
    } catch (error) {
      toast.error('Failed to fetch job posts');
      console.error('Error fetching job posts:', error);
      setJobPosts([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        localStorage.removeItem("user");
        router.push("/auth/login");
      } else {
        const userData = localStorage.getItem("user");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        }
        // Get ID token for API calls
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        // Fetch job posts when user is authenticated
        fetchJobPosts(token);
      }
    });

    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.relative')) {
        setShowDropdown(false);
      }
      if (showNotificationDropdown && !event.target.closest('.relative')) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [router, showDropdown, showNotificationDropdown]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Handle nested location fields
    if (name.startsWith('location.')) {
      const field = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          [field]: value,
        },
      }));
      return;
    }
    
    // Handle nested salary fields
    if (name.startsWith('salary.')) {
      const field = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        salary: {
          ...prev.salary,
          [field]: value ? parseFloat(value) : "",
        },
      }));
      return;
    }
    
    // Handle nested weightage fields - store empty string for 0 or empty
    if (name.startsWith('weightage.')) {
      const field = name.split('.')[1];
      // Store as empty string if 0 or empty, otherwise parse the number
      const numValue = value === '' || value === null || value === undefined || value === '0'
        ? ''
        : (value ? parseInt(value) || '' : '');
      setFormData((prev) => {
        const newWeightage = {
          ...prev.weightage,
          [field]: numValue,
        };
        return {
          ...prev,
          weightage: newWeightage,
        };
      });
      return;
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddSkill = () => {
    if (currentSkillInput.trim() && !formData.skills.includes(currentSkillInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, currentSkillInput.trim()],
      }));
      setCurrentSkillInput("");
      setSkillsSuggestionsOpen(false);
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const handleAddEducation = () => {
    if (currentEducationInput.trim() && !formData.education.includes(currentEducationInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        education: [...prev.education, currentEducationInput.trim()],
      }));
      setCurrentEducationInput("");
      setEducationSuggestionsOpen(false);
    }
  };

  const handleRemoveEducation = (educationToRemove) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((edu) => edu !== educationToRemove),
    }));
  };

  const handleAddCandidateLocation = () => {
    if (currentCandidateLocationInput.trim() && !formData.candidateLocation.includes(currentCandidateLocationInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        candidateLocation: [...prev.candidateLocation, currentCandidateLocationInput.trim()],
      }));
      setCurrentCandidateLocationInput("");
      setCandidateLocationSuggestionsOpen(false);
    }
  };

  const handleRemoveCandidateLocation = (locationToRemove) => {
    setFormData((prev) => ({
      ...prev,
      candidateLocation: prev.candidateLocation.filter((loc) => loc !== locationToRemove),
    }));
  };

  const handleAddLanguage = () => {
    if (currentLanguageInput.trim() && !formData.languages.includes(currentLanguageInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        languages: [...prev.languages, currentLanguageInput.trim()],
      }));
      setCurrentLanguageInput("");
      setLanguagesSuggestionsOpen(false);
    }
  };

  const handleRemoveLanguage = (languageToRemove) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter((language) => language !== languageToRemove),
    }));
  };

  const getWeightageTotal = () => {
    const getValue = (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      return typeof val === 'number' ? val : parseInt(val) || 0;
    };
    
    let total = getValue(formData.weightage.skills) + 
                getValue(formData.weightage.education) + 
                getValue(formData.weightage.experience) + 
                getValue(formData.weightage.projects) +
                getValue(formData.weightage.language);
    
    // Add custom weightage fields
    if (formData.customWeightageFields && formData.customWeightageFields.length > 0) {
      formData.customWeightageFields.forEach(field => {
        total += getValue(field.value);
      });
    }
    
    return total;
  };

  const handleAddCustomWeightageField = () => {
    setFormData((prev) => ({
      ...prev,
      customWeightageFields: [...(prev.customWeightageFields || []), { fieldName: "", value: 0 }],
    }));
  };

  const handleRemoveCustomWeightageField = (index) => {
    setFormData((prev) => {
      const newFields = [...(prev.customWeightageFields || [])];
      // Remove from weightage object if exists
      if (newFields[index] && newFields[index].fieldName) {
        const updatedWeightage = { ...prev.weightage };
        delete updatedWeightage[newFields[index].fieldName];
        newFields.splice(index, 1);
        return {
          ...prev,
          customWeightageFields: newFields,
          weightage: updatedWeightage,
        };
      }
      newFields.splice(index, 1);
      return {
        ...prev,
        customWeightageFields: newFields,
      };
    });
  };

  const handleCustomWeightageFieldChange = (index, field, value) => {
    setFormData((prev) => {
      const newFields = [...(prev.customWeightageFields || [])];
      const updatedWeightage = { ...prev.weightage };
      
      // If field name changed, remove old key and add new key
      if (field === 'fieldName') {
        const oldFieldName = newFields[index].fieldName;
        if (oldFieldName) {
          delete updatedWeightage[oldFieldName];
        }
        if (value.trim()) {
          updatedWeightage[value.trim()] = newFields[index].value || 0;
        }
      } else if (field === 'value') {
        const fieldName = newFields[index].fieldName;
        if (fieldName) {
          updatedWeightage[fieldName] = parseInt(value) || 0;
        }
      }
      
      newFields[index] = { ...newFields[index], [field]: field === 'value' ? parseInt(value) || 0 : value };
      
      return {
        ...prev,
        customWeightageFields: newFields,
        weightage: updatedWeightage,
      };
    });
  };

  const handleCreateNew = () => {
    setEditingJobPost(null);
    setFormData({
      company: "",
      officialEmail: "",
      websiteUrl: "",
      contactNo: "",
      location: {
        country: "",
        city: "",
        province: "",
        address: "",
      },
      jobTitle: "",
      jobType: "Full-time",
      salary: {
        min: "",
        max: "",
      },
      keyResponsibilities: "",
      experience: "",
      education: [],
      deadline: "",
      skills: [],
      languages: [],
      candidateLocation: [],
      weightage: {
        skills: 0,
        education: 0,
        experience: 0,
        projects: 0,
        language: 0,
      },
      customWeightageFields: [],
    });
    setCurrentSkillInput("");
    setCurrentLanguageInput("");
    setCurrentEducationInput("");
    setCurrentCandidateLocationInput("");
    setCurrentCandidateLocationInput("");
    setShowForm(true);
  };

  const handleEdit = async (jobPostId) => {
    try {
      if (!idToken) {
        toast.error("Authentication required");
        return;
      }
      const result = await getJobPostById(jobPostId, idToken);
      if (result.success) {
        const jobPost = result.data;
        setEditingJobPost(jobPost);
        
        // Extract custom weightage fields (fields that are not standard)
        const standardWeightageFields = ['skills', 'education', 'experience', 'projects', 'language'];
        const customFields = [];
        const weightageObj = jobPost.weightage || {};
        
        for (const key in weightageObj) {
          if (!standardWeightageFields.includes(key)) {
            customFields.push({ fieldName: key, value: weightageObj[key] || 0 });
          }
        }
        
        setFormData({
          company: jobPost.company || "",
          officialEmail: jobPost.officialEmail || "",
          websiteUrl: jobPost.websiteUrl || "",
          contactNo: jobPost.contactNo || "",
          location: {
            country: jobPost.location?.country || "",
            city: jobPost.location?.city || "",
            province: jobPost.location?.province || "",
            address: jobPost.location?.address || "",
          },
          jobTitle: jobPost.jobTitle || "",
          jobType: jobPost.jobType || "Full-time",
          salary: {
            min: jobPost.salary?.min || "",
            max: jobPost.salary?.max || "",
          },
          keyResponsibilities: jobPost.keyResponsibilities || jobPost.description || "",
          experience: jobPost.experience || "",
          education: Array.isArray(jobPost.education) ? jobPost.education : (jobPost.education ? [jobPost.education] : []),
          deadline: jobPost.deadline ? new Date(jobPost.deadline).toISOString().split('T')[0] : "",
          skills: jobPost.skills || [],
          languages: jobPost.languages || [],
          candidateLocation: Array.isArray(jobPost.candidateLocation) 
            ? jobPost.candidateLocation 
            : (jobPost.candidateLocation ? [jobPost.candidateLocation] : []),
          weightage: {
            skills: weightageObj.skills || 0,
            education: weightageObj.education || 0,
            experience: weightageObj.experience || 0,
            projects: weightageObj.projects || 0,
            language: weightageObj.language || 0,
            ...Object.fromEntries(
              customFields.map(f => [f.fieldName, f.value])
            ),
          },
          customWeightageFields: customFields,
        });
        setCurrentSkillInput("");
        setCurrentLanguageInput("");
        setShowForm(true);
      } else {
        toast.error(result.error || 'Failed to fetch job post details');
      }
    } catch (error) {
      toast.error('Failed to fetch job post details');
      console.error('Error fetching job post:', error);
    }
  };

  const handleDelete = async (jobPostId) => {
    if (!window.confirm('Are you sure you want to delete this job post?')) {
      return;
    }

    try {
      if (!idToken) {
        toast.error("Authentication required");
        return;
      }
      const result = await deleteJobPost(jobPostId, idToken);
      if (result.success) {
        toast.success("Job post deleted successfully!", { autoClose: 3000 });
        // Refresh job posts list
        fetchJobPosts(idToken);
      } else {
        toast.error(result.error || 'Failed to delete job post');
      }
    } catch (error) {
      toast.error('Failed to delete job post');
      console.error('Error deleting job post:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!idToken) {
      toast.error("Authentication required");
      return;
    }

    // Validate weightage sum (must be exactly 100)
    const weightageTotal = getWeightageTotal();
    if (weightageTotal !== 100) {
      toast.error(`Priority Weight Distribution must sum to exactly 100%. Current sum: ${weightageTotal}%`);
      return;
    }

    // Validate salary range
    if (formData.salary.min && formData.salary.max) {
      const minSalary = parseFloat(formData.salary.min);
      const maxSalary = parseFloat(formData.salary.max);
      if (minSalary < 0 || maxSalary < 0) {
        toast.error("Salary values must be non-negative");
        return;
      }
      if (minSalary > maxSalary) {
        toast.error("Minimum salary cannot be greater than maximum salary");
        return;
      }
    }

    // Validate required fields
    if (!formData.company || !formData.location.country || !formData.location.city || 
        !formData.jobTitle || !formData.keyResponsibilities || !formData.deadline) {
      toast.error("Please fill in all required fields (Company, Location, Job Title, Key Responsibilities, Deadline)");
      return;
    }

    try {
      const jobData = {
        company: formData.company,
        officialEmail: formData.officialEmail || '',
        websiteUrl: formData.websiteUrl || '',
        contactNo: formData.contactNo || '',
        location: {
          country: formData.location.country,
          city: formData.location.city,
          province: formData.location.province || '',
          address: formData.location.address || '',
        },
        jobTitle: formData.jobTitle,
        jobType: formData.jobType,
        salary: {
          min: formData.salary.min ? parseFloat(formData.salary.min) : null,
          max: formData.salary.max ? parseFloat(formData.salary.max) : null,
        },
        keyResponsibilities: formData.keyResponsibilities,
        experience: formData.experience || null,
        education: Array.isArray(formData.education) ? formData.education.join(', ') : (formData.education || ''),
        deadline: formData.deadline,
        skills: formData.skills || [],
        languages: formData.languages || [],
        candidateLocation: formData.candidateLocation || 'anywhere',
        templateImage: '/job-posting-template.png', // Template image path
        weightage: {
          skills: parseInt(formData.weightage.skills) || 0,
          education: parseInt(formData.weightage.education) || 0,
          experience: parseInt(formData.weightage.experience) || 0,
          projects: parseInt(formData.weightage.projects) || 0,
          language: parseInt(formData.weightage.language) || 0,
          ...Object.fromEntries(
            (formData.customWeightageFields || []).map(f => [f.fieldName, f.value || 0])
          ),
        },
      };

      // If editing, update directly without LLM
      if (editingJobPost) {
        // Preserve template image from existing job post or use default
        jobData.templateImage = editingJobPost.templateImage || '/job-posting-template.png';
        const result = await updateJobPost(editingJobPost._id, jobData, idToken);
        if (result.success) {
          toast.success("Job post updated successfully!", { autoClose: 3000 });
          setShowForm(false);
          setEditingJobPost(null);
          handleClear();
          fetchJobPosts(idToken);
        } else {
          toast.error(result.error || 'Failed to update job post');
        }
        return;
      }

      // For new posts, generate description using LLM
      setPendingJobData(jobData);
      setIsGenerating(true);
      const llmResult = await generateJobDescription(jobData, null, null, idToken);
      setIsGenerating(false);

      if (llmResult.success) {
        // Ensure we have a string, not an object
        const description = llmResult.data?.generatedDescription || llmResult.data?.output || '';
        const descriptionText = typeof description === 'string' 
          ? description 
          : (description?.content || description?.text || JSON.stringify(description));
        
        setGeneratedDescription(descriptionText);
        setShowGeneratedModal(true);
        setShowEditFeedback(false);
        setEditFeedback("");
      } else {
        toast.error(llmResult.error || 'Failed to generate job description');
      }
    } catch (error) {
      setIsGenerating(false);
      toast.error('Failed to generate job description');
      console.error('Error generating job description:', error);
    }
  };

  const handleLooksGood = async () => {
    if (!pendingJobData || !idToken) {
      toast.error("Missing data");
      return;
    }

    if (showTemplateSelection && !selectedTemplate) {
      toast.error("Please select an image template or upload an image");
      return;
    }

    try {
      let finalImageUrl = selectedTemplate || '/job-posting-template.png';
      
      // Convert local template paths to full URLs using centralized config
      if (showTemplateSelection && selectedTemplate && (selectedTemplate.startsWith('/Temaple-') || selectedTemplate.startsWith('/Template-') || selectedTemplate.startsWith('/job-posting-template'))) {
        // Use centralized config for frontend URL
        finalImageUrl = config.getFullUrl(selectedTemplate);
      }

      const jobData = {
        ...pendingJobData,
        generatedDescription: generatedDescription,
        templateImage: finalImageUrl, // Use full URL (ngrok/public URL for templates, or direct URL for AI/uploaded images)
      };

      let result;
      if (editingJobPost) {
        result = await updateJobPost(editingJobPost._id, jobData, idToken);
      } else {
        result = await createJobPost(jobData, idToken);
      }

      if (result.success) {
        const jobPostId = result.data._id || result.data.id;
        
        // Post to social media platforms via n8n
        toast.info("Posting to social media platforms...", { autoClose: 2000 });
        const socialMediaResult = await postToSocialMedia(jobPostId, idToken);
        
        if (socialMediaResult.success) {
          toast.success(editingJobPost ? "Job post updated and posted to social media!" : "Job post created and posted to social media!", { autoClose: 5000 });
        } else {
          toast.warning(editingJobPost ? "Job post updated, but social media posting failed." : "Job post created, but social media posting failed.", { autoClose: 5000 });
          console.error('Social media posting error:', socialMediaResult.error);
        }
        
        setShowGeneratedModal(false);
        setShowForm(false);
        setEditingJobPost(null);
        setPendingJobData(null);
        setGeneratedDescription("");
        setShowTemplateSelection(false);
        setSelectedTemplate(null);
        setUploadedImageUrl(null);
        setAiGeneratedImageUrl(null);
        setShowAIImagePreview(false);
        setAiImageBase64(null);
        setShowRegeneratePrompt(false);
        setRegenerateDescription("");
        handleClear();
        fetchJobPosts(idToken);
      } else {
        toast.error(result.error || 'Failed to save job post');
      }
    } catch (error) {
      toast.error('Failed to save job post');
      console.error('Error saving job post:', error);
    }
  };

  const handleEditDescription = () => {
    setShowEditFeedback(true);
  };

  const handleRegenerateDescription = async () => {
    if (!pendingJobData || !idToken || !editFeedback.trim()) {
      toast.error("Please provide feedback for regeneration");
      return;
    }

    try {
      setIsGenerating(true);
      const llmResult = await generateJobDescription(
        pendingJobData,
        generatedDescription,
        editFeedback,
        idToken
      );
      setIsGenerating(false);

      if (llmResult.success) {
        // Ensure we have a string, not an object
        const description = llmResult.data?.generatedDescription || llmResult.data?.output || '';
        const descriptionText = typeof description === 'string' 
          ? description 
          : (description?.content || description?.text || JSON.stringify(description));
        
        setGeneratedDescription(descriptionText);
        setShowEditFeedback(false);
        setEditFeedback("");
        toast.success("Job description regenerated successfully!");
      } else {
        toast.error(llmResult.error || 'Failed to regenerate job description');
      }
    } catch (error) {
      setIsGenerating(false);
      toast.error('Failed to regenerate job description');
      console.error('Error regenerating job description:', error);
    }
  };

  const handleClear = () => {
    setFormData({
      company: "",
      officialEmail: "",
      websiteUrl: "",
      contactNo: "",
      location: {
        country: "",
        city: "",
        province: "",
        address: "",
      },
      jobTitle: "",
      jobType: "Full-time",
      salary: {
        min: "",
        max: "",
      },
      keyResponsibilities: "",
      experience: "",
      education: [],
      deadline: "",
      skills: [],
      languages: [],
      candidateLocation: [],
      weightage: {
        skills: 0,
        education: 0,
        experience: 0,
        projects: 0,
        language: 0,
      },
      customWeightageFields: [],
    });
    setCurrentSkillInput("");
    setCurrentLanguageInput("");
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingJobPost(null);
    handleClear();
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
      localStorage.removeItem("user");
      toast.success("Logged out successfully", { autoClose: 2000 });
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Logo */}
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} relative`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-linear-to-br from-cyan-400 via-teal-400 to-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-lg">NH</span>
                </div>
                <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>NeuroHire</span>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-10 h-10 bg-linear-to-br from-cyan-400 via-teal-400 to-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-black text-lg">NH</span>
              </div>
            )}
            {/* Sidebar Toggle Button - Always visible */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`flex-shrink-0 p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg transition-colors hidden lg:flex ${sidebarCollapsed ? 'absolute top-2 right-2' : ''}`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className={`flex-1 p-4 overflow-y-auto ${sidebarCollapsed ? 'p-2' : ''}`}>
          {!sidebarCollapsed && (
            <div className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-4 px-3`}>MAIN MENU</div>
          )}
          
          <div className="space-y-1">
            <button
              onClick={() => {
                setShowMenuItems(!showMenuItems);
                setShowSidebar(false);
              }}
              className={`w-full ${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'} rounded-lg ${sidebarCollapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2.5'} flex items-center gap-3 cursor-pointer`}
              title={sidebarCollapsed ? 'Dashboard' : ''}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {!sidebarCollapsed && (
                <>
                  <span className={`text-sm font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>Dashboard</span>
                  <svg className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'} ml-auto transition-transform ${showMenuItems ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              )}
            </button>

            {showMenuItems && !sidebarCollapsed && (
              <>
                <div className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mt-4 mb-2 px-3`}>OPTIONS</div>
                
                <button
                  onClick={() => {
                    router.push("/hr/dashboard");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Analytics</span>
                </button>

                <button
                  onClick={() => {
                    router.push("/hr/job-posting");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Manage Job Posting</span>
                </button>
              </>
            )}
            
            {/* Collapsed menu items */}
            {sidebarCollapsed && showMenuItems && (
              <div className="space-y-2 mt-4">
                <button
                  onClick={() => router.push("/hr/dashboard")}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg p-2 flex items-center justify-center cursor-pointer transition-colors`}
                  title="Analytics"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => router.push("/hr/job-posting")}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-2 flex items-center justify-center cursor-pointer`}
                  title="Create Job Posting"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`lg:hidden p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg`}
              >
                <svg className={`w-6 h-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex-1 text-center lg:text-left">
                <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Manage Job Posting</h1>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>NeuroHire where hiring meets AI</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Theme Toggle */}
              <div className={`flex items-center gap-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-1`}>
                <button
                  onClick={() => setDarkMode(false)}
                  className={`p-2 rounded transition-colors ${!darkMode ? 'bg-white shadow-sm' : darkMode ? 'hover:bg-gray-600' : ''}`}
                  title="Light mode"
                >
                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDarkMode(true)}
                  className={`p-2 rounded transition-colors ${darkMode ? 'bg-gray-600 shadow-sm' : ''}`}
                  title="Dark mode"
                >
                  <svg className={`w-4 h-4 ${darkMode ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </button>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg relative transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {errors.length > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {errors.length > 9 ? '9+' : errors.length}
                    </span>
                  )}
                </button>
                
                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className={`absolute right-0 mt-2 w-80 sm:w-96 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl border ${darkMode ? 'border-gray-700' : 'border-gray-200'} z-50 max-h-96 overflow-hidden flex flex-col`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
                      <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        System Errors ({errors.length})
                      </h3>
                      {errors.length > 0 && (
                        <button
                          onClick={() => {
                            setErrors([]);
                            localStorage.removeItem('systemErrors');
                          }}
                          className={`text-xs ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {errors.length === 0 ? (
                        <div className={`px-4 py-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p>No errors</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {errors.map((error) => (
                            <div key={error.id} className={`px-4 py-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'}`}>
                                      {error.type.toUpperCase()}
                                    </span>
                                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {new Date(error.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'} break-words`}>
                                    {error.message}
                                  </p>
                                  {error.source && (
                                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                      Source: {error.source}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    setErrors(prev => {
                                      const updated = prev.filter(e => e.id !== error.id);
                                      localStorage.setItem('systemErrors', JSON.stringify(updated));
                                      return updated;
                                    });
                                  }}
                                  className={`flex-shrink-0 p-1 ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                                  title="Dismiss"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile with Dropdown */}
              <div className="relative">
                <div 
                  className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg px-2 sm:px-3 py-2 transition-colors`}
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">HR</span>
                  </div>
                  <span className={`hidden sm:inline text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{user?.email || "Email"}</span>
                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {showDropdown && (
                  <div className={`absolute right-0 mt-2 w-48 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'} z-50`}>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className={`w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors flex items-center gap-2`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 p-4 sm:p-6 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {!showForm ? (
            /* Active Job Posts Table */
            <div className={`max-w-7xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 sm:p-8 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Active Job Posts</h2>
                <button
                  onClick={handleCreateNew}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Job Post
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading job posts...</p>
                </div>
              ) : !Array.isArray(jobPosts) || jobPosts.length === 0 ? (
                <div className="text-center py-12">
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No active job posts found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>#</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Job Title</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Active Status</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Deadline</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Created Date</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Remarks</th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(jobPosts) ? jobPosts : []).map((jobPost, index) => (
                        <tr key={jobPost._id} className={`border-b ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{index + 1}</td>
                          <td className={`py-3 px-4 text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{jobPost.jobTitle}</td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${jobPost.activeStatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {jobPost.activeStatus ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {new Date(jobPost.deadline).toLocaleDateString()}
                          </td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {new Date(jobPost.createdAt).toLocaleDateString()}
                          </td>
                          <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <div className="flex items-center gap-2">
                              {/* Status Icon */}
                              <div className={`w-3 h-3 rounded-full ${
                                jobPost.activeStatus ? 'bg-green-500' :
                                jobPost.remarks === 'completed' ? 'bg-green-500' :
                                jobPost.remarks === 'pending' ? 'bg-yellow-500' :
                                'bg-orange-500'
                              }`} title={
                                jobPost.activeStatus ? 'Active' :
                                jobPost.remarks === 'completed' ? 'Completed' :
                                jobPost.remarks === 'pending' ? 'Pending' :
                                'Other'
                              }></div>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                jobPost.remarks === 'completed' ? 'bg-blue-100 text-blue-800' :
                                jobPost.remarks === 'deleted' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {jobPost.remarks.charAt(0).toUpperCase() + jobPost.remarks.slice(1)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(jobPost._id)}
                                className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-100 text-blue-600'}`}
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(jobPost._id)}
                                className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100 text-red-600'}`}
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Job Posting Form */
            <div className={`max-w-4xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 sm:p-8 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {editingJobPost ? 'Edit Job Post' : 'Create New Job Post'}
                </h2>
                <button
                  onClick={handleCancel}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Cancel
                </button>
              </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Company Name *
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  placeholder="Enter company name"
                />
              </div>

              {/* Official Email */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Official Email
                </label>
                <input
                  type="email"
                  name="officialEmail"
                  value={formData.officialEmail}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  placeholder="recruitment@company.com"
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  This email will be used in job vacancy banners
                </p>
              </div>

              {/* Website URL */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Website URL
                </label>
                <input
                  type="text"
                  name="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  placeholder="www.company.com or https://www.company.com"
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Company website domain (optional)
                </p>
              </div>

              {/* Contact No */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Contact No
                </label>
                <input
                  type="text"
                  name="contactNo"
                  value={formData.contactNo}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  placeholder="+1 234 567 8900"
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Customer support contact number
                </p>
              </div>

              {/* Company Location Details */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Company Location *
                </label>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Country with Autocomplete */}
                    <div className="relative">
                      <input
                        type="text"
                        name="location.country"
                        value={formData.location.country}
                        onChange={(e) => {
                          handleInputChange(e);
                          setCountrySuggestionsOpen(true);
                        }}
                        onFocus={() => setCountrySuggestionsOpen(true)}
                        onBlur={() => setTimeout(() => setCountrySuggestionsOpen(false), 200)}
                        required
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                        placeholder="Country *"
                      />
                      {countrySuggestionsOpen && formData.location.country && (
                        <div className={`absolute z-10 w-full mt-1 ${darkMode ? 'bg-gray-700' : 'bg-white'} border ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
                          {countrySuggestions
                            .filter(suggestion => suggestion.toLowerCase().includes(formData.location.country.toLowerCase()))
                            .map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    location: { ...prev.location, country: suggestion }
                                  }));
                                  setCountrySuggestionsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`}
                              >
                                {suggestion}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    {/* City with Autocomplete */}
                    <div className="relative">
                      <input
                        type="text"
                        name="location.city"
                        value={formData.location.city}
                        onChange={(e) => {
                          handleInputChange(e);
                          setCitySuggestionsOpen(true);
                        }}
                        onFocus={() => setCitySuggestionsOpen(true)}
                        onBlur={() => setTimeout(() => setCitySuggestionsOpen(false), 200)}
                        required
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                        placeholder="City *"
                      />
                      {citySuggestionsOpen && formData.location.city && (
                        <div className={`absolute z-10 w-full mt-1 ${darkMode ? 'bg-gray-700' : 'bg-white'} border ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
                          {citySuggestions
                            .filter(suggestion => suggestion.toLowerCase().includes(formData.location.city.toLowerCase()))
                            .map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    location: { ...prev.location, city: suggestion }
                                  }));
                                  setCitySuggestionsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`}
                              >
                                {suggestion}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <input
                      type="text"
                      name="location.address"
                      value={formData.location.address}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      placeholder="Street Address (Optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Job Title with Autocomplete */}
              <div className="relative">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Job Title *
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) => {
                    handleInputChange(e);
                    setJobTitleSuggestionsOpen(true);
                  }}
                  onFocus={() => setJobTitleSuggestionsOpen(true)}
                  onBlur={() => setTimeout(() => setJobTitleSuggestionsOpen(false), 200)}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  placeholder="e.g., Senior Software Engineer"
                />
                {jobTitleSuggestionsOpen && formData.jobTitle && (
                  <div className={`absolute z-10 w-full mt-1 ${darkMode ? 'bg-gray-700' : 'bg-white'} border ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
                    {jobTitleSuggestions
                      .filter(suggestion => suggestion.toLowerCase().includes(formData.jobTitle.toLowerCase()))
                      .map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, jobTitle: suggestion }));
                            setJobTitleSuggestionsOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Experience (1-10 years or 10+) */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Experience (Years) *
                </label>
                <select
                  name="experience"
                  value={formData.experience}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                >
                  <option value="">Select years of experience</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(year => (
                    <option key={year} value={year}>{year} {year === 1 ? 'year' : 'years'}</option>
                  ))}
                  <option value="10+">10+ years</option>
                </select>
              </div>

              {/* Job Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Job Type *
                </label>
                <select
                  name="jobType"
                  value={formData.jobType}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>

              {/* Salary Range */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Salary Range ($)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="number"
                      name="salary.min"
                      value={formData.salary.min}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      placeholder="Min ($)"
                      min="0"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      name="salary.max"
                      value={formData.salary.max}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      placeholder="Max ($)"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Education with Tag Input */}
              <div className="relative">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Education *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={currentEducationInput}
                    onChange={(e) => {
                      setCurrentEducationInput(e.target.value);
                      setEducationSuggestionsOpen(true);
                    }}
                    onFocus={() => setEducationSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setEducationSuggestionsOpen(false), 200)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEducation();
                      }
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    placeholder="Enter education and press Enter or click Add"
                  />
                  <button
                    type="button"
                    onClick={handleAddEducation}
                    className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors`}
                  >
                    Add
                  </button>
                </div>
                {educationSuggestionsOpen && currentEducationInput && (
                  <div className={`absolute z-10 w-full mt-1 ${darkMode ? 'bg-gray-700' : 'bg-white'} border ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
                    {educationSuggestions
                      .filter(suggestion => suggestion.toLowerCase().includes(currentEducationInput.toLowerCase()) && !formData.education.includes(suggestion))
                      .map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (!formData.education.includes(suggestion)) {
                              setFormData(prev => ({ ...prev, education: [...prev.education, suggestion] }));
                              setCurrentEducationInput("");
                              setEducationSuggestionsOpen(false);
                            }
                          }}
                          className={`w-full text-left px-4 py-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
                {formData.education.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.education.map((edu, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${darkMode ? 'bg-gray-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}
                      >
                        {edu}
                        <button
                          type="button"
                          onClick={() => handleRemoveEducation(edu)}
                          className={`hover:${darkMode ? 'text-red-400' : 'text-red-600'}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Candidate Location Preference with Tag Input */}
              <div className="relative">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Candidate Location Preference *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={currentCandidateLocationInput}
                    onChange={(e) => {
                      setCurrentCandidateLocationInput(e.target.value);
                      setCandidateLocationSuggestionsOpen(true);
                    }}
                    onFocus={() => setCandidateLocationSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setCandidateLocationSuggestionsOpen(false), 200)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCandidateLocation();
                      }
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    placeholder="Enter location preference and press Enter or click Add"
                  />
                  <button
                    type="button"
                    onClick={handleAddCandidateLocation}
                    className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors`}
                  >
                    Add
                  </button>
                </div>
                {candidateLocationSuggestionsOpen && currentCandidateLocationInput && (
                  <div className={`absolute z-10 w-full mt-1 ${darkMode ? 'bg-gray-700' : 'bg-white'} border ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
                    {candidateLocationSuggestions
                      .filter(suggestion => suggestion.toLowerCase().includes(currentCandidateLocationInput.toLowerCase()) && !formData.candidateLocation.includes(suggestion))
                      .map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (!formData.candidateLocation.includes(suggestion)) {
                              setFormData(prev => ({ ...prev, candidateLocation: [...prev.candidateLocation, suggestion] }));
                              setCurrentCandidateLocationInput("");
                              setCandidateLocationSuggestionsOpen(false);
                            }
                          }}
                          className={`w-full text-left px-4 py-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
                {formData.candidateLocation.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.candidateLocation.map((loc, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${darkMode ? 'bg-gray-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}
                      >
                        {loc}
                        <button
                          type="button"
                          onClick={() => handleRemoveCandidateLocation(loc)}
                          className={`hover:${darkMode ? 'text-red-400' : 'text-red-600'}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Languages with Autocomplete */}
              <div className="relative">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Languages (Preferred)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={currentLanguageInput}
                    onChange={(e) => {
                      setCurrentLanguageInput(e.target.value);
                      setLanguagesSuggestionsOpen(true);
                    }}
                    onFocus={() => setLanguagesSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setLanguagesSuggestionsOpen(false), 200)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLanguage();
                      }
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    placeholder="Enter language and press Enter or click Add"
                  />
                  <button
                    type="button"
                    onClick={handleAddLanguage}
                    className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors`}
                  >
                    Add
                  </button>
                </div>
                {languagesSuggestionsOpen && currentLanguageInput && (
                  <div className={`absolute z-10 w-full mt-1 ${darkMode ? 'bg-gray-700' : 'bg-white'} border ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
                    {languageSuggestions
                      .filter(suggestion => suggestion.toLowerCase().includes(currentLanguageInput.toLowerCase()) && !formData.languages.includes(suggestion))
                      .map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (!formData.languages.includes(suggestion)) {
                              setFormData(prev => ({ ...prev, languages: [...prev.languages, suggestion] }));
                              setCurrentLanguageInput("");
                              setLanguagesSuggestionsOpen(false);
                            }
                          }}
                          className={`w-full text-left px-4 py-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
                {formData.languages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.languages.map((language, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${darkMode ? 'bg-gray-700 text-white' : 'bg-blue-100 text-blue-800'}`}
                      >
                        {language}
                        <button
                          type="button"
                          onClick={() => handleRemoveLanguage(language)}
                          className={`hover:${darkMode ? 'text-red-400' : 'text-red-600'}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Responsibilities */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Key Responsibilities *
                </label>
                <textarea
                  name="keyResponsibilities"
                  value={formData.keyResponsibilities}
                  onChange={handleInputChange}
                  required
                  rows={6}
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none`}
                  placeholder="List the key responsibilities and requirements for this role..."
                />
              </div>

              {/* Skills with Autocomplete */}
              <div className="relative">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Skills *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={currentSkillInput}
                    onChange={(e) => {
                      setCurrentSkillInput(e.target.value);
                      setSkillsSuggestionsOpen(true);
                    }}
                    onFocus={() => setSkillsSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setSkillsSuggestionsOpen(false), 200)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    placeholder="Enter skill and press Enter or click Add"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors`}
                  >
                    Add
                  </button>
                </div>
                {skillsSuggestionsOpen && currentSkillInput && (
                  <div className={`absolute z-10 w-full mt-1 ${darkMode ? 'bg-gray-700' : 'bg-white'} border ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
                    {skillsSuggestions
                      .filter(suggestion => suggestion.toLowerCase().includes(currentSkillInput.toLowerCase()) && !formData.skills.includes(suggestion))
                      .map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (!formData.skills.includes(suggestion)) {
                              setFormData(prev => ({ ...prev, skills: [...prev.skills, suggestion] }));
                              setCurrentSkillInput("");
                              setSkillsSuggestionsOpen(false);
                            }
                          }}
                          className={`w-full text-left px-4 py-2 hover:${darkMode ? 'bg-gray-600' : 'bg-gray-100'} ${darkMode ? 'text-white' : 'text-gray-800'}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.skills.map((skill, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${darkMode ? 'bg-gray-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className={`hover:${darkMode ? 'text-red-400' : 'text-red-600'}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority Weight Distribution */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Priority Weight Distribution * (Must sum to exactly 100%)
                </label>
                <p className={`text-xs mb-3 ${darkMode ? 'text-red-500' : 'text-red-500'} italic`}>
                  <b>For better accuracy of results, choose these weights according to the job role or company demands.</b>
                </p>
                <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Skills (%)
                      </label>
                      <input
                        type="number"
                        name="weightage.skills"
                        value={(formData.weightage.skills === 0 || formData.weightage.skills === '' || !formData.weightage.skills) ? '' : formData.weightage.skills}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Education (%)
                      </label>
                      <input
                        type="number"
                        name="weightage.education"
                        value={(formData.weightage.education === 0 || formData.weightage.education === '' || !formData.weightage.education) ? '' : formData.weightage.education}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Experience (%)
                      </label>
                      <input
                        type="number"
                        name="weightage.experience"
                        value={(formData.weightage.experience === 0 || formData.weightage.experience === '' || !formData.weightage.experience) ? '' : formData.weightage.experience}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Projects (%)
                      </label>
                      <input
                        type="number"
                        name="weightage.projects"
                        value={(formData.weightage.projects === 0 || formData.weightage.projects === '' || !formData.weightage.projects) ? '' : formData.weightage.projects}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Language (%)
                      </label>
                      <input
                        type="number"
                        name="weightage.language"
                        value={(formData.weightage.language === 0 || formData.weightage.language === '' || !formData.weightage.language) ? '' : formData.weightage.language}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Custom Weightage Fields */}
                  {formData.customWeightageFields && formData.customWeightageFields.length > 0 && (
                    <div className="mb-4 space-y-3">
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Custom Fields:
                      </label>
                      {formData.customWeightageFields.map((field, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Field Name
                            </label>
                            <input
                              type="text"
                              value={field.fieldName || ''}
                              onChange={(e) => handleCustomWeightageFieldChange(index, 'fieldName', e.target.value)}
                              className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm`}
                              placeholder="e.g., Certifications"
                            />
                          </div>
                          <div className="w-24">
                            <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Value (%)
                            </label>
                            <input
                              type="number"
                              value={(field.value === 0 || field.value === '' || !field.value) ? '' : field.value}
                              placeholder="0"
                              onChange={(e) => handleCustomWeightageFieldChange(index, 'value', e.target.value)}
                              min="0"
                              max="100"
                              className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomWeightageField(index)}
                            className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white text-sm transition-colors`}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddCustomWeightageField}
                    className={`mb-4 px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'} text-sm font-medium transition-colors`}
                  >
                    + Add Custom Field
                  </button>

                  <div className={`text-sm font-semibold ${getWeightageTotal() === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Total: {getWeightageTotal()}% {getWeightageTotal() === 100 ? '✓' : '(Must be exactly 100%)'}
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Application Deadline *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="deadline"
                    value={formData.deadline}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className={`w-full px-4 py-2.5 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all appearance-none cursor-pointer`}
                    style={{
                      backgroundImage: darkMode 
                        ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23ffffff' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z'/%3E%3C/svg%3E")`
                        : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23374151' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                      backgroundSize: '1rem',
                      paddingRight: '2.75rem'
                    }}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Select a date from today onwards
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {isGenerating ? 'Generating Description...' : (editingJobPost ? 'Update Job Post' : 'Generate & Post Job')}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          )}
        </div>
      </div>

      {/* Generated Description Modal */}
      {showGeneratedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Generated Job Description
              </h3>
              <button
                onClick={() => {
                  setShowGeneratedModal(false);
                  setShowEditFeedback(false);
                  setEditFeedback("");
                  setShowTemplateSelection(false);
                  setSelectedTemplate(null);
                  setUploadedImageUrl(null);
                  setAiGeneratedImageUrl(null);
                  setShowAIImagePreview(false);
                  setAiImageBase64(null);
                  setShowRegeneratePrompt(false);
                  setRegenerateDescription("");
                }}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
              >
                <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isGenerating ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Generating job description...</p>
                </div>
              ) : showTemplateSelection ? (
                <div className="space-y-6">
                  <h4 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    Select an Image Template
                  </h4>
                  
                  {/* Template Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                      const templatePath = `/Temaple-0${num}.${num === 7 ? 'png' : 'jpg'}`;
                      const isSelected = selectedTemplate === templatePath;
                      return (
                        <div
                          key={num}
                          onClick={() => setSelectedTemplate(templatePath)}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected 
                              ? 'border-emerald-500 ring-2 ring-emerald-300' 
                              : darkMode 
                              ? 'border-gray-600 hover:border-gray-500' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <img
                            src={templatePath}
                            alt={`Template ${num}`}
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              e.target.src = '/job-posting-template.png';
                            }}
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                              <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Generated Image Option */}
                  <div className="border-t pt-6">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Or Generate AI Image
                    </label>
                    
                    {!showAIImagePreview ? (
                      <button
                        onClick={async () => {
                          if (!pendingJobData || !idToken) {
                            toast.error("Missing data");
                            return;
                          }
                          
                          setIsGeneratingAIImage(true);
                          try {
                            const result = await generateAIImage(pendingJobData, generatedDescription, idToken, null);
                            if (result.success) {
                              // Check if we got a taskId (webhook-based flow)
                              if (result.data.taskId) {
                                const taskId = result.data.taskId;
                                setAiImageTaskId(taskId);
                                setIsPollingForImage(true);
                                setIsGeneratingAIImage(false);
                                toast.info('Image generation started. Waiting for result...', { autoClose: 3000 });
                                
                                // Start polling for result
                                let pollAttempts = 0;
                                const maxPollAttempts = 40; // 40 attempts * 3 seconds = 2 minutes
                                
                                const pollInterval = setInterval(async () => {
                                  pollAttempts++;
                                  console.log(`Polling attempt ${pollAttempts} for taskId: ${taskId}`);
                                  
                                  try {
                                    const checkResult = await checkAIImageResult(taskId, idToken);
                                    console.log('Poll result:', checkResult);
                                    
                                    if (checkResult.success && checkResult.data) {
                                      if (checkResult.data.status === 'completed') {
                                        clearInterval(pollInterval);
                                        setIsPollingForImage(false);
                                        
                                        // Get image data - check all possible fields
                                        const imageData = checkResult.data.imageBase64 || 
                                                         checkResult.data.imageData || 
                                                         checkResult.data.imageUrl;
                                        if (imageData) {
                                          // Accept both data URIs and HTTP URLs
                                          if (imageData.startsWith('data:image') || imageData.startsWith('http')) {
                                            setAiImageBase64(imageData);
                                            setShowAIImagePreview(true);
                                            // Also set as selected template (no Google Drive upload needed)
                                            setSelectedTemplate(imageData);
                                            setAiGeneratedImageUrl(imageData);
                                            toast.success('AI image generated! Review and confirm to use.');
                                          } else {
                                            toast.error('Invalid image data format');
                                          }
                                        } else {
                                          console.error('No image data in result:', checkResult.data);
                                          toast.error('Image data not found in result');
                                        }
                                      } else if (checkResult.data.status === 'failed' || checkResult.data.status === 'error') {
                                        clearInterval(pollInterval);
                                        setIsPollingForImage(false);
                                        toast.error('Image generation failed');
                                      }
                                      // If still pending, continue polling
                                    } else if (checkResult.status === 'not_found') {
                                      // Task not found yet, continue polling
                                      console.log('Task not found yet, continuing to poll...');
                                    } else {
                                      // Error checking result
                                      console.error('Error checking result:', checkResult.error);
                                    }
                                  } catch (error) {
                                    console.error('Polling error:', error);
                                  }
                                  
                                  // Stop polling after max attempts
                                  if (pollAttempts >= maxPollAttempts) {
                                    clearInterval(pollInterval);
                                    setIsPollingForImage(false);
                                    toast.error('Image generation timed out. Please try again.');
                                  }
                                }, 3000); // Poll every 3 seconds
                              } else if (result.data.imageBase64) {
                                // Direct response (if API returns immediately - fallback)
                                setAiImageBase64(result.data.imageBase64);
                                setShowAIImagePreview(true);
                                setIsGeneratingAIImage(false);
                                toast.success('AI image generated! Review and confirm to upload.');
                              } else if (result.data.imageUrl) {
                                // Direct URL
                                setAiGeneratedImageUrl(result.data.imageUrl);
                                setSelectedTemplate(result.data.imageUrl);
                                setIsGeneratingAIImage(false);
                                toast.success('AI image generated successfully!');
                              } else {
                                toast.error('Unexpected response format');
                                setIsGeneratingAIImage(false);
                              }
                            } else {
                              toast.error(result.error || 'Failed to generate AI image');
                              setIsGeneratingAIImage(false);
                            }
                          } catch (error) {
                            console.error('AI image generation error:', error);
                            toast.error('Failed to generate AI image');
                            setIsGeneratingAIImage(false);
                          }
                        }}
                        disabled={isGeneratingAIImage || isPollingForImage}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          isGeneratingAIImage
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {(isGeneratingAIImage || isPollingForImage) ? (
                          <>
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>{isPollingForImage ? 'Waiting for image...' : 'Generating AI Image...'}</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span>Generate AI Image</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-4">
                        {/* Preview Section */}
                        <div>
                          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            AI Generated Image Preview:
                          </p>
                          <div className="relative rounded-lg border-2 border-purple-500 overflow-hidden">
                            <img 
                              src={aiImageBase64} 
                              alt="AI Generated Preview" 
                              className="w-full h-64 object-contain bg-gray-100 rounded-lg"
                            />
                          </div>
                        </div>

                        {/* Regeneration Options */}
                        {!showRegeneratePrompt ? (
                          <div className="flex gap-3">
                            <button
                              onClick={async () => {
                                // Use AI image directly (no Google Drive upload needed)
                                // The image URL or base64 will be sent directly to n8n
                                setSelectedTemplate(aiImageBase64);
                                setAiGeneratedImageUrl(aiImageBase64);
                                setShowAIImagePreview(false);
                                setAiImageBase64(null);
                                toast.success('AI image selected!');
                              }}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                              Use This Image
                            </button>
                            <button
                              onClick={() => {
                                setShowRegeneratePrompt(true);
                                setRegenerateDescription("");
                              }}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                            >
                              Regenerate
                            </button>
                            <button
                              onClick={() => {
                                setShowAIImagePreview(false);
                                setAiImageBase64(null);
                                setShowRegeneratePrompt(false);
                                setRegenerateDescription("");
                              }}
                              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                How would you like to modify the image? (Optional)
                              </label>
                              <textarea
                                value={regenerateDescription}
                                onChange={(e) => setRegenerateDescription(e.target.value)}
                                rows={3}
                                className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none`}
                                placeholder="e.g., Change colors to red and blue, make it more modern, add more geometric shapes..."
                              />
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={async () => {
                                  setIsGeneratingAIImage(true);
                                  try {
                                    const result = await generateAIImage(pendingJobData, generatedDescription, idToken, regenerateDescription);
                                    if (result.success) {
                                      if (result.data.taskId) {
                                        // Webhook-based flow
                                        const taskId = result.data.taskId;
                                        setAiImageTaskId(taskId);
                                        setIsPollingForImage(true);
                                        setIsGeneratingAIImage(false);
                                        setShowRegeneratePrompt(false);
                                        setRegenerateDescription("");
                                        toast.info('Regenerating image. Waiting for result...', { autoClose: 3000 });
                                        
                                        // Poll for result
                                        const pollInterval = setInterval(async () => {
                                          try {
                                            const checkResult = await checkAIImageResult(taskId, idToken);
                                            if (checkResult.success && checkResult.data?.status === 'completed') {
                                              clearInterval(pollInterval);
                                              setIsPollingForImage(false);
                                              const imageData = checkResult.data.imageBase64 || checkResult.data.imageUrl;
                                              if (imageData) {
                                                setAiImageBase64(imageData);
                                                toast.success('Image regenerated successfully!');
                                              }
                                            }
                                          } catch (error) {
                                            console.error('Polling error:', error);
                                          }
                                        }, 3000);
                                        
                                        setTimeout(() => {
                                          clearInterval(pollInterval);
                                          if (isPollingForImage) {
                                            setIsPollingForImage(false);
                                            toast.error('Regeneration timed out');
                                          }
                                        }, 120000);
                                      } else if (result.data.imageBase64) {
                                        setAiImageBase64(result.data.imageBase64);
                                        setShowRegeneratePrompt(false);
                                        setRegenerateDescription("");
                                        setIsGeneratingAIImage(false);
                                        toast.success('Image regenerated successfully!');
                                      } else {
                                        toast.error('Unexpected response format');
                                        setIsGeneratingAIImage(false);
                                      }
                                    } else {
                                      toast.error(result.error || 'Failed to regenerate image');
                                      setIsGeneratingAIImage(false);
                                    }
                                  } catch (error) {
                                    console.error('Regeneration error:', error);
                                    toast.error('Failed to regenerate image');
                                    setIsGeneratingAIImage(false);
                                  }
                                }}
                                disabled={isGeneratingAIImage || isPollingForImage}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                              >
                                {(isGeneratingAIImage || isPollingForImage) ? 'Regenerating...' : 'Regenerate Image'}
                              </button>
                              <button
                                onClick={() => {
                                  setShowRegeneratePrompt(false);
                                  setRegenerateDescription("");
                                }}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Upload from PC Option */}
                  <div className="border-t pt-6">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Or Upload from Your PC
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setIsUploadingImage(true);
                          try {
                            const result = await uploadImageToDrive(file, idToken);
                            if (result.success) {
                              // Use webContentLink for direct image access (better for n8n)
                              const imageUrl = result.data.webContentLink || result.data.webViewLink;
                              setUploadedImageUrl(imageUrl);
                              setSelectedTemplate(imageUrl);
                              toast.success('Image uploaded successfully!');
                            } else {
                              toast.error(result.error || 'Failed to upload image');
                            }
                          } catch (error) {
                            console.error('Upload error:', error);
                            toast.error('Failed to upload image');
                          } finally {
                            setIsUploadingImage(false);
                          }
                        }
                      }}
                      className="hidden"
                      id="image-upload"
                      disabled={isUploadingImage}
                    />
                    <label
                      htmlFor="image-upload"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                        isUploadingImage
                          ? 'bg-gray-400 cursor-not-allowed'
                          : darkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      {isUploadingImage ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span>Upload Image</span>
                        </>
                      )}
                    </label>
                    {uploadedImageUrl && (
                      <div className="mt-4">
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Uploaded Image Preview:</p>
                        <img src={uploadedImageUrl} alt="Uploaded" className="w-full h-32 object-cover rounded-lg border border-gray-300" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {!showEditFeedback ? (
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Job Description (Editable)
                        </label>
                        <textarea
                          value={generatedDescription}
                          onChange={(e) => setGeneratedDescription(e.target.value)}
                          rows={12}
                          className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none`}
                          placeholder="Job description will appear here..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          How would you like to modify the description?
                        </label>
                        <textarea
                          value={editFeedback}
                          onChange={(e) => setEditFeedback(e.target.value)}
                          rows={6}
                          className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none`}
                          placeholder="e.g., Make it more technical, add more benefits, emphasize remote work opportunities..."
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleRegenerateDescription}
                          disabled={!editFeedback.trim() || isGenerating}
                          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                        >
                          {isGenerating ? 'Regenerating...' : 'Regenerate'}
                        </button>
                        <button
                          onClick={() => {
                            setShowEditFeedback(false);
                            setEditFeedback("");
                          }}
                          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {!isGenerating && !showEditFeedback && !showTemplateSelection && (
              <div className={`px-6 py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex gap-3`}>
                <button
                  onClick={() => {
                    setShowTemplateSelection(true);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Next: Select Image
                </button>
                <button
                  onClick={handleEditDescription}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Edit Description
                </button>
              </div>
            )}
            {!isGenerating && !showEditFeedback && showTemplateSelection && (
              <div className={`px-6 py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex gap-3`}>
                <button
                  onClick={handleLooksGood}
                  disabled={!selectedTemplate}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Looks Good - Save Post
                </button>
                <button
                  onClick={() => {
                    setShowTemplateSelection(false);
                    setSelectedTemplate(null);
                    setUploadedImageUrl(null);
                  }}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function JobPosting() {
  return (
    <ProtectedRoute requiredRole="HR">
      <JobPostingContent />
    </ProtectedRoute>
  );
}

