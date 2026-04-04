"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { getOnboardingHires, getApiBaseUrl, generateTrainingPlan } from "../../../lib/api";
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

  return (
    <div
      className={`min-h-screen font-sans antialiased ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40 text-slate-900"}`}
    >
      <header
        className={`sticky top-0 z-10 border-b backdrop-blur-md ${darkMode ? "border-slate-800/80 bg-slate-900/90" : "border-slate-200/80 bg-white/90"} px-4 py-4 flex items-center gap-3`}
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
          className={`hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-teal-500/15 text-teal-300" : "bg-teal-100 text-teal-700"}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className={`text-lg sm:text-xl font-bold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>Hire candidates onboarding</h1>
          <p className={`text-xs sm:text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Selected hires across your jobs</p>
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
