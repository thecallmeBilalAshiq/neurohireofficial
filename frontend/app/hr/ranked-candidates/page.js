"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import {
  getJobsForRanking,
  getCvRankedCandidates,
  evaluateJobApplications,
  evaluateOneApplication,
  prepareTestQuestions,
  getJobTestContent,
  saveJobTestContent,
  regenerateJobTest,
  generateInterviewEmail,
  sendTestTop50,
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
  const [jobMeta, setJobMeta] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluatingOneId, setEvaluatingOneId] = useState(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [updatingDeadline, setUpdatingDeadline] = useState(false);

  const [showTestWizard, setShowTestWizard] = useState(false);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardStep, setWizardStep] = useState("edit");
  const [mcqQuestions, setMcqQuestions] = useState([]);
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [mcqJson, setMcqJson] = useState("[]");
  const [codingJson, setCodingJson] = useState("[]");
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenScope, setRegenScope] = useState("both");
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });

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
      if (result.success) setJobs(result.data);
      else toast.error(result.error || "Failed to fetch jobs");
    } catch (e) {
      toast.error("Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

  const fetchCvList = useCallback(async (jobId) => {
    if (!jobId || !idToken) {
      setCandidates([]);
      setJobInfo(null);
      setJobMeta(null);
      return;
    }
    try {
      setLoading(true);
      const result = await getCvRankedCandidates(jobId, idToken);
      if (result.success) {
        const list = [...(result.data.candidates || [])].sort(
          (a, b) => (b.totalScore || 0) - (a.totalScore || 0)
        );
        setCandidates(list);
        setJobInfo({
          jobTitle: result.data.jobTitle,
          company: result.data.company,
        });
        setJobMeta({
          deadline: result.data.deadline,
          evaluatedAt: result.data.evaluatedAt,
          remarks: result.data.remarks,
          hirePipelineStage: result.data.hirePipelineStage,
          assessmentInviteSentAt: result.data.assessmentInviteSentAt,
          assessmentDeadline: result.data.assessmentDeadline,
          testContentFinalizedAt: result.data.testContentFinalizedAt,
        });
        setCurrentPage(1);
      } else {
        toast.error(result.error || "Failed to load");
        setCandidates([]);
      }
    } catch (e) {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    if (selectedJobId && idToken) fetchCvList(selectedJobId);
  }, [selectedJobId, idToken, fetchCvList]);

  useEffect(() => {
    if (jobMeta?.deadline) {
      try {
        const d = new Date(jobMeta.deadline);
        setDeadlineInput(d.toISOString().slice(0, 16));
      } catch {
        setDeadlineInput("");
      }
    } else setDeadlineInput("");
  }, [jobMeta?.deadline]);

  const handleEvaluateJob = async () => {
    if (!selectedJobId || !idToken) return;
    setEvaluating(true);
    try {
      const result = await evaluateJobApplications(selectedJobId, idToken);
      if (result.success) {
        toast.success(result.data?.message || "Evaluated.");
        fetchJobs(idToken);
        fetchCvList(selectedJobId);
      } else toast.error(result.error || "Failed");
    } catch {
      toast.error("Failed");
    } finally {
      setEvaluating(false);
    }
  };

  const handleInstantRank = async (applicationId) => {
    if (!idToken) return;
    setEvaluatingOneId(applicationId);
    try {
      const result = await evaluateOneApplication(applicationId, idToken);
      if (result.success) {
        toast.success("Candidate scored.");
        fetchCvList(selectedJobId);
      } else toast.error(result.error || "Failed");
    } catch {
      toast.error("Failed");
    } finally {
      setEvaluatingOneId(null);
    }
  };

  const handleUpdateDeadline = async () => {
    if (!selectedJobId || !idToken || !deadlineInput) {
      toast.warning("Select job and deadline.");
      return;
    }
    setUpdatingDeadline(true);
    try {
      const iso = new Date(deadlineInput).toISOString();
      const result = await updateJobPost(selectedJobId, { deadline: iso }, idToken);
      if (result.success) {
        toast.success("Deadline updated.");
        fetchJobs(idToken);
        setJobMeta((m) => (m ? { ...m, deadline: result.data.deadline } : m));
      } else toast.error(result.error || "Failed");
    } catch {
      toast.error("Failed");
    } finally {
      setUpdatingDeadline(false);
    }
  };

  const syncJsonFromState = () => {
    try {
      setMcqJson(JSON.stringify(mcqQuestions, null, 2));
      setCodingJson(JSON.stringify(codingQuestions, null, 2));
    } catch {
      toast.error("Could not serialize questions");
    }
  };

  const openTestWizard = async () => {
    if (!selectedJobId || !idToken) return;
    setShowTestWizard(true);
    setWizardStep("edit");
    setWizardBusy(true);
    try {
      const prep = await prepareTestQuestions(selectedJobId, idToken);
      if (!prep.success) {
        toast.error(prep.error || "Generation failed");
        setShowTestWizard(false);
        return;
      }
      const content = await getJobTestContent(selectedJobId, idToken);
      if (!content.success) {
        toast.error(content.error || "Could not load test");
        setShowTestWizard(false);
        return;
      }
      const mcq = content.data.mcqQuestions || [];
      const cod = content.data.codingQuestions || [];
      setMcqQuestions(mcq);
      setCodingQuestions(cod);
      setMcqJson(JSON.stringify(mcq, null, 2));
      setCodingJson(JSON.stringify(cod, null, 2));
      toast.success("Test draft loaded. Review, edit, or regenerate.");
    } catch {
      toast.error("Failed to open test builder");
      setShowTestWizard(false);
    } finally {
      setWizardBusy(false);
    }
  };

  const applyJsonToState = () => {
    try {
      const m = JSON.parse(mcqJson);
      const c = JSON.parse(codingJson);
      if (!Array.isArray(m) || !Array.isArray(c)) throw new Error("Expected arrays");
      setMcqQuestions(m);
      setCodingQuestions(c);
      return true;
    } catch {
      toast.error("Invalid JSON");
      return false;
    }
  };

  const handleSaveTest = async () => {
    if (!selectedJobId || !idToken) return;
    if (!applyJsonToState()) return;
    setWizardBusy(true);
    try {
      const result = await saveJobTestContent(
        selectedJobId,
        { mcqQuestions, codingQuestions },
        idToken
      );
      if (result.success) {
        toast.success("Test saved.");
        const sample =
          candidates[0] ||
          ({ _id: "", email: "candidate@example.com", candidateName: "Candidate" });
        const gen = await generateInterviewEmail(
          [
            {
              _id: sample._id,
              email: sample.email,
              candidateName: sample.candidateName,
            },
          ],
          jobInfo,
          "online_test",
          idToken
        );
        if (gen.success) {
          setEmailDraft({
            subject: gen.data.email.subject,
            body: gen.data.email.body,
          });
          setWizardStep("email");
          toast.success("Email draft generated — review and send to top 50.");
        } else toast.error(gen.error || "Email draft failed");
        fetchCvList(selectedJobId);
        fetchJobs(idToken);
      } else toast.error(result.error || "Save failed");
    } catch {
      toast.error("Save failed");
    } finally {
      setWizardBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedJobId || !idToken) return;
    setWizardBusy(true);
    try {
      const result = await regenerateJobTest(
        selectedJobId,
        { instruction: regenInstruction, scope: regenScope },
        idToken
      );
      if (result.success) {
        const mcq = result.data.mcqQuestions || [];
        const cod = result.data.codingQuestions || [];
        setMcqQuestions(mcq);
        setCodingQuestions(cod);
        setMcqJson(JSON.stringify(mcq, null, 2));
        setCodingJson(JSON.stringify(cod, null, 2));
        toast.success("Regenerated.");
      } else toast.error(result.error || "Regenerate failed");
    } catch {
      toast.error("Regenerate failed");
    } finally {
      setWizardBusy(false);
    }
  };

  const handleSendTop50 = async () => {
    if (!selectedJobId || !idToken) return;
    setWizardBusy(true);
    try {
      const user = auth.currentUser;
      const result = await sendTestTop50(
        selectedJobId,
        {
          emailContent: emailDraft,
          hrInfo: {
            name: user?.displayName || "HR Team",
            title: "Human Resources",
            email: user?.email || "",
            phone: "",
          },
          jobInfo,
        },
        idToken
      );
      if (result.success) {
        toast.success(
          `Sent ${result.data.sentTestCount} test invite(s). ${result.data.sentCondolenceCount || 0} update email(s) to other applicants.`
        );
        setShowTestWizard(false);
        fetchCvList(selectedJobId);
        fetchJobs(idToken);
      } else toast.error(result.error || "Send failed");
    } catch {
      toast.error("Send failed");
    } finally {
      setWizardBusy(false);
    }
  };

  const totalPages = Math.ceil(candidates.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCandidates = candidates.slice(startIndex, startIndex + itemsPerPage);

  const testAlreadySent = !!jobMeta?.assessmentInviteSentAt;
  const canCreateTest =
    jobMeta?.evaluatedAt && !testAlreadySent && jobMeta?.remarks !== "completed";

  return (
    <div
      className={`min-h-screen font-sans antialiased ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gradient-to-br from-slate-50 via-fuchsia-50/25 to-violet-50/35 text-slate-900"}`}
    >
      <style>{`body { background: ${darkMode ? "#020617" : "#f8fafc"}; min-height: 100vh; }`}</style>

      <header
        className={`sticky top-0 z-10 border-b backdrop-blur-md ${darkMode ? "border-slate-800/80 bg-slate-900/90" : "border-slate-200/80 bg-white/90"} shadow-sm px-4 sm:px-6 py-4`}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/hr/dashboard")}
              className={`p-2.5 rounded-xl shrink-0 ${darkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
              aria-label="Back"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div
              className={`hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-fuchsia-500/15 text-fuchsia-300" : "bg-fuchsia-100 text-fuchsia-700"}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
                Ranked Candidates (CV scores)
              </h1>
              <p className={`text-xs sm:text-sm mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                CV-based ranking only. Online test invites go to the top 50 after you create & finalize the test.
              </p>
            </div>
          </div>
          <div className={`flex gap-1 rounded-xl p-1 border ${darkMode ? "border-slate-700 bg-slate-800/80" : "border-slate-200 bg-slate-100"}`}>
            <button
              type="button"
              onClick={() => setDarkMode(false)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium ${!darkMode ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Light
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(true)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium ${darkMode ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              Dark
            </button>
          </div>
        </div>
      </header>

      <div className={`p-4 sm:p-6 ${darkMode ? "bg-slate-950" : ""}`}>
        <div
          className={`rounded-2xl shadow-sm p-6 mb-6 border ${darkMode ? "border-slate-700/80 bg-slate-900/60 shadow-black/20" : "border-slate-200/80 bg-white shadow-slate-200/40"}`}
        >
          <label className={`flex items-center gap-2 text-sm font-medium mb-3 ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
            <svg className={`w-4 h-4 ${darkMode ? "text-violet-400" : "text-violet-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Select Job Post
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className={`flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border text-sm outline-none ${darkMode ? "border-slate-600 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"}`}
              disabled={loading}
            >
              <option value="">-- Select a Job --</option>
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.jobTitle} — {job.company}
                  {job.assessmentInviteSentAt ? " (test sent)" : ""}
                </option>
              ))}
            </select>
            {selectedJobId && jobMeta && !jobMeta.evaluatedAt && jobMeta.deadline && new Date(jobMeta.deadline) < new Date() && (
              <button
                type="button"
                onClick={handleEvaluateJob}
                disabled={evaluating}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white disabled:opacity-50"
              >
                {evaluating ? "Evaluating…" : "Evaluate applications"}
              </button>
            )}
            {selectedJobId && canCreateTest && (
              <button
                type="button"
                onClick={openTestWizard}
                disabled={wizardBusy}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Create test
              </button>
            )}
          </div>
          {testAlreadySent && jobMeta?.assessmentDeadline && (
            <p className={`mt-3 text-sm ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}>
              Test invitations sent. Candidate window ends:{" "}
              <strong>{new Date(jobMeta.assessmentDeadline).toLocaleString()}</strong> (10 minutes from send).
            </p>
          )}
          {selectedJobId && (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr),auto] items-end">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                  Application deadline
                </label>
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${darkMode ? "border-slate-600 bg-slate-900 text-white [color-scheme:dark]" : "border-slate-200 bg-white text-slate-900"}`}
                />
              </div>
              <button
                type="button"
                onClick={handleUpdateDeadline}
                disabled={updatingDeadline}
                className="px-4 py-2 rounded-lg text-sm bg-sky-600 text-white disabled:opacity-50"
              >
                {updatingDeadline ? "Updating…" : "Update deadline"}
              </button>
            </div>
          )}
        </div>

        {selectedJobId && jobInfo && (
          <div
            className={`rounded-2xl p-6 mb-6 border-2 text-center shadow-sm ${darkMode ? "border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/80 to-violet-950/60" : "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-violet-50"}`}
          >
            <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${darkMode ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-fuchsia-200 text-fuchsia-800"}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className={`text-xl font-bold ${darkMode ? "text-fuchsia-50" : "text-fuchsia-950"}`}>{jobInfo.jobTitle}</h2>
            <p className={`mt-1 text-sm font-medium ${darkMode ? "text-fuchsia-200/90" : "text-fuchsia-800"}`}>{jobInfo.company}</p>
          </div>
        )}

        {loading && selectedJobId ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-fuchsia-500 border-t-transparent" />
            <p className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Loading candidates…</p>
          </div>
        ) : selectedJobId && candidates.length === 0 ? (
          <div
            className={`rounded-2xl border p-10 text-center ${darkMode ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-white"}`}
          >
            <p className={`text-base font-medium ${darkMode ? "text-slate-200" : "text-slate-800"}`}>No applications yet.</p>
            <p className={`mt-2 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Candidates will appear here after they apply to this job.</p>
          </div>
        ) : (
          selectedJobId && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentCandidates.map((candidate, index) => {
                const rank = startIndex + index + 1;
                const hasRank = !!candidate.rankedAt;
                return (
                  <div
                    key={candidate._id}
                    className={`rounded-2xl border-2 p-4 shadow-md transition hover:shadow-lg ${darkMode ? "border-slate-700 bg-slate-900/70 hover:border-fuchsia-500/35" : "border-slate-100 bg-white hover:border-fuchsia-200"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-fuchsia-900/30">
                          {rank}
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-semibold truncate ${darkMode ? "text-white" : "text-slate-900"}`}>
                            {candidate.candidateName}
                          </h3>
                          <p className={`text-xs truncate flex items-center gap-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                            <svg className="w-3 h-3 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {candidate.email}
                          </p>
                        </div>
                      </div>
                      {hasRank ? (
                        <div className="px-2 py-1 rounded-lg bg-green-600 text-white text-sm font-bold shrink-0">
                          {(candidate.totalScore ?? 0).toFixed(1)}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInstantRank(candidate._id)}
                          disabled={!!evaluatingOneId}
                          className="text-xs px-2 py-1 rounded bg-sky-600 text-white shrink-0"
                        >
                          {evaluatingOneId === candidate._id ? "…" : "Score now"}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      {[
                        ["Exp", candidate.experienceScore, "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"],
                        ["Proj", candidate.projectsScore, "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"],
                        ["Skills", candidate.skillsScore, "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"],
                        ["Cert", candidate.certificatesScore, "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"],
                        ["Edu", candidate.educationScore, "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"],
                        ["Lang", candidate.languagesScore, "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"],
                      ].map(([label, score, path]) => (
                        <div
                          key={label}
                          className={`rounded-lg px-1 py-1.5 ${darkMode ? "bg-slate-800/90 border border-slate-700/80" : "bg-slate-50 border border-slate-100"}`}
                        >
                          <div className={`flex items-center justify-center gap-0.5 font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                            <svg className="w-3 h-3 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
                            </svg>
                            {label}
                          </div>
                          <div className={`font-bold tabular-nums ${darkMode ? "text-white" : "text-slate-900"}`}>{(score ?? 0).toFixed(1)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {selectedJobId && candidates.length > itemsPerPage && (
          <div className="flex justify-center items-center gap-3 mt-8">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${darkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              Previous
            </button>
            <span className={`text-sm font-medium tabular-nums ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${darkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showTestWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div
            className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 sm:p-8 ${darkMode ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
          >
            <h3 className={`text-lg font-bold mb-2 flex items-center gap-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
              <svg className="w-6 h-6 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Create online test
            </h3>
            <p className={`text-sm mb-4 leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
              Step 1: AI generated a draft. Edit JSON below, regenerate with instructions, then save. Step 2: Review the email and send to the{" "}
              <strong>top 50</strong> by CV score. Others receive a respectful update. Candidates have <strong>10 minutes</strong> from send to start the test (link expires after that).
            </p>

            {wizardStep === "edit" && (
              <>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Regenerate scope</label>
                    <select
                      value={regenScope}
                      onChange={(e) => setRegenScope(e.target.value)}
                      className={`w-full rounded-xl border px-2 py-2 text-sm outline-none ${darkMode ? "border-slate-600 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}
                    >
                      <option value="both">MCQ + Coding</option>
                      <option value="mcq">MCQ only</option>
                      <option value="coding">Coding only</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Instructions for AI (regenerate)</label>
                    <input
                      value={regenInstruction}
                      onChange={(e) => setRegenInstruction(e.target.value)}
                      placeholder="e.g. More focus on React and system design"
                      className={`w-full rounded-xl border px-2 py-2 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 ${darkMode ? "border-slate-600 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={wizardBusy}
                  className="mb-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
                >
                  Regenerate with instructions
                </button>
                <div className="mb-2">
                  <label className={`text-xs font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>MCQ questions (JSON array, min 30)</label>
                  <textarea
                    value={mcqJson}
                    onChange={(e) => setMcqJson(e.target.value)}
                    rows={8}
                    className={`w-full font-mono text-xs rounded-xl border p-2 outline-none ${darkMode ? "border-slate-600 bg-slate-950 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-900"}`}
                  />
                </div>
                <div className="mb-4">
                  <label className={`text-xs font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Coding questions (JSON array, min 3)</label>
                  <textarea
                    value={codingJson}
                    onChange={(e) => setCodingJson(e.target.value)}
                    rows={8}
                    className={`w-full font-mono text-xs rounded-xl border p-2 outline-none ${darkMode ? "border-slate-600 bg-slate-950 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-900"}`}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTest}
                    disabled={wizardBusy}
                    className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white disabled:opacity-50"
                  >
                    Save finalized test & draft email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestWizard(false)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium ${darkMode ? "border-slate-500 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {wizardStep === "email" && (
              <>
                <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Subject</label>
                <input
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft((d) => ({ ...d, subject: e.target.value }))}
                  className={`w-full mb-3 rounded-xl border px-3 py-2 text-sm outline-none ${darkMode ? "border-slate-600 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}
                />
                <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Body (placeholders: [TEST_LINK], [TEST_DEADLINE], [TEST_DURATION], [CANDIDATE_NAME], …)</label>
                <textarea
                  value={emailDraft.body}
                  onChange={(e) => setEmailDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={12}
                  className={`w-full mb-4 rounded-xl border px-3 py-2 text-sm font-mono outline-none ${darkMode ? "border-slate-600 bg-slate-950 text-slate-200" : "border-slate-200 bg-white text-slate-900"}`}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSendTop50}
                    disabled={wizardBusy}
                    className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 shadow-lg shadow-violet-900/25"
                  >
                    Send to top 50 + notify others
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep("edit")}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium ${darkMode ? "border-slate-500 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                  >
                    Back to test editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestWizard(false)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium ${darkMode ? "border-slate-500 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {wizardBusy && <p className={`mt-3 text-sm font-medium ${darkMode ? "text-fuchsia-400" : "text-fuchsia-600"}`}>Working…</p>}
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
