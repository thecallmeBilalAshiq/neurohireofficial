"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import BrandLogo from "../../../components/BrandLogo";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { toast } from "react-toastify";
import { getMyApplications, getOnboardingProgress, submitWeeklyTask } from "../../../lib/api";

function CandidateOnboardingContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hiredApps, setHiredApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [activeWeek, setActiveWeek] = useState(1);
  const [submissionText, setSubmissionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        localStorage.removeItem("user");
        router.push("/auth/login");
      } else {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        fetchHiredApplications(token);
      }
    });

    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.relative')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [router, showDropdown]);

  const fetchHiredApplications = async (token) => {
    try {
      setLoading(true);
      const res = await getMyApplications(token);
      if (res.success) {
        // Filter applications that are marked as hired and have initiated onboarding
        const hired = (res.data || []).filter(app => app.selectedAsHire === true);
        setHiredApps(hired);
        if (hired.length > 0) {
          // Auto-select first hired application
          handleSelectApp(hired[0], token);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSelectApp = async (app, token = idToken) => {
    setSelectedApp(app);
    setLoadingProgress(true);
    try {
      const res = await getOnboardingProgress(app._id, token);
      if (res.success && res.data.stats?.status !== 'none') {
        setOnboardingData(res.data);
        // Default active week to first incomplete week
        const firstIncomplete = (res.data.tasks || []).find(t => 
          t.jiraStatus.toLowerCase() !== 'done' && t.jiraStatus.toLowerCase() !== 'completed'
        );
        if (firstIncomplete) {
          setActiveWeek(firstIncomplete.weekNumber);
          setSubmissionText(firstIncomplete.submissionText || "");
        } else if (res.data.tasks?.length > 0) {
          setActiveWeek(12);
          setSubmissionText(res.data.tasks[11]?.submissionText || "");
        }
      } else {
        setOnboardingData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleWeekClick = (weekNum) => {
    setActiveWeek(weekNum);
    const task = onboardingData.tasks.find(t => t.weekNumber === weekNum);
    setSubmissionText(task?.submissionText || "");
  };

  const handleSubmitDeliverables = async (e) => {
    e.preventDefault();
    if (!submissionText.trim()) {
      toast.error("Submission notes cannot be empty.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitWeeklyTask(selectedApp._id, activeWeek, submissionText, idToken);
      if (res.success) {
        toast.success(`Week ${activeWeek} deliverables submitted on JIRA!`);
        // Refresh progress
        await handleSelectApp(selectedApp);
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("Failed to submit deliverables");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("user");
      toast.success("Logged out successfully");
      router.push("/auth/login");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  const getStatusColor = (status = "") => {
    const s = status.toLowerCase();
    if (s === "done" || s === "completed") return darkMode ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s === "in progress") return darkMode ? "bg-blue-950 text-blue-400 border-blue-800" : "bg-blue-100 text-blue-800 border-blue-200";
    return darkMode ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gradient-to-br from-white via-fuchsia-50/20 to-violet-50/30 text-gray-900'}`}>
      {/* Sidebar */}
      <div className={`${showSidebar ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r shadow-lg flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className={`p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
          {!sidebarCollapsed ? <BrandLogo className="h-14 w-auto" /> : <BrandLogo className="h-10 w-auto" />}
        </div>
        <div className="flex-1 p-4 space-y-2">
          <button onClick={() => router.push("/candidate/dashboard")} className={`w-full rounded-lg px-3 py-2.5 flex items-center gap-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!sidebarCollapsed && <span className="text-sm font-medium">Dashboard</span>}
          </button>
          <button onClick={() => router.push("/candidate/apply")} className={`w-full rounded-lg px-3 py-2.5 flex items-center gap-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {!sidebarCollapsed && <span className="text-sm font-medium">Apply to Job</span>}
          </button>
          <button className={`w-full rounded-lg px-3 py-2.5 flex items-center gap-3 ${darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'} transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {!sidebarCollapsed && <span className="text-sm font-medium">Onboarding & Training</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <div className={`p-6 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold">Onboarding & Training Program</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            
            <div className="relative">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowDropdown(!showDropdown)}>
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || "C"}
                </div>
                <span className="hidden sm:inline text-sm font-medium">{user?.name || "Candidate"}</span>
              </div>
              {showDropdown && (
                <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border p-1 z-50 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Area */}
        <div className="p-6 max-w-6xl mx-auto w-full flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
            </div>
          ) : hiredApps.length === 0 ? (
            <div className={`text-center py-16 px-6 rounded-2xl border ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className="text-xl font-bold mb-2">No active onboarding programs found.</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto">Once you are finalized as a hired candidate for a position, HR will set up your 12-week onboarding roadmap here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Job Selector (if multiple hired jobs) */}
              {hiredApps.length > 1 && (
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Hired Position</label>
                  <select 
                    value={selectedApp?._id || ""} 
                    onChange={(e) => handleSelectApp(hiredApps.find(a => a._id === e.target.value))}
                    className={`w-full max-w-md px-3 py-2 rounded-lg border outline-none ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'}`}
                  >
                    {hiredApps.map(app => (
                      <option key={app._id} value={app._id}>{app.jobPost?.jobTitle} - {app.jobPost?.company}</option>
                    ))}
                  </select>
                </div>
              )}

              {loadingProgress ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                </div>
              ) : !onboardingData ? (
                <div className={`text-center py-16 px-6 rounded-2xl border ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h2 className="text-xl font-bold mb-2">Onboarding Program Pending Initiation</h2>
                  <p className="text-gray-500 text-sm max-w-md mx-auto">Your onboarding program for **{selectedApp?.jobPost?.jobTitle}** at **{selectedApp?.jobPost?.company}** is pending JIRA initialization by HR.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Side: 12 Weeks Navigation */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <h3 className="font-bold mb-1">Onboarding Progress</h3>
                      <p className="text-xs text-gray-500 mb-4">{selectedApp?.jobPost?.jobTitle} @ {selectedApp?.jobPost?.company}</p>
                      
                      <div className="flex items-center justify-between text-sm font-semibold mb-2">
                        <span>{onboardingData.stats.completedTasks} / 12 Weeks Done</span>
                        <span>{onboardingData.stats.progressPercentage}%</span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-6">
                        <div 
                          className="bg-purple-600 h-2.5 rounded-full transition-all duration-500" 
                          style={{ width: `${onboardingData.stats.progressPercentage}%` }} 
                        />
                      </div>

                      {/* 12 Week Grid */}
                      <div className="grid grid-cols-4 gap-2">
                        {onboardingData.tasks.map(task => {
                          const isDone = task.jiraStatus.toLowerCase() === 'done' || task.jiraStatus.toLowerCase() === 'completed';
                          const isActive = activeWeek === task.weekNumber;
                          return (
                            <button
                              key={task.weekNumber}
                              onClick={() => handleWeekClick(task.weekNumber)}
                              className={`h-11 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all ${
                                isActive
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-105'
                                  : isDone
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                              }`}
                            >
                              W{task.weekNumber}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Active Week Tasks & Submissions */}
                  <div className="lg:col-span-2 space-y-6">
                    {(() => {
                      const task = onboardingData.tasks.find(t => t.weekNumber === activeWeek);
                      if (!task) return null;
                      const isDone = task.jiraStatus.toLowerCase() === 'done' || task.jiraStatus.toLowerCase() === 'completed';

                      return (
                        <div className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} space-y-6`}>
                          {/* Task Title & JIRA status */}
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 dark:border-gray-700">
                            <div>
                              <h2 className="text-xl font-bold">Week {task.weekNumber}: {task.title}</h2>
                              {task.jiraIssueKey && (
                                <p className="text-xs text-gray-400 mt-1">
                                  JIRA Ticket: <span className="font-semibold text-purple-400 hover:underline">{task.jiraIssueKey}</span>
                                </p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(task.jiraStatus)}`}>
                              {task.jiraStatus}
                            </span>
                          </div>

                          {/* Task Description */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Weekly Objective</h4>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
                          </div>

                          {/* Deliverables */}
                          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Required Deliverables</h4>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.deliverables}</p>
                          </div>

                          {/* Weekly Submission Form */}
                          <form onSubmit={handleSubmitDeliverables} className="space-y-4 pt-4 border-t dark:border-gray-700">
                            <h4 className="text-sm font-bold">Submit Deliverables</h4>
                            {isDone ? (
                              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/20 border-emerald-900 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-800'} text-sm`}>
                                <p className="font-bold mb-1">✓ Deliverables Submitted</p>
                                <p className="text-xs opacity-80 mb-3">Posted on JIRA as a completed task.</p>
                                <div className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${darkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-gray-700 border border-emerald-100'}`}>
                                  {task.submissionText}
                                </div>
                              </div>
                            ) : (
                              <>
                                <textarea
                                  value={submissionText}
                                  onChange={(e) => setSubmissionText(e.target.value)}
                                  placeholder="Describe the work completed this week. Include github links, pull requests, deployed staging links, or text-based deliverables. This will be posted as a comment on your JIRA ticket."
                                  className={`w-full h-32 px-3 py-2 text-sm rounded-lg border outline-none focus:ring-1 focus:ring-purple-500 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'}`}
                                  required
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
                                  >
                                    {submitting ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                        Submitting...
                                      </>
                                    ) : (
                                      "Submit to JIRA"
                                    )}
                                  </button>
                                </div>
                              </>
                            )}
                          </form>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CandidateOnboarding() {
  return (
    <ProtectedRoute requiredRole="candidate">
      <CandidateOnboardingContent />
    </ProtectedRoute>
  );
}
