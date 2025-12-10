"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../../lib/firebase";
import { getJobPostByIdForCandidate, submitApplication, autofillCV, downloadCVTemplate } from "../../../../lib/api";
import { toast } from "react-toastify";

function JobApplicationContent() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId;
  
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [cvFile, setCvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [showCVTemplateModal, setShowCVTemplateModal] = useState(false);
  const [extractedData, setExtractedData] = useState(null); // Store original extracted data structure
  const [formData, setFormData] = useState({
    // Personal Information (Required)
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    // Profile (Optional)
    education: "",
    experience: "",
    skills: "",
    certificates: "",
  });

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        fetchJob(token);
      }
    });
    return () => unsubscribe();
  }, [jobId]);

  const fetchJob = async (token) => {
    try {
      setLoading(true);
      const result = await getJobPostByIdForCandidate(jobId, token);
      if (result.success) {
        setJob(result.data);
      } else {
        toast.error(result.error || "Failed to fetch job details");
        router.push("/candidate/apply");
      }
    } catch (error) {
      console.error("Error fetching job:", error);
      toast.error("Failed to fetch job details");
      router.push("/candidate/apply");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setCvFile(file);
    }
  };

  const handleDownloadCVTemplate = async () => {
    try {
      const result = await downloadCVTemplate();
      if (result.success) {
        toast.success("CV template downloaded successfully!");
      } else {
        toast.error(result.error || "Failed to download CV template");
      }
    } catch (error) {
      console.error("Error downloading CV template:", error);
      toast.error("Failed to download CV template");
    }
  };

  const handleAutofill = async () => {
    if (!cvFile) {
      toast.error("Please select a CV file first");
      return;
    }

    try {
      setParsing(true);
      const formData = new FormData();
      formData.append("cv", cvFile);

      const result = await autofillCV(formData, idToken);
      
      if (result.success && result.data.extractedData) {
        const extracted = result.data.extractedData;
        
        // Check if extracted data is empty (invalid CV)
        const isEmpty = !extracted || 
          Object.keys(extracted).length === 0 ||
          (
            (!extracted.firstName || extracted.firstName === '') &&
            (!extracted.lastName || extracted.lastName === '') &&
            (!extracted.email || extracted.email === '') &&
            (!extracted.phone || extracted.phone === '') &&
            (!extracted.address || extracted.address === '') &&
            (!extracted.experience || extracted.experience === '') &&
            (!extracted.skills || (Array.isArray(extracted.skills) && extracted.skills.length === 0)) &&
            (!extracted.education || 
              (typeof extracted.education === 'object' && 
               (!extracted.education.university || extracted.education.university === '') &&
               (!extracted.education.degree || extracted.education.degree === ''))) &&
            (!extracted.certificates || extracted.certificates === '')
          );

        if (isEmpty) {
          // Show popup for invalid CV
          toast.error("Please upload a valid CV or fill the form manually. The uploaded file does not appear to be a valid CV.", {
            autoClose: 6000,
          });
          return;
        }
        
        // Store original extracted data structure (for backend scoring)
        setExtractedData(extracted);
        
        // Handle education - convert object to readable string for display
        let educationStr = "";
        if (extracted.education) {
          if (typeof extracted.education === 'object' && extracted.education !== null) {
            const edu = extracted.education;
            const parts = [];
            if (edu.university) parts.push(edu.university);
            if (edu.degree) parts.push(edu.degree);
            if (edu.dateOfCompletion) parts.push(`(${edu.dateOfCompletion})`);
            educationStr = parts.join(' - ');
          } else if (typeof extracted.education === 'string') {
            educationStr = extracted.education;
          }
        }
        
        // Handle skills - convert array to comma-separated string for display
        let skillsStr = "";
        if (extracted.skills) {
          if (Array.isArray(extracted.skills)) {
            skillsStr = extracted.skills.join(', ');
          } else if (typeof extracted.skills === 'string') {
            skillsStr = extracted.skills;
          }
        }
        
        setFormData({
          firstName: extracted.firstName || "",
          lastName: extracted.lastName || "",
          email: extracted.email || "",
          phone: extracted.phone || "",
          address: extracted.address || "",
          education: educationStr,
          experience: extracted.experience || "",
          skills: skillsStr,
          certificates: extracted.certificates || "",
        });
        toast.success("CV parsed successfully! Please review and update the information.");
        setActiveTab("application");
      } else {
        toast.error(result.error || "Failed to parse CV");
      }
    } catch (error) {
      console.error("Error autofilling CV:", error);
      toast.error("Failed to parse CV");
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!cvFile) {
      toast.error("Please upload your CV");
      return;
    }

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setUploading(true);
      const applicationFormData = new FormData();
      applicationFormData.append("jobId", jobId);
      applicationFormData.append("cv", cvFile);
      applicationFormData.append("formData", JSON.stringify(formData));
      
      // If we have extracted data from CV parsing, send it for scoring
      if (extractedData) {
        applicationFormData.append("extractedData", JSON.stringify(extractedData));
      }

      const result = await submitApplication(applicationFormData, idToken);
      
      if (result.success) {
        toast.success("Application submitted successfully!");
        router.push("/candidate/apply");
      } else {
        toast.error(result.error || "Failed to submit application");
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("Failed to submit application");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <style>{`
        body {
          background: ${darkMode ? '#111827' : '#f9fafb'};
          min-height: 100vh;
        }
      `}</style>

      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/candidate/apply")}
              className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg`}
            >
              <svg className={`w-6 h-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {job.jobTitle}
              </h1>
              <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>
                {job.company} - {job.location?.city}, {job.location?.country}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6`}>
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "overview"
                ? "border-emerald-500 text-emerald-600"
                : darkMode
                ? "border-transparent text-gray-400 hover:text-gray-300"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            OVERVIEW
          </button>
          <button
            onClick={() => {
              setActiveTab("application");
              setShowCVTemplateModal(true);
            }}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "application"
                ? "border-emerald-500 text-emerald-600"
                : darkMode
                ? "border-transparent text-gray-400 hover:text-gray-300"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            APPLICATION
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 sm:p-6 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-4xl mx-auto">
          {activeTab === "overview" && (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
                Job Description
              </h2>
              <div className={`prose max-w-none ${darkMode ? 'prose-invert' : ''}`}>
                <div className={`whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {job.generatedDescription || job.description || job.keyResponsibilities || "No description available."}
                </div>
              </div>
            </div>
          )}

          {activeTab === "application" && (
            <div className="space-y-6">
              {/* CV Upload Section */}
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    AUTOFILL APPLICATION
                  </h2>
                </div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                  Save time by importing your resume in PDF format.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={parsing}
                    />
                    <div className={`border-2 border-dashed ${darkMode ? 'border-gray-600' : 'border-gray-300'} rounded-lg p-4 text-center hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}>
                      {cvFile ? (
                        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Selected: {cvFile.name}
                        </div>
                      ) : (
                        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Click to select PDF file
                        </div>
                      )}
                    </div>
                  </label>
                  
                  <button
                    onClick={handleAutofill}
                    disabled={!cvFile || parsing}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {parsing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Parsing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Import resume from
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Application Form */}
              <form onSubmit={handleSubmit} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-6`}>
                  * Required fields
                </p>

                {/* Personal Information Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      Personal Information
                    </h3>
                    <button
                      type="button"
                      onClick={() => setFormData({
                        firstName: "",
                        lastName: "",
                        email: "",
                        phone: "",
                        address: "",
                        education: formData.education,
                        experience: formData.experience,
                        skills: formData.skills,
                        certificates: formData.certificates,
                      })}
                      className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} flex items-center gap-1`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        * First name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        * Last name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        * Email
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        * Phone
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        * Address
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>
                  </div>
                </div>

                {/* Profile Section */}
                <div className="mb-6">
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>
                    Profile
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        Education
                      </label>
                      <textarea
                        value={formData.education}
                        onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                        rows={3}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        Experience
                      </label>
                      <textarea
                        value={formData.experience}
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                        rows={3}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        Skills
                      </label>
                      <textarea
                        value={formData.skills}
                        onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                        rows={2}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                        Certificates
                      </label>
                      <textarea
                        value={formData.certificates}
                        onChange={(e) => setFormData({ ...formData, certificates: e.target.value })}
                        rows={2}
                        className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !cvFile}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  {uploading ? "Submitting..." : "Submit Application"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* CV Template Download Modal */}
      {showCVTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-6 max-w-md mx-4 border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex flex-col items-center gap-4">
              <div className={`w-16 h-16 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-full flex items-center justify-center`}>
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                CV Template Required
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-center`}>
                Kindly download the following format CV to upload
              </p>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setShowCVTemplateModal(false)}
                  className={`flex-1 px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} rounded-lg transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleDownloadCVTemplate();
                    setShowCVTemplateModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                >
                  Download Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parsing Modal */}
      {parsing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-6 max-w-sm mx-4 border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
              <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Auto parsing is in progress...
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} text-center`}>
                Please wait while we extract information from your CV.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobApplication() {
  return (
    <ProtectedRoute requiredRole="candidate">
      <JobApplicationContent />
    </ProtectedRoute>
  );
}
