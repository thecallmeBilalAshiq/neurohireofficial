"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { validateTestToken, startTest } from "../../lib/api";
import { toast } from "react-toastify";

const PROCTORING_INSTRUCTIONS = [
  {
    title: "Face detection & identity",
    items: [
      "Your face must be visible to the camera at all times during the test. The test will not continue if your face is not detected.",
      "Only one person (you) must be visible in the camera frame. Multiple faces will be treated as a violation.",
    ],
  },
  {
    title: "Screen position & posture",
    items: [
      "Your face and eyes should stay within standard laptop screen viewing dimensions. You will be given up to 5 alerts if you move well above or beyond these limits.",
      "After 5 alerts, you will be automatically disqualified and your test will be submitted.",
    ],
  },
  {
    title: "Devices & objects",
    items: [
      "Object detection is active. Do not use mobile phones, secondary devices, or reference materials in view of the camera. Such behavior may result in disqualification.",
    ],
  },
  {
    title: "MCQ section (30 questions, 30 marks)",
    items: [
      "You may use only the left mouse button to select answers. No keyboard or right-click is allowed in the MCQ section.",
    ],
  },
  {
    title: "Coding section (7 questions, 70 marks)",
    items: [
      "Full keyboard and mouse access are allowed for typing code and navigating the coding environment.",
    ],
  },
  {
    title: "Browser & focus",
    items: [
      "Do not open new tabs, switch windows, or use the browser developer console. Doing so will trigger a warning and may be recorded as a violation.",
    ],
  },
];

function TestEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [existingAttemptId, setExistingAttemptId] = useState(null);

  useEffect(() => {
    if (!token) {
      setError("No test link provided. Please use the link from your invitation email.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await validateTestToken(token);
      if (cancelled) return;
      setLoading(false);
      if (result.success) {
        setValid(true);
        setInfo(result.data);
        setExistingAttemptId(result.data.existingAttemptId || null);
      } else {
        setError(result.error || "Invalid or expired link");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleStartTest = async () => {
    if (!token) return;
    if (existingAttemptId) {
      router.push(`/test/take?token=${encodeURIComponent(token)}&attemptId=${existingAttemptId}`);
      return;
    }
    if (!agreed) {
      toast.warning("Please confirm that you have read and agree to the instructions.");
      return;
    }
    setStarting(true);
    try {
      const result = await startTest(token);
      if (result.success) {
        const { attemptId } = result.data;
        router.push(`/test/take?token=${encodeURIComponent(token)}&attemptId=${attemptId}`);
      } else {
        toast.error(result.error || "Failed to start test");
        setStarting(false);
      }
    } catch (e) {
      toast.error("Failed to start test");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Validating your test link...</div>
      </div>
    );
  }

  if (error || !valid) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Invalid or expired link</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">{error}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Please use the link sent to you in your invitation email, and ensure you take the test within 1 week.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-teal-600 to-emerald-600">
            Online Test – {info?.jobTitle}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{info?.company}</p>
          {info?.expiresAt && (
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
              Test must be completed by: {new Date(info.expiresAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Test format</h2>
          <ul className="text-sm text-amber-800 dark:text-amber-200/90 space-y-1">
            <li>• 30 MCQs (30 marks) – job/stack related</li>
            <li>• 7 coding questions (70 marks) – data structures, algorithms, problem solving</li>
            <li>• Total time: 2 hours</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Proctoring & rules</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Please read these instructions carefully. Violations may lead to disqualification.
            </p>
          </div>
          <div className="px-6 py-5 space-y-6">
            {PROCTORING_INSTRUCTIONS.map((section, i) => (
              <div key={i}>
                <h3 className="font-medium text-slate-800 dark:text-white mb-2">{section.title}</h3>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  {section.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {existingAttemptId ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">You have an in-progress attempt. Click below to continue.</p>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                I have read and agree to these rules and understand that violations may result in disqualification.
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={handleStartTest}
            disabled={!existingAttemptId && (!agreed || starting)}
            className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-teal-600 to-emerald-600 text-white shadow hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {starting ? "Starting..." : existingAttemptId ? "Continue test" : "Start test"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TestEntryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">Loading...</div>}>
      <TestEntryContent />
    </Suspense>
  );
}
