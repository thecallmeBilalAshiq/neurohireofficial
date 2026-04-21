"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import {
  getJobsForRanking,
  getTestParticipants,
  getTestParticipantDetail,
  generateInterviewEmail,
  sendPhysicalInterviewRound,
  completeFinalHire,
  closeJobNoEligibleCandidates,
  updateJobPost,
} from "../../../lib/api";
import { toast } from "react-toastify";
import { useHrDarkMode } from "../../../lib/useHrDarkMode";

function FinalizeHireContent() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useHrDarkMode();
  const [idToken, setIdToken] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [mode, setMode] = useState("top5");
  const [manualIds, setManualIds] = useState(new Set());
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [physEmail, setPhysEmail] = useState({ subject: "", body: "" });
  const [physBusy, setPhysBusy] = useState(false);

  const [hireIds, setHireIds] = useState(new Set());
  const [hireBusy, setHireBusy] = useState(false);
  const [closeNoEligibleBusy, setCloseNoEligibleBusy] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [updatingDeadline, setUpdatingDeadline] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const t = await u.getIdToken();
        setIdToken(t);
        const r = await getJobsForRanking(t);
        if (r.success) setJobs(r.data);
      }
    });
    return () => unsub();
  }, []);

  const load = useCallback(async () => {
    if (!jobId || !idToken) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const r = await getTestParticipants(jobId, idToken);
      if (r.success) setData(r.data);
      else {
        toast.error(r.error);
        setData(null);
      }
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [jobId, idToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.deadline) {
      try {
        setDeadlineInput(new Date(data.deadline).toISOString().slice(0, 16));
      } catch {
        setDeadlineInput("");
      }
    } else {
      setDeadlineInput("");
    }
  }, [data?.deadline]);

  const handleUpdateDeadline = async () => {
    if (!jobId || !idToken || !deadlineInput) {
      toast.warning("Select a job and set a deadline.");
      return;
    }
    setUpdatingDeadline(true);
    try {
      const iso = new Date(deadlineInput).toISOString();
      const r = await updateJobPost(jobId, { deadline: iso }, idToken);
      if (r.success) {
        toast.success("Application deadline updated.");
        load();
      } else toast.error(r.error || "Failed");
    } catch {
      toast.error("Failed");
    } finally {
      setUpdatingDeadline(false);
    }
  };

  const deadlinePassed =
    data?.assessmentDeadline && new Date() >= new Date(data.assessmentDeadline);
  const closed = !!data?.finalHireCompletedAt || data?.hirePipelineStage === "finished";
  const canPhysical =
    deadlinePassed &&
    !closed &&
    data?.hirePipelineStage === "test_sent" &&
    !data?.physicalInterviewEmailSentAt;
  const awaitingHire = data?.awaitingFinalHireSelection && !data?.finalHireCompletedAt;

  const considerationCandidates = (data?.candidates || []).filter(
    (c) => String(c.testStatus).toLowerCase() !== "disqualified"
  );
  const disqualifiedOnly = (data?.candidates || []).filter(
    (c) => String(c.testStatus).toLowerCase() === "disqualified"
  );
  const candidatesList = data?.candidates || [];
  const allDisqualifiedPool =
    candidatesList.length > 0 &&
    candidatesList.every((c) => String(c.testStatus).toLowerCase() === "disqualified");
  const noTestParticipants = candidatesList.length === 0;
  const showCloseNoEligible =
    deadlinePassed &&
    !closed &&
    data?.hirePipelineStage === "test_sent" &&
    !data?.physicalInterviewEmailSentAt &&
    (noTestParticipants || allDisqualifiedPool);

  useEffect(() => {
    if (!data?.candidates) return;
    setManualIds((prev) => {
      const disq = new Set(
        data.candidates
          .filter((c) => String(c.testStatus).toLowerCase() === "disqualified")
          .map((c) => String(c._id))
      );
      return new Set([...prev].filter((id) => !disq.has(String(id))));
    });
  }, [data?.candidates]);

  const openDetail = async (applicationId) => {
    if (!idToken) return;
    const r = await getTestParticipantDetail(applicationId, idToken);
    if (r.success) {
      setDetail(r.data);
      setDetailOpen(true);
    } else toast.error(r.error);
  };

  const toggleManual = (id) => {
    setManualIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const genPhysicalEmail = async () => {
    if (!jobId || !idToken || !considerationCandidates.length) return;
    const first = considerationCandidates[0];
    const r = await generateInterviewEmail(
      [{ _id: first._id, email: first.email, candidateName: first.candidateName }],
      { jobTitle: data.jobTitle, company: data.company },
      "interview",
      idToken
    );
    if (r.success) {
      setPhysEmail({ subject: r.data.email.subject, body: r.data.email.body });
      toast.success("Draft generated — add date/time if needed, then send.");
    } else toast.error(r.error);
  };

  const sendPhysical = async () => {
    if (!jobId || !idToken) return;
    if (!interviewDate || !interviewTime || !interviewLocation) {
      toast.warning("Enter interview date, time, and location / link.");
      return;
    }
    if (!physEmail.subject || !physEmail.body) {
      toast.warning("Generate or paste email content first.");
      return;
    }
    setPhysBusy(true);
    try {
      const user = auth.currentUser;
      const r = await sendPhysicalInterviewRound(
        jobId,
        {
          mode: mode === "manual" ? "manual" : mode,
          applicationIds: mode === "manual" ? Array.from(manualIds) : undefined,
          interviewDate,
          interviewTime,
          interviewLocation,
          emailSubject: physEmail.subject,
          emailBody: physEmail.body,
          hrInfo: {
            name: user?.displayName || "HR",
            title: "Human Resources",
            email: user?.email || "",
            phone: "",
          },
        },
        idToken
      );
      if (r.success) {
        toast.success(`Invited ${r.data.invitedCount}. Others notified.`);
        load();
      } else toast.error(r.error);
    } catch {
      toast.error("Failed");
    } finally {
      setPhysBusy(false);
    }
  };

  const submitCloseNoEligible = async () => {
    if (!jobId || !idToken) return;
    const ok = window.confirm(
      "Close this job with no further hiring?\n\nWe are sorry — no candidate was up to the mark. The job will be marked closed. This cannot be undone."
    );
    if (!ok) return;
    setCloseNoEligibleBusy(true);
    try {
      const r = await closeJobNoEligibleCandidates(jobId, idToken);
      if (r.success) {
        toast.success(r.data?.message || "Job closed.");
        load();
      } else toast.error(r.error);
    } catch {
      toast.error("Failed");
    } finally {
      setCloseNoEligibleBusy(false);
    }
  };

  const submitHire = async (noHire) => {
    if (!jobId || !idToken) return;
    setHireBusy(true);
    try {
      const user = auth.currentUser;
      const r = await completeFinalHire(
        jobId,
        {
          applicationIds: noHire ? [] : Array.from(hireIds),
          hrInfo: {
            name: user?.displayName || "HR",
            email: user?.email || "",
          },
        },
        idToken
      );
      if (r.success) {
        if (r.data.noHire) {
          toast.success("Role closed. Candidates were notified with care.");
        } else {
          toast.success(`Hire complete. ${r.data.hiredCount} offer email(s) sent.`);
        }
        load();
        setHireIds(new Set());
      } else toast.error(r.error);
    } catch {
      toast.error("Failed");
    } finally {
      setHireBusy(false);
    }
  };

  const toggleHire = (id) => {
    setHireIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const physicalPool = (data?.candidates || []).filter((c) => c.physicalInterviewInvitedAt);

  const inputBase =
    "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
    (darkMode
      ? "border-slate-600 bg-slate-900/80 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
      : "border-slate-200 bg-white text-slate-900 focus:border-violet-400 focus:ring-1 focus:ring-violet-400");

  const labelClass = `block text-sm font-medium mb-2 ${darkMode ? "text-slate-200" : "text-slate-700"}`;

  return (
    <div
      className={`min-h-screen font-sans antialiased ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gradient-to-br from-slate-50 via-violet-50/50 to-indigo-50/40 text-slate-900"}`}
    >
      <header
        className={`sticky top-0 z-10 border-b backdrop-blur-md ${darkMode ? "border-slate-800/80 bg-slate-900/90" : "border-slate-200/80 bg-white/90"} px-4 py-4 flex items-center gap-3 sm:gap-4`}
      >
        <button
          type="button"
          onClick={() => router.push("/hr/dashboard")}
          className={`p-2.5 rounded-xl transition-colors ${darkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div
          className={`hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-violet-500/15 text-violet-300" : "bg-violet-100 text-violet-600"}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className={`text-lg sm:text-xl font-bold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>Finalize Hire</h1>
          <p className={`text-xs sm:text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Online test → physical interview → final selection
          </p>
        </div>
        <div className={`ml-auto flex gap-1 rounded-xl p-1 border ${darkMode ? "border-slate-700 bg-slate-800/80" : "border-slate-200 bg-slate-100"}`}>
          <button
            type="button"
            onClick={() => setDarkMode(false)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${!darkMode ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Light
          </button>
          <button
            type="button"
            onClick={() => setDarkMode(true)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${darkMode ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
            Dark
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div
          className={`rounded-2xl border p-5 mb-6 shadow-sm ${darkMode ? "border-slate-700/80 bg-slate-900/60 shadow-black/20" : "border-slate-200/80 bg-white shadow-slate-200/50"}`}
        >
          <label className={`${labelClass} flex items-center gap-2`}>
            <svg className={`w-4 h-4 ${darkMode ? "text-violet-400" : "text-violet-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Job
          </label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className={`w-full max-w-xl rounded-xl border px-3 py-2.5 text-sm ${darkMode ? "border-slate-600 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"}`}
          >
            <option value="">Select job</option>
            {jobs.map((j) => (
              <option key={j._id} value={j._id}>
                {j.jobTitle} — {j.company}
              </option>
            ))}
          </select>
          {jobId && (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr),auto] items-end">
              <div>
                <label className={`${labelClass} mb-1 flex items-center gap-2`}>
                  <svg className={`w-4 h-4 ${darkMode ? "text-amber-400" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Application deadline
                </label>
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className={`w-full max-w-xl rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? "border-slate-600 bg-slate-900 text-white [color-scheme:dark]" : "border-slate-200 bg-white text-slate-900"}`}
                />
              </div>
              <button
                type="button"
                onClick={handleUpdateDeadline}
                disabled={updatingDeadline}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {updatingDeadline ? "Updating…" : "Update deadline"}
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Loading pipeline…</p>
          </div>
        )}

        {data && !loading && (
          <>
            <div
              className={`rounded-2xl border p-5 mb-6 ${darkMode ? "border-indigo-500/25 bg-indigo-950/40" : "border-violet-200 bg-violet-50/80"}`}
            >
              <div className={`flex flex-wrap items-start gap-3 text-sm ${darkMode ? "text-slate-200" : "text-slate-800"}`}>
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${darkMode ? "bg-slate-800 text-violet-300" : "bg-white text-violet-700"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Pipeline
                </span>
                <span className="font-mono text-xs sm:text-sm">{data.hirePipelineStage}</span>
                {data.assessmentDeadline && (
                  <span className={`flex items-center gap-1.5 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                    <svg className="w-4 h-4 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Test window ends{" "}
                    <strong className={darkMode ? "text-white" : "text-slate-900"}>
                      {new Date(data.assessmentDeadline).toLocaleString()}
                    </strong>
                  </span>
                )}
              </div>
              {closed && (
                <div className={`mt-3 space-y-2 text-sm font-medium ${darkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                  <p className="flex items-center gap-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This job is closed. No further actions.
                    {data.noHireSelected && data.closureReason !== "no_eligible_pool" && " No offer was extended."}
                  </p>
                  {data.closureReason === "no_eligible_pool" && (
                    <p className={`rounded-lg px-3 py-2 ${darkMode ? "bg-slate-800/80 text-slate-200" : "bg-white/80 text-slate-800"}`}>
                      We are sorry — no candidate was up to the mark for this role. The position has been closed without further interviews.
                    </p>
                  )}
                </div>
              )}
              {!deadlinePassed && data.assessmentDeadline && (
                <p className={`mt-3 flex items-center gap-2 text-sm ${darkMode ? "text-amber-300" : "text-amber-700"}`}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Physical interview step unlocks after the assessment deadline.
                </p>
              )}
            </div>

            {showCloseNoEligible && (
              <div
                className={`rounded-2xl border p-5 mb-6 ${darkMode ? "border-amber-700/50 bg-amber-950/30" : "border-amber-300 bg-amber-50/90"}`}
              >
                <h3 className={`font-bold mb-2 flex items-center gap-2 ${darkMode ? "text-amber-200" : "text-amber-900"}`}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  No eligible candidates
                </h3>
                <p className={`text-sm mb-4 leading-relaxed ${darkMode ? "text-amber-100/90" : "text-amber-950/90"}`}>
                  {noTestParticipants
                    ? "There are no test participants for this job (no one in the assessment pool)."
                    : "Every participant was disqualified (e.g. proctoring), so there is no one to shortlist for interviews."}{" "}
                  You can close the job and record that we are sorry — no candidate was up to the mark.
                </p>
                <button
                  type="button"
                  onClick={submitCloseNoEligible}
                  disabled={closeNoEligibleBusy}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${darkMode ? "bg-amber-600 hover:bg-amber-500" : "bg-amber-700 hover:bg-amber-600"}`}
                >
                  {closeNoEligibleBusy ? "Closing…" : "Close job — no candidate up to the mark"}
                </button>
              </div>
            )}

            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
              <svg className={`w-5 h-5 ${darkMode ? "text-cyan-400" : "text-cyan-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Test participants (under consideration)
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {considerationCandidates.map((c) => {
                const done = String(c.testStatus).toLowerCase() === "completed";
                const disq = String(c.testStatus).toLowerCase() === "disqualified";
                return (
                  <button
                    type="button"
                    key={c._id}
                    onClick={() => openDetail(c._id)}
                    className={`group text-left rounded-2xl border p-4 transition hover:shadow-lg ${darkMode ? "border-slate-700 bg-slate-900/70 hover:border-violet-500/40 hover:bg-slate-800/80" : "border-slate-200 bg-white hover:border-violet-200 hover:shadow-violet-100"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`font-semibold truncate ${darkMode ? "text-white" : "text-slate-900"}`}>{c.candidateName}</div>
                        <div className={`text-xs truncate ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{c.email}</div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          disq
                            ? darkMode
                              ? "bg-red-500/20 text-red-300"
                              : "bg-red-100 text-red-800"
                            : done
                              ? darkMode
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-emerald-100 text-emerald-800"
                              : darkMode
                                ? "bg-amber-500/20 text-amber-200"
                                : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {done ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : disq ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {c.testStatus}
                      </span>
                    </div>
                    {disq ? (
                      <div className={`mt-3 text-sm font-medium ${darkMode ? "text-red-300" : "text-red-700"}`}>
                        Disqualified (proctoring) — not scored, not ranked
                      </div>
                    ) : (
                      c.testScore != null && (
                        <div className={`mt-3 flex items-center gap-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${darkMode ? "bg-violet-500/25 text-violet-200" : "bg-violet-100 text-violet-800"}`}>
                            Score {c.testScore}
                          </span>
                        </div>
                      )
                    )}
                  </button>
                );
              })}
            </div>

            {disqualifiedOnly.length > 0 && (
              <div
                className={`mb-8 rounded-2xl border p-4 ${darkMode ? "border-red-900/50 bg-red-950/20" : "border-red-200 bg-red-50/80"}`}
              >
                <h3 className={`text-sm font-semibold mb-2 ${darkMode ? "text-red-200" : "text-red-900"}`}>
                  Not under consideration (proctoring disqualification)
                </h3>
                <p className={`text-xs mb-3 ${darkMode ? "text-red-300/90" : "text-red-800"}`}>
                  These candidates are excluded from scoring, ranking, manual shortlist, and physical interview selection.
                </p>
                <ul className={`text-sm space-y-1 ${darkMode ? "text-red-100/90" : "text-red-950"}`}>
                  {disqualifiedOnly.map((c) => (
                    <li key={c._id}>
                      {c.candidateName} — <span className="opacity-90">{c.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canPhysical && (
              <div
                className={`rounded-2xl border p-6 mb-8 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-white"}`}
              >
                <h3 className={`font-bold mb-1 flex items-center gap-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
                  <svg className={`w-5 h-5 ${darkMode ? "text-orange-400" : "text-orange-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Physical interview round
                </h3>
                <p className={`text-sm mb-4 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Set logistics, choose shortlist mode, then send invites.</p>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className={`text-xs block mb-1.5 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Interview date</label>
                    <input
                      type="text"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      placeholder="e.g. Monday, 15 April 2026"
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <label className={`text-xs block mb-1.5 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Time</label>
                    <input
                      type="text"
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                      placeholder="e.g. 2:00 PM (GMT+5)"
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <label className={`text-xs block mb-1.5 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Location / video link</label>
                    <input
                      type="text"
                      value={interviewLocation}
                      onChange={(e) => setInterviewLocation(e.target.value)}
                      placeholder="Address or meeting URL"
                      className={inputBase}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={`text-xs block mb-2 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Selection mode</label>
                  <div className="flex flex-wrap gap-2">
                    {["top3", "top5", "top10", "manual"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${mode === m ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-900/30" : darkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                      >
                        {m === "manual" ? "Manual" : m.replace("top", "Top ")}
                      </button>
                    ))}
                  </div>
                </div>
                {mode === "manual" && (
                  <div
                    className={`mb-4 max-h-40 overflow-y-auto rounded-xl border p-3 ${darkMode ? "border-slate-600 bg-slate-950/50" : "border-slate-200 bg-slate-50"}`}
                  >
                    {considerationCandidates.map((c) => (
                      <label
                        key={c._id}
                        className={`flex items-center gap-2 text-sm py-1.5 cursor-pointer ${darkMode ? "text-slate-200" : "text-slate-800"}`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-slate-400 text-violet-600"
                          checked={manualIds.has(c._id)}
                          onChange={() => toggleManual(c._id)}
                        />
                        {c.candidateName} ({c.testScore ?? "—"})
                      </label>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={genPhysicalEmail}
                  className="mb-3 inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate interview email (AI)
                </button>
                <input
                  value={physEmail.subject}
                  onChange={(e) => setPhysEmail((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Subject"
                  className={`${inputBase} mb-2`}
                />
                <textarea
                  value={physEmail.body}
                  onChange={(e) => setPhysEmail((p) => ({ ...p, body: e.target.value }))}
                  rows={8}
                  placeholder="Body — [INTERVIEW_DATE], [INTERVIEW_TIME], [INTERVIEW_LOCATION/LINK], [CANDIDATE_NAME] will be filled on send"
                  className={`${inputBase} mb-4 font-mono text-xs`}
                />
                <button
                  type="button"
                  onClick={sendPhysical}
                  disabled={physBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 disabled:opacity-50"
                >
                  {physBusy ? "Sending…" : "Send to selected candidates"}
                </button>
              </div>
            )}

            {awaitingHire && !closed && (
              <div
                className={`rounded-2xl border p-6 ${darkMode ? "border-emerald-500/30 bg-emerald-950/35" : "bg-emerald-50 border-emerald-200"}`}
              >
                <h3 className={`font-bold mb-2 flex items-center gap-2 ${darkMode ? "text-emerald-200" : "text-emerald-900"}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Final hiring decision
                </h3>
                <p className={`text-sm mb-4 leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                  Select one or more candidates you wish to hire. They will receive a congratulations email; others who attended the physical round will
                  receive a thoughtful update. HR will share practical onboarding details separately.
                </p>
                <div
                  className={`max-h-48 overflow-y-auto rounded-xl border p-3 mb-4 ${darkMode ? "border-slate-600 bg-slate-950/50" : "border-emerald-200 bg-white"}`}
                >
                  {physicalPool.map((c) => (
                    <label
                      key={c._id}
                      className={`flex items-center gap-2 text-sm py-1.5 cursor-pointer ${darkMode ? "text-slate-200" : "text-slate-800"}`}
                    >
                      <input type="checkbox" className="rounded text-emerald-600" checked={hireIds.has(c._id)} onChange={() => toggleHire(c._id)} />
                      {c.candidateName}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={hireBusy}
                    onClick={() => submitHire(false)}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Confirm hire selection
                  </button>
                  <button
                    type="button"
                    disabled={hireBusy}
                    onClick={() => {
                      if (confirm("Close this role without hiring anyone? Candidates will be notified kindly.")) submitHire(true);
                    }}
                    className={`rounded-xl border-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${darkMode ? "border-amber-500/60 text-amber-200 hover:bg-amber-500/10" : "border-amber-500 text-amber-900 hover:bg-amber-50"}`}
                  >
                    No suitable candidate — close job
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {detailOpen && detail && (() => {
        const disqDetail =
          detail.disqualifiedDueToProctoring === true || String(detail.status).toLowerCase() === "disqualified";
        if (disqDetail) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetailOpen(false)}>
              <div
                className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl ${darkMode ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className={`font-bold text-lg mb-1 ${darkMode ? "text-white" : "text-slate-900"}`}>{detail.candidateName}</h4>
                <p className={`text-sm mb-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{detail.email}</p>
                <div
                  className={`mb-6 rounded-xl border p-4 ${darkMode ? "border-red-500/40 bg-red-950/40 text-red-100" : "border-red-200 bg-red-50 text-red-900"}`}
                >
                  <p className="font-semibold mb-2">Disqualified — proctoring violation</p>
                  <p className="text-sm leading-relaxed opacity-95">
                    {detail.disqualificationMessage ||
                      "No test score is shown. This candidate is not eligible for ranking or shortlist by assessment score."}
                  </p>
                </div>
                <button
                  type="button"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium ${darkMode ? "border-slate-500 text-slate-200 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-50"}`}
                  onClick={() => setDetailOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          );
        }
        const mcqTotal = detail.mcqTotal ?? detail.mcqScore;
        const mcqMax = detail.mcqMax ?? 30;
        const codingTotal = detail.codingTotal ?? detail.codingScore;
        const codingMax = detail.codingMax ?? 70;
        const mcqRows = Array.isArray(detail.mcqBreakdown) ? detail.mcqBreakdown : [];
        const codingRows = Array.isArray(detail.codingBreakdown) ? detail.codingBreakdown : [];
        const tableHead = darkMode ? "text-slate-400" : "text-slate-600";
        const tableCell = darkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-800";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetailOpen(false)}>
            <div
              className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl ${darkMode ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className={`font-bold text-lg mb-1 ${darkMode ? "text-white" : "text-slate-900"}`}>{detail.candidateName}</h4>
              <p className={`text-sm mb-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{detail.email}</p>
              <div className={`mb-4 flex flex-wrap gap-3 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                <span className={`rounded-lg px-3 py-1 font-semibold ${darkMode ? "bg-violet-500/20 text-violet-200" : "bg-violet-100 text-violet-900"}`}>
                  Total: {detail.testScore ?? "—"} / 100
                </span>
                {detail.status && (
                  <span className={`rounded-lg px-3 py-1 ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>Status: {detail.status}</span>
                )}
              </div>

              <div className="mb-5">
                <h5 className={`text-sm font-bold mb-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
                  MCQ — total {mcqTotal ?? "—"} / {mcqMax}
                </h5>
                {mcqRows.length === 0 ? (
                  <p className={`text-sm ${darkMode ? "text-slate-500" : "text-slate-600"}`}>No per-question breakdown yet (pending evaluation or no attempt).</p>
                ) : (
                  <div className={`overflow-x-auto rounded-xl border ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className={darkMode ? "bg-slate-800" : "bg-slate-50"}>
                        <tr>
                          <th className={`px-3 py-2 font-semibold ${tableHead}`}>#</th>
                          <th className={`px-3 py-2 font-semibold ${tableHead}`}>Question</th>
                          <th className={`px-3 py-2 font-semibold ${tableHead} w-24 text-right`}>Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mcqRows.map((row, idx) => (
                          <tr key={idx} className={`border-t ${tableCell}`}>
                            <td className="px-3 py-2 align-top">{(row.orderIndex ?? idx) + 1}</td>
                            <td className="px-3 py-2 align-top">{row.questionPreview || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">
                              {row.marksObtained ?? 0}/{row.marksMax ?? 1}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h5 className={`text-sm font-bold mb-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
                  Coding — total {codingTotal ?? "—"} / {codingMax}
                </h5>
                {codingRows.length === 0 ? (
                  <p className={`text-sm ${darkMode ? "text-slate-500" : "text-slate-600"}`}>No per-question breakdown yet.</p>
                ) : (
                  <div className={`overflow-x-auto rounded-xl border ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className={darkMode ? "bg-slate-800" : "bg-slate-50"}>
                        <tr>
                          <th className={`px-3 py-2 font-semibold ${tableHead}`}>#</th>
                          <th className={`px-3 py-2 font-semibold ${tableHead}`}>Problem</th>
                          <th className={`px-3 py-2 font-semibold ${tableHead} w-28 text-right`}>Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codingRows.map((row, idx) => (
                          <tr key={idx} className={`border-t ${tableCell}`}>
                            <td className="px-3 py-2 align-top">{(row.questionIndex ?? idx) + 1}</td>
                            <td className="px-3 py-2 align-top">{row.title || `Problem ${idx + 1}`}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">
                              {row.marksObtained == null ? "—" : row.marksObtained}/{row.marksMax ?? 10}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium ${darkMode ? "border-slate-500 text-slate-200 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-50"}`}
                onClick={() => setDetailOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function FinalizeHirePage() {
  return (
    <ProtectedRoute requiredRole="HR">
      <FinalizeHireContent />
    </ProtectedRoute>
  );
}
