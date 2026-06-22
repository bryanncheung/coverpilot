"use client";

import { useRef, useState } from "react";
import type { PolicyFact } from "@/types";
import Link from "next/link";

const LOADING_STEPS = [
  "Reading policy…",
  "Extracting facts…",
  "Structuring data…",
];

export default function DecodePage() {
  const [facts, setFacts] = useState<PolicyFact[] | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadSeeded() {
    await extractFacts("seeded");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    await extractFacts("upload", file);
  }

  async function extractFacts(mode: "seeded" | "upload", file?: File) {
    setError(null);
    setFacts(null);
    setUsedFallback(false);
    setLoadingStep(LOADING_STEPS[0]);

    const stepTimer = window.setInterval(() => {
      setLoadingStep((prev) => {
        const idx = LOADING_STEPS.indexOf(prev ?? "");
        return LOADING_STEPS[Math.min(idx + 1, LOADING_STEPS.length - 1)];
      });
    }, 1200);

    try {
      let res: Response;

      if (mode === "seeded") {
        res = await fetch("/api/policy/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "seeded" }),
        });
      } else {
        const form = new FormData();
        form.append("file", file!);
        res = await fetch("/api/policy/extract", { method: "POST", body: form });
      }

      if (!res.ok) throw new Error("Could not read the document. Please try again.");
      const data = await res.json();

      if (data.fallback) setUsedFallback(true);
      setFacts(data.facts);
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
        <Link href="/" className="text-slate-400 hover:text-white text-sm">
          ← Home
        </Link>

        <div>
          <h1 className="text-2xl font-bold">📄 Decode</h1>
          <p className="text-slate-400 mt-1">
            Extract structured facts from a policy document.
          </p>
        </div>

        {!facts && !loadingStep && (
          <div className="space-y-3">
            <button
              onClick={loadSeeded}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Use sample policy
            </button>

            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <span className="flex-1 h-px bg-slate-800" />
              or
              <span className="flex-1 h-px bg-slate-800" />
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Upload my own policy (PDF)
            </button>

            <p className="text-slate-500 text-xs">
              Documents are processed in-session only and not stored.
            </p>
          </div>
        )}

        {loadingStep && (
          <div className="space-y-3">
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
            <button
              onClick={() => setError(null)}
              className="text-red-400 text-xs mt-2 underline"
            >
              Try again
            </button>
          </div>
        )}

        {facts && (
          <div className="space-y-3">
            {usedFallback && (
              <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-2">
                <p className="text-yellow-300 text-xs">
                  Could not extract enough data from the uploaded PDF. Showing sample policy instead.
                </p>
              </div>
            )}

            <p className="text-slate-400 text-sm">
              {facts.length} facts extracted from the policy document.
            </p>

            {facts.map((fact) => (
              <div
                key={fact.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{fact.label}</span>
                  <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                    {fact.sourceType}
                  </span>
                </div>
                <p className="text-slate-200">
                  {String(fact.value)}
                  {fact.unit ? ` ${fact.unit}` : ""}
                </p>
                {fact.quote && (
                  <blockquote className="text-slate-400 text-xs border-l-2 border-slate-600 pl-3 mt-1 italic">
                    {fact.quote}
                    {fact.page ? ` (p.${fact.page})` : ""}
                  </blockquote>
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Link
                href="/check"
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Check statements →
              </Link>
              <button
                onClick={() => { setFacts(null); setUsedFallback(false); }}
                className="text-slate-400 hover:text-white text-sm px-4 py-2.5"
              >
                Load different policy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
