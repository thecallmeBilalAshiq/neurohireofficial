"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import {
  getJobsForRanking,
  getRankedCandidates,
  getEvaluatedCandidates,
  getApplicationsByJob,
  evaluateJobApplications,
  evaluateOneApplication,
  generateInterviewEmail,
  sendInterviewEmails,
  prepareTestQuestions,
  markInterviewInviteSent,
  markSelectedAsHire,
  finalizeJob,
  generateTrainingPlan,
  getApiBaseUrl,
  updateJobPost,
} from "../../../lib/api";
import { toast } from "react-toastify";
import { useHrDarkMode } from "../../../lib/useHrDarkMode";

function RankedCandidatesContent() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useHrDarkMode();
  const [idToken, setIdToken] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [jobInfo, setJobInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Selection states
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Email modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [emailType, setEmailType] = useState("interview"); // 'interview' or 'online_test'
  const [generatedEmail, setGeneratedEmail] = useState({ subject: "", body: "" });
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [hrInfo, setHrInfo] = useState({
    name: "",
    title: "Human Resources",
    email: "",
    phone: ""
  });
  const [preparingTest, setPreparingTest] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [jobMeta, setJobMeta] = useState(null);
  const [viewMode, setViewMode] = useState("ranked");
  const [generatingPdfForAppId, setGeneratingPdfForAppId] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [evaluatingOneId, setEvaluatingOneId] = useState(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [updatingDeadline, setUpdatingDeadline] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        fetchJobs(token);
        // Set HR info from Firebase user
        setHrInfo(prev => ({
          ...prev,
          name: firebaseUser.displayName || "HR Team",
          email: firebaseUser.email || ""
        }));
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
      setJobMeta(null);
      setViewMode("ranked");
      setCurrentPage(1);
      setSelectedCandidates([]);
      setSelectAll(false);
      return;
    }

    try {
      setLoading(true);
      const result = await getRankedCandidates(jobId, idToken);
      if (result.success) {
        const list = result.data.candidates || [];
        setJobMeta({
          deadline: result.data.deadline,
          evaluatedAt: result.data.evaluatedAt,
          remarks: result.data.remarks,
        });
        setJobInfo({
          jobTitle: result.data.jobTitle,
          company: result.data.company,
        });
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
          setCandidates(sorted);
          setViewMode("ranked");
        } else if (result.data.evaluatedAt) {
          const evalResult = await getEvaluatedCandidates(jobId, idToken);
          if (evalResult.success && (evalResult.data.candidates || []).length > 0) {
            setCandidates(evalResult.data.candidates || []);
            setViewMode("evaluated");
          } else {
            setCandidates([]);
            setViewMode("ranked");
          }
        } else {
          const byJobResult = await getApplicationsByJob(jobId, idToken);
          if (byJobResult.success && (byJobResult.data.candidates || []).length > 0) {
            const apps = (byJobResult.data.candidates || []).sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
            setCandidates(apps);
            setViewMode("applicants");
          } else {
            setCandidates([]);
            setViewMode("ranked");
          }
        }
        setCurrentPage(1);
        setSelectedCandidates([]);
        setSelectAll(false);
      } else {
        toast.error(result.error || "Failed to fetch ranked candidates");
        setCandidates([]);
        setJobInfo(null);
        setJobMeta(null);
      }
    } catch (error) {
      console.error("Error fetching ranked candidates:", error);
      toast.error("Failed to fetch ranked candidates");
      setCandidates([]);
      setJobInfo(null);
      setJobMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateJob = async () => {
    if (!selectedJobId || !idToken) return;
    setEvaluating(true);
    try {
      const result = await evaluateJobApplications(selectedJobId, idToken);
      if (result.success) {
        toast.success(result.data?.message || "Applications evaluated.");
        fetchJobs(idToken);
        fetchRankedCandidates(selectedJobId);
      } else {
        toast.error(result.error || "Evaluation failed");
      }
    } catch (e) {
      toast.error("Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  const handleShowInstantRanking = async (applicationId) => {
    if (!idToken) return;
    setEvaluatingOneId(applicationId);
    try {
      const result = await evaluateOneApplication(applicationId, idToken);
      if (result.success) {
        toast.success("Instant ranking done. This candidate is scored; rest will be ranked after deadline.");
        fetchRankedCandidates(selectedJobId);
      } else {
        toast.error(result.error || "Evaluation failed");
      }
    } catch (e) {
      toast.error("Evaluation failed");
    } finally {
      setEvaluatingOneId(null);
    }
  };

  const handleMarkInterviewSent = async () => {
    if (!selectedJobId || !idToken || selectedCandidates.length === 0) return;
    setIsSendingEmails(true);
    try {
      const appIds = selectedCandidates.map((c) => c._id);
      const result = await markInterviewInviteSent(selectedJobId, appIds, idToken);
      if (result.success) {
        toast.success("Interview invite marked as sent.");
        setShowConfirmModal(false);
        setShowEmailModal(false);
        setSelectedCandidates([]);
        fetchRankedCandidates(selectedJobId);
      } else toast.error(result.error || "Failed");
    } catch (e) {
      toast.error("Failed to mark interview sent");
    } finally {
      setIsSendingEmails(false);
    }
  };

  const handleSaveHires = async () => {
    if (!selectedJobId || !idToken) return;
    try {
      const appIds = selectedCandidates.map((c) => c._id);
      const result = await markSelectedAsHire(selectedJobId, appIds, idToken);
      if (result.success) {
        toast.success("Selected hires saved.");
        setSelectedCandidates([]);
        fetchRankedCandidates(selectedJobId);
      } else toast.error(result.error || "Failed");
    } catch (e) {
      toast.error("Failed to update hires");
    }
  };

  const handleGenerateTrainingPlan = async (applicationId) => {
    if (!idToken) return;
    setGeneratingPdfForAppId(applicationId);
    try {
      const result = await generateTrainingPlan(applicationId, idToken);
      if (result.success) {
        toast.success("Training plan generated. Use Download PDF to get the file.");
        fetchRankedCandidates(selectedJobId);
      } else toast.error(result.error || "Failed to generate PDF");
    } catch (e) {
      toast.error("Failed to generate training plan");
    } finally {
      setGeneratingPdfForAppId(null);
    }
  };

  const handleDownloadTrainingPlan = (applicationId, candidateName) => {
    if (!idToken) return;
    const url = `${getApiBaseUrl()}/applications/training-plan/${applicationId}/download`;
    const headers = {
      Authorization: `Bearer ${idToken}`,
      "ngrok-skip-browser-warning": "true",
    };
    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("Download failed");
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) throw new Error("Got HTML instead of PDF (ngrok?). Try again.");
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `training-plan-${candidateName || applicationId}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Failed to download PDF"));
  };

  const handleFinalizeJob = async () => {
    if (!selectedJobId || !idToken) return;
    if (!confirm("Finalize this job? It will be marked as completed.")) return;
    setFinalizing(true);
    try {
      const result = await finalizeJob(selectedJobId, idToken);
      if (result.success) {
        toast.success("Job finalized and completed.");
        fetchJobs(idToken);
        setJobMeta((m) => (m ? { ...m, remarks: "completed" } : null));
      } else toast.error(result.error || "Failed");
    } catch (e) {
      toast.error("Failed to finalize job");
    } finally {
      setFinalizing(false);
    }
  };

  useEffect(() => {
    if (selectedJobId && idToken) {
      fetchRankedCandidates(selectedJobId);
    }
  }, [selectedJobId, idToken]);

  // Keep deadline input in sync with jobMeta
  useEffect(() => {
    if (jobMeta?.deadline) {
      try {
        const d = new Date(jobMeta.deadline);
        // Format to yyyy-MM-ddTHH:mm for datetime-local
        const iso = d.toISOString();
        const value = iso.slice(0, 16);
        setDeadlineInput(value);
      } catch {
        setDeadlineInput("");
      }
    } else {
      setDeadlineInput("");
    }
  }, [jobMeta?.deadline]);

  // Selection handlers
  const handleSelectCandidate = (candidate) => {
    const isSelected = selectedCandidates.some(c => c._id === candidate._id || c.email === candidate.email);
    if (isSelected) {
      setSelectedCandidates(prev => prev.filter(c => c._id !== candidate._id && c.email !== candidate.email));
    } else {
      setSelectedCandidates(prev => [...prev, candidate]);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates([...candidates]);
    }
    setSelectAll(!selectAll);
  };

  useEffect(() => {
    setSelectAll(selectedCandidates.length === candidates.length && candidates.length > 0);
  }, [selectedCandidates, candidates]);

  // Email generation handler
  const handleGenerateEmail = async () => {
    if (selectedCandidates.length === 0) {
      toast.warning("Please select at least one candidate");
      return;
    }
    
    setShowConfirmModal(true);
  };

  const confirmAndGenerateEmail = async () => {
    setShowConfirmModal(false);
    setIsGeneratingEmail(true);
    setShowEmailModal(true);

    try {
      const result = await generateInterviewEmail(
        selectedCandidates,
        jobInfo,
        emailType,
        idToken
      );

      if (result.success) {
        setGeneratedEmail({
          subject: result.data.email.subject,
          body: result.data.email.body
        });
        toast.success("Email generated successfully!");
      } else {
        toast.error(result.error || "Failed to generate email");
        setShowEmailModal(false);
      }
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error("Failed to generate email");
      setShowEmailModal(false);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  // Send emails handler
  const handleSendEmails = async () => {
    if (!generatedEmail.subject || !generatedEmail.body) {
      toast.warning("Please generate an email first");
      return;
    }

    setIsSendingEmails(true);

    try {
      const result = await sendInterviewEmails(
        selectedCandidates,
        generatedEmail,
        jobInfo,
        hrInfo,
        idToken,
        { jobId: selectedJobId, emailType }
      );

      if (result.success) {
        toast.success(`Successfully sent ${result.data.sentCount} email(s)!`);
        if (emailType === "interview" && selectedJobId && selectedCandidates.length > 0) {
          const appIds = selectedCandidates.map((c) => c._id);
          await markInterviewInviteSent(selectedJobId, appIds, idToken);
        }
        setShowConfirmModal(false);
        setShowEmailModal(false);
        setGeneratedEmail({ subject: "", body: "" });
        setSelectedCandidates([]);
        setSelectAll(false);
        fetchRankedCandidates(selectedJobId);
      } else {
        toast.error(result.error || "Failed to send emails");
      }
    } catch (error) {
      console.error("Error sending emails:", error);
      toast.error("Failed to send emails");
    } finally {
      setIsSendingEmails(false);
    }
  };

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

  const handlePrepareTest = async () => {
    if (!selectedJobId || !idToken) {
      toast.warning("Please select a job first.");
      return;
    }
    setPreparingTest(true);
    try {
      const result = await prepareTestQuestions(selectedJobId, idToken);
      if (result.success) {
        toast.success("Test questions (MCQ pool + coding) are being generated. You can send online test emails now.");
      } else {
        toast.error(result.error || "Failed to prepare test questions");
      }
    } catch (e) {
      toast.error("Failed to prepare test questions");
    } finally {
      setPreparingTest(false);
    }
  };

  const handleUpdateDeadline = async () => {
    if (!selectedJobId || !idToken || !deadlineInput) {
      toast.warning("Please select a job and choose a deadline date & time.");
      return;
    }
    setUpdatingDeadline(true);
    try {
      const newDeadline = new Date(deadlineInput).toISOString();
      const result = await updateJobPost(selectedJobId, { deadline: newDeadline }, idToken);
      if (result.success) {
        toast.success("Deadline updated.");
        // Refresh jobs and current job meta
        fetchJobs(idToken);
        setJobMeta((prev) => prev ? { ...prev, deadline: result.data.deadline } : prev);
      } else {
        toast.error(result.error || "Failed to update deadline");
      }
    } catch (e) {
      toast.error("Failed to update deadline");
    } finally {
      setUpdatingDeadline(false);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(candidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCandidates = candidates.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 11;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 6) {
        for (let i = 1; i <= 9; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 5) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 8; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
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
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-white via-fuchsia-50/30 to-violet-50/40'}`}>
      <style>{`
        body {
          background: ${darkMode ? '#111827' : '#f9fafb'};
          min-height: 100vh;
        }
      `}</style>

      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 py-4`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
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

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className={`flex items-center gap-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-1`}>
              <button
                type="button"
                onClick={() => setDarkMode(false)}
                className={`p-2 rounded transition-colors ${!darkMode ? 'bg-white shadow-sm' : 'hover:bg-gray-600'}`}
                title="Light mode"
              >
                <svg className={`w-4 h-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setDarkMode(true)}
                className={`p-2 rounded transition-colors ${darkMode ? 'bg-gray-600 shadow-sm' : ''}`}
                title="Dark mode"
              >
                <svg className={`w-4 h-4 ${darkMode ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>
            </div>
            {selectedCandidates.length > 0 && (
              <>
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {selectedCandidates.length} selected
                </span>
                <button
                  onClick={handleGenerateEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white rounded-lg hover:from-fuchsia-600 hover:to-violet-700 transition-all shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Email
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 sm:p-6 ${darkMode ? 'bg-gray-900' : 'bg-transparent'}`}>
        {/* Job Selection */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 mb-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
            Select Job Post
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className={`flex-1 min-w-[200px] px-4 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500`}
              disabled={loading}
            >
              <option value="">-- Select a Job --</option>
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.jobTitle} - {job.company}
                  {job.evaluatedAt ? " (evaluated)" : job.deadline && new Date(job.deadline) < new Date() ? " (deadline passed)" : ""}
                </option>
              ))}
            </select>
            {selectedJobId && jobMeta && !jobMeta.evaluatedAt && jobMeta.deadline && new Date(jobMeta.deadline) < new Date() && (
              <button
                type="button"
                onClick={handleEvaluateJob}
                disabled={evaluating || loading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {evaluating ? "Evaluating…" : "Evaluate applications"}
              </button>
            )}
            {selectedJobId && jobMeta?.evaluatedAt && viewMode === "ranked" && (
              <button
                type="button"
                onClick={handlePrepareTest}
                disabled={preparingTest || loading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {preparingTest ? "Preparing…" : "Prepare online test"}
              </button>
            )}
          </div>
          {selectedJobId && (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr),auto] items-end">
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Application deadline (date & time)
                </label>
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm`}
                />
                {jobMeta?.deadline && (
                  <p className={`mt-1 text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Current deadline: {new Date(jobMeta.deadline).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleUpdateDeadline}
                disabled={updatingDeadline}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {updatingDeadline ? "Updating…" : "Update deadline"}
              </button>
            </div>
          )}
          {viewMode === "evaluated" && candidates.length > 0 && (
            <p className={`mt-2 text-sm ${darkMode ? "text-amber-300" : "text-amber-700"}`}>
              Select candidates below and send &quot;Online test&quot; email to see them in ranked view with test scores.
            </p>
          )}
          {viewMode === "applicants" && candidates.length > 0 && (
            <p className={`mt-2 text-sm ${darkMode ? "text-sky-300" : "text-sky-700"}`}>
              Use &quot;Show instant ranking&quot; on one candidate to evaluate them now; the rest will be ranked after the application deadline.
            </p>
          )}
        </div>

        {/* Candidates Display */}
        {selectedJobId && (
          <>
            {jobInfo && (
              <div className={`${darkMode ? 'bg-fuchsia-900/30 border-fuchsia-700' : 'bg-fuchsia-50 border-fuchsia-200'} rounded-xl shadow-sm p-6 mb-6 border-2 text-center`}>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-fuchsia-100' : 'text-fuchsia-900'} mb-2`}>
                  {jobInfo.jobTitle}
                </h2>
                <p className={`text-base ${darkMode ? 'text-fuchsia-300' : 'text-fuchsia-700'}`}>
                  {jobInfo.company}
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fuchsia-600"></div>
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
                {/* Select All Checkbox */}
                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 mb-4 border ${darkMode ? 'border-gray-700' : 'border-gray-100'} flex items-center justify-between`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-2 border-fuchsia-500 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                    />
                    <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Select All Candidates ({candidates.length})
                    </span>
                  </label>
                  {selectedCandidates.length > 0 && (
                    <span className={`text-sm ${darkMode ? 'text-fuchsia-400' : 'text-fuchsia-600'} font-medium`}>
                      {selectedCandidates.length} candidate{selectedCandidates.length > 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>

                {/* Candidates Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                  {currentCandidates.map((candidate, index) => {
                    const rank = startIndex + index + 1;
                    const isTopThree = rank <= 3;
                    const isSelected = selectedCandidates.some(c => c._id === candidate._id || c.email === candidate.email);

                    return (
                      <div
                        key={candidate._id || index}
                        onClick={() => handleSelectCandidate(candidate)}
                        className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-xl ${
                          isSelected 
                            ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/30' 
                            : isTopThree 
                              ? darkMode ? 'border-fuchsia-700/50' : 'border-fuchsia-200'
                              : darkMode ? 'border-gray-700' : 'border-gray-100'
                        } ${isTopThree ? (darkMode ? 'bg-fuchsia-900/10' : 'bg-fuchsia-50/30') : ''}`}
                      >
                        {/* Card Header */}
                        <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Selection Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleSelectCandidate(candidate);
                                }}
                                className="w-5 h-5 rounded border-2 border-fuchsia-500 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer flex-shrink-0"
                              />
                              
                              {/* Rank Badge */}
                              <div className="flex items-center flex-shrink-0">
                                {rank === 1 && <span className="text-xl mr-1">🥇</span>}
                                {rank === 2 && <span className="text-xl mr-1">🥈</span>}
                                {rank === 3 && <span className="text-xl mr-1">🥉</span>}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isTopThree 
                                    ? 'bg-fuchsia-500 text-white' 
                                    : darkMode 
                                      ? 'bg-gray-700 text-gray-300' 
                                      : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {rank}
                                </div>
                              </div>

                              {/* Avatar & Name */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gradient-to-br from-fuchsia-100 to-fuchsia-200 text-fuchsia-700'
                                  }`}>
                                    {(candidate.candidateName || 'N/A').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {candidate.candidateName || 'N/A'}
                                    </h3>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Total Score + Test Score Badges / Instant ranking */}
                            <div className="flex flex-shrink-0 items-center gap-2">
                              {viewMode === "applicants" ? (
                                candidate.rankedAt ? (
                                  <div className={`px-3 py-1.5 text-sm font-bold rounded-lg shadow-sm border ${
                                    (candidate.totalScore || 0) >= 8 ? "bg-green-500 text-white border-green-600" :
                                    (candidate.totalScore || 0) >= 6 ? "bg-yellow-500 text-white border-yellow-600" :
                                    (candidate.totalScore || 0) >= 4 ? "bg-orange-500 text-white border-orange-600" : "bg-red-500 text-white border-red-600"
                                  }`}>
                                    {(candidate.totalScore ?? 0).toFixed(1)}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleShowInstantRanking(candidate._id); }}
                                    disabled={!!evaluatingOneId}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                                  >
                                    {evaluatingOneId === candidate._id ? "Evaluating…" : "Show instant ranking"}
                                  </button>
                                )
                              ) : (
                                <>
                                  {candidate.testStatus !== undefined && (
                                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${
                                      candidate.testStatus === "pending"
                                        ? "bg-amber-500/80 text-white border-amber-600"
                                        : (candidate.testScore || 0) >= 70
                                          ? "bg-violet-500 text-white border-violet-600"
                                          : (candidate.testScore || 0) >= 50
                                            ? "bg-violet-400/80 text-white border-violet-500"
                                            : "bg-slate-500 text-white border-slate-600"
                                    }`} title="Online test score">
                                      Test: {candidate.testStatus === "pending" ? "Pending" : candidate.testScore}
                                    </span>
                                  )}
                                  <div className={`px-3 py-1.5 text-sm font-bold rounded-lg shadow-sm border ${
                                    (candidate.totalScore || 0) >= 8 ? "bg-green-500 text-white border-green-600" :
                                    (candidate.totalScore || 0) >= 6 ? "bg-yellow-500 text-white border-yellow-600" :
                                    (candidate.totalScore || 0) >= 4 ? "bg-orange-500 text-white border-orange-600" : "bg-red-500 text-white border-red-600"
                                  }`}>
                                    {(candidate.totalScore || 0).toFixed(1)}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'} space-y-2`}>
                          <div className="flex items-center gap-2">
                            <svg className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className={`text-sm truncate ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {candidate.email || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {candidate.phone || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Scores Grid */}
                        <div className="p-4">
                          <div className="grid grid-cols-6 gap-2">
                            {[
                              { label: 'Exp', score: candidate.experienceScore },
                              { label: 'Proj', score: candidate.projectsScore },
                              { label: 'Skills', score: candidate.skillsScore },
                              { label: 'Cert', score: candidate.certificatesScore },
                              { label: 'Edu', score: candidate.educationScore },
                              { label: 'Test', score: candidate.testScore },
                            ].map((item, idx) => (
                              <div key={idx} className="text-center">
                                <div className={`text-[10px] uppercase tracking-wide mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {item.label}
                                </div>
                                <div className={`text-sm font-semibold px-2 py-1 rounded ${
                                  item.score == null && item.label === 'Test'
                                    ? darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                                    : (item.score || 0) >= 8 
                                      ? 'bg-green-100 text-green-700' 
                                      : (item.score || 0) >= 6 
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : (item.score || 0) >= 4
                                          ? 'bg-orange-100 text-orange-700'
                                          : 'bg-red-100 text-red-700'
                                }`}>
                                  {item.label === 'Test' && item.score == null ? '—' : item.label === 'Test' ? (item.score ?? 0) : (item.score ?? 0).toFixed(1)}
                                </div>
                              </div>
                            ))}
                          </div>
                          {candidate.testEvaluationSummary && (
                            <p className={`mt-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} line-clamp-2`} title={candidate.testEvaluationSummary}>
                              {candidate.testEvaluationSummary}
                            </p>
                          )}
                          {viewMode === "ranked" && (candidate.selectedAsHire || candidate.interviewInviteSentAt) && (
                            <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              {candidate.selectedAsHire && (
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${darkMode ? 'bg-fuchsia-800 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-800'}`}>
                                  Selected as hire
                                </span>
                              )}
                              {candidate.selectedAsHire && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleGenerateTrainingPlan(candidate._id); }}
                                    disabled={!!generatingPdfForAppId}
                                    className="text-xs px-2 py-1 rounded bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50"
                                  >
                                    {generatingPdfForAppId === candidate._id ? "Generating…" : "Generate training plan"}
                                  </button>
                                  {candidate.trainingPlanPdfPath && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleDownloadTrainingPlan(candidate._id, candidate.candidateName); }}
                                      className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700"
                                    >
                                      Download PDF
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hires & Finalize (ranked view only, job not completed) */}
                {viewMode === "ranked" && jobMeta?.remarks !== "completed" && (
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 mb-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'} flex flex-wrap items-center gap-3`}>
                    <button
                      type="button"
                      onClick={handleSaveHires}
                      disabled={selectedCandidates.length === 0}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      Save selected as final hires
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalizeJob}
                      disabled={finalizing}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {finalizing ? "Finalizing…" : "Finalize job (mark completed)"}
                    </button>
                  </div>
                )}

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
                                    ? `${darkMode ? 'bg-fuchsia-600 text-white' : 'bg-fuchsia-500 text-white'}`
                                    : `${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'}`
                                }`}
                              >
                                {page}
                              </button>
                            );
                          })}
                        </div>

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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-6`}>
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-fuchsia-900/30' : 'bg-fuchsia-100'}`}>
                <svg className={`w-8 h-8 ${darkMode ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                Confirm Selection
              </h3>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You have selected <span className="font-semibold text-fuchsia-500">{selectedCandidates.length}</span> candidate{selectedCandidates.length > 1 ? 's' : ''}.
              </p>
            </div>

            {/* Selected Candidates List */}
            <div className={`max-h-48 overflow-y-auto mb-6 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-3`}>
              {selectedCandidates.map((candidate, idx) => (
                <div key={idx} className={`flex items-center gap-2 py-2 ${idx > 0 ? `border-t ${darkMode ? 'border-gray-600' : 'border-gray-200'}` : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${darkMode ? 'bg-gray-600 text-gray-300' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                    {(candidate.candidateName || 'N').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {candidate.candidateName || 'N/A'}
                    </p>
                    <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {candidate.email || 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Email Type Selection */}
            <div className="mb-6">
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                Select Email Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setEmailType('interview')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    emailType === 'interview'
                      ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                      : darkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium">Interview</span>
                </button>
                <button
                  onClick={() => setEmailType('online_test')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    emailType === 'online_test'
                      ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                      : darkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium">Online Test</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={confirmAndGenerateEmail}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white rounded-lg font-medium hover:from-fuchsia-600 hover:to-violet-700 transition-all"
              >
                Generate Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview/Edit Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl`}>
            {/* Modal Header */}
            <div className={`sticky top-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex items-center justify-between`}>
              <div>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {emailType === 'online_test' ? 'Online Test' : 'Interview'} Invitation Email
                </h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Preview and edit the email before sending to {selectedCandidates.length} candidate{selectedCandidates.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setGeneratedEmail({ subject: "", body: "" });
                }}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <svg className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {isGeneratingEmail ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fuchsia-600 mb-4"></div>
                  <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Generating email…</p>
                </div>
              ) : (
                <>
                  {/* HR Info Section */}
                  <div className="mb-6">
                    <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                      Your Information (Signature)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={hrInfo.name}
                          onChange={(e) => setHrInfo(prev => ({ ...prev, name: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500`}
                          placeholder="HR Manager"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          Title
                        </label>
                        <input
                          type="text"
                          value={hrInfo.title}
                          onChange={(e) => setHrInfo(prev => ({ ...prev, title: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500`}
                          placeholder="Human Resources"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          Email
                        </label>
                        <input
                          type="email"
                          value={hrInfo.email}
                          onChange={(e) => setHrInfo(prev => ({ ...prev, email: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500`}
                          placeholder="hr@company.com"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          Phone (Optional)
                        </label>
                        <input
                          type="text"
                          value={hrInfo.phone}
                          onChange={(e) => setHrInfo(prev => ({ ...prev, phone: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500`}
                          placeholder="+1 234 567 890"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Subject */}
                  <div className="mb-4">
                    <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                      Subject
                    </label>
                    <input
                      type="text"
                      value={generatedEmail.subject}
                      onChange={(e) => setGeneratedEmail(prev => ({ ...prev, subject: e.target.value }))}
                      className={`w-full px-4 py-3 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500`}
                      placeholder="Email subject..."
                    />
                  </div>

                  {/* Email Body */}
                  <div className="mb-6">
                    <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                      Email Body
                    </label>
                    <textarea
                      value={generatedEmail.body}
                      onChange={(e) => setGeneratedEmail(prev => ({ ...prev, body: e.target.value }))}
                      rows={15}
                      className={`w-full px-4 py-3 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500 font-mono text-sm`}
                      placeholder="Email body..."
                    />
                  </div>

                  {/* Placeholder Guide */}
                  <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <h5 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                      Available Placeholders
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '[CANDIDATE_NAME]',
                        '[HR_NAME]',
                        '[HR_TITLE]',
                        '[COMPANY_NAME]',
                        '[COMPANY_EMAIL]',
                        '[COMPANY_PHONE]',
                        emailType === 'online_test' ? '[TEST_LINK]' : '[INTERVIEW_DATE]',
                        emailType === 'online_test' ? '[TEST_DEADLINE]' : '[INTERVIEW_TIME]',
                        emailType === 'online_test' ? '[TEST_DURATION]' : '[INTERVIEW_LOCATION/LINK]',
                      ].map((placeholder, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-xs rounded ${darkMode ? 'bg-gray-600 text-fuchsia-400' : 'bg-fuchsia-100 text-fuchsia-700'} font-mono`}
                        >
                          {placeholder}
                        </span>
                      ))}
                    </div>
                    <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      These placeholders will be replaced with actual values when sending emails.
                    </p>
                  </div>

                  {/* Recipients Preview */}
                  <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-fuchsia-900/20 border-fuchsia-700' : 'bg-fuchsia-50 border-fuchsia-200'} border`}>
                    <h5 className={`text-sm font-semibold ${darkMode ? 'text-fuchsia-300' : 'text-fuchsia-700'} mb-2`}>
                      Recipients ({selectedCandidates.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidates.slice(0, 5).map((candidate, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-fuchsia-800 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-800'}`}
                        >
                          {candidate.candidateName || candidate.email}
                        </span>
                      ))}
                      {selectedCandidates.length > 5 && (
                        <span className={`px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                          +{selectedCandidates.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!isGeneratingEmail && (
              <div className={`sticky bottom-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t px-6 py-4 flex justify-end gap-3`}>
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setGeneratedEmail({ subject: "", body: "" });
                  }}
                  className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAndGenerateEmail}
                  className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Regenerate
                </button>
                <button
                  onClick={handleSendEmails}
                  disabled={isSendingEmails || !generatedEmail.subject || !generatedEmail.body}
                  className={`px-5 py-2.5 bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white rounded-lg font-medium hover:from-fuchsia-600 hover:to-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                >
                  {isSendingEmails ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Emails
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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
