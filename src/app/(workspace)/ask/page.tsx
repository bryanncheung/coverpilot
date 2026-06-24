"use client";

import Link from "next/link";
import { useState } from "react";
import type { FinancialQuestionResponse, PolicyFact } from "@/types";
import {
  createCaseEvent,
  loadPolicyWorkspace,
  updateCaseWorkspace,
  type PolicyWorkspaceSource,
} from "@/lib/workspace-session";

const EXAMPLE_QUESTIONS = [
  "What should I check before signing a whole life policy?",
  "What does distribution cost mean in a policy illustration?",
  "What is the difference between guaranteed and projected surrender value?",
  "What should I ask if my adviser says I can surrender anytime?",
];

const LOADING_STEPS = [
  "Finding the financial topic…",
  "Pulling policy and public-source context…",
  "Preparing adviser questions…",
];

export default function AskPage() {
  const [policyWorkspace] = useState(() => loadPolicyWorkspace());
  const [facts] = useState<PolicyFact[]>(() => policyWorkspace?.facts ?? []);
  const [policySource] = useState<PolicyWorkspaceSource>(
    () => policyWorkspace?.source ?? "sample"
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<FinancialQuestionResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useDocumentContext, setUseDocumentContext] = useState(false);

  async function askQuestion(nextQuestion = question) {
    if (!nextQuestion.trim()) {
      setError("Ask a financial question first.");
      return;
    }
    setError(null);
    setAnswer(null);
    setLoadingStep(LOADING_STEPS[0]);

    const stepTimer = window.setInterval(() => {
      setLoadingStep((prev) => {
        const idx = LOADING_STEPS.indexOf(prev ?? "");
        return LOADING_STEPS[Math.min(idx + 1, LOADING_STEPS.length - 1)];
      });
    }, 1200);

    try {
      const res = await fetch("/api/questions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          facts: useDocumentContext ? facts : [],
        }),
      });
      if (!res.ok) throw new Error("Could not answer that question yet.");
      const data: FinancialQuestionResponse = await res.json();
      if (!data.blocked) {
        updateCaseWorkspace((current) => ({
          ...current,
          facts: useDocumentContext ? facts : current.facts,
          factsSource: useDocumentContext ? policySource : current.factsSource,
          events: [
            ...current.events,
            createCaseEvent(
              "Financial question answered",
              data.topic
                ? `Question routed to ${data.topic}.`
                : "A financial question was answered."
            ),
          ],
        }));
      }
      setAnswer(data);
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
            <Link href="/decode">Decode</Link>
            <Link href="/my-case">My Case</Link>
          </nav>
        </header>

        <div className="cp-workspace">
          <section className="cp-route-header">
            <div>
              <p className="cg-kicker">Ask</p>
              <h1 className="cp-route-title">Ask a financial question.</h1>
            </div>
            <p className="cp-route-copy">
            Ask about Singapore insurance or financial-advisory concepts.
            Claro answers in plain English with public guidance and
            questions you can bring to a licensed adviser.
          </p>
            <div className="cp-empty">
              {facts.length > 0
                ? `${facts.length} document facts are available if you choose to use them.`
                : "No document loaded. General answers will use public guidance only."}
            </div>
          </section>

          <section className="cp-stack">
            <div className="cp-panel cp-panel-pad cp-stack">
              <label htmlFor="financial-question" className="cp-label">
            What do you want to understand?
          </label>
          <textarea
            id="financial-question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setAnswer(null);
            }}
            placeholder="Example: What should I check before signing a whole life policy?"
            rows={5}
                className="cp-input"
          />

              {facts.length > 0 && (
                <label className="flex items-start gap-3 text-sm leading-6 text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={useDocumentContext}
                    onChange={(event) => setUseDocumentContext(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Use my loaded document as context for this question.
                  </span>
                </label>
              )}

              <div className="cp-chip-row">
            {EXAMPLE_QUESTIONS.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setQuestion(example);
                  void askQuestion(example);
                }}
                    className="cp-chip"
              >
                {example}
              </button>
            ))}
          </div>

          <button
            onClick={() => void askQuestion()}
            disabled={!!loadingStep}
                className="primary-button w-fit disabled:opacity-50"
          >
            {loadingStep ?? "Answer question"}
          </button>
        </div>

        {loadingStep && (
              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border border-[var(--line)] border-t-[var(--foreground)]" />
            {loadingStep}
          </div>
        )}

        {error && (
              <div className="cp-error">
                <p>{error}</p>
          </div>
        )}

        {answer?.blocked && (
              <div className="cp-alert space-y-2">
                <p className="font-semibold">Claro cannot answer that directly</p>
                <p>{answer.blockReason}</p>
          </div>
        )}

        {answer && !answer.blocked && (
          <div className="space-y-5">
            <div className="cp-panel cp-panel-pad">
              <p className="cp-source-label">Answer</p>
              <h2 className="mt-2 text-lg font-semibold">{answer.topic}</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                {answer.answer?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>

            {!!answer.officialSourceFacts?.length && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Public sources used</h2>
                {answer.officialSourceFacts.map((fact) => (
                  <SourceFact key={fact.id} fact={fact} />
                ))}
              </div>
            )}

            {!!answer.documentSourceFacts?.length && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Your document context</h2>
                {answer.documentSourceFacts.map((fact) => (
                  <SourceFact key={fact.id} fact={fact} />
                ))}
              </div>
            )}

            {!!answer.questionsForLicensedAdviser?.length && (
                  <div className="cp-panel cp-panel-pad">
                    <h2 className="text-lg font-semibold">
                  Ask a licensed adviser
                </h2>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
                  {answer.questionsForLicensedAdviser.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!answer.relatedActions?.length && (
              <div className="flex flex-wrap gap-3">
                {answer.relatedActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                        className="secondary-button"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            )}

                <p className="text-xs leading-5 text-[var(--muted)]">
              {answer.complianceNotice}
            </p>
          </div>
        )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SourceFact({ fact }: { fact: PolicyFact }) {
  return (
    <div className="cp-source">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-medium">{fact.label}</p>
        <span className="cp-status">
          {fact.sourceType === "official-source"
            ? fact.sourceName
            : "Policy"}
        </span>
      </div>
      <blockquote>
        {fact.quote ?? String(fact.value)}
        {fact.page ? ` (p.${fact.page})` : ""}
      </blockquote>
      {fact.sourceUrl && (
        <a
          href={fact.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="cp-quiet-link mt-2 inline-block"
        >
          View source
        </a>
      )}
    </div>
  );
}
