"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getTestAttempt,
  saveTestProgress,
  submitTest,
  runCode,
} from "../../../lib/api";
import { toast } from "react-toastify";
import Proctoring from "../../../components/test/Proctoring";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[min(70vh,520px)] rounded-lg border border-slate-700 bg-slate-900/50 animate-pulse" />
    ),
  }
);

function monacoLanguageId(lang) {
  const l = (lang || "javascript").toLowerCase();
  if (l === "py") return "python";
  return l === "python" || l === "java" || l === "cpp" || l === "c" || l === "javascript" ? l : "javascript";
}

const TOTAL_MINUTES = 120;
const SAVE_INTERVAL_MS = 30000;
/** Let camera + MediaPipe / TFLite warm up before running detection (reduces early errors & console noise). */
const PROCTORING_PREP_MS = 12500;

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
  const [runOutputByQuestion, setRunOutputByQuestion] = useState({});
  const [runLoadingByQuestion, setRunLoadingByQuestion] = useState({});
  const [runStdinByQuestion, setRunStdinByQuestion] = useState({});
  const [codingStep, setCodingStep] = useState(0);
  const tabSwitchCountRef = useRef(0);
  const saveIntervalRef = useRef(null);
  const proctoringRef = useRef(null);
  const handleSubmitRef = useRef(null);
  const [prepComplete, setPrepComplete] = useState(false);

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
    setCodingStep(0);
    setStartedAt(d.startedAt ? new Date(d.startedAt) : new Date());
    setStatus(d.status || "in_progress");
    if (d.status === "disqualified") {
      setDisqualified(true);
      setError("Disqualified due to proctoring rules violation. Your attempt is not scored and will not be considered for ranking.");
    } else if (d.status && d.status !== "in_progress") {
      setError("This test has already been submitted.");
    }
    setLoading(false);
  }, [attemptId, token]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  // After the test loads, wait before starting detection + countdown (models & WASM initialize).
  useEffect(() => {
    if (loading || error || status !== "in_progress") {
      setPrepComplete(false);
      return;
    }
    setPrepComplete(false);
    const id = window.setTimeout(() => setPrepComplete(true), PROCTORING_PREP_MS);
    return () => window.clearTimeout(id);
  }, [loading, error, status, attemptId]);

  // Timer (starts only after prep so candidates are not charged for initialization time)
  useEffect(() => {
    if (status !== "in_progress" || !startedAt || !prepComplete) return;
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
  }, [status, startedAt, prepComplete]);

  const saveProgress = useCallback(
    async (extra = {}) => {
      if (!attemptId || !token || status !== "in_progress") return;
      const res = await saveTestProgress(attemptId, token, {
        mcqAnswers,
        codingSubmissions,
        ...extra,
      });
      if (res.success && res.data?.disqualified) {
        setStatus("disqualified");
        setDisqualified(true);
        setError(
          "Disqualified due to proctoring rules violation. Your attempt is not scored and will not be considered for ranking."
        );
      }
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

  useEffect(() => {
    if (!codingQuestions.length) return;
    if (codingStep >= codingQuestions.length) {
      setCodingStep(Math.max(0, codingQuestions.length - 1));
    }
  }, [codingQuestions.length, codingStep, codingQuestions]);

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

  const handleRunCode = async (questionIndex, sampleInput = "") => {
    const sub = (codingSubmissions[questionIndex] || {});
    const code = sub.code || "";
    const language = sub.language || "javascript";
    if (!code.trim()) {
      setRunOutputByQuestion((prev) => ({ ...prev, [questionIndex]: { error: "No code to run." } }));
      return;
    }
    setRunLoadingByQuestion((prev) => ({ ...prev, [questionIndex]: true }));
    setRunOutputByQuestion((prev) => ({ ...prev, [questionIndex]: null }));
    const result = await runCode(language, code, sampleInput);
    setRunLoadingByQuestion((prev) => ({ ...prev, [questionIndex]: false }));
    if (result.success && result.data) {
      setRunOutputByQuestion((prev) => ({
        ...prev,
        [questionIndex]: {
          stdout: result.data.stdout || "",
          stderr: result.data.stderr || "",
          exitCode: result.data.exitCode,
          error: result.data.error,
        },
      }));
    } else {
      setRunOutputByQuestion((prev) => ({
        ...prev,
        [questionIndex]: { error: result.error || "Run failed." },
      }));
    }
  };
  const getStdinForQuestion = (i) => runStdinByQuestion[i] !== undefined ? runStdinByQuestion[i] : (codingQuestions[i]?.sampleInput || "");

  const handleNextCoding = useCallback(async () => {
    if (status !== "in_progress" || !codingQuestions.length) return;
    await saveProgress();
    if (codingStep < codingQuestions.length - 1) {
      setCodingStep((s) => s + 1);
    } else {
      toast.info("This was the last coding problem. Submit the test from the header when you are done.");
    }
  }, [status, codingQuestions.length, codingStep, saveProgress]);

  const handlePrevCoding = useCallback(() => {
    setCodingStep((s) => Math.max(0, s - 1));
  }, []);

  const handleTabSwitch = useCallback(() => {
    tabSwitchCountRef.current += 1;
    const count = tabSwitchCountRef.current;
    if (count === 1) {
      setTestPaused(true);
    } else if (count >= 2) {
      setTestPaused(false);
      if (handleSubmitRef.current) {
        handleSubmitRef.current(true); // proctoring disqualification (tab switch)
      }
    }
  }, []);

  const handleMaxViolations = useCallback(() => {
    if (handleSubmitRef.current) {
      handleSubmitRef.current(true); // proctoring disqualification (camera / object rules)
    }
  }, []);

  const handleSubmit = useCallback(async (proctoringDisqualification = false) => {
    if (status !== "in_progress") return;
    await saveProgress();
    const result = await submitTest(attemptId, token, {
      mcqAnswers,
      codingSubmissions,
      proctoringDisqualification: !!proctoringDisqualification,
    });
    if (result.success) {
      const disq = result.data?.disqualified === true || result.data?.status === "disqualified";
      if (disq) {
        setStatus("disqualified");
        setDisqualified(true);
        toast.warning("Disqualified due to proctoring rules violation. Your attempt will not be scored.");
        router.push(
          `/test/done?token=${encodeURIComponent(token)}&attemptId=${attemptId}&disqualified=1`
        );
      } else {
        setStatus("submitted");
        toast.success("Test submitted successfully.");
        router.push(`/test/done?token=${encodeURIComponent(token)}&attemptId=${attemptId}`);
      }
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
        enableDetection={prepComplete}
        mcqMode={section === "mcq"}
      />

      {/* Warm-up: camera + AI models load without running detection yet */}
      {status === "in_progress" && !prepComplete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-2xl border border-violet-500/30 bg-slate-900 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-violet-500/50">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Preparing your test</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Initializing the secure environment: camera preview and on-device checks (this usually takes about 10–15 seconds). Please stay on this page and allow camera access if prompted.
            </p>
            <p className="text-xs text-slate-500">
              The timer will start after setup completes. You can review instructions below once the overlay clears.
            </p>
          </div>
        </div>
      )}

      {/* Pause until face detected (only after prep — avoids clashing with model init) */}
      {status === "in_progress" && prepComplete && !faceDetected && !testPaused && (
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
            {section === "mcq" ? "MCQ Section (30 marks)" : `Coding (3 problems, 70 marks) — ${Math.min(codingStep + 1, Math.max(codingQuestions.length, 1))}/${Math.max(codingQuestions.length, 1)}`}
          </span>
          <span className="text-2xl font-mono text-violet-600 dark:text-violet-400">{formatTime(timeLeftSeconds)}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSection("mcq")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${section === "mcq" ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"}`}
          >
            MCQs
          </button>
          <button
            type="button"
            onClick={() => setSection("coding")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${section === "coding" ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"}`}
          >
            Coding
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700"
          >
            Submit test
          </button>
        </div>
      </header>

      <main
        className={
          section === "coding"
            ? "flex-1 flex flex-col min-h-0 overflow-hidden p-0"
            : "flex-1 overflow-auto p-4 md:p-6"
        }
      >
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
                        className="text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {section === "coding" && codingQuestions.length > 0 && (() => {
          const i = Math.min(codingStep, codingQuestions.length - 1);
          const q = codingQuestions[i];
          const sub = codingSubmissions[i] || {};
          const runOut = runOutputByQuestion[i];
          const runLoading = runLoadingByQuestion[i];
          return (
            <div className="flex flex-1 flex-col lg:flex-row min-h-0">
              <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4 md:p-6 bg-white dark:bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-2">
                  Problem {i + 1} of {codingQuestions.length}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">{q.title}</h2>
                <span className="inline-block mb-4 text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {q.difficulty || "medium"}
                </span>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  <div>{q.statement}</div>
                  {q.inputFormat && (
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200">Input:</strong> {q.inputFormat}
                    </div>
                  )}
                  {q.outputFormat && (
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200">Output:</strong> {q.outputFormat}
                    </div>
                  )}
                  {q.sampleInput && (
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200">Sample input:</strong>
                      <pre className="mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs overflow-x-auto">{q.sampleInput}</pre>
                    </div>
                  )}
                  {q.sampleOutput && (
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200">Sample output:</strong>
                      <pre className="mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs overflow-x-auto">{q.sampleOutput}</pre>
                    </div>
                  )}
                  {q.constraints && (
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200">Constraints:</strong> {q.constraints}
                    </div>
                  )}
                </div>
              </div>
              <div className="lg:w-1/2 flex flex-col min-h-0 flex-1 p-4 md:p-6 gap-3 bg-slate-50 dark:bg-slate-950/50">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Language</label>
                  <select
                    value={sub.language || "javascript"}
                    onChange={(e) => handleCodingChange(i, sub.code || "", e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm px-2 py-1.5"
                  >
                    <option value="javascript">JavaScript (Node)</option>
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                  </select>
                </div>
                <div className="flex-1 min-h-[520px] rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <MonacoEditor
                    height={520}
                    language={monacoLanguageId(sub.language)}
                    theme="vs-dark"
                    value={sub.code || ""}
                    onChange={(v) => handleCodingChange(i, v ?? "", sub.language || "javascript")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                    }}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Custom input (optional)</label>
                    <textarea
                      placeholder="stdin for testing..."
                      className="w-full h-20 font-mono text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-2"
                      value={getStdinForQuestion(i)}
                      onChange={(e) => setRunStdinByQuestion((prev) => ({ ...prev, [i]: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRunCode(i, getStdinForQuestion(i))}
                    disabled={runLoading || status !== "in_progress"}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 shrink-0"
                  >
                    {runLoading ? "Running…" : "Run code"}
                  </button>
                </div>
                {runOut && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0">
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                      Output (Piston / server)
                    </div>
                    <pre className="p-3 font-mono text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word">
                      {runOut.error && <span className="text-red-600 dark:text-red-400">{runOut.error}</span>}
                      {runOut.stderr && <span className="text-amber-600 dark:text-amber-400">{runOut.stderr}</span>}
                      {runOut.stdout != null && runOut.stdout !== "" && runOut.stdout}
                      {runOut.exitCode != null && runOut.exitCode !== 0 && !runOut.stderr && !runOut.error && (
                        <span className="text-slate-500">Exit code: {runOut.exitCode}</span>
                      )}
                      {!runOut.error && !runOut.stderr && (runOut.stdout == null || runOut.stdout === "") && runOut.exitCode === 0 && (
                        <span className="text-slate-500">(no output)</span>
                      )}
                    </pre>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={handlePrevCoding}
                    disabled={i === 0 || status !== "in_progress"}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNextCoding}
                    disabled={status !== "in_progress"}
                    className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-50"
                  >
                    {i < codingQuestions.length - 1 ? "Save & next problem" : "Save (last problem)"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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
