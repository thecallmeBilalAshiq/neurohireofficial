"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function TestDoneContent() {
  const searchParams = useSearchParams();
  const disqualified = searchParams.get("disqualified") === "1";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        {disqualified ? (
          <>
            <h1 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">Disqualified</h1>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Your attempt ended because of a proctoring rules violation (for example repeated tab switching or camera checks).{" "}
              <strong className="text-slate-800 dark:text-slate-200">No score is shown or recorded for ranking.</strong> The hiring team will not consider this attempt as a completed assessment.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Test submitted</h1>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Thank you for completing the test. Your responses have been recorded. The hiring team will review your submission and contact you if you progress to the next stage.
            </p>
          </>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">You can safely close this tab.</p>
      </div>
    </div>
  );
}

export default function TestDonePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">Loading...</div>}>
      <TestDoneContent />
    </Suspense>
  );
}
