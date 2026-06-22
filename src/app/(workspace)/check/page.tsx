"use client";

import { useState } from "react";
import type {
  CompareResponse,
  SourceComparison,
  CalculationCard,
  UserStatement,
} from "@/types";
import { SEEDED_FACTS, SEEDED_STATEMENTS } from "@/data/seeded-policy";
import Link from "next/link";

const STATE_LABELS: Record<SourceComparison["state"], string> = {
  "matches-document": "Matches document",
  "partially-matches": "Partially matches",
  "not-found": "Not found in document",
  "needs-source-reconciliation": "Needs source reconciliation",
  "calculation-differs": "Calculation differs",
};

const STATE_COLORS: Record<SourceComparison["state"], string> = {
  "matches-document": "bg-green-900 text-green-300 border-green-700",
  "partially-matches": "bg-yellow-900 text-yellow-300 border-yellow-700",
  "not-found": "bg-slate-700 text-slate-300 border-slate-600",
  "needs-source-reconciliation": "bg-orange-900 text-orange-300 border-orange-700",
  "calculation-differs": "bg-red-900 text-red-300 border-red-700",
};

const LOADING_STEPS = [
  "Running compliance check…",
  "Comparing statements against document…",
  "Running calculations…",
  "Almost done…",
];

export default function CheckPage() {
  const [statements, setStatements] = useState<UserStatement[]>(SEEDED_STATEMENTS);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");

  async function runCheck() {
    setError(null);
    setResult(null);
    setLoadingStep(LOADING_STEPS[0]);

    const stepTimer = window.setInterval(() => {
      setLoadingStep((prev) => {
        const idx = LOADING_STEPS.indexOf(prev ?? "");
        return LOADING_STEPS[Math.min(idx + 1, LOADING_STEPS.length - 1)];
      });
    }, 1800);

    try {
      const res = await fetch("/api/statements/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts: SEEDED_FACTS, statements }),
      });
      if (!res.ok) throw new Error("Comparison failed. Please try again.");
      const data: CompareResponse = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearInterval(stepTimer);
      setLoadingStep(null);
    }
  }

  function addCustomStatement() {
    if (!customInput.trim()) return;
    setStatements((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, text: customInput.trim(), category: "other" },
    ]);
    setCustomInput("");
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
          <h1 className="text-2xl font-bold">🔍 Check</h1>
          <p className="text-slate-400 mt-1">
            Compare statements from your sales conversation against the policy document.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-400">Statements to check:</p>
          {statements.map((s, i) => (
            <div
              key={s.id}
              className="flex items-start gap-3 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5"
            >
              <span className="text-slate-500 text-sm mt-0.5">{i + 1}.</span>
              <span className="text-sm flex-1">{s.text}</span>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomStatement()}
              placeholder="Add a statement you heard…"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={addCustomStatement}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <button
          onClick={runCheck}
          disabled={!!loadingStep}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {loadingStep ?? "Check statements"}
        </button>

        {loadingStep && (
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
            {loadingStep}
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {result?.blocked && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-red-300">CoverPilot cannot answer this</p>
            <p className="text-red-200 text-sm">{result.blockReason}</p>
          </div>
        )}

        {result && !result.blocked && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Statement Comparisons</h2>
            {result.comparisons.map((c) => {
              const stmt = statements.find((s) => s.id === c.statementId);
              return (
                <div
                  key={c.statementId}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-sm">&ldquo;{stmt?.text}&rdquo;</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${STATE_COLORS[c.state]}`}
                    >
                      {STATE_LABELS[c.state]}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm">{c.explanation}</p>
                  {c.documentEvidence.length > 0 && (
                    <div className="space-y-1">
                      {c.documentEvidence.map((e) => (
                        <blockquote
                          key={e.id}
                          className="text-slate-400 text-xs border-l-2 border-slate-600 pl-3 italic"
                        >
                          {e.quote}
                          {e.page ? ` (p.${e.page})` : ""}
                        </blockquote>
                      ))}
                    </div>
                  )}
                  <p className="text-blue-400 text-sm">
                    Q: {c.clarificationQuestion}
                  </p>
                </div>
              );
            })}

            {result.calculations.length > 0 && (
              <>
                <h2 className="font-semibold text-lg pt-2">Calculation Cards</h2>
                {result.calculations.map((calc) => (
                  <CalcCard key={calc.id} calc={calc} />
                ))}
              </>
            )}

            <div className="pt-2">
              <Link
                href="/prepare"
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-lg transition-colors inline-block"
              >
                Prepare meeting report →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CalcCard({ calc }: { calc: CalculationCard }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
      <h3 className="font-medium text-sm">{calc.title}</h3>
      <p className="text-slate-400 text-xs font-mono">{calc.formula}</p>
      <p className="text-xl font-bold text-white">{calc.result}</p>
      <p className="text-slate-500 text-xs">{calc.caveat}</p>
    </div>
  );
}
