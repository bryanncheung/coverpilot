"use client";

import { useRef, useState } from "react";
import type { PolicyFact } from "@/types";
import Link from "next/link";
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
            CoverPilot
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
          <div className="space-y-3">
            {usedFallback && (
                  <div className="cp-alert">
                    <p>
                  AI extraction was unavailable, so CoverPilot used a deterministic
                  parser on your uploaded PDF. Review the extracted facts before
                  relying on them.
                </p>
              </div>
            )}

                <p className="text-sm text-[var(--muted)]">
              {facts.length} facts extracted from the policy document.
            </p>

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
