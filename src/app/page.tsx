"use client";

import { useMemo, useState } from "react";
import { SEEDED_FACTS, SEEDED_STATEMENTS } from "@/data/seeded-policy";
import {
  DEMO_ASK,
  DEMO_COMPARISONS,
  DEMO_DISCUSSION_PROMPTS,
  DEMO_EVIDENCE_RECORD,
  DEMO_HISTORY,
  DEMO_PREP_QUESTIONS,
  DEMO_UNSAFE_PROMPTS,
  DEMO_USER_CONTEXT,
} from "@/data/demo-evidence";
import { checkCompliance } from "@/lib/compliance";
import { runCalculations } from "@/lib/calculations";
import type { CalculationCard, CompareResponse, SourceComparison } from "@/types";

const MODULES = [
  { name: "Ask", detail: "Public context" },
  { name: "Decode", detail: "Document facts" },
  { name: "Verify", detail: "Claim report" },
  { name: "Review", detail: "Context prompts" },
  { name: "Prepare", detail: "Meeting pack" },
  { name: "History", detail: "Case log" },
] as const;

type ModuleName = (typeof MODULES)[number]["name"];

const REVIEW_SOURCE_LABELS: Record<NonNullable<CompareResponse["source"]>, string> = {
  ai: "Live AI review",
  "demo-fallback": "Demo evidence fallback",
};

const STATE_TONE: Record<SourceComparison["state"], string> = {
  "matches-document": "Supported",
  "partially-matches": "Partial",
  "not-found": "Not found",
  "needs-source-reconciliation": "Reconcile",
  "calculation-differs": "Differs",
};

function missingEvidenceFor(comparison: SourceComparison) {
  if (comparison.state === "matches-document") {
    return "No missing document evidence for this statement in the demo record.";
  }
  if (comparison.state === "partially-matches") {
    return "Timing, conditions, and early-policy value should be clarified before relying on the statement.";
  }
  if (comparison.state === "not-found") {
    return "The current record does not contain a source that supports the statement as phrased.";
  }
  return "The claim needs separation between guaranteed figures, projected figures, and public-source context.";
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleName>("Verify");
  const [comparisons, setComparisons] =
    useState<SourceComparison[]>(DEMO_COMPARISONS);
  const [calculations, setCalculations] = useState<CalculationCard[]>(
    () => runCalculations(SEEDED_FACTS)
  );
  const [running, setRunning] = useState(false);
  const [reviewSource, setReviewSource] =
    useState<NonNullable<CompareResponse["source"]>>("demo-fallback");
  const [firewallInput, setFirewallInput] = useState(DEMO_UNSAFE_PROMPTS[0]);
  const [firewallResult, setFirewallResult] = useState(
    () => checkCompliance(DEMO_UNSAFE_PROMPTS[0])
  );

  const openQuestions = useMemo(
    () => [
      ...comparisons.map((item) => item.clarificationQuestion),
      ...DEMO_DISCUSSION_PROMPTS,
    ],
    [comparisons]
  );

  async function runEvidenceReview() {
    setRunning(true);
    setActiveModule("Verify");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch("/api/statements/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          facts: SEEDED_FACTS,
          statements: SEEDED_STATEMENTS,
        }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data: CompareResponse = await res.json();
      if (data.blocked || data.comparisons.length === 0) {
        throw new Error(data.blockReason ?? "No comparison output");
      }
      setComparisons(data.comparisons);
      setCalculations(data.calculations);
      setReviewSource(data.source ?? "demo-fallback");
    } catch {
      setReviewSource("demo-fallback");
      setComparisons(DEMO_COMPARISONS);
      setCalculations(runCalculations(SEEDED_FACTS));
    } finally {
      window.clearTimeout(timeoutId);
      setRunning(false);
    }
  }

  function testFirewall(prompt = firewallInput) {
    setFirewallInput(prompt);
    setFirewallResult(checkCompliance(prompt));
  }

  return (
    <main className="min-h-screen bg-[#fdfcfc] text-black">
      <Nav />

      <section className="mx-auto grid max-w-[1200px] gap-12 px-5 pb-16 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24 lg:pt-28">
        <div className="max-w-[680px]">
          <p className="text-sm leading-6 text-[#777169]">
            For Singaporeans before the next insurance meeting
          </p>
          <h1 className="font-display mt-5 text-[42px] font-light leading-[1.08] tracking-[-0.02em] text-black md:text-6xl">
            Check the insurance conversation against the evidence.
          </h1>
          <p className="mt-6 max-w-[600px] text-base leading-7 text-[#777169]">
            CoverPilot turns a policy illustration, adviser claims, and public
            guidance into one evidence record. It verifies facts and prepares
            questions without giving financial advice.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={runEvidenceReview}
              disabled={running}
              className="rounded-full border border-[#e5e5e5] bg-black px-6 py-3 text-sm font-medium text-[#fdfcfc] shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_4px] transition hover:opacity-85 active:translate-y-px disabled:opacity-50"
            >
              {running ? "Running evidence review" : "Run evidence review"}
            </button>
            <button
              onClick={() => setActiveModule("Prepare")}
              className="rounded-full border border-[#e5e5e5] bg-white px-5 py-3 text-sm font-medium text-black shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_4px] transition hover:bg-[#f5f3f1] active:translate-y-px"
            >
              View meeting pack
            </button>
          </div>
        </div>

        <EvidenceSummary
          reviewSource={reviewSource}
          comparisonCount={comparisons.length}
          calculationCount={calculations.length}
          questionCount={openQuestions.length}
        />
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-16 lg:px-8 lg:pb-24">
        <ProductDemoCard
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          comparisons={comparisons}
          calculations={calculations}
          reviewSource={reviewSource}
          firewallInput={firewallInput}
          firewallResult={firewallResult}
          setFirewallInput={setFirewallInput}
          testFirewall={testFirewall}
        />
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-10 px-5 pb-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:pb-28">
        <div>
          <p className="text-sm text-[#777169]">What the demo proves</p>
          <h2 className="font-display mt-3 max-w-[520px] text-4xl font-light leading-tight tracking-[-0.02em]">
            One record, several insurance jobs.
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <FeatureBlock
            dot="#ff4704"
            title="Not a chatbot wrapper"
            body="The same case record powers Ask, Decode, Verify, Review, Prepare, and History. The user moves through one workspace instead of separate tools."
          />
          <FeatureBlock
            dot="#0447ff"
            title="Built around compliance"
            body="The system refuses buy, cancel, switch, and suitability prompts, then redirects the user to facts and licensed-adviser questions."
          />
        </div>
      </section>
    </main>
  );
}

function Nav() {
  return (
    <header className="border-b border-[#e5e5e5] bg-[#fdfcfc]">
      <div className="mx-auto flex h-10 max-w-[1200px] items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[conic-gradient(from_180deg,#3d75d8,#75bee5,#20bad0,#2f40d2,#3d75d8)]" />
          <span className="font-display text-xl font-light tracking-[-0.02em]">
            CoverPilot
          </span>
        </div>
        <div className="hidden items-center gap-6 text-sm text-[#777169] sm:flex">
          <span>Evidence desk</span>
          <span>Singapore insurance</span>
          <span>No recommendations</span>
        </div>
      </div>
    </header>
  );
}

function EvidenceSummary({
  reviewSource,
  comparisonCount,
  calculationCount,
  questionCount,
}: {
  reviewSource: NonNullable<CompareResponse["source"]>;
  comparisonCount: number;
  calculationCount: number;
  questionCount: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[rgba(0,0,0,0.4)_0px_0px_1px_0px,rgba(0,0,0,0.04)_0px_2px_4px]">
      <div className="flex items-start justify-between gap-5 border-b border-[#e5e5e5] pb-5">
        <div>
          <p className="font-mono text-xs text-[#a59f97]">
            {DEMO_EVIDENCE_RECORD.id}
          </p>
          <h2 className="mt-2 text-lg font-medium leading-6">
            {DEMO_EVIDENCE_RECORD.title}
          </h2>
        </div>
        <span className="rounded-full border border-[#e5e5e5] bg-[#f5f3f1] px-3 py-1 text-xs text-[#777169]">
          {REVIEW_SOURCE_LABELS[reviewSource]}
        </span>
      </div>

      <div className="py-5">
        <p className="text-sm text-[#777169]">Claim under review</p>
        <p className="mt-2 text-xl leading-8">
          &ldquo;{DEMO_EVIDENCE_RECORD.adviserClaim}&rdquo;
        </p>
      </div>

      <dl className="grid grid-cols-3 border-y border-[#e5e5e5] py-4 text-center">
        <Metric label="Claims" value={comparisonCount} />
        <Metric label="Calcs" value={calculationCount} />
        <Metric label="Questions" value={questionCount} />
      </dl>

      <div className="mt-5 space-y-3">
        {DEMO_EVIDENCE_RECORD.artefacts.map((artefact, index) => (
          <div key={artefact.label} className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 rounded-full"
              style={{ backgroundColor: index === 1 ? "#0447ff" : "#ff4704" }}
            />
            <div>
              <p className="text-sm font-medium">{artefact.label}</p>
              <p className="mt-1 text-sm leading-5 text-[#777169]">
                {artefact.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductDemoCard({
  activeModule,
  setActiveModule,
  comparisons,
  calculations,
  reviewSource,
  firewallInput,
  firewallResult,
  setFirewallInput,
  testFirewall,
}: {
  activeModule: ModuleName;
  setActiveModule: (module: ModuleName) => void;
  comparisons: SourceComparison[];
  calculations: CalculationCard[];
  reviewSource: NonNullable<CompareResponse["source"]>;
  firewallInput: string;
  firewallResult: ReturnType<typeof checkCompliance>;
  setFirewallInput: (value: string) => void;
  testFirewall: (value?: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[rgba(0,0,0,0.4)_0px_0px_1px_0px,rgba(0,0,0,0.04)_0px_2px_4px] md:p-6">
      <div className="flex flex-col gap-4 border-b border-[#e5e5e5] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-[#777169]">Live product surface</p>
          <h2 className="font-display mt-1 text-3xl font-light tracking-[-0.02em]">
            Evidence desk workspace
          </h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MODULES.map((module) => (
            <button
              key={module.name}
              onClick={() => setActiveModule(module.name)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition active:translate-y-px ${
                activeModule === module.name
                  ? "border-black bg-black text-[#fdfcfc]"
                  : "border-[#e5e5e5] bg-white text-black hover:bg-[#f5f3f1]"
              }`}
            >
              {module.name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[500px] pt-8">
        {activeModule === "Ask" && <AskPanel />}
        {activeModule === "Decode" && <DecodePanel />}
        {activeModule === "Verify" && (
          <VerifyPanel comparisons={comparisons} reviewSource={reviewSource} />
        )}
        {activeModule === "Review" && <ReviewPanel />}
        {activeModule === "Prepare" && (
          <PreparePanel calculations={calculations} comparisons={comparisons} />
        )}
        {activeModule === "History" && (
          <HistoryPanel
            firewallInput={firewallInput}
            firewallResult={firewallResult}
            setFirewallInput={setFirewallInput}
            testFirewall={testFirewall}
          />
        )}
      </div>
    </div>
  );
}

function AskPanel() {
  return (
    <PanelFrame eyebrow="Ask" title="Start with a general insurance question.">
      <div className="max-w-2xl">
        <p className="text-xl leading-8">&ldquo;{DEMO_ASK.question}&rdquo;</p>
        <p className="mt-6 text-base leading-7 text-[#777169]">
          {DEMO_ASK.answer}
        </p>
        <p className="mt-8 border-t border-[#e5e5e5] pt-4 font-mono text-xs leading-5 text-[#a59f97]">
          {DEMO_ASK.source}
        </p>
      </div>
    </PanelFrame>
  );
}

function DecodePanel() {
  return (
    <PanelFrame eyebrow="Decode" title="Policy facts become reusable evidence.">
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {SEEDED_FACTS.slice(0, 8).map((fact) => (
          <div key={fact.id} className="border-t border-[#e5e5e5] pt-3">
            <p className="text-sm text-[#777169]">{fact.label}</p>
            <p className="mt-1 text-lg font-medium">
              {String(fact.value)}
              {fact.unit ? ` ${fact.unit}` : ""}
            </p>
            <p className="mt-2 font-mono text-xs text-[#a59f97]">
              {fact.sourceType}
              {fact.page ? ` · p.${fact.page}` : ""}
            </p>
          </div>
        ))}
      </div>
    </PanelFrame>
  );
}

function VerifyPanel({
  comparisons,
  reviewSource,
}: {
  comparisons: SourceComparison[];
  reviewSource: NonNullable<CompareResponse["source"]>;
}) {
  const [selectedId, setSelectedId] = useState(comparisons[0]?.statementId);
  const selected = comparisons.find((item) => item.statementId === selectedId) ?? comparisons[0];
  const statement = SEEDED_STATEMENTS.find((item) => item.id === selected?.statementId);

  if (!selected) return null;

  return (
    <PanelFrame eyebrow="Verify" title="One claim, checked against the record.">
      <div className="mb-6 flex flex-wrap gap-2">
        {comparisons.map((comparison, index) => (
          <button
            key={comparison.statementId}
            onClick={() => setSelectedId(comparison.statementId)}
            className={`rounded-full border px-3 py-2 text-sm transition ${
              selected.statementId === comparison.statementId
                ? "border-black bg-black text-[#fdfcfc]"
                : "border-[#e5e5e5] bg-white text-black hover:bg-[#f5f3f1]"
            }`}
          >
            Claim {index + 1}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-[#f5f3f1] p-5">
        <div className="flex flex-col gap-4 border-b border-[#e5e5e5] pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs text-[#a59f97]">
              {REVIEW_SOURCE_LABELS[reviewSource]} · {DEMO_EVIDENCE_RECORD.id}
            </p>
            <p className="mt-3 text-2xl leading-9">
              &ldquo;{statement?.text}&rdquo;
            </p>
          </div>
          <span className="w-fit rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-sm">
            {STATE_TONE[selected.state]}
          </span>
        </div>

        <div className="grid gap-6 pt-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm text-[#777169]">Finding</p>
            <p className="mt-2 text-base leading-7">{selected.explanation}</p>
            <p className="mt-6 text-sm text-[#777169]">
              Missing or unresolved evidence
            </p>
            <p className="mt-2 text-base leading-7">
              {missingEvidenceFor(selected)}
            </p>
          </div>
          <div>
            <p className="text-sm text-[#777169]">Evidence used</p>
            <div className="mt-3 space-y-3">
              {selected.documentEvidence.map((evidence) => (
                <blockquote
                  key={evidence.id}
                  className="border-l border-black bg-white px-4 py-3 text-sm leading-6 text-[#777169]"
                >
                  <span className="font-medium text-black">{evidence.label}: </span>
                  {evidence.quote}
                  {evidence.page ? ` (p.${evidence.page})` : ""}
                </blockquote>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-black p-5 text-[#fdfcfc]">
          <p className="text-sm text-[#b1b0b0]">Ask your licensed adviser</p>
          <p className="mt-2 text-base leading-7">
            {selected.clarificationQuestion}
          </p>
        </div>
      </div>
    </PanelFrame>
  );
}

function ReviewPanel() {
  return (
    <PanelFrame eyebrow="Review" title="Context changes the questions.">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-2 text-base leading-7">
          <p className="font-medium">{DEMO_USER_CONTEXT.name}</p>
          <p className="text-[#777169]">{DEMO_USER_CONTEXT.situation}</p>
          <p className="text-[#777169]">{DEMO_USER_CONTEXT.income}</p>
          <p className="text-[#777169]">{DEMO_USER_CONTEXT.dependents}</p>
          <p className="text-[#777169]">{DEMO_USER_CONTEXT.currentCover}</p>
        </div>
        <div className="space-y-4">
          {DEMO_DISCUSSION_PROMPTS.map((prompt) => (
            <p
              key={prompt}
              className="border-t border-[#e5e5e5] pt-4 text-base leading-7"
            >
              {prompt}
            </p>
          ))}
        </div>
      </div>
    </PanelFrame>
  );
}

function PreparePanel({
  calculations,
  comparisons,
}: {
  calculations: CalculationCard[];
  comparisons: SourceComparison[];
}) {
  return (
    <PanelFrame eyebrow="Prepare" title="A meeting pack, not advice.">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          {calculations.slice(0, 3).map((calc) => (
            <div key={calc.id} className="border-t border-[#e5e5e5] pt-4">
              <p className="text-sm text-[#777169]">{calc.title}</p>
              <p className="font-display mt-1 text-3xl font-light">
                {calc.result}
              </p>
              <p className="mt-2 font-mono text-xs text-[#a59f97]">
                {calc.formula}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[
            ...comparisons.map((item) => item.clarificationQuestion),
            ...DEMO_PREP_QUESTIONS.slice(-2),
          ]
            .slice(0, 6)
            .map((question, index) => (
              <div key={`${question}-${index}`} className="flex gap-4">
                <span className="font-mono text-sm text-[#a59f97]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-base leading-7">{question}</p>
              </div>
            ))}
        </div>
      </div>
    </PanelFrame>
  );
}

function HistoryPanel({
  firewallInput,
  firewallResult,
  setFirewallInput,
  testFirewall,
}: {
  firewallInput: string;
  firewallResult: ReturnType<typeof checkCompliance>;
  setFirewallInput: (value: string) => void;
  testFirewall: (value?: string) => void;
}) {
  return (
    <PanelFrame eyebrow="History" title="The case stays together.">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {DEMO_HISTORY.map((entry) => (
            <div key={entry.title} className="grid grid-cols-[56px_1fr] gap-4">
              <p className="font-mono text-xs text-[#a59f97]">{entry.time}</p>
              <div className="border-t border-[#e5e5e5] pt-3">
                <p className="font-medium">{entry.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#777169]">
                  {entry.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Firewall
          value={firewallInput}
          result={firewallResult}
          onChange={setFirewallInput}
          onTest={testFirewall}
        />
      </div>
    </PanelFrame>
  );
}

function PanelFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-sm text-[#777169]">{eyebrow}</p>
      <h3 className="font-display mt-2 text-4xl font-light leading-tight tracking-[-0.02em]">
        {title}
      </h3>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-xs text-[#a59f97]">{label}</dt>
      <dd className="font-display mt-1 text-2xl font-light">{value}</dd>
    </div>
  );
}

function Firewall({
  value,
  result,
  onChange,
  onTest,
}: {
  value: string;
  result: ReturnType<typeof checkCompliance>;
  onChange: (value: string) => void;
  onTest: (value?: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-[#f5f3f1] p-5">
      <p className="text-sm text-[#777169]">Decision firewall</p>
      <h4 className="mt-2 text-xl font-medium">
        Refuse advice. Redirect to evidence.
      </h4>
      <div className="mt-5">
        <label className="block text-sm text-[#777169]" htmlFor="firewall">
          Test a prompt
        </label>
        <div className="mt-2 flex gap-3">
          <input
            id="firewall"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-w-0 flex-1 border-b border-black bg-transparent px-0 py-3 text-sm outline-none"
          />
          <button
            onClick={() => onTest()}
            className="rounded-full border border-[#e5e5e5] bg-black px-4 py-2 text-sm text-[#fdfcfc] active:translate-y-px"
          >
            Test
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {DEMO_UNSAFE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onTest(prompt)}
            className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs text-[#777169]"
          >
            {prompt}
          </button>
        ))}
      </div>
      <div className="mt-5 border-t border-[#e5e5e5] pt-4">
        {result.blocked ? (
          <div>
            <p className="font-medium">Blocked regulated-advice request</p>
            <p className="mt-2 text-sm leading-6 text-[#777169]">
              {result.reason}
            </p>
            <p className="mt-3 text-sm leading-6">
              Safe replacement: verify the policy facts, prepare questions, and
              show what the evidence does or does not support.
            </p>
          </div>
        ) : (
          <p className="text-sm leading-6 text-[#777169]">
            This input can be handled as factual evidence, document comparison,
            or meeting-prep support.
          </p>
        )}
      </div>
    </div>
  );
}

function FeatureBlock({
  dot,
  title,
  body,
}: {
  dot: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <span
        className="block h-2 w-2 rounded-full"
        style={{ backgroundColor: dot }}
      />
      <h3 className="mt-4 text-base font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#777169]">{body}</p>
    </div>
  );
}
