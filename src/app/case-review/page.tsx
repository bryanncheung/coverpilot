"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OFFICIAL_SOURCES, type OfficialSource } from "@/data/official-sources(actual)";
import { SEEDED_STATEMENTS } from "@/data/seeded-policy";
import { checkCompliance } from "@/lib/compliance";
import {
  createCaseEvent,
  createEmptyCaseWorkspace,
  loadCaseWorkspace,
  saveCaseWorkspace,
  saveCheckWorkspace,
  savePolicyWorkspace,
  type CaseWorkspace,
  type PolicyWorkspaceSource,
} from "@/lib/workspace-session";
import type {
  CalculationCard,
  CompareResponse,
  ExtractResponse,
  MeetingPrepReport,
  PolicyFact,
  ReportResponse,
  SourceComparison,
  UserStatement,
} from "@/types";

const SOURCE_LABELS: Record<string, string> = {
  "document-stated": "Document-stated",
  "calculated-from-document": "Calculated",
  "official-source": "Official-source",
  "not-found": "Not found",
  "user-provided": "User-provided",
};

const STATE_LABELS: Record<SourceComparison["state"], string> = {
  "matches-document": "Supported by document",
  "partially-matches": "Partially supported",
  "not-found": "Not found in document",
  "needs-source-reconciliation": "Needs reconciliation",
  "calculation-differs": "Calculation differs",
};

const STEP_TITLES = [
  "Intake",
  "Policy facts",
  "Claim review",
  "Meeting pack",
] as const;

const ASK_TOPICS: Array<{
  label: string;
  question: string;
  topic: OfficialSource["topic"];
}> = [
  {
    label: "Distribution cost",
    question: "What does distribution cost mean in a policy illustration?",
    topic: "distribution-cost",
  },
  {
    label: "Guaranteed values",
    question: "What is the difference between guaranteed and non-guaranteed values?",
    topic: "guaranteed-vs-non-guaranteed",
  },
  {
    label: "Illustrated rates",
    question: "Are illustrated rates promises?",
    topic: "illustrated-rate",
  },
  {
    label: "Early surrender",
    question: "What should I check if I may surrender early?",
    topic: "early-surrender",
  },
];

const MANUAL_FACT_TEMPLATES: Array<{
  id: string;
  label: string;
  value: string;
  unit?: string;
}> = [
  { id: "product-name", label: "Product / Plan Name", value: "" },
  { id: "policy-type", label: "Policy Type", value: "" },
  { id: "annual-premium", label: "Annual Premium", value: "", unit: "SGD/year" },
  { id: "premium-term", label: "Premium Payment Term", value: "", unit: "years" },
  { id: "policy-term", label: "Policy Term", value: "", unit: "years" },
  { id: "sum-assured", label: "Sum Assured / Coverage Amount", value: "", unit: "SGD" },
  { id: "distribution-cost", label: "Total Distribution Cost", value: "", unit: "SGD" },
  { id: "surrender-value-yr5", label: "Guaranteed Surrender Value — Year 5", value: "", unit: "SGD" },
  { id: "surrender-value-yr10", label: "Guaranteed Surrender Value — Year 10", value: "", unit: "SGD" },
  { id: "surrender-value-yr20", label: "Guaranteed Surrender Value — Year 20", value: "", unit: "SGD" },
  { id: "projected-surrender-yr20", label: "Projected Non-Guaranteed Value — Year 20", value: "", unit: "SGD" },
  { id: "non-guaranteed-notice", label: "Guaranteed vs Non-Guaranteed Note", value: "" },
];

function sourceLabel(value: string) {
  return SOURCE_LABELS[value] ?? value;
}

function newStatement(text: string): UserStatement {
  return {
    id: `claim-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    category: classifyStatement(text),
  };
}

function classifyStatement(text: string): UserStatement["category"] {
  const lower = text.toLowerCase();
  if (/cost|cheap|low|expensive|commission|distribution|fee|charge/.test(lower)) {
    return "cost";
  }
  if (/access|withdraw|liquid|cash out|surrender|anytime/.test(lower)) {
    return "liquidity";
  }
  if (/return|project|interest|investment|savings|grow|yield/.test(lower)) {
    return "returns";
  }
  if (/coverage|cover|protection|sum assured|enough|death|ci|critical/.test(lower)) {
    return "coverage";
  }
  if (/guarantee|guaranteed|sure|promise/.test(lower)) {
    return "guarantee";
  }
  if (/exclude|exclusion|waiting|claim|condition/.test(lower)) {
    return "exclusion";
  }
  return "other";
}

function createManualFact(template?: (typeof MANUAL_FACT_TEMPLATES)[number]): PolicyFact {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id: template?.id ? `${template.id}-${suffix}` : `manual-fact-${suffix}`,
    label: template?.label ?? "Manual policy fact",
    value: template?.value ?? "",
    unit: template?.unit,
    sourceType: "document-stated",
    quote: "Manually entered from policy illustration.",
  };
}

function formatMeetingPack(workspace: CaseWorkspace): string {
  const report = workspace.report;
  if (!report) return "";
  const statements = new Map(
    workspace.statements.map((statement) => [statement.id, statement.text])
  );
  const lines = [
    `CoverPilot Meeting-Prep Pack`,
    `Case: ${workspace.id}`,
    ``,
    `Context`,
    `- Situation: ${workspace.context.situation}`,
    `- Age: ${workspace.context.age}`,
    `- Income: ${workspace.context.income}`,
    `- Dependents: ${workspace.context.dependents}`,
    `- Current cover: ${workspace.context.currentCover}`,
    ``,
    `Policy Facts`,
    ...report.policySummary.slice(0, 12).map((fact) => {
      const unit = fact.unit ? ` ${fact.unit}` : "";
      return `- [${sourceLabel(fact.sourceType)}] ${fact.label}: ${String(fact.value)}${unit}`;
    }),
    ``,
    `Claims Checked`,
    ...report.comparisons.map((comparison) => {
      const statement = statements.get(comparison.statementId) ?? "Claim";
      return `- "${statement}" -> ${STATE_LABELS[comparison.state]}. Ask: ${comparison.clarificationQuestion}`;
    }),
    ``,
    `Calculations`,
    ...report.calculations.map(
      (calculation) => `- ${calculation.title}: ${calculation.result}`
    ),
    ``,
    `Questions For Licensed Adviser`,
    ...report.questionsForLicensedAdviser.map(
      (question, index) => `${index + 1}. ${question}`
    ),
    ``,
    `Compliance Notice`,
    report.complianceNotice,
  ];
  return lines.join("\n");
}

export default function CaseReviewPage() {
  const [workspace, setWorkspace] = useState<CaseWorkspace | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [claimInput, setClaimInput] = useState("");
  const [firewallInput, setFirewallInput] = useState("Should I buy this policy?");
  const [firewallResult, setFirewallResult] = useState(() =>
    checkCompliance("Should I buy this policy?")
  );
  const [copiedReport, setCopiedReport] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setWorkspace(loadCaseWorkspace() ?? createEmptyCaseWorkspace());
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function persist(next: CaseWorkspace) {
    saveCaseWorkspace(next);
    setWorkspace(next);
  }

  function updateWorkspace(updater: (current: CaseWorkspace) => CaseWorkspace) {
    if (!workspace) return;
    persist(updater(workspace));
  }

  function updateContext(key: keyof CaseWorkspace["context"], value: string) {
    updateWorkspace((current) => ({
      ...current,
      context: { ...current.context, [key]: value },
    }));
  }

  async function loadPolicy(mode: "seeded" | "upload", file?: File) {
    setError(null);
    setLoading(mode === "seeded" ? "Loading sample policy" : "Reading PDF");
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

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not read the policy document.");
      }
      const data = (await res.json()) as ExtractResponse & { fallback?: boolean };
      const source: PolicyWorkspaceSource = data.fallback
        ? "sample-fallback"
        : mode === "seeded"
          ? "sample"
          : "uploaded";

      savePolicyWorkspace(data.facts, source);
      updateWorkspace((current) => ({
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
            `${data.facts.length} policy facts were added to the evidence record.`
          ),
        ],
      }));
      setActiveStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    void loadPolicy("upload", file);
  }

  function updateFact(id: string, key: "label" | "value" | "quote", value: string) {
    updateWorkspace((current) => ({
      ...current,
      facts: current.facts.map((fact) =>
        fact.id === id ? { ...fact, [key]: value } : fact
      ),
      comparisons: [],
      calculations: [],
      report: null,
    }));
  }

  function addManualFact(template?: (typeof MANUAL_FACT_TEMPLATES)[number]) {
    const fact = createManualFact(template);
    updateWorkspace((current) => ({
      ...current,
      facts: [...current.facts, fact],
      factsSource: current.factsSource,
      comparisons: [],
      calculations: [],
      report: null,
      events: [
        ...current.events,
        createCaseEvent("Manual policy fact added", fact.label),
      ],
    }));
  }

  function startManualFactSheet() {
    updateWorkspace((current) => ({
      ...current,
      facts: MANUAL_FACT_TEMPLATES.map(createManualFact),
      factsSource: "uploaded",
      comparisons: [],
      calculations: [],
      report: null,
      events: [
        ...current.events,
        createCaseEvent(
          "Manual fact sheet started",
          "Core policy fields were added for manual entry from a policy illustration."
        ),
      ],
    }));
    setActiveStep(1);
  }

  function removeFact(id: string) {
    updateWorkspace((current) => ({
      ...current,
      facts: current.facts.filter((fact) => fact.id !== id),
      comparisons: [],
      calculations: [],
      report: null,
    }));
  }

  function addSeedClaims() {
    updateWorkspace((current) => ({
      ...current,
      statements: SEEDED_STATEMENTS,
      comparisons: [],
      report: null,
      events: [
        ...current.events,
        createCaseEvent(
          "Adviser claims added",
          `${SEEDED_STATEMENTS.length} sample adviser claims were prepared for checking.`
        ),
      ],
    }));
    setActiveStep(2);
  }

  function addClaim() {
    if (!claimInput.trim()) return;
    const statement = newStatement(claimInput.trim());
    updateWorkspace((current) => ({
      ...current,
      statements: [...current.statements, statement],
      comparisons: [],
      report: null,
      events: [
        ...current.events,
        createCaseEvent("Adviser claim captured", statement.text),
      ],
    }));
    setClaimInput("");
  }

  function removeClaim(id: string) {
    updateWorkspace((current) => ({
      ...current,
      statements: current.statements.filter((statement) => statement.id !== id),
      comparisons: current.comparisons.filter(
        (comparison) => comparison.statementId !== id
      ),
      report: null,
    }));
  }

  async function runEvidenceReview() {
    if (!workspace) return;
    if (workspace.facts.length === 0) {
      setError("Load a policy first so CoverPilot has evidence to check.");
      return;
    }
    if (workspace.statements.length === 0) {
      setError("Add at least one adviser claim to check.");
      return;
    }

    setError(null);
    setLoading("Checking claims against policy facts");
    try {
      const res = await fetch("/api/statements/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facts: workspace.facts,
          statements: workspace.statements,
        }),
      });
      if (!res.ok) throw new Error("Evidence review failed.");
      const data = (await res.json()) as CompareResponse;
      if (data.blocked) throw new Error(data.blockReason);

      saveCheckWorkspace(
        workspace.statements,
        data.comparisons,
        data.calculations
      );
      updateWorkspace((current) => ({
        ...current,
        comparisons: data.comparisons,
        calculations: data.calculations,
        report: null,
        events: [
          ...current.events,
          createCaseEvent(
            "Evidence review generated",
            `${data.comparisons.length} claims checked and ${data.calculations.length} calculations produced.`
          ),
        ],
      }));
      setActiveStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  async function generateMeetingPack() {
    if (!workspace) return;
    if (workspace.comparisons.length === 0) {
      await runEvidenceReview();
    }

    const latest = loadCaseWorkspace() ?? workspace;
    if (latest.comparisons.length === 0 || latest.calculations.length === 0) {
      return;
    }

    setError(null);
    setLoading("Generating meeting-prep pack");
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facts: latest.facts,
          comparisons: latest.comparisons,
          calculations: latest.calculations,
        }),
      });
      if (!res.ok) throw new Error("Meeting pack generation failed.");
      const data = (await res.json()) as ReportResponse;
      updateWorkspace((current) => ({
        ...current,
        report: data.report,
        events: [
          ...current.events,
          createCaseEvent(
            "Meeting pack prepared",
            `${data.report.questionsForLicensedAdviser.length} adviser questions were assembled.`
          ),
        ],
      }));
      setActiveStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  function testFirewall() {
    setFirewallResult(checkCompliance(firewallInput));
  }

  async function copyMeetingPack() {
    if (!workspace?.report) return;
    const text = formatMeetingPack(workspace);
    await navigator.clipboard.writeText(text);
    setCopiedReport(true);
    window.setTimeout(() => setCopiedReport(false), 1800);
  }

  if (!workspace) {
    return (
      <main className="min-h-screen bg-[#fdfcfc] text-black">
        <div className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8">
          <p className="text-sm text-[#777169]">Loading case workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdfcfc] text-black">
      <header className="border-b border-[#e5e5e5]">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="font-display text-xl font-light">
            CoverPilot
          </Link>
          <div className="flex items-center gap-4 text-sm text-[#777169]">
            <Link href="/my-case" className="hover:text-black">
              My Case
            </Link>
            <span className="hidden sm:inline">No recommendations</span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1240px] gap-8 px-5 py-10 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="space-y-5">
          <div>
            <p className="text-sm text-[#777169]">Case ID</p>
            <h1 className="font-display mt-1 text-3xl font-light">
              {workspace.id}
            </h1>
          </div>
          <nav className="space-y-2">
            {STEP_TITLES.map((title, index) => (
              <button
                key={title}
                onClick={() => setActiveStep(index)}
                className={`flex w-full items-center justify-between border px-4 py-3 text-left text-sm transition ${
                  activeStep === index
                    ? "border-black bg-black text-[#fdfcfc]"
                    : "border-[#e5e5e5] bg-white text-black hover:bg-[#f5f3f1]"
                }`}
              >
                <span>{title}</span>
                <span className="font-mono text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            ))}
          </nav>
          <div className="border border-[#e5e5e5] bg-white p-4 text-sm leading-6 text-[#777169]">
            This workspace produces facts, calculations, and questions. It does
            not tell you what to buy, keep, cancel, or switch.
          </div>
        </aside>

        <div className="space-y-8">
          <section className="border-b border-[#e5e5e5] pb-8">
            <p className="text-sm text-[#777169]">
              Singapore insurance evidence workflow
            </p>
            <h2 className="font-display mt-3 max-w-[760px] text-5xl font-light leading-tight">
              Build one sourced case before the next FA conversation.
            </h2>
            <p className="mt-4 max-w-[680px] text-base leading-7 text-[#777169]">
              Load a policy, capture what was said, run the evidence engine, and
              leave with questions for a licensed adviser.
            </p>
          </section>

          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#777169]">
              {loading}...
            </div>
          )}

          {activeStep === 0 && (
            <IntakeStep
              workspace={workspace}
              updateContext={updateContext}
              loadSample={() => void loadPolicy("seeded")}
              triggerUpload={() => fileRef.current?.click()}
              startManualFactSheet={startManualFactSheet}
            />
          )}

          {activeStep === 1 && (
            <FactsStep
              workspace={workspace}
              updateFact={updateFact}
              addManualFact={addManualFact}
              removeFact={removeFact}
              startManualFactSheet={startManualFactSheet}
              loadSample={() => void loadPolicy("seeded")}
              triggerUpload={() => fileRef.current?.click()}
              next={() => setActiveStep(2)}
            />
          )}

          {activeStep === 2 && (
            <ClaimStep
              workspace={workspace}
              claimInput={claimInput}
              setClaimInput={setClaimInput}
              addClaim={addClaim}
              addSeedClaims={addSeedClaims}
              removeClaim={removeClaim}
              runEvidenceReview={() => void runEvidenceReview()}
              generateMeetingPack={() => void generateMeetingPack()}
            />
          )}

          {activeStep === 3 && (
            <MeetingPackStep
              workspace={workspace}
              generateMeetingPack={() => void generateMeetingPack()}
              firewallInput={firewallInput}
              firewallResult={firewallResult}
              setFirewallInput={setFirewallInput}
              testFirewall={testFirewall}
              copiedReport={copiedReport}
              copyMeetingPack={() => void copyMeetingPack()}
            />
          )}
        </div>
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileUpload}
      />
    </main>
  );
}

function IntakeStep({
  workspace,
  updateContext,
  loadSample,
  triggerUpload,
  startManualFactSheet,
}: {
  workspace: CaseWorkspace;
  updateContext: (key: keyof CaseWorkspace["context"], value: string) => void;
  loadSample: () => void;
  triggerUpload: () => void;
  startManualFactSheet: () => void;
}) {
  const [selectedTopic, setSelectedTopic] =
    useState<OfficialSource["topic"]>("distribution-cost");
  const selectedSources = OFFICIAL_SOURCES.filter(
    (source) => source.topic === selectedTopic
  );

  return (
    <section className="space-y-8">
      <div className="border border-[#e5e5e5] bg-white p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            eyebrow="Ask"
            title="Start from official-source context."
            body="This is the InsureLobang FAQ pattern, grounded in MoneySense and LIA-style source snippets before the user moves into their own document."
          />
          <SourceBadge label="Official-source" />
        </div>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {ASK_TOPICS.map((topic) => (
            <button
              key={topic.topic}
              onClick={() => setSelectedTopic(topic.topic)}
              className={`shrink-0 border px-3 py-2 text-sm transition ${
                selectedTopic === topic.topic
                  ? "border-black bg-black text-[#fdfcfc]"
                  : "border-[#e5e5e5] bg-white text-black hover:bg-[#f5f3f1]"
              }`}
            >
              {topic.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-sm text-[#777169]">User question</p>
            <p className="mt-2 text-xl leading-8">
              {ASK_TOPICS.find((topic) => topic.topic === selectedTopic)?.question}
            </p>
          </div>
          <div className="space-y-3">
            {selectedSources.length > 0 ? (
              selectedSources.map((source) => (
                <blockquote
                  key={source.id}
                  className="border-l border-black bg-[#f5f3f1] px-4 py-3 text-sm leading-6 text-[#777169]"
                >
                  <span className="font-medium text-black">{source.body}: </span>
                  {source.quote}
                  <span className="mt-2 block font-mono text-xs text-[#a59f97]">
                    Verified {source.verifiedOn}
                  </span>
                </blockquote>
              ))
            ) : (
              <blockquote className="border-l border-black bg-[#f5f3f1] px-4 py-3 text-sm leading-6 text-[#777169]">
                MoneySense and LIA-style policy illustrations commonly warn
                users to check surrender values, distribution cost, guaranteed
                values, and policy conditions before relying on early-exit or
                flexibility claims.
                <span className="mt-2 block font-mono text-xs text-[#a59f97]">
                  Official-source discussion prompt
                </span>
              </blockquote>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-5">
        <SectionHeader
          eyebrow="Intake"
          title="Start with the actual situation."
          body="Context changes the questions CoverPilot prepares, not the recommendation. This keeps the workflow useful without crossing into financial advice."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Situation"
            value={workspace.context.situation}
            onChange={(value) => updateContext("situation", value)}
          />
          <TextField
            label="Age"
            value={workspace.context.age}
            onChange={(value) => updateContext("age", value)}
          />
          <TextField
            label="Income"
            value={workspace.context.income}
            onChange={(value) => updateContext("income", value)}
          />
          <TextField
            label="Dependents"
            value={workspace.context.dependents}
            onChange={(value) => updateContext("dependents", value)}
          />
        </div>
        <TextField
          label="Current cover"
          value={workspace.context.currentCover}
          onChange={(value) => updateContext("currentCover", value)}
        />
        <TextArea
          label="Main concern"
          value={workspace.context.concern}
          onChange={(value) => updateContext("concern", value)}
        />
      </div>

      <div className="space-y-4">
        <ActionPanel
          title="Load policy evidence"
          body="Use the hackathon sample for a reliable demo, or upload a PDF when the API key is configured. Uploaded PDFs are processed for extraction and are not saved into the workspace; only extracted facts are kept in this browser session."
        >
          <div className="flex flex-wrap gap-3">
            <button onClick={loadSample} className="primary-button">
              Use sample policy
            </button>
            <button onClick={triggerUpload} className="secondary-button">
              Upload PDF
            </button>
            <button onClick={startManualFactSheet} className="secondary-button">
              Enter facts manually
            </button>
          </div>
        </ActionPanel>
        <ActionPanel
          title="Why this is the wedge"
          body="This copies the strongest AI startup pattern: automate one high-value first-pass workflow end to end, then expand into the operating layer."
        />
      </div>
      </div>
    </section>
  );
}

function FactsStep({
  workspace,
  updateFact,
  addManualFact,
  removeFact,
  startManualFactSheet,
  loadSample,
  triggerUpload,
  next,
}: {
  workspace: CaseWorkspace;
  updateFact: (id: string, key: "label" | "value" | "quote", value: string) => void;
  addManualFact: (template?: (typeof MANUAL_FACT_TEMPLATES)[number]) => void;
  removeFact: (id: string) => void;
  startManualFactSheet: () => void;
  loadSample: () => void;
  triggerUpload: () => void;
  next: () => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Policy facts"
          title="Review the extraction before trusting the workflow."
          body="If PDF extraction misses something, correct it manually. CoverPilot should not guess."
        />
        <div className="flex flex-wrap gap-3">
          <button onClick={loadSample} className="secondary-button">
            Reload sample
          </button>
          <button onClick={triggerUpload} className="secondary-button">
            Upload another PDF
          </button>
          <button onClick={() => addManualFact()} className="secondary-button">
            Add fact
          </button>
        </div>
      </div>

      {workspace.facts.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="No policy facts loaded"
            body="Load the sample policy, upload a PDF, or start with manual fields from a policy illustration."
          />
          <button onClick={startManualFactSheet} className="primary-button">
            Start manual fact sheet
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border border-[#e5e5e5] bg-white p-4">
            <p className="text-sm font-medium">Quick add common PI fields</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {MANUAL_FACT_TEMPLATES.slice(0, 7).map((template) => (
                <button
                  key={template.id}
                  onClick={() => addManualFact(template)}
                  className="shrink-0 border border-[#e5e5e5] bg-white px-3 py-2 text-xs text-[#777169] transition hover:bg-[#f5f3f1] hover:text-black"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          {workspace.facts.map((fact) => (
            <div key={fact.id} className="border border-[#e5e5e5] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <input
                  value={fact.label}
                  onChange={(event) =>
                    updateFact(fact.id, "label", event.target.value)
                  }
                  className="w-full bg-transparent text-sm font-medium outline-none"
                />
                <div className="flex shrink-0 items-center gap-2">
                  <SourceBadge label={sourceLabel(fact.sourceType)} />
                  <button
                    onClick={() => removeFact(fact.id)}
                    className="text-xs text-[#777169] hover:text-black"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <input
                value={String(fact.value)}
                onChange={(event) =>
                  updateFact(fact.id, "value", event.target.value)
                }
                className="mt-3 w-full bg-transparent text-2xl font-light outline-none"
              />
              <textarea
                value={fact.quote ?? ""}
                onChange={(event) =>
                  updateFact(fact.id, "quote", event.target.value)
                }
                className="mt-3 min-h-20 w-full resize-none border-t border-[#e5e5e5] bg-transparent pt-3 text-xs leading-5 text-[#777169] outline-none"
                placeholder="Supporting quote or manual note"
              />
            </div>
          ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={next} className="primary-button">
          Continue to claim review
        </button>
      </div>
    </section>
  );
}

function ClaimStep({
  workspace,
  claimInput,
  setClaimInput,
  addClaim,
  addSeedClaims,
  removeClaim,
  runEvidenceReview,
  generateMeetingPack,
}: {
  workspace: CaseWorkspace;
  claimInput: string;
  setClaimInput: (value: string) => void;
  addClaim: () => void;
  addSeedClaims: () => void;
  removeClaim: (id: string) => void;
  runEvidenceReview: () => void;
  generateMeetingPack: () => void;
}) {
  return (
    <section className="space-y-8">
      <SectionHeader
        eyebrow="Claim review"
        title="Check what was said against what is sourced."
        body="This is the InsureLobang Check Advice pattern, but connected to the policy breakdown and meeting pack."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <input
          value={claimInput}
          onChange={(event) => setClaimInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addClaim()}
          placeholder="Paste an adviser claim, e.g. You can access your money anytime"
          className="border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none focus:border-black"
        />
        <div className="flex gap-3">
          <button onClick={addClaim} className="secondary-button">
            Add claim
          </button>
          <button onClick={addSeedClaims} className="secondary-button">
            Use demo claims
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <h3 className="text-sm font-medium">User-provided claims</h3>
          {workspace.statements.length === 0 ? (
            <EmptyState
              title="No claims yet"
              body="Add claims from WhatsApp, email, meeting notes, or the demo sample."
            />
          ) : (
            workspace.statements.map((statement, index) => (
              <div
                key={statement.id}
                className="flex gap-3 border border-[#e5e5e5] bg-white p-4"
              >
                <span className="font-mono text-xs text-[#a59f97]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="flex-1 text-sm leading-6">{statement.text}</p>
                <button
                  onClick={() => removeClaim(statement.id)}
                  className="text-xs text-[#777169] hover:text-black"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium">Evidence comparisons</h3>
            <button onClick={runEvidenceReview} className="primary-button">
              Run evidence review
            </button>
          </div>
          {workspace.comparisons.length === 0 ? (
            <EmptyState
              title="No review generated"
              body="Run the evidence review to compare claims against extracted policy facts."
            />
          ) : (
            <div className="space-y-4">
              {workspace.comparisons.map((comparison) => {
                const statement = workspace.statements.find(
                  (item) => item.id === comparison.statementId
                );
                return (
                  <ComparisonCard
                    key={comparison.statementId}
                    comparison={comparison}
                    statement={statement?.text ?? "Claim"}
                  />
                );
              })}
              <button onClick={generateMeetingPack} className="primary-button">
                Generate meeting pack
              </button>
            </div>
          )}
        </div>
      </div>

      {workspace.calculations.length > 0 && (
        <CalculationGrid calculations={workspace.calculations} />
      )}
    </section>
  );
}

function MeetingPackStep({
  workspace,
  generateMeetingPack,
  firewallInput,
  firewallResult,
  setFirewallInput,
  testFirewall,
  copiedReport,
  copyMeetingPack,
}: {
  workspace: CaseWorkspace;
  generateMeetingPack: () => void;
  firewallInput: string;
  firewallResult: ReturnType<typeof checkCompliance>;
  setFirewallInput: (value: string) => void;
  testFirewall: () => void;
  copiedReport: boolean;
  copyMeetingPack: () => void;
}) {
  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Meeting pack"
          title="Leave with questions, not advice."
          body="The output is meant to help a licensed adviser conversation start from the source record."
        />
        <div className="flex flex-wrap gap-3">
          <button onClick={generateMeetingPack} className="primary-button">
            Generate meeting pack
          </button>
          {workspace.report && (
            <>
              <button onClick={copyMeetingPack} className="secondary-button">
                {copiedReport ? "Copied" : "Copy pack"}
              </button>
              <button onClick={() => window.print()} className="secondary-button">
                Print
              </button>
            </>
          )}
        </div>
      </div>

      {workspace.report ? (
        <MeetingReport workspace={workspace} report={workspace.report} />
      ) : (
        <EmptyState
          title="No meeting pack yet"
          body="Generate the pack after the evidence review has run."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ActionPanel
          title="Compliance firewall"
          body="This visible refusal turns the legal boundary into a product feature."
        >
          <div className="space-y-3">
            <input
              value={firewallInput}
              onChange={(event) => setFirewallInput(event.target.value)}
              className="w-full border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none focus:border-black"
            />
            <button onClick={testFirewall} className="secondary-button">
              Test firewall
            </button>
          </div>
        </ActionPanel>
        <div className="border border-[#e5e5e5] bg-white p-5">
          <SourceBadge label={firewallResult.blocked ? "Blocked" : "Allowed"} />
          <p className="mt-4 text-base leading-7">
            {firewallResult.blocked
              ? firewallResult.reason
              : "This prompt can proceed as factual information or preparation."}
          </p>
          {firewallResult.blocked && (
            <p className="mt-3 text-sm leading-6 text-[#777169]">
              {firewallResult.redirect}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/my-case" className="primary-button">
          Open My Case
        </Link>
      </div>
    </section>
  );
}

function MeetingReport({
  workspace,
  report,
}: {
  workspace: CaseWorkspace;
  report: MeetingPrepReport;
}) {
  return (
    <div id="meeting-pack" className="space-y-6">
      <div className="border border-[#e5e5e5] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs text-[#a59f97]">{workspace.id}</p>
            <h3 className="font-display mt-2 text-3xl font-light">
              Insurance meeting-prep pack
            </h3>
            <p className="mt-3 max-w-[680px] text-sm leading-6 text-[#777169]">
              This pack summarizes source evidence and questions for a licensed
              adviser. It does not recommend what to buy, keep, cancel, switch,
              or rank.
            </p>
          </div>
          <SourceBadge label="Facts and questions only" />
        </div>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <SummaryMetric label="Policy facts" value={report.policySummary.length} />
          <SummaryMetric label="Claims checked" value={report.comparisons.length} />
          <SummaryMetric label="Questions" value={report.questionsForLicensedAdviser.length} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Calculation evidence</h3>
        {report.calculations.map((calculation) => (
          <div key={calculation.id} className="border border-[#e5e5e5] bg-white p-4">
            <SourceBadge label="Calculated" />
            <p className="mt-3 text-sm text-[#777169]">{calculation.title}</p>
            <p className="mt-1 text-2xl font-light">{calculation.result}</p>
            <p className="mt-2 font-mono text-xs leading-5 text-[#a59f97]">
              {calculation.formula}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Questions for licensed adviser</h3>
        {report.questionsForLicensedAdviser.map((question, index) => (
          <div key={`${question}-${index}`} className="flex gap-4 border-t border-[#e5e5e5] pt-4">
            <span className="font-mono text-sm text-[#a59f97]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="text-base leading-7">{question}</p>
          </div>
        ))}
        <div className="border border-[#e5e5e5] bg-[#f5f3f1] p-4 text-xs leading-5 text-[#777169]">
          {report.complianceNotice}
        </div>
      </div>
      </div>

      <div className="border border-[#e5e5e5] bg-white p-5">
        <h3 className="text-sm font-medium">Official-source context</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {OFFICIAL_SOURCES.slice(0, 4).map((source) => (
            <blockquote
              key={source.id}
              className="border-l border-black bg-[#f5f3f1] px-4 py-3 text-xs leading-5 text-[#777169]"
            >
              <span className="font-medium text-black">{source.body}: </span>
              {source.quote}
            </blockquote>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-t border-[#e5e5e5] pt-3">
      <p className="text-xs text-[#a59f97]">{label}</p>
      <p className="mt-1 text-2xl font-light">{value}</p>
    </div>
  );
}

function ComparisonCard({
  comparison,
  statement,
}: {
  comparison: SourceComparison;
  statement: string;
}) {
  return (
    <div className="border border-[#e5e5e5] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-base leading-7">&ldquo;{statement}&rdquo;</p>
        <SourceBadge label={STATE_LABELS[comparison.state]} />
      </div>
      <p className="mt-4 text-sm leading-6 text-[#777169]">
        {comparison.explanation}
      </p>
      {comparison.documentEvidence.length > 0 && (
        <div className="mt-4 space-y-2">
          {comparison.documentEvidence.map((fact) => (
            <blockquote
              key={fact.id}
              className="border-l border-black bg-[#f5f3f1] px-4 py-3 text-xs leading-5 text-[#777169]"
            >
              <span className="font-medium text-black">{fact.label}: </span>
              {fact.quote ?? String(fact.value)}
            </blockquote>
          ))}
        </div>
      )}
      <p className="mt-4 border-t border-[#e5e5e5] pt-3 text-sm leading-6">
        Ask: {comparison.clarificationQuestion}
      </p>
    </div>
  );
}

function CalculationGrid({ calculations }: { calculations: CalculationCard[] }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">Deterministic calculations</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {calculations.map((calculation) => (
          <div key={calculation.id} className="border border-[#e5e5e5] bg-white p-4">
            <SourceBadge label="Calculated" />
            <p className="mt-3 text-sm text-[#777169]">{calculation.title}</p>
            <p className="mt-1 text-xl font-light">{calculation.result}</p>
            <p className="mt-2 text-xs leading-5 text-[#777169]">
              {calculation.caveat}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="text-sm text-[#777169]">{eyebrow}</p>
      <h2 className="font-display mt-2 max-w-[720px] text-4xl font-light leading-tight">
        {title}
      </h2>
      <p className="mt-3 max-w-[680px] text-sm leading-6 text-[#777169]">
        {body}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[#777169]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none focus:border-black"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[#777169]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-28 w-full resize-none border border-[#e5e5e5] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-black"
      />
    </label>
  );
}

function ActionPanel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-[#e5e5e5] bg-white p-5">
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#777169]">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-[#d8d4d0] bg-[#f5f3f1] p-6">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#777169]">{body}</p>
    </div>
  );
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit items-center border border-[#e5e5e5] bg-[#f5f3f1] px-2.5 py-1 text-xs text-[#777169]">
      {label}
    </span>
  );
}
