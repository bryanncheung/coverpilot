"use client";

import { useState } from "react";
import type { ReportResponse } from "@/types";
import { SEEDED_FACTS, SEEDED_STATEMENTS } from "@/data/seeded-policy";
import Link from "next/link";

const LOADING_STEPS = [
  "Reading policy…",
  "Extracting facts…",
  "Comparing statements…",
  "Calculating figures…",
  "Preparing your questions…",
];

export default function PreparePage() {
  const [report, setReport] = useState<ReportResponse["report"] | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateReport() {
    setError(null);
    setReport(null);
    setLoadingStep(LOADING_STEPS[0]);

    const stepTimer = window.setInterval(() => {
      setLoadingStep((prev) => {
        const idx = LOADING_STEPS.indexOf(prev ?? "");
        return LOADING_STEPS[Math.min(idx + 1, LOADING_STEPS.length - 1)];
      });
    }, 1400);

    try {
      const compareRes = await fetch("/api/statements/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts: SEEDED_FACTS, statements: SEEDED_STATEMENTS }),
      });
      if (!compareRes.ok) throw new Error("Comparison failed. Please try again.");
      const compareData = await compareRes.json();
      if (compareData.blocked) throw new Error(compareData.blockReason);

      const reportRes = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facts: SEEDED_FACTS,
          comparisons: compareData.comparisons,
          calculations: compareData.calculations,
        }),
      });
      if (!reportRes.ok) throw new Error("Report generation failed. Please try again.");
      const reportData: ReportResponse = await reportRes.json();
      setReport(reportData.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearInterval(stepTimer);
      setLoadingStep(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">
            ← Home
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold">📋 Prepare</h1>
          <p className="text-slate-400 mt-1">
            Your meeting-prep report — sourced facts, calculations, and questions
            for your licensed adviser.
          </p>
        </div>

        {!report && (
          <div className="space-y-4">
            <button
              onClick={generateReport}
              disabled={!!loadingStep}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {loadingStep ?? "Generate meeting-prep report"}
            </button>

            {loadingStep && (
              <div className="space-y-2">
                {LOADING_STEPS.map((step) => {
                  const current = LOADING_STEPS.indexOf(loadingStep);
                  const idx = LOADING_STEPS.indexOf(step);
                  return (
                    <div key={step} className="flex items-center gap-3 text-sm">
                      {idx < current ? (
                        <span className="text-green-400 w-4">✓</span>
                      ) : idx === current ? (
                        <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-slate-700" />
                      )}
                      <span className={idx <= current ? "text-slate-200" : "text-slate-600"}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="bg-red-950 border border-red-800 rounded-lg p-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {report && (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="font-semibold text-lg border-b border-slate-700 pb-2">
                Policy Facts
              </h2>
              {report.policySummary.slice(0, 6).map((fact) => (
                <div key={fact.id} className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-400">{fact.label}</span>
                  <span className="font-medium text-right">
                    {String(fact.value)}
                    {fact.unit ? ` ${fact.unit}` : ""}
                  </span>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-lg border-b border-slate-700 pb-2">
                Calculations
              </h2>
              {report.calculations.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4"
                >
                  <p className="text-sm text-slate-400">{c.title}</p>
                  <p className="text-xl font-bold mt-1">{c.result}</p>
                  <p className="text-slate-500 text-xs mt-1">{c.caveat}</p>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-lg border-b border-slate-700 pb-2">
                Questions for Your Licensed Adviser
              </h2>
              <ol className="space-y-2">
                {report.questionsForLicensedAdviser.map((q, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-slate-500 shrink-0">{i + 1}.</span>
                    <span className="text-slate-200">{q}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-xs">{report.complianceNotice}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
