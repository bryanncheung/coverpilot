"use client";

import { useRef, useState } from "react";
import type { PolicyFact } from "@/types";
import Link from "next/link";
import { buildDocumentAnalysis } from "@/lib/document-analysis";
import {
  clearPolicyWorkspace,
  createCaseEvent,
  savePolicyWorkspace,
  updateCaseWorkspace,
  type PolicyWorkspaceSource,
} from "@/lib/workspace-session";

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
  const analysis = facts ? buildDocumentAnalysis(facts) : null;

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

  async function readUploadError(res: Response) {
    try {
      const data = (await res.json()) as { error?: string };
      return data.error ?? "Could not read the document. Please try again.";
    } catch {
      return "Could not read the document. Please try again.";
    }
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

      if (!res.ok) throw new Error(await readUploadError(res));
      const data = await res.json();
      const source: PolicyWorkspaceSource = data.fallback
        ? "uploaded-fallback"
        : mode === "seeded"
          ? "sample"
          : "uploaded";

      if (data.fallback) setUsedFallback(true);
      savePolicyWorkspace(data.facts, source);
      updateCaseWorkspace((current) => ({
        ...current,
        facts: data.facts,
        factsSource: source,
        comparisons: [],
        calculations: [],
        report: null,
        events: [
          ...current.events,
          createCaseEvent(
            "Policy facts loaded",
            `${data.facts.length} facts were saved from the Decode page.`
          ),
        ],
      }));
      setFacts(data.facts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearInterval(stepTimer);
      setLoadingStep(null);
    }
  }

  return (
    <main className="cp-page">
      <div className="cp-shell">
        <header className="cp-nav">
          <Link href="/" className="font-display text-2xl font-light">
            Claro
          </Link>
          <nav className="cp-nav-links">
            <Link href="/check">Check</Link>
            <Link href="/ask">Ask</Link>
            <Link href="/my-case">My Case</Link>
          </nav>
        </header>

        <div className="cp-workspace">
          <section className="cp-route-header">
            <div>
              <p className="cg-kicker">Decode</p>
              <h1 className="cp-route-title">Understand a financial document.</h1>
            </div>
            <p className="cp-route-copy">
            Upload a policy illustration or financial document to extract the
            figures you want to understand.
          </p>
            <div className="cp-empty">
              Start with your own PDF. Sample data is available only as a demo.
            </div>
          </section>

          <section className="cp-stack">
        {!facts && !loadingStep && (
              <div className="cp-panel cp-panel-pad cp-stack">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileRef.current?.click()}
                  className="primary-button w-fit"
            >
              Upload PDF
            </button>

            <button
              onClick={loadSeeded}
                  className="cp-quiet-link w-fit"
            >
              Try with a sample policy
            </button>

                <p className="text-xs text-[var(--muted)]">
              Documents are processed in-session only and not stored.
            </p>
          </div>
        )}

        {loadingStep && (
              <div className="cp-panel cp-panel-pad space-y-3">
            {LOADING_STEPS.map((step) => {
              const current = LOADING_STEPS.indexOf(loadingStep);
              const idx = LOADING_STEPS.indexOf(step);
              return (
                <div key={step} className="flex items-center gap-3 text-sm">
                  {idx < current ? (
                        <span className="w-12 text-[var(--success)]">Done</span>
                  ) : idx === current ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border border-[var(--line)] border-t-[var(--foreground)]" />
                  ) : (
                        <span className="h-4 w-4 rounded-full border border-[var(--line)]" />
                  )}
                      <span className={idx <= current ? "text-[var(--foreground)]" : "text-[var(--soft)]"}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {error && (
              <div className="cp-error">
                <p>{error}</p>
            <button
              onClick={() => setError(null)}
                  className="mt-2 text-xs underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {facts && (
          <div className="space-y-5">
            {usedFallback && (
                  <div className="cp-alert">
                    <p>
                  AI extraction was unavailable, so Claro used a deterministic
                  parser on your uploaded PDF. Review the extracted facts before
                  relying on them.
                </p>
              </div>
            )}

                <p className="text-sm text-[var(--muted)]">
              {facts.length} facts extracted from the policy document.
            </p>

                {analysis && (
                  <div className="space-y-5">
                    <section className="cp-panel cp-panel-pad space-y-5">
                      <div>
                        <p className="cp-source-label">Deep document analysis</p>
                        <h2 className="text-2xl font-medium tracking-[-0.01em]">
                          What this policy illustration is really showing
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          Claro extracts the document figures, then computes the
                          mechanics that are hard to see at a glance: premium
                          commitment, distribution cost load, Breakeven, surrender
                          trade-offs, and projected values in today&apos;s dollars.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {analysis.summary.map((metric) => (
                          <div key={metric.label} className="cp-decode-metric">
                            <p className="cp-source-label">{metric.label}</p>
                            <p className="text-xl font-medium">{metric.value}</p>
                            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                              {metric.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div>
                        <p className="cp-source-label">Calculations</p>
                        <h3 className="text-lg font-medium">Document-derived mechanics</h3>
                      </div>
                      {analysis.calculations.map((calc) => (
                        <div key={calc.id} className="cp-panel cp-panel-pad space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-medium">{calc.title}</h4>
                              <p className="mt-1 text-sm text-[var(--muted)]">
                                {calc.formula}
                              </p>
                            </div>
                            <span className="cp-status">calculated</span>
                          </div>
                          <p className="text-lg font-medium">{calc.result}</p>
                          <p className="text-sm leading-6 text-[var(--muted)]">
                            {calc.caveat}
                          </p>
                          {calc.inputs.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {calc.inputs.map((input) => (
                                <span key={`${calc.id}-${input.id}`} className="cp-status">
                                  {input.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </section>

                    <section className="space-y-3">
                      <div>
                        <p className="cp-source-label">Interpretation</p>
                        <h3 className="text-lg font-medium">How to read the main tables</h3>
                      </div>
                      {analysis.sections.map((section) => (
                        <div key={section.title} className="cp-panel cp-panel-pad space-y-3">
                          <h4 className="font-medium">{section.title}</h4>
                          <p className="text-sm leading-6 text-[var(--muted)]">
                            {section.body}
                          </p>
                          {section.facts.length > 0 && (
                            <div className="space-y-2">
                              {section.facts.slice(0, 3).map((fact) => (
                                <blockquote key={`${section.title}-${fact.id}`} className="cp-source">
                                  <span className="font-medium text-[var(--foreground)]">
                                    {fact.label}:{" "}
                                  </span>
                                  {String(fact.value)}
                                  {fact.unit ? ` ${fact.unit}` : ""}
                                  {fact.quote ? ` — ${fact.quote}` : ""}
                                </blockquote>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </section>

                    <section className="cp-panel cp-panel-pad space-y-3">
                      <div>
                        <p className="cp-source-label">Ask your adviser</p>
                        <h3 className="text-lg font-medium">
                          Questions to bring into the next meeting
                        </h3>
                      </div>
                      <ol className="space-y-3">
                        {analysis.sustainabilityQuestions.map((question, index) => (
                          <li key={question} className="flex gap-3 text-sm leading-6">
                            <span className="font-mono text-xs text-[var(--soft)]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  </div>
                )}

                <section className="space-y-3">
                  <div>
                    <p className="cp-source-label">Extracted source facts</p>
                    <h3 className="text-lg font-medium">Evidence used by Claro</h3>
                  </div>
                  {facts.map((fact) => (
                    <div
                      key={fact.id}
                      className="cp-panel cp-panel-pad space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{fact.label}</span>
                        <span className="cp-status">
                          {fact.sourceType}
                        </span>
                      </div>
                      <p>
                        {String(fact.value)}
                        {fact.unit ? ` ${fact.unit}` : ""}
                      </p>
                      {fact.quote && (
                        <blockquote className="cp-source">
                          {fact.quote}
                          {fact.page ? ` (p.${fact.page})` : ""}
                        </blockquote>
                      )}
                    </div>
                  ))}
                </section>

                <div className="flex gap-3 pt-2">
                  <Link
                    href="/check"
                    className="primary-button"
                  >
                    Check statements →
                  </Link>
                  <button
                    onClick={() => {
                      clearPolicyWorkspace();
                      setFacts(null);
                      setUsedFallback(false);
                    }}
                    className="secondary-button"
                  >
                    Load different policy
                  </button>
                </div>
          </div>
        )}
          </section>
        </div>
      </div>
    </main>
  );
}
