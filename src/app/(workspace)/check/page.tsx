"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CompareResponse,
  SourceComparison,
  CalculationCard,
  PolicyFact,
  UserStatement,
} from "@/types";
import { SEEDED_STATEMENTS } from "@/data/seeded-policy";
import Link from "next/link";
import { checkCompliance } from "@/lib/compliance";
import {
  createCaseEvent,
  loadPolicyWorkspace,
  saveCheckWorkspace,
  savePolicyWorkspace,
  updateCaseWorkspace,
  type PolicyWorkspaceSource,
} from "@/lib/workspace-session";
import {
  classifyFinancialStatement,
  splitFinancialClaims,
  topicForText,
} from "@/lib/financial-topic-intelligence";

const STATE_LABELS: Record<SourceComparison["state"], string> = {
  "matches-document": "Found in document",
  "partially-matches": "Partially found",
  "not-found": "No matching section found",
  "needs-source-reconciliation": "Ask adviser to clarify",
  "calculation-differs": "Calculation differs",
};

const LOADING_STEPS = [
  "Running compliance check…",
  "Comparing statements against document…",
  "Running calculations…",
  "Almost done…",
];

const EXAMPLE_CLAIMS = [
  "This plan is low-cost and most of your premium goes into savings.",
  "The returns are basically guaranteed if you hold it long enough.",
  "You can surrender anytime and still get your money back.",
  "This gives you both protection and investment growth.",
];

export default function CheckPage() {
  const [policyWorkspace] = useState(() => loadPolicyWorkspace());
  const [facts, setFacts] = useState<PolicyFact[]>(() => policyWorkspace?.facts ?? []);
  const [policySource, setPolicySource] = useState<PolicyWorkspaceSource>(
    () => policyWorkspace?.source ?? "uploaded"
  );
  const [statements, setStatements] = useState<UserStatement[]>([]);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPolicy, setUploadingPolicy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFallback, setUploadFallback] = useState(false);
  const [claimInput, setClaimInput] = useState("");
  const [noFactsCaveat, setNoFactsCaveat] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const statementsRef = useRef<HTMLDivElement>(null);
  const compliance = checkCompliance(claimInput);

  async function readUploadError(res: Response) {
    try {
      const data = (await res.json()) as { error?: string };
      return data.error ?? "Could not read the policy illustration.";
    } catch {
      return "Could not read the policy illustration.";
    }
  }

  async function uploadPolicy(file: File) {
    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF policy illustration.");
      return;
    }

    setUploadingPolicy(true);
    setUploadError(null);
    setUploadFallback(false);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/policy/extract", { method: "POST", body: form });
      if (!res.ok) throw new Error(await readUploadError(res));
      const data = (await res.json()) as { facts: PolicyFact[]; fallback?: boolean };
      setFacts(data.facts);
      setUploadFallback(!!data.fallback);
      setPolicySource(data.fallback ? "uploaded-fallback" : "uploaded");
      savePolicyWorkspace(data.facts, data.fallback ? "uploaded-fallback" : "uploaded");
      setResult(null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Could not read the policy illustration.");
    } finally {
      setUploadingPolicy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runCheck() {
    if (statements.length === 0) {
      setError("Add at least one checkable point first.");
      return;
    }
    setError(null);
    setResult(null);
    setNoFactsCaveat(facts.length === 0);
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
        body: JSON.stringify({ facts, statements }),
      });
      if (!res.ok) throw new Error("Comparison failed. Please try again.");
      const data: CompareResponse = await res.json();
      if (!data.blocked) {
        saveCheckWorkspace(statements, data.comparisons, data.calculations);
        updateCaseWorkspace((current) => ({
          ...current,
          facts,
          factsSource: policySource,
          statements,
          comparisons: data.comparisons,
          calculations: data.calculations,
          report: null,
          events: [
            ...current.events,
            createCaseEvent(
              "Evidence review generated",
              `${data.comparisons.length} claims were checked from the Check page.`
            ),
          ],
        }));
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearInterval(stepTimer);
      setLoadingStep(null);
    }
  }

  function splitInputIntoClaims() {
    setError(null);
    if (!claimInput.trim()) {
      setError("Paste what your adviser said first.");
      return;
    }
    if (compliance.blocked) {
      setStatements([]);
      return;
    }
    setResult(null);
    setStatements(splitFinancialClaims(claimInput));
  }

  function updateStatement(id: string, text: string) {
    setStatements((prev) =>
      prev.map((statement) =>
        statement.id === id
          ? { ...statement, text, category: classifyFinancialStatement(text) }
          : statement
      )
    );
  }

  function removeStatement(id: string) {
    setStatements((prev) => prev.filter((statement) => statement.id !== id));
  }

  function loadDemoClaims() {
    setClaimInput(SEEDED_STATEMENTS.map((statement) => statement.text).join("\n"));
    setStatements(SEEDED_STATEMENTS);
    setResult(null);
    setError(null);
  }

  useEffect(() => {
    if (statements.length > 0) {
      setTimeout(
        () => statementsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        80
      );
    }
  }, [statements.length]);

  return (
    <main className="cp-page">
      <div className="cp-shell">
        <header className="cp-nav">
          <Link href="/" className="font-display text-2xl font-light">
            Claro
          </Link>
          <nav className="cp-nav-links">
            <Link href="/decode">Decode</Link>
            <Link href="/ask">Ask</Link>
            <Link href="/my-case">My Case</Link>
          </nav>
        </header>

        <div className="cp-workspace">
          <section className="cp-route-header">
            <div>
              <p className="cg-kicker">Check</p>
              <h1 className="cp-route-title">Check what my adviser said.</h1>
            </div>
            <p className="cp-route-copy">
            Paste a claim from WhatsApp, a meeting, or a sales pitch. Claro
            turns it into checkable points and prepares questions for your next
            conversation.
          </p>
            <div className="cp-empty">
              {facts.length > 0
                ? `${facts.length} document facts are available for this check.`
                : "No document loaded yet. You can start with a claim, then add a document when you want policy-specific checks."}
            </div>
          </section>

          <section className="cp-stack">
            <div className="cp-panel cp-panel-pad cp-stack">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadPolicy(file);
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="cp-label">Policy illustration</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Attach the document behind the claim so Claro can check
                    policy-specific figures.
                  </p>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPolicy}
                  className="secondary-button w-fit disabled:opacity-50"
                >
                  {uploadingPolicy ? "Reading..." : facts.length > 0 ? "Replace PDF" : "Upload PDF"}
                </button>
              </div>
              <div className="cp-empty">
                {facts.length > 0
                  ? `${facts.length} document facts loaded for this policy-specific check.`
                  : "No policy illustration attached yet. You can split the adviser claim first, but policy-specific checking needs the PDF."}
              </div>
              {uploadError && <div className="cp-error">{uploadError}</div>}
              {uploadFallback && (
                <div className="cp-alert">
                  AI extraction was unavailable, so Claro used a deterministic
                  parser on your uploaded PDF. Review the extracted facts before
                  running the adviser check.
                </div>
              )}
            </div>

            <div className="cp-action-row">
              <button onClick={loadDemoClaims} className="cp-quiet-link">
                Use demo claims
              </button>
              <Link href="/decode" className="cp-quiet-link">
                Decode a document separately
              </Link>
            </div>

            <div className="cp-panel cp-panel-pad cp-stack">
          <div>
                <label htmlFor="claim-input" className="cp-label">
              What did your adviser say?
            </label>
            <textarea
              id="claim-input"
              value={claimInput}
              onChange={(e) => {
                setClaimInput(e.target.value);
                setResult(null);
              }}
              placeholder="Example: This plan is low-cost, the returns are basically guaranteed, and you can surrender anytime."
              rows={5}
                  className="cp-input mt-3"
            />
          </div>

              <div className="cp-chip-row">
            {EXAMPLE_CLAIMS.map((claim) => (
              <button
                key={claim}
                onClick={() => {
                  setClaimInput(claim);
                  setStatements(splitFinancialClaims(claim));
                  setResult(null);
                  setError(null);
                }}
                    className="cp-chip"
              >
                {claim}
              </button>
            ))}
          </div>

          {compliance.blocked && (
                <div className="cp-alert">
                  <p className="font-medium">
                Claro cannot answer that directly.
              </p>
                  <p className="mt-1">{compliance.reason}</p>
                  <p className="mt-2">{compliance.redirect}</p>
            </div>
          )}

              <div className="cp-action-row">
            <button
              onClick={splitInputIntoClaims}
              disabled={compliance.blocked}
                  className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
            >
              Split into checkable points
            </button>
                <p className="self-center text-xs text-[var(--muted)]">
              You can edit the points before running the check.
            </p>
          </div>
        </div>

        {statements.length > 0 && (
          <div ref={statementsRef} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Checkable points</p>
                  <p className="text-xs text-[var(--muted)]">{statements.length} point(s)</p>
            </div>
            {statements.map((s, i) => (
              <div
                key={s.id}
                    className="grid gap-3 border border-[var(--line)] bg-[var(--surface)] p-3 sm:grid-cols-[auto_1fr_auto]"
              >
                    <span className="mt-2 text-sm text-[var(--muted)]">{i + 1}.</span>
                <div className="space-y-2">
                  <textarea
                    value={s.text}
                    onChange={(e) => updateStatement(s.id, e.target.value)}
                    rows={2}
                        className="cp-input"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                        <span className="cp-status">
                      {topicForText(s.text).label}
                    </span>
                        <span className="text-[11px] text-[var(--muted)]">
                      Claro checks this with policy facts and public guidance where available.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeStatement(s.id)}
                      className="self-start border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={runCheck}
          disabled={!!loadingStep || statements.length === 0}
              className="primary-button disabled:opacity-50"
        >
          {loadingStep ?? "Check statements"}
        </button>

        {loadingStep && (
          <div className="cp-panel cp-panel-pad">
            <div className="flex items-center gap-4">
              <span className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--foreground)]" />
              <div>
                <p className="text-sm font-medium">{loadingStep}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">This takes about 10–20 seconds…</p>
              </div>
            </div>
          </div>
        )}

        {error && (
              <div className="cp-error">
                <p>{error}</p>
          </div>
        )}

        {result?.blocked && (
              <div className="cp-error space-y-2">
                <p className="font-semibold">Claro cannot answer this</p>
                <p>{result.blockReason}</p>
          </div>
        )}

        {result && !result.blocked && (
          <div className="space-y-4">
            {noFactsCaveat && (
              <div className="cp-alert">
                No policy document was loaded — these results use public guidance only. Upload a policy illustration for document-specific checks.
              </div>
            )}
            <h2 className="font-semibold text-lg">Statement Comparisons</h2>
            {result.comparisons.map((c) => {
              const stmt = statements.find((s) => s.id === c.statementId);
              return (
                <div
                  key={c.statementId}
                  className="cp-panel cp-panel-pad space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-sm">&ldquo;{stmt?.text}&rdquo;</p>
                        <span className="cp-status whitespace-nowrap">
                      {STATE_LABELS[c.state]}
                    </span>
                  </div>
                      <p className="text-sm leading-6 text-[var(--muted)]">{c.explanation}</p>
                  {c.documentEvidence.length > 0 && (
                    <div className="space-y-1">
                      {c.documentEvidence.map((e) => (
                        <div
                          key={e.id}
                              className="cp-source"
                        >
                              <div className="cp-source-label">
                            {e.sourceType === "official-source"
                              ? `${e.sourceName ?? "Official source"}${e.verifiedOn ? ` · verified ${e.verifiedOn}` : ""}`
                              : `Policy document${e.page ? ` · p.${e.page}` : ""}`}
                          </div>
                              <blockquote>
                            {e.quote ?? String(e.value)}
                          </blockquote>
                          {e.sourceUrl && (
                            <a
                              href={e.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                                  className="cp-quiet-link mt-2 inline-block"
                            >
                              View source
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                      <p className="text-sm font-medium">
                    Ask your adviser: {c.clarificationQuestion}
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
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/prepare"
                      className="primary-button"
                >
                  Prepare meeting pack →
                </Link>
                <Link
                  href="/decode"
                      className="secondary-button"
                >
                  Decode another document
                </Link>
              </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                Claro helps you prepare questions. It does not decide
                whether to buy, keep, cancel, or switch a product.
              </p>
            </div>
          </div>
        )}
          </section>
        </div>
      </div>
    </main>
  );
}

function CalcCard({ calc }: { calc: CalculationCard }) {
  return (
    <div className="cp-panel cp-panel-pad space-y-2">
      <h3 className="font-medium text-sm">{calc.title}</h3>
      <p className="text-xs font-mono text-[var(--muted)]">{calc.formula}</p>
      <p className="text-xl font-semibold">{calc.result}</p>
      <p className="text-xs text-[var(--muted)]">{calc.caveat}</p>
    </div>
  );
}
