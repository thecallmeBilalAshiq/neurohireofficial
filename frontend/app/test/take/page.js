"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getTestAttempt,
  saveTestProgress,
  submitTest,
} from "../../../lib/api";
import { toast } from "react-toastify";
import Proctoring from "../../../components/test/Proctoring";

const TOTAL_MINUTES = 120;
const SAVE_INTERVAL_MS = 30000;

function TestTakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const attemptId = searchParams.get("attemptId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [section, setSection] = useState("mcq"); // 'mcq' | 'coding'
  const [mcqQuestions, setMcqQuestions] = useState([]);
  const [mcqAnswers, setMcqAnswers] = useState([]);
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [codingSubmissions, setCodingSubmissions] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [status, setStatus] = useState("in_progress");
  const [disqualified, setDisqualified] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(TOTAL_MINUTES * 60);
  const [testPaused, setTestPaused] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const tabSwitchCountRef = useRef(0);
  const saveIntervalRef = useRef(null);
  const proctoringRef = useRef(null);
  const handleSubmitRef = useRef(null);

  const loadAttempt = useCallback(async () => {
    if (!attemptId || !token) {
      setError("Missing attempt or token");
      setLoading(false);
      return;
    }
    const result = await getTestAttempt(attemptId, token);
    if (!result.success) {
      setError(result.error || "Failed to load test");
      setLoading(false);
      return;
    }
    const d = result.data;
    setMcqQuestions(d.mcqQuestions || []);
    setMcqAnswers(d.mcqAnswers || []);
    setCodingQuestions(d.codingQuestions || []);
    setCodingSubmissions(d.codingSubmissions || []);
    setStartedAt(d.startedAt ? new Date(d.startedAt) : new Date());
    setStatus(d.status || "in_progress");
    if (d.status && d.status !== "in_progress") {
      setError("This test has already been submitted or disqualified.");
    }
    setLoading(false);
  }, [attemptId, token]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  // Timer
  useEffect(() => {
    if (status !== "in_progress" || !startedAt) return;
    const computeLeft = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      return Math.max(0, Math.floor(TOTAL_MINUTES * 60 - elapsed));
    };
    setTimeLeftSeconds(computeLeft());
    const t = setInterval(() => {
      const left = computeLeft();
      setTimeLeftSeconds(left);
      if (left <= 0) {
        clearInterval(t);
        if (handleSubmitRef.current) handleSubmitRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [status, startedAt]);

  const saveProgress = useCallback(
    async (extra = {}) => {
      if (!attemptId || !token || status !== "in_progress") return;
      await saveTestProgress(attemptId, token, {
        mcqAnswers,
        codingSubmissions,
        ...extra,
      });
    },
    [attemptId, token, status, mcqAnswers, codingSubmissions]
  );

  useEffect(() => {
    if (status !== "in_progress" || !attemptId || !token) return;
    saveIntervalRef.current = setInterval(() => {
      saveProgress();
    }, SAVE_INTERVAL_MS);
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, [status, attemptId, token, saveProgress]);

  const handleMcqSelect = (questionIndex, optionIndex) => {
    if (section !== "mcq" || status !== "in_progress") return;
    setMcqAnswers((prev) => {
      const next = [...(prev || [])];
      next[questionIndex] = { ...next[questionIndex], questionIndex, selectedIndex: optionIndex };
      return next;
    });
  };

  const handleCodingChange = (questionIndex, code, language = "javascript") => {
    if (status !== "in_progress") return;
    setCodingSubmissions((prev) => {
      const next = [...(prev || [])];
      next[questionIndex] = { ...next[questionIndex], questionIndex, code, language };
      return next;
    });
  };

  const handleTabSwitch = useCallback(() => {
    tabSwitchCountRef.current += 1;
    const count = tabSwitchCountRef.current;
    if (count === 1) {
      setTestPaused(true);
    } else if (count >= 2) {
      setTestPaused(false);
      if (handleSubmitRef.current) {
        handleSubmitRef.current(true);
      }
    }
  }, []);

  const handleMaxViolations = useCallback(() => {
    if (handleSubmitRef.current) {
      handleSubmitRef.current(true);
    }
  }, []);

  const handleSubmit = useCallback(async (autoSubmitDueToTabSwitch = false) => {
    if (status !== "in_progress") return;
    await saveProgress();
    const result = await submitTest(attemptId, token, { mcqAnswers, codingSubmissions });
    if (result.success) {
      setStatus("submitted");
      if (autoSubmitDueToTabSwitch) {
        toast.warning(
          "Test submitted automatically due to proctoring rules (tab switch or face violations)."
        );
      } else {
        toast.success("Test submitted successfully.");
      }
      router.push(`/test/done?token=${encodeURIComponent(token)}&attemptId=${attemptId}`);
    } else {
      toast.error(result.error || "Failed to submit");
    }
  }, [status, attemptId, token, mcqAnswers, codingSubmissions, saveProgress, router]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // MCQ: block right-click and keyboard (except Tab, Enter)
  useEffect(() => {
    if (section !== "mcq") return;
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const noRightClick = (e) => {
      if (e.button === 2) prevent(e);
    };
    const noKeys = (e) => {
      if (!["Tab", "Enter"].includes(e.key)) prevent(e);
    };
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("mousedown", noRightClick);
    document.addEventListener("keydown", noKeys);
    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("mousedown", noRightClick);
      document.removeEventListener("keydown", noKeys);
    };
  }, [section]);

  // Block copy, paste, cut, and screenshot (Print Screen) for the whole test
  useEffect(() => {
    if (status !== "in_progress") return;
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const blockKeys = (e) => {
      if (e.key === "PrintScreen") {
        prevent(e);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x"].includes(e.key.toLowerCase())) {
        prevent(e);
      }
    };
    document.addEventListener("copy", prevent, true);
    document.addEventListener("cut", prevent, true);
    document.addEventListener("paste", prevent, true);
    document.addEventListener("keydown", blockKeys, true);
    return () => {
      document.removeEventListener("copy", prevent, true);
      document.removeEventListener("cut", prevent, true);
      document.removeEventListener("paste", prevent, true);
      document.removeEventListener("keydown", blockKeys, true);
    };
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading test...</div>
      </div>
    );
  }

  if (error || disqualified) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            {disqualified ? "Disqualified" : "Error"}
          </h1>
          <p className="text-slate-600 dark:text-slate-300">{error || "You have been disqualified after multiple proctoring alerts."}</p>
        </div>
      </div>
    );
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Proctoring
        ref={proctoringRef}
        onTabSwitch={handleTabSwitch}
        onFaceStatusChange={setFaceDetected}
        onMaxViolations={handleMaxViolations}
        disabled={status !== "in_progress"}
        mcqMode={section === "mcq"}
      />

      {/* Pause until face detected */}
      {status === "in_progress" && !faceDetected && !testPaused && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4">
          <div className="max-w-md w-full bg-slate-800 text-white rounded-2xl shadow-2xl p-8 text-center border-2 border-amber-500">
            <div className="text-5xl mb-4">📷</div>
            <h2 className="text-xl font-bold mb-3">Test paused</h2>
            <p className="text-slate-300 mb-2">
              Position your face in the camera view. Only one person should be visible, with your face and eyes in the center of the frame.
            </p>
            <p className="text-sm text-amber-400">The test will continue automatically when your face is detected.</p>
          </div>
        </div>
      )}

      {/* Full-screen warning when user switched tab (first time) */}
      {testPaused && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-lg w-full bg-amber-500 text-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-3">Do not switch tabs or open new windows</h2>
            <p className="text-amber-100 mb-6">
              You left this tab. This is your <strong>first warning</strong>. If you switch tabs or open a new tab again, your test will be <strong>automatically submitted</strong> and you will not be able to continue.
            </p>
            <button
              type="button"
              onClick={() => setTestPaused(false)}
              className="px-8 py-3 rounded-xl bg-white text-amber-700 font-semibold hover:bg-amber-50 transition-colors"
            >
              I understand, continue test
            </button>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-800 dark:text-white">
            {section === "mcq" ? "MCQ Section (30 marks)" : "Coding Section (70 marks)"}
          </span>
          <span className="text-2xl font-mono text-teal-600 dark:text-teal-400">{formatTime(timeLeftSeconds)}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSection("mcq")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${section === "mcq" ? "bg-teal-600 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"}`}
          >
            MCQs
          </button>
          <button
            type="button"
            onClick={() => setSection("coding")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${section === "coding" ? "bg-teal-600 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"}`}
          >
            Coding
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Submit test
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {section === "mcq" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {mcqQuestions.map((q, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <p className="font-medium text-slate-800 dark:text-white mb-3">
                  {i + 1}. {q.questionText}
                </p>
                <div className="space-y-2">
                  {(q.options || []).map((opt, j) => (
                    <label
                      key={j}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <input
                        type="radio"
                        name={`mcq-${i}`}
                        checked={((mcqAnswers[i] || {}).selectedIndex ?? -1) === j}
                        onChange={() => handleMcqSelect(i, j)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {section === "coding" && (
          <div className="max-w-4xl mx-auto space-y-6">
            {codingQuestions.map((q, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                  <span className="font-medium text-slate-800 dark:text-white">{q.title}</span>
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({q.difficulty})</span>
                </div>
                <div className="p-4 space-y-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  <div>{q.statement}</div>
                  {q.inputFormat && <div><strong>Input:</strong> {q.inputFormat}</div>}
                  {q.outputFormat && <div><strong>Output:</strong> {q.outputFormat}</div>}
                  {q.sampleInput && <div><strong>Sample input:</strong><pre className="bg-slate-100 dark:bg-slate-700 p-2 rounded mt-1">{q.sampleInput}</pre></div>}
                  {q.sampleOutput && <div><strong>Sample output:</strong><pre className="bg-slate-100 dark:bg-slate-700 p-2 rounded mt-1">{q.sampleOutput}</pre></div>}
                  {q.constraints && <div><strong>Constraints:</strong> {q.constraints}</div>}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Your code</label>
                  <textarea
                    value={(codingSubmissions[i] || {}).code || ""}
                    onChange={(e) => handleCodingChange(i, e.target.value)}
                    className="w-full h-40 font-mono text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Write your solution here..."
                    spellCheck={false}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function TestTakePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">Loading...</div>}>
      <div className="min-h-screen">
        <TestTakeContent />
      </div>
    </Suspense>
  );
}
