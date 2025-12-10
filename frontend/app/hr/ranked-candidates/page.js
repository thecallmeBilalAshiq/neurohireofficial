"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { getJobsForRanking, getRankedCandidates } from "../../../lib/api";
import { toast } from "react-toastify";

function RankedCandidatesContent() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [idToken, setIdToken] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [jobInfo, setJobInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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
      const result = await getJobsForRanking(token);
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

  const fetchRankedCandidates = async (jobId) => {
    if (!jobId) {
      setCandidates([]);
      setJobInfo(null);
      setCurrentPage(1);
      return;
    }

    try {
      setLoading(true);
      const result = await getRankedCandidates(jobId, idToken);
      if (result.success) {
        // Ensure candidates array is sorted by totalScore descending
        const sortedCandidates = (result.data.candidates || []).sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
        setCandidates(sortedCandidates);
        setJobInfo({
          jobTitle: result.data.jobTitle,
          company: result.data.company
        });
        setCurrentPage(1); // Reset to first page when new job is selected
      } else {
        toast.error(result.error || "Failed to fetch ranked candidates");
        setCandidates([]);
        setJobInfo(null);
      }
    } catch (error) {
      console.error("Error fetching ranked candidates:", error);
      toast.error("Failed to fetch ranked candidates");
      setCandidates([]);
      setJobInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJobId && idToken) {
      fetchRankedCandidates(selectedJobId);
    }
  }, [selectedJobId, idToken]);

  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    if (score >= 4) return "text-orange-600";
    return "text-red-600";
  };

  const getTotalScoreColor = (score) => {
    if (score >= 8) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 6) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (score >= 4) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  // Pagination calculations
  const totalPages = Math.ceil(candidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCandidates = candidates.slice(startIndex, endIndex);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 11; // Show up to 11 page numbers

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than maxVisible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages with ellipsis
      if (currentPage <= 6) {
        // Show first pages + ellipsis + last page
        for (let i = 1; i <= 9; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 5) {
        // Show first page + ellipsis + last pages
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 8; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page + ellipsis + current pages + ellipsis + last page
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 3; i <= currentPage + 3; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
              onClick={() => router.push("/hr/dashboard")}
              className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg`}
            >
              <svg className={`w-6 h-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Ranked Candidates
              </h1>
              <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>
                View and compare candidate rankings for job positions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 sm:p-6 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Job Selection */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 mb-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
            Select Job Post
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            disabled={loading}
          >
            <option value="">-- Select a Job --</option>
            {jobs.map((job) => (
              <option key={job._id} value={job._id}>
                {job.jobTitle} - {job.company}
              </option>
            ))}
          </select>
        </div>

        {/* Candidates Table */}
        {selectedJobId && (
          <>
            {jobInfo && (
              <div className={`${darkMode ? 'bg-emerald-900/30 border-emerald-700' : 'bg-emerald-50 border-emerald-200'} rounded-xl shadow-sm p-6 mb-6 border-2 text-center`}>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-emerald-100' : 'text-emerald-900'} mb-2`}>
                  {jobInfo.jobTitle}
                </h2>
                <p className={`text-base ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {jobInfo.company}
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
              </div>
            ) : candidates.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-8 text-center border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <svg className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  No candidates found
                </p>
                <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  No applications have been submitted for this job yet.
                </p>
              </div>
            ) : (
              <>
                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl border ${darkMode ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={`sticky top-0 ${darkMode ? 'bg-gradient-to-r from-gray-800 to-gray-750' : 'bg-gradient-to-r from-gray-50 to-gray-100'} backdrop-blur-sm z-10`}>
                        <tr>
                          <th className={`px-6 py-5 text-left text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                              <span>Rank</span>
                            </div>
                          </th>
                          <th className={`px-6 py-5 text-left text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Name
                          </th>
                          <th className={`px-6 py-5 text-left text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Email
                          </th>
                          <th className={`px-6 py-5 text-left text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Phone Number
                          </th>
                          <th className={`px-6 py-5 text-center text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Experience
                          </th>
                          <th className={`px-6 py-5 text-center text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Projects
                          </th>
                          <th className={`px-6 py-5 text-center text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Skills
                          </th>
                          <th className={`px-6 py-5 text-center text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Certificates
                          </th>
                          <th className={`px-6 py-5 text-center text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Education
                          </th>
                          <th className={`px-6 py-5 text-center text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} uppercase tracking-wider border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            Total Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? 'divide-gray-700/30' : 'divide-gray-100'}`}>
                        {currentCandidates.map((candidate, index) => {
                          const rank = startIndex + index + 1;
                          const isTopThree = rank <= 3;
                          return (
                            <tr 
                              key={candidate._id || index} 
                              className={`group ${darkMode ? 'hover:bg-gray-700/20' : 'hover:bg-gray-50'} transition-all duration-200 ${
                                isTopThree ? (darkMode ? 'bg-emerald-900/10' : 'bg-emerald-50/30') : ''
                              }`}
                            >
                              <td className={`px-6 py-5 whitespace-nowrap`}>
                                <div className="flex items-center">
                                  {rank === 1 && (
                                    <span className="mr-2 text-xl">🥇</span>
                                  )}
                                  {rank === 2 && (
                                    <span className="mr-2 text-xl">🥈</span>
                                  )}
                                  {rank === 3 && (
                                    <span className="mr-2 text-xl">🥉</span>
                                  )}
                                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                                    isTopThree 
                                      ? 'bg-emerald-500 text-white' 
                                      : darkMode 
                                        ? 'bg-gray-700 text-gray-300' 
                                        : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    {rank}
                                  </div>
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap`}>
                                <div className="flex items-center">
                                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm mr-3 ${
                                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700'
                                  }`}>
                                    {(candidate.candidateName || 'N/A').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {candidate.candidateName || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap`}>
                                <div className="flex items-center gap-2">
                                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {candidate.email || 'N/A'}
                                  </div>
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap`}>
                                <div className="flex items-center gap-2">
                                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {candidate.phone || 'N/A'}
                                  </div>
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap text-center`}>
                                <div className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                  (candidate.experienceScore || 0) >= 8 
                                    ? 'bg-green-100 text-green-700' 
                                    : (candidate.experienceScore || 0) >= 6 
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : (candidate.experienceScore || 0) >= 4
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                  {(candidate.experienceScore || 0).toFixed(1)}
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap text-center`}>
                                <div className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                  (candidate.projectsScore || 0) >= 8 
                                    ? 'bg-green-100 text-green-700' 
                                    : (candidate.projectsScore || 0) >= 6 
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : (candidate.projectsScore || 0) >= 4
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                  {(candidate.projectsScore || 0).toFixed(1)}
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap text-center`}>
                                <div className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                  (candidate.skillsScore || 0) >= 8 
                                    ? 'bg-green-100 text-green-700' 
                                    : (candidate.skillsScore || 0) >= 6 
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : (candidate.skillsScore || 0) >= 4
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                  {(candidate.skillsScore || 0).toFixed(1)}
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap text-center`}>
                                <div className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                  (candidate.certificatesScore || 0) >= 8 
                                    ? 'bg-green-100 text-green-700' 
                                    : (candidate.certificatesScore || 0) >= 6 
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : (candidate.certificatesScore || 0) >= 4
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                  {(candidate.certificatesScore || 0).toFixed(1)}
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap text-center`}>
                                <div className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                  (candidate.educationScore || 0) >= 8 
                                    ? 'bg-green-100 text-green-700' 
                                    : (candidate.educationScore || 0) >= 6 
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : (candidate.educationScore || 0) >= 4
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                  {(candidate.educationScore || 0).toFixed(1)}
                                </div>
                              </td>
                              <td className={`px-6 py-5 whitespace-nowrap text-center`}>
                                <span className={`inline-flex items-center justify-center min-w-[70px] px-4 py-2 text-sm font-bold rounded-xl shadow-sm border-2 ${
                                  (candidate.totalScore || 0) >= 8 
                                    ? 'bg-green-500 text-white border-green-600' 
                                    : (candidate.totalScore || 0) >= 6 
                                      ? 'bg-yellow-500 text-white border-yellow-600'
                                      : (candidate.totalScore || 0) >= 4
                                        ? 'bg-orange-500 text-white border-orange-600'
                                        : 'bg-red-500 text-white border-red-600'
                                }`}>
                                  {(candidate.totalScore || 0).toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-100'} px-4 py-4 mt-6`}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Showing <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{startIndex + 1}</span> to{' '}
                        <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {Math.min(endIndex, candidates.length)}
                        </span>{' '}
                        of <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{candidates.length}</span> candidates
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Previous Button */}
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            currentPage === 1
                              ? `${darkMode ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`
                              : `${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'}`
                          }`}
                        >
                          &lt; Previous
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-1">
                          {getPageNumbers().map((page, idx) => {
                            if (page === 'ellipsis') {
                              return (
                                <span key={`ellipsis-${idx}`} className={`px-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  ...
                                </span>
                              );
                            }
                            return (
                              <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`min-w-[36px] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                  currentPage === page
                                    ? `${darkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'}`
                                    : `${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'}`
                                }`}
                              >
                                {page}
                              </button>
                            );
                          })}
                        </div>

                        {/* Next Button */}
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            currentPage === totalPages
                              ? `${darkMode ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`
                              : `${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'}`
                          }`}
                        >
                          Next &gt;
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!selectedJobId && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-8 text-center border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <svg className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Select a Job Post
            </p>
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Please select a job post from the dropdown above to view ranked candidates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RankedCandidates() {
  return (
    <ProtectedRoute requiredRole="HR">
      <RankedCandidatesContent />
    </ProtectedRoute>
  );
}

