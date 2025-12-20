"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { getActiveJobsForCandidates, getJobPostById } from "../../../lib/api";
import { toast } from "react-toastify";

function ApplyToJobContent() {
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
        fetchJobs(token);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchJobs = async (token) => {
    try {
      setLoading(true);
      const result = await getActiveJobsForCandidates(token);
      if (result.success) {
        setJobs(result.data);
      } else {
        toast.error(result.error || "Failed to fetch jobs");
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

  const [showWarning, setShowWarning] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);

  const handleApply = async (jobId) => {
    setSelectedJobId(jobId);
    setShowWarning(true);
  };

  const handleConfirmApply = () => {
    setShowWarning(false);
    if (selectedJobId) {
      router.push(`/candidate/apply/${selectedJobId}`);
    }
  };

  const handleCancelApply = () => {
    setShowWarning(false);
    setSelectedJobId(null);
  };

  const filteredJobs = jobs.filter(job => {
    const searchLower = searchTerm.toLowerCase();
    return (
      job.jobTitle?.toLowerCase().includes(searchLower) ||
      job.company?.toLowerCase().includes(searchLower) ||
      job.location?.city?.toLowerCase().includes(searchLower) ||
      job.location?.country?.toLowerCase().includes(searchLower)
    );
  });

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
              onClick={() => router.push("/candidate/dashboard")}
              className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg`}
            >
              <svg className={`w-6 h-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Apply to Job</h1>
              <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>Browse and apply to available positions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 sm:p-6 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Search Bar */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 mb-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search jobs by title, company, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            />
            <svg className={`absolute left-3 top-2.5 w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-8 text-center border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <svg className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {searchTerm ? 'No jobs found matching your search' : 'No active jobs available'}
            </p>
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {searchTerm ? 'Try adjusting your search terms' : 'Check back later for new opportunities'}
            </p>
          </div>
        ) : (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-100'} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Job Title
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Company
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Location
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Type
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Deadline
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {filteredJobs.map((job) => (
                    <tr key={job._id} className={`${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className={`px-4 py-4 whitespace-nowrap`}>
                        <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {job.jobTitle}
                        </div>
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap`}>
                        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {job.company}
                        </div>
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap`}>
                        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {job.location?.city}, {job.location?.country}
                        </div>
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap`}>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          darkMode 
                            ? 'bg-blue-900/30 text-blue-400' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {job.jobType}
                        </span>
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap`}>
                        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {new Date(job.deadline).toLocaleDateString()}
                        </div>
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium`}>
                        {job.hasApplied ? (
                          <span className="bg-gray-500 text-white px-4 py-2 rounded-lg">
                            Already Applied
                          </span>
                        ) : (
                          <button
                            onClick={() => handleApply(job._id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            Apply
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-6 max-w-md mx-4 border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Important Notice
              </h3>
            </div>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-6`}>
              We kindly request that all information provided be accurate and truthful. 
              <strong className="text-red-500"> Submission of false or incorrect information may result in disqualification from the application process.</strong>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelApply}
                className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} rounded-lg transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApply}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplyToJob() {
  return (
    <ProtectedRoute requiredRole="candidate">
      <ApplyToJobContent />
    </ProtectedRoute>
  );
}

