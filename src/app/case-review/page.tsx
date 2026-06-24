"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OFFICIAL_SOURCES, type OfficialSource } from "@/data/official-sources(actual)";
import { SEEDED_STATEMENTS } from "@/data/seeded-policy";
import { checkCompliance } from "@/lib/compliance";
import {
  createCaseEvent,
  createEmptyCaseWorkspace,
  DEFAULT_USER_CONTEXT,
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
  "Claim",
  "Policy",
  "Evidence",
  "Questions",
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

const INITIAL_WORKSPACE: CaseWorkspace = {
  id: "CP-SG-DEMO",
  context: DEFAULT_USER_CONTEXT,
  facts: [],
  factsSource: "sample",
  statements: [],
  comparisons: [],
  calculations: [],
  report: null,
  events: [],
  updatedAt: "",
};

function buildAskAnswer(question: string, sources: OfficialSource[]) {
  const lead =
    sources.length > 0
      ? sources
          .slice(0, 2)
          .map((source) => source.quote)
          .join(" ")
      : "Official consumer education sources usually ask consumers to verify policy costs, guaranteed values, surrender values, exclusions, and assumptions before relying on a sales claim.";

  return [
    `Question: ${question}`,
    `CoverPilot answer: ${lead}`,
    `Sources used: ${sources.length > 0 ? sources.map((source) => `${source.body} (${source.url})`).join("; ") : "policy illustration education context"}`,
    "Use this as meeting preparation only: ask the licensed adviser to point to the exact policy illustration page or official source that supports the claim.",
  ].join("\n\n");
}

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
  const [workspace, setWorkspace] = useState<CaseWorkspace>(INITIAL_WORKSPACE);
  const [activeStep, setActiveStep] = useState(0);
  const [claimInput, setClaimInput] = useState("");
  const [firewallInput, setFirewallInput] = useState("Should I buy this policy?");
  const [firewallResult, setFirewallResult] = useState(() =>
    checkCompliance("Should I buy this policy?")
  );
  const claimWarning = checkCompliance(claimInput);
  const [copiedReport, setCopiedReport] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handledEntryRef = useRef(false);
  const handledDemoRef = useRef(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setWorkspace(loadCaseWorkspace() ?? createEmptyCaseWorkspace());
      if (handledEntryRef.current) return;
      handledEntryRef.current = true;
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (params.get("demo") === "seeded") {
        setActiveStep(0);
        return;
      }
      if (mode === "upload") setActiveStep(1);
      if (mode === "ask" || mode === "claim") setActiveStep(0);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function persist(next: CaseWorkspace) {
    saveCaseWorkspace(next);
    setWorkspace(next);
  }

  function updateWorkspace(updater: (current: CaseWorkspace) => CaseWorkspace) {
    persist(updater(loadCaseWorkspace() ?? workspace));
  }

  function updateContext(key: keyof CaseWorkspace["context"], value: string) {
    updateWorkspace((current) => ({
      ...current,
      context: { ...current.context, [key]: value },
    }));
  }

  async function extractSeededPolicy() {
    const res = await fetch("/api/policy/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "seeded" }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Could not load the sample policy.");
    }
    const data = (await res.json()) as ExtractResponse & { fallback?: boolean };
    const source: PolicyWorkspaceSource = data.fallback ? "sample-fallback" : "sample";
    return { facts: data.facts, source };
  }

  async function loadPolicy(mode: "seeded" | "upload", file?: File) {
    setError(null);
    setLoading(mode === "seeded" ? "Loading sample policy" : "Reading PDF");
    try {
      let data: ExtractResponse & { fallback?: boolean };
      let source: PolicyWorkspaceSource;
      if (mode === "seeded") {
        const extracted = await extractSeededPolicy();
        data = { facts: extracted.facts };
        source = extracted.source;
      } else {
        const form = new FormData();
        form.append("file", file!);
        const res = await fetch("/api/policy/extract", { method: "POST", body: form });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            body?.error ??
              "Could not read the policy document. Use the sample policy or enter facts manually to continue the demo."
          );
        }
        data = (await res.json()) as ExtractResponse & { fallback?: boolean };
        source = data.fallback ? "sample-fallback" : "uploaded";
      }

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

  async function compareEvidence(
    facts: PolicyFact[],
    statements: UserStatement[]
  ) {
    const res = await fetch("/api/statements/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts, statements }),
    });
    if (!res.ok) throw new Error("Evidence review failed.");
    const data = (await res.json()) as CompareResponse;
    if (data.blocked) throw new Error(data.blockReason);
    return data;
  }

  async function fetchMeetingReport(
    facts: PolicyFact[],
    comparisons: SourceComparison[],
    calculations: CalculationCard[]
  ) {
    const res = await fetch("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts, comparisons, calculations }),
    });
    if (!res.ok) throw new Error("Meeting pack generation failed.");
    const data = (await res.json()) as ReportResponse;
    return data.report;
  }

  async function startSeededDemo() {
    setError(null);
    setLoading("Starting seeded demo");
    try {
      const { facts, source } = await extractSeededPolicy();
      const statements = SEEDED_STATEMENTS;
      const evidence = await compareEvidence(facts, statements);
      const report = await fetchMeetingReport(
        facts,
        evidence.comparisons,
        evidence.calculations
      );
      savePolicyWorkspace(facts, source);
      saveCheckWorkspace(statements, evidence.comparisons, evidence.calculations);
      const next: CaseWorkspace = {
        ...workspace,
        facts,
        factsSource: source,
        statements,
        comparisons: evidence.comparisons,
        calculations: evidence.calculations,
        reviewSource: evidence.source,
        report,
        events: [
          ...workspace.events,
          createCaseEvent(
            "Seeded demo generated",
            "Sample policy facts, adviser claims, evidence comparisons, calculations, and meeting pack were prepared."
          ),
        ],
      };
      persist(next);
      setActiveStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (handledDemoRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") !== "seeded") return;
    handledDemoRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void startSeededDemo();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // Query-param bootstrapping should run once for the initial route only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const warning = checkCompliance(claimInput);
    if (warning.blocked) {
      setError(warning.redirect);
      return;
    }
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
    setActiveStep(workspace.facts.length > 0 ? 2 : 1);
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
      const data = await compareEvidence(workspace.facts, workspace.statements);
      const nextComparisons = data.comparisons;
      const nextCalculations = data.calculations;

      saveCheckWorkspace(
        workspace.statements,
        nextComparisons,
        nextCalculations
      );
      updateWorkspace((current) => ({
        ...current,
        comparisons: nextComparisons,
        calculations: nextCalculations,
        reviewSource: data.source,
        report: null,
        events: [
          ...current.events,
          createCaseEvent(
            "Evidence review generated",
            `${nextComparisons.length} claims checked and ${nextCalculations.length} calculations produced.`
          ),
        ],
      }));
      setActiveStep(2);
      await generateReport(nextComparisons, nextCalculations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  async function generateReport(
    nextComparisons?: SourceComparison[],
    nextCalculations?: CalculationCard[]
  ) {
    const comparisons = nextComparisons ?? workspace.comparisons;
    const calculations = nextCalculations ?? workspace.calculations;
    if (comparisons.length === 0 || calculations.length === 0) {
      return;
    }

    setError(null);
    setLoading("Generating meeting-prep pack");
    try {
      const report = await fetchMeetingReport(
        workspace.facts,
        comparisons,
        calculations
      );
      updateWorkspace((current) => ({
        ...current,
        comparisons,
        calculations,
        report,
        events: [
          ...current.events,
          createCaseEvent(
            "Meeting pack prepared",
            `${report.questionsForLicensedAdviser.length} adviser questions were assembled.`
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

  async function generateMeetingPack() {
    if (workspace.comparisons.length === 0) {
      await runEvidenceReview();
      return;
    }
    await generateReport();
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

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b cg-hairline">
        <div className="cg-shell flex h-12 items-center justify-between">
          <Link href="/" className="font-display text-xl font-light">
            CoverPilot
          </Link>
          <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/my-case" className="hover:text-[var(--foreground)]">
              My Case
            </Link>
            <span className="hidden sm:inline">No recommendations</span>
          </div>
        </div>
      </header>

      <section className="cg-shell grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="cg-kicker">Your check</p>
            <h1 className="font-display mt-1 text-3xl font-light">
              Before signing
            </h1>
          </div>
          <nav className="space-y-2">
            {STEP_TITLES.map((title, index) => (
              <button
                key={title}
                onClick={() => setActiveStep(index)}
                className={`flex w-full items-center justify-between border px-4 py-3 text-left text-sm transition ${
                  activeStep === index
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <span>{title}</span>
                <span className="font-mono text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            ))}
          </nav>
          <div className="cg-card-muted p-4 text-sm leading-6 text-[var(--muted)]">
            This workspace produces facts, calculations, and questions. It does
            not tell you what to buy, keep, cancel, or switch.
          </div>
        </aside>

        <div className="space-y-8">
          <section className="pb-2">
            <p className="cg-kicker">Singapore insurance claim check</p>
            <h2 className="font-display mt-3 max-w-[720px] text-[42px] font-light leading-[1.04] md:text-[56px]">
              Paste what your adviser said. CoverPilot checks the evidence.
            </h2>
            <p className="mt-4 max-w-[680px] text-sm leading-6 text-[var(--muted)]">
              Start with the conversation, then add the policy illustration.
              CoverPilot splits the claim, checks policy facts and public
              guidance, and prepares questions for a licensed adviser.
            </p>
          </section>

          <EvidenceProcessStrip workspace={workspace} activeStep={activeStep} />

          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="cg-card px-4 py-3 text-sm text-[var(--muted)]">
              {loading}...
            </div>
          )}

          {activeStep === 0 && (
            <IntakeStep
              workspace={workspace}
              updateContext={updateContext}
              loadSample={() => void loadPolicy("seeded")}
              startSeededDemo={() => void startSeededDemo()}
              triggerUpload={() => fileRef.current?.click()}
              startManualFactSheet={startManualFactSheet}
              claimInput={claimInput}
              claimWarning={claimWarning}
              setClaimInput={setClaimInput}
              addClaim={addClaim}
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
              claimWarning={claimWarning}
              setClaimInput={setClaimInput}
              addClaim={addClaim}
              addSeedClaims={addSeedClaims}
              removeClaim={removeClaim}
              runEvidenceReview={() => void runEvidenceReview()}
              generateMeetingPack={() => void generateMeetingPack()}
              reviewSource={workspace.reviewSource}
              goToPolicy={() => setActiveStep(1)}
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
  startSeededDemo,
  triggerUpload,
  startManualFactSheet,
  claimInput,
  claimWarning,
  setClaimInput,
  addClaim,
}: {
  workspace: CaseWorkspace;
  updateContext: (key: keyof CaseWorkspace["context"], value: string) => void;
  loadSample: () => void;
  startSeededDemo: () => void;
  triggerUpload: () => void;
  startManualFactSheet: () => void;
  claimInput: string;
  claimWarning: ReturnType<typeof checkCompliance>;
  setClaimInput: (value: string) => void;
  addClaim: () => void;
}) {
  const [selectedTopic, setSelectedTopic] =
    useState<OfficialSource["topic"]>("distribution-cost");
  const [askQuestion, setAskQuestion] = useState(ASK_TOPICS[0].question);
  const [askAnswer, setAskAnswer] = useState("");
  const selectedSources = OFFICIAL_SOURCES.filter(
    (source) => source.topic === selectedTopic
  );
  const selectedPreset = ASK_TOPICS.find((topic) => topic.topic === selectedTopic);

  function answerAskQuestion() {
    setAskAnswer(buildAskAnswer(askQuestion, selectedSources));
  }

  return (
    <section className="space-y-7">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.82fr]">
        <div className="cg-card p-5">
          <SectionHeader
            eyebrow="Start here"
            title="What did your adviser say?"
            body="Paste the sentence from WhatsApp, email, a sales deck, or your meeting notes. CoverPilot treats it as a claim to check, not as a request for advice."
          />
          <textarea
            value={claimInput}
            onChange={(event) => setClaimInput(event.target.value)}
            placeholder="Example: This whole life plan is flexible, low-cost, and the returns are basically guaranteed."
            className="mt-5 min-h-28 w-full resize-none border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-base leading-7 outline-none focus:border-[var(--foreground)]"
          />
          {claimInput.trim() && (
            <p
              className={`mt-2 text-xs leading-5 ${
                claimWarning.blocked ? "text-red-700" : "text-[var(--muted)]"
              }`}
            >
              {claimWarning.blocked
                ? claimWarning.redirect
                : "Allowed: CoverPilot will split this into checkable evidence questions."}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={addClaim} className="primary-button">
              Add claim to check
            </button>
            <button onClick={startSeededDemo} className="secondary-button">
              Try full sample review
            </button>
          </div>
        </div>

        <div className="cg-focus-panel p-5">
          <p className="cg-kicker text-[color-mix(in_oklch,var(--background)_70%,transparent)]">
            What happens next
          </p>
          <div className="mt-5 space-y-4">
            <EvidenceStep label="Split" body="One sentence becomes smaller claims: cost, flexibility, guarantee, coverage." />
            <EvidenceStep label="Ground" body="Each claim is checked against policy facts, calculations, or public-source guidance." />
            <EvidenceStep label="Prepare" body="The output is questions for a licensed adviser, not a buy/sell recommendation." />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.86fr]">
        <ActionPanel
          title="Add policy evidence"
          body="If you already have the policy illustration, load it now. If not, you can still start with the claim and use the sample review."
        >
          <div className="flex flex-wrap gap-3">
            <button onClick={loadSample} className="secondary-button">
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
        <div className="cg-card-muted p-4 text-sm leading-6 text-[var(--muted)]">
          Independent posture: no commissions, no product ranking, no suitability
          advice. CoverPilot shows what is sourced and what still needs adviser
          clarification.
        </div>
      </div>

      <div className="cg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            eyebrow="Optional"
            title="Ask a source-backed insurance question."
            body="If you are new to insurance, ask a factual question first. CoverPilot answers only from stored MoneySense and LIA source snippets."
          />
          <SourceBadge label="Official-source" />
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {ASK_TOPICS.map((topic) => (
            <button
              key={topic.topic}
              onClick={() => {
                setSelectedTopic(topic.topic);
                setAskQuestion(topic.question);
                setAskAnswer("");
              }}
              className={`shrink-0 border px-3 py-2 text-sm transition ${
                selectedTopic === topic.topic
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {topic.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm text-[var(--muted)]">User question</p>
            <textarea
              value={askQuestion}
              onChange={(event) => setAskQuestion(event.target.value)}
              className="mt-2 min-h-24 w-full resize-none border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-base leading-7 outline-none focus:border-[var(--foreground)]"
            />
            <button onClick={answerAskQuestion} className="primary-button mt-3">
              Ask source-backed question
            </button>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Preset: {selectedPreset?.label}. Answers stay factual and point
              back to official-source context.
            </p>
          </div>
          <div className="space-y-3">
            {askAnswer && (
              <div className="border border-[var(--foreground)] bg-[var(--surface)] p-4 text-sm leading-6 whitespace-pre-line">
                {askAnswer}
              </div>
            )}
            {selectedSources.length > 0 ? (
              selectedSources.map((source) => (
                <SourceReference key={source.id} source={source} />
              ))
            ) : (
              <div className="cg-card-muted px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                MoneySense and LIA source entries commonly warn
                users to check surrender values, distribution cost, guaranteed
                values, and policy conditions before relying on early-exit or
                flexibility claims.
                <span className="mt-2 block font-mono text-xs text-[var(--soft)]">
                  Official-source discussion prompt
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.86fr]">
      <div className="space-y-5">
        <SectionHeader
          eyebrow="Context"
          title="Add the situation if it helps the meeting questions."
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
        <div className="cg-card-muted p-4 text-xs leading-5 text-[var(--muted)]">
          Resource discipline: public-source answers cite MoneySense/LIA links;
          policy checks cite extracted PI facts; calculations show formulas and
          input fields.
        </div>
      </div>
      </div>
    </section>
  );
}

function EvidenceProcessStrip({
  workspace,
  activeStep,
}: {
  workspace: CaseWorkspace;
  activeStep: number;
}) {
  const process = [
    {
      label: "Claim",
      value: `${workspace.statements.length} captured`,
      detail: "What the adviser said",
    },
    {
      label: "Policy",
      value: `${workspace.facts.length} facts`,
      detail: workspace.factsSource === "uploaded" ? "Uploaded or manual PI" : "Seeded PI evidence",
    },
    {
      label: "Evidence",
      value: `${workspace.comparisons.length} checks`,
      detail: `${OFFICIAL_SOURCES.length} public-source snippets available`,
    },
    {
      label: "Questions",
      value: workspace.report
        ? `${workspace.report.questionsForLicensedAdviser.length} questions`
        : "Not generated",
      detail: "Licensed-adviser meeting pack",
    },
  ];

  return (
    <div className="cg-process-grid">
      {process.map((item, index) => (
        <div
          key={item.label}
          className={`cg-process-card ${
            activeStep === index ? "border-[var(--foreground)] bg-[#fffefb]" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="cg-process-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            {activeStep === index && <SourceBadge label="Active" />}
          </div>
          <div>
            <p className="text-2xl font-light">{item.label}</p>
            <p className="mt-3 text-sm text-[var(--foreground)]">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {item.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceStep({ label, body }: { label: string; body: string }) {
  return (
    <div className="border-t border-[color-mix(in_oklch,var(--background)_30%,transparent)] pt-3">
      <p className="font-mono text-xs text-[color-mix(in_oklch,var(--background)_58%,transparent)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color-mix(in_oklch,var(--background)_80%,transparent)]">
        {body}
      </p>
    </div>
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
          <div className="cg-card p-4">
            <p className="text-sm font-medium">Quick add common PI fields</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {MANUAL_FACT_TEMPLATES.slice(0, 7).map((template) => (
                <button
                  key={template.id}
                  onClick={() => addManualFact(template)}
                  className="shrink-0 border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          {workspace.facts.map((fact) => (
            <div key={fact.id} className="cg-card p-4">
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
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
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
                className="mt-3 min-h-20 w-full resize-none border-t border-[var(--line)] bg-transparent pt-3 text-xs leading-5 text-[var(--muted)] outline-none"
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
  claimWarning,
  setClaimInput,
  addClaim,
  addSeedClaims,
  removeClaim,
  runEvidenceReview,
  generateMeetingPack,
  reviewSource,
  goToPolicy,
}: {
  workspace: CaseWorkspace;
  claimInput: string;
  claimWarning: ReturnType<typeof checkCompliance>;
  setClaimInput: (value: string) => void;
  addClaim: () => void;
  addSeedClaims: () => void;
  removeClaim: (id: string) => void;
  runEvidenceReview: () => void;
  generateMeetingPack: () => void;
  reviewSource?: "ai" | "deterministic";
  goToPolicy: () => void;
}) {
  const canRunReview = workspace.facts.length > 0 && workspace.statements.length > 0;

  return (
    <section className="space-y-8">
      <SectionHeader
        eyebrow="Claim review"
        title="Check what was said against what is sourced."
        body="This is the InsureLobang Check Advice pattern, but connected to the policy breakdown and meeting pack."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <input
            value={claimInput}
            onChange={(event) => setClaimInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addClaim()}
            placeholder="Paste an adviser claim, e.g. You can access your money anytime"
            className="w-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)]"
          />
          {claimInput.trim() && (
            <p
              className={`mt-2 text-xs leading-5 ${
                claimWarning.blocked ? "text-red-700" : "text-[var(--muted)]"
              }`}
            >
              {claimWarning.blocked
                ? claimWarning.redirect
                : "Allowed: CoverPilot will treat this as a factual claim to check against sources."}
            </p>
          )}
        </div>
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
                className="flex gap-3 border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <span className="font-mono text-xs text-[var(--soft)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="flex-1 text-sm leading-6">{statement.text}</p>
                <button
                  onClick={() => removeClaim(statement.id)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
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
            {canRunReview ? (
              <button onClick={runEvidenceReview} className="primary-button">
                Run evidence review
              </button>
            ) : workspace.statements.length > 0 ? (
              <button onClick={goToPolicy} className="secondary-button">
                Add policy evidence
              </button>
            ) : (
              <button disabled className="secondary-button opacity-50">
                Add claim first
              </button>
            )}
          </div>
          {workspace.comparisons.length === 0 ? (
            <EmptyState
              title="No review generated"
              body={
                canRunReview
                  ? "Run the evidence review to compare claims against extracted policy facts."
                  : "Add one adviser claim and policy evidence before generating a review."
              }
            />
          ) : (
            <div className="space-y-4">
              {reviewSource && (
                <div
                  className={`border px-3 py-2 text-xs ${
                    reviewSource === "ai"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {reviewSource === "ai"
                    ? "Live AI review — results generated by GPT-4o against your policy facts."
                    : "Deterministic evidence comparison — results matched from policy facts without AI."}
                </div>
              )}
              {workspace.comparisons.map((comparison) => {
                const statement = workspace.statements.find(
                  (item) => item.id === comparison.statementId
                );
                return (
                  <ComparisonCard
                    key={comparison.statementId}
                    comparison={comparison}
                    statement={statement}
                    calculations={workspace.calculations}
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
  const canCreatePack =
    workspace.comparisons.length > 0 ||
    (workspace.facts.length > 0 && workspace.statements.length > 0);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Meeting pack"
          title="Leave with questions, not advice."
          body="The output is meant to help a licensed adviser conversation start from the source record."
        />
        <div className="flex flex-wrap gap-3">
          {canCreatePack ? (
            <button onClick={generateMeetingPack} className="primary-button">
              {workspace.report ? "Regenerate meeting pack" : "Create meeting pack"}
            </button>
          ) : (
            <button disabled className="secondary-button opacity-50">
              Run evidence first
            </button>
          )}
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
              className="w-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)]"
            />
            <button onClick={testFirewall} className="secondary-button">
              Test firewall
            </button>
          </div>
        </ActionPanel>
        <div className="cg-card p-5">
          <SourceBadge label={firewallResult.blocked ? "Blocked" : "Allowed"} />
          <p className="mt-4 text-base leading-7">
            {firewallResult.blocked
              ? firewallResult.reason
              : "This prompt can proceed as factual information or preparation."}
          </p>
          {firewallResult.blocked && (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
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
      <div className="cg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs text-[var(--soft)]">{workspace.id}</p>
            <h3 className="font-display mt-2 text-3xl font-light">
              Insurance meeting-prep pack
            </h3>
            <p className="mt-3 max-w-[680px] text-sm leading-6 text-[var(--muted)]">
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
          <div key={calculation.id} className="cg-card p-4">
            <SourceBadge label="Calculated" />
            <p className="mt-3 text-sm text-[var(--muted)]">{calculation.title}</p>
            <p className="mt-1 text-2xl font-light">{calculation.result}</p>
            <p className="mt-2 font-mono text-xs leading-5 text-[var(--soft)]">
              {calculation.formula}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Questions for licensed adviser</h3>
        {report.questionsForLicensedAdviser.map((question, index) => (
          <div key={`${question}-${index}`} className="flex gap-4 border-t border-[var(--line)] pt-4">
            <span className="font-mono text-sm text-[var(--soft)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="text-base leading-7">{question}</p>
          </div>
        ))}
        <div className="cg-card-muted p-4 text-xs leading-5 text-[var(--muted)]">
          {report.complianceNotice}
        </div>
      </div>
      </div>

      <div className="cg-card p-5">
        <h3 className="text-sm font-medium">Official-source context</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {OFFICIAL_SOURCES.slice(0, 4).map((source) => (
            <SourceReference key={source.id} source={source} compact />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-t border-[var(--line)] pt-3">
      <p className="text-xs text-[var(--soft)]">{label}</p>
      <p className="mt-1 text-2xl font-light">{value}</p>
    </div>
  );
}

function ComparisonCard({
  comparison,
  statement,
  calculations,
}: {
  comparison: SourceComparison;
  statement?: UserStatement;
  calculations: CalculationCard[];
}) {
  const relatedCalculations = relatedCalculationsFor(statement, calculations);
  const statementText = statement?.text ?? "Claim";
  const splitLabel = statement?.category
    ? `${statement.category[0].toUpperCase()}${statement.category.slice(1)} check`
    : "Evidence check";

  return (
    <div className="cg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-base leading-7">&ldquo;{statementText}&rdquo;</p>
        <SourceBadge label={STATE_LABELS[comparison.state]} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <ReasoningCell label="1. Split" value={splitLabel} />
        <ReasoningCell
          label="2. Policy facts"
          value={
            comparison.documentEvidence.length > 0
              ? `${comparison.documentEvidence.length} source facts`
              : "No matching fact"
          }
        />
        <ReasoningCell
          label="3. Maths / guidance"
          value={
            relatedCalculations.length > 0
              ? relatedCalculations.map((item) => item.title).join("; ")
              : "Public-source context"
          }
        />
        <ReasoningCell
          label="4. Next step"
          value="Ask licensed adviser"
        />
      </div>

      <p className="mt-4 border-l-2 border-[var(--foreground)] pl-3 text-sm leading-6 text-[var(--muted)]">
        {comparison.explanation}
      </p>
      {comparison.documentEvidence.length > 0 && (
        <div className="mt-4 space-y-2">
          {comparison.documentEvidence.map((fact) => (
            <div
              key={fact.id}
              className="cg-card-muted px-4 py-3 text-xs leading-5 text-[var(--muted)]"
            >
              <span className="font-medium text-[var(--foreground)]">{fact.label}: </span>
              {fact.quote ?? String(fact.value)}
              {fact.page && (
                <span className="mt-2 block font-mono text-[11px] text-[var(--soft)]">
                  PI page {fact.page}
                </span>
              )}
              {fact.sourceUrl && (
                <a
                  href={fact.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cg-source-link mt-2 block font-mono text-[11px]"
                >
                  {fact.sourceName ?? "Source"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {relatedCalculations.length > 0 && (
        <div className="mt-4 space-y-2">
          {relatedCalculations.map((calculation) => (
            <div
              key={`${comparison.statementId}-${calculation.id}`}
              className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-xs font-medium">{calculation.title}</p>
                <span className="font-mono text-xs text-[var(--soft)]">
                  {calculation.result}
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] leading-5 text-[var(--muted)]">
                {calculation.formula}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 border-t border-[var(--line)] pt-3 text-sm leading-6">
        Ask: {comparison.clarificationQuestion}
      </p>
    </div>
  );
}

function ReasoningCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface-muted)] p-3">
      <p className="font-mono text-[11px] text-[var(--soft)]">{label}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{value}</p>
    </div>
  );
}

function relatedCalculationsFor(
  statement: UserStatement | undefined,
  calculations: CalculationCard[]
) {
  if (!statement) return [];
  const matchers: Record<UserStatement["category"], RegExp> = {
    cost: /cost|premium|distribution|charge|fee/i,
    liquidity: /surrender|cash|break.?even|liquid|access/i,
    coverage: /coverage|sum assured|death|critical/i,
    returns: /return|projected|yield|bonus|non-guaranteed/i,
    guarantee: /guarantee|guaranteed|non-guaranteed/i,
    exclusion: /exclusion|waiting|claim|condition/i,
    other: /./,
  };
  const matcher = matchers[statement.category];
  return calculations
    .filter(
      (calculation) =>
        matcher.test(calculation.title) ||
        matcher.test(calculation.formula) ||
        matcher.test(calculation.caveat)
    )
    .slice(0, 2);
}

function CalculationGrid({ calculations }: { calculations: CalculationCard[] }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">PI-backed calculations</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {calculations.map((calculation) => (
          <div key={calculation.id} className="cg-card p-4">
            <SourceBadge label="Calculated" />
            <p className="mt-3 text-sm text-[var(--muted)]">{calculation.title}</p>
            <p className="mt-1 text-xl font-light">{calculation.result}</p>
            <p className="mt-3 border-t border-[var(--line)] pt-3 font-mono text-[11px] leading-5 text-[var(--muted)]">
              {calculation.formula}
            </p>
            {calculation.inputs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {calculation.inputs.map((input) => (
                  <span
                    key={input.id}
                    className="border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] text-[var(--muted)]"
                  >
                    {input.label}: {String(input.value)}
                    {input.unit ? ` ${input.unit}` : ""}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {calculation.caveat}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceReference({
  source,
  compact = false,
}: {
  source: OfficialSource;
  compact?: boolean;
}) {
  return (
    <div className="cg-card-muted px-4 py-3 text-sm leading-6 text-[var(--muted)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-[var(--foreground)]">{source.body}</span>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="cg-source-link font-mono text-[11px]"
        >
          Source
        </a>
      </div>
      <p className={compact ? "mt-2 text-xs leading-5" : "mt-2"}>
        {source.quote}
      </p>
      <span className="mt-2 block font-mono text-[11px] text-[var(--soft)]">
        Verified {source.verifiedOn}
      </span>
    </div>
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
      <p className="cg-kicker">{eyebrow}</p>
      <h2 className="font-display mt-2 max-w-[720px] text-4xl font-light leading-tight">
        {title}
      </h2>
      <p className="mt-3 max-w-[680px] text-sm leading-6 text-[var(--muted)]">
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
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)]"
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
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-28 w-full resize-none border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--foreground)]"
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
    <div className="cg-card p-5">
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-6">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
    </div>
  );
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit items-center border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--muted)]">
      {label}
    </span>
  );
}
