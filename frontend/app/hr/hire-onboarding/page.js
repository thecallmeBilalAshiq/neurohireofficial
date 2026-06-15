"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { 
  getOnboardingHires, 
  getApiBaseUrl, 
  generateTrainingPlan, 
  getOnboardingProgress, 
  initiateOnboarding, 
  evaluateOnboardingPerformance 
} from "../../../lib/api";
import { toast } from "react-toastify";
import { useHrDarkMode } from "../../../lib/useHrDarkMode";

function HireOnboardingContent() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useHrDarkMode();
  const [idToken, setIdToken] = useState(null);
  const [hires, setHires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterJob, setFilterJob] = useState("");
  const [genId, setGenId] = useState(null);

  // JIRA Onboarding management state
  const [activeApp, setActiveApp] = useState(null);
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const t = await u.getIdToken();
      setIdToken(t);
      setLoading(true);
      const r = await getOnboardingHires(t);
      if (r.success) setHires(r.data.hires || []);
      else toast.error(r.error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const fetchOnboardingProgress = async (appId, token = idToken) => {
    setLoadingProgress(true);
    try {
      const r = await getOnboardingProgress(appId, token);
      if (r.success) {
        setOnboardingProgress(r.data);
      } else {
        toast.error(r.error);
      }
    } catch (err) {
      toast.error("Failed to load JIRA progress");
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleOpenJiraProgram = (app) => {
    setActiveApp(app);
    fetchOnboardingProgress(app.applicationId);
  };

  const handleCloseJiraProgram = () => {
    setActiveApp(null);
    setOnboardingProgress(null);
  };

  const handleInitiateJiraProgram = async () => {
    if (!idToken || !activeApp) return;
    setInitiating(true);
    try {
      const r = await initiateOnboarding(activeApp.applicationId, idToken);
      if (r.success) {
        toast.success(r.data.message || "Onboarding program initiated on JIRA!");
        fetchOnboardingProgress(activeApp.applicationId);
      } else {
        toast.error(r.error);
      }
    } catch (err) {
      toast.error("Failed to initiate JIRA program");
    } finally {
      setInitiating(false);
    }
  };

  const handleEvaluatePerformance = async () => {
    if (!idToken || !activeApp) return;
    setEvaluating(true);
    try {
      const r = await evaluateOnboardingPerformance(activeApp.applicationId, idToken);
      if (r.success) {
        toast.success("AI Onboarding performance evaluation report generated!");
        fetchOnboardingProgress(activeApp.applicationId);
      } else {
        toast.error(r.error);
      }
    } catch (err) {
      toast.error("Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  const jobs = [...new Map(hires.map((h) => [h.jobId, { id: h.jobId, title: h.jobTitle, company: h.company }])).values()];

  const filtered = filterJob ? hires.filter((h) => h.jobId === filterJob) : hires;

  const downloadPlan = (applicationId, name) => {
    if (!idToken) return;
    fetch(`${getApiBaseUrl()}/applications/training-plan/${applicationId}/download`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "ngrok-skip-browser-warning": "true",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("fail");
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `training-plan-${name || applicationId}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Download failed"));
  };

  const genPlan = async (applicationId) => {
    if (!idToken) return;
    setGenId(applicationId);
    try {
      const r = await generateTrainingPlan(applicationId, idToken);
      if (r.success) {
        toast.success("Training plan generated.");
        const token = await auth.currentUser.getIdToken();
        const r2 = await getOnboardingHires(token);
        if (r2.success) setHires(r2.data.hires || []);
      } else toast.error(r.error);
    } catch {
      toast.error("Failed");
    } finally {
      setGenId(null);
    }
  };

  const selectClass = `w-full max-w-md rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? "border-slate-600 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`;

  const getStatusColor = (status = "") => {
    const s = status.toLowerCase();
    if (s === "done" || s === "completed") return darkMode ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s === "in progress") return darkMode ? "bg-blue-950 text-blue-400 border-blue-800" : "bg-blue-100 text-blue-800 border-blue-200";
    return darkMode ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div
      className={`min-h-screen font-sans antialiased ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40 text-slate-900"}`}
    >
      <header
        className={`sticky top-0 z-10 border-b backdrop-blur-md ${darkMode ? "border-slate-800/80 bg-slate-900/90" : "border-slate-200/80 bg-white/90"} px-4 py-4 flex items-center gap-3`}
      >
        <button
          type="button"
          onClick={activeApp ? handleCloseJiraProgram : () => router.push("/hr/dashboard")}
          className={`p-2.5 rounded-xl transition-colors ${darkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div
          className={`hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-teal-500/15 text-teal-300" : "bg-teal-100 text-teal-700"}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className={`text-lg sm:text-xl font-bold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
            {activeApp ? `Onboarding Manager: ${activeApp.candidateName}` : "Hire candidates onboarding"}
          </h1>
          <p className={`text-xs sm:text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            {activeApp ? `${activeApp.jobTitle} at ${activeApp.company}` : "Selected hires across your jobs"}
          </p>
        </div>
        <div className={`ml-auto flex gap-1 rounded-xl p-1 border ${darkMode ? "border-slate-700 bg-slate-800/80" : "border-slate-200 bg-slate-100"}`}>
          <button
            type="button"
            onClick={() => setDarkMode(false)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${!darkMode ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Light
          </button>
          <button
            type="button"
            onClick={() => setDarkMode(true)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${darkMode ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
            Dark
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {activeApp ? (
          /* Detailed Onboarding & JIRA view */
          <div className="space-y-6">
            {loadingProgress ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <p className="text-sm font-medium">Loading program progress...</p>
              </div>
            ) : !onboardingProgress || onboardingProgress?.stats?.status === "none" ? (
              /* Program not yet initiated */
              <div className={`rounded-2xl border p-10 text-center ${darkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white"}`}>
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${darkMode ? "bg-purple-950 text-purple-400" : "bg-purple-100 text-purple-700"}`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Initiate Onboarding on JIRA</h2>
                <p className={`max-w-md mx-auto text-sm mb-6 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  neurohire will generate a tailored 12-week onboarding roadmap using AI and create the 12 weekly tasks directly in your JIRA project board.
                </p>
                <button
                  onClick={handleInitiateJiraProgram}
                  disabled={initiating}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-purple-900/20 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                >
                  {initiating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Creating tickets on JIRA...
                    </>
                  ) : (
                    "Setup 12-Week JIRA Program"
                  )}
                </button>
              </div>
            ) : (
              /* Program Progress Panel */
              <div className="space-y-6">
                {/* Metrics Summary Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Progress metric */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"} md:col-span-1 flex flex-col justify-between`}>
                    <div>
                      <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">JIRA Progress</h3>
                      <p className="text-3xl font-extrabold mt-2 text-purple-500">
                        {onboardingProgress?.stats?.completedTasks} / 12
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Weekly Tasks Finished</p>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span>Completion Rate</span>
                        <span>{onboardingProgress?.stats?.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${onboardingProgress?.stats?.progressPercentage}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: AI coach evaluation report trigger */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"} md:col-span-2 space-y-4`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">AI Onboarding Evaluation</h3>
                        <p className="text-xs text-slate-400 mt-1">Evaluate weekly submissions and JIRA task completion reports using an AI agent.</p>
                      </div>
                      {onboardingProgress?.stats?.status === 'evaluated' && (
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${darkMode ? "bg-emerald-950/40 text-emerald-400 border-emerald-800" : "bg-emerald-100 text-emerald-800 border-emerald-200"}`}>
                          Score: {onboardingProgress?.stats?.evaluation?.score}/100
                        </div>
                      )}
                    </div>
                    
                    {onboardingProgress?.stats?.status !== 'evaluated' ? (
                      <button
                        onClick={handleEvaluatePerformance}
                        disabled={evaluating}
                        className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors inline-flex items-center gap-2"
                      >
                        {evaluating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            AI Coach auditing submissions...
                          </>
                        ) : (
                          "Trigger AI Performance Evaluation"
                        )}
                      </button>
                    ) : (
                      <div className={`p-3 rounded-xl text-xs max-h-32 overflow-y-auto leading-relaxed border whitespace-pre-wrap ${darkMode ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                        {onboardingProgress?.stats?.evaluation?.feedbackText}
                      </div>
                    )}
                  </div>
                </div>

                {/* 12-Week Program Tasks List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">12-Week Onboarding Tasks (JIRA Sync)</h3>
                  {onboardingProgress.tasks.map((task) => (
                    <div 
                      key={task.weekNumber} 
                      className={`p-5 rounded-2xl border transition-all ${darkMode ? "border-slate-800 bg-slate-900/50 hover:bg-slate-900" : "border-slate-200 bg-white hover:bg-slate-50/50"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b dark:border-slate-800 mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`h-7 w-7 rounded-lg font-bold text-xs flex items-center justify-center ${darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
                            W{task.weekNumber}
                          </span>
                          <h4 className="font-bold text-sm sm:text-base">{task.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.jiraIssueKey && (
                            <span className="text-xs font-semibold text-slate-400">{task.jiraIssueKey}</span>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(task.jiraStatus)}`}>
                            {task.jiraStatus}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Objective</p>
                          <p className="whitespace-pre-wrap">{task.description}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Deliverables Required</p>
                          <p className="whitespace-pre-wrap">{task.deliverables}</p>
                        </div>
                      </div>
                      {task.submissionText && (
                        <div className={`mt-4 p-4 rounded-xl border leading-relaxed text-xs ${darkMode ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-150 text-slate-700"}`}>
                          <p className="font-bold mb-1.5 flex items-center gap-1.5 text-slate-400">
                            <span>Candidate Submission notes:</span>
                            {task.submittedAt && (
                              <span className="font-normal text-[10px] text-slate-500">Submitted at: {new Date(task.submittedAt).toLocaleDateString()}</span>
                            )}
                          </p>
                          <p className="whitespace-pre-wrap">{task.submissionText}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List of hired candidates */
          <div>
            <div
              className={`rounded-2xl border p-5 mb-6 shadow-sm ${darkMode ? "border-slate-700/80 bg-slate-900/60 shadow-black/20" : "border-slate-200/80 bg-white shadow-slate-200/50"}`}
            >
              <label
                className={`mb-2 flex items-center gap-2 text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}
              >
                <svg className={`w-4 h-4 ${darkMode ? "text-cyan-400" : "text-cyan-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter by job
              </label>
              <select value={filterJob} onChange={(e) => setFilterJob(e.target.value)} className={selectClass}>
                <option value="">All jobs</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.company}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                <p className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Loading hires…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border py-16 px-6 text-center ${darkMode ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"}`}
              >
                <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${darkMode ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"}`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className={`text-base font-medium ${darkMode ? "text-slate-200" : "text-slate-800"}`}>No hired candidates yet</p>
                <p className={`mt-1 max-w-sm text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  When you complete final hire on a job, selected candidates appear here for onboarding.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((h) => (
                  <div
                    key={h.applicationId}
                    className={`flex flex-col gap-4 rounded-2xl border p-5 transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-700 bg-slate-900/70 hover:border-teal-500/30" : "border-slate-200 bg-white hover:border-teal-200"}`}
                  >
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-teal-300" : "bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-700"}`}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className={`truncate font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{h.candidateName}</div>
                        <div className={`flex items-center gap-1.5 truncate text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                          <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {h.email}
                        </div>
                        <div className={`mt-2 flex flex-wrap items-center gap-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${darkMode ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"}`}>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {h.jobTitle}
                          </span>
                          <span className={darkMode ? "text-slate-500" : "text-slate-500"}>·</span>
                          <span>{h.company}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenJiraProgram(h)}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 hover:bg-purple-500"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7A2 2 0 0015 5h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        JIRA Onboarding
                      </button>
                      <button
                        type="button"
                        onClick={() => genPlan(h.applicationId)}
                        disabled={genId === h.applicationId}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {genId === h.applicationId ? "…" : "Generate training plan"}
                      </button>
                      {h.trainingPlanPdfPath && (
                        <button
                          type="button"
                          onClick={() => downloadPlan(h.applicationId, h.candidateName)}
                          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 hover:bg-teal-500"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HireOnboardingPage() {
  return (
    <ProtectedRoute requiredRole="HR">
      <HireOnboardingContent />
    </ProtectedRoute>
  );
}
