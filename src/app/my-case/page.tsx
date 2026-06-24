"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearCaseWorkspace,
  loadCaseWorkspace,
  type CaseWorkspace,
} from "@/lib/workspace-session";
import type { CalculationCard, PolicyFact, SourceComparison } from "@/types";

const STATE_LABELS: Record<SourceComparison["state"], string> = {
  "matches-document": "Supported by document",
  "partially-matches": "Partially supported",
  "not-found": "Not found",
  "needs-source-reconciliation": "Needs reconciliation",
  "calculation-differs": "Calculation differs",
};

const SOURCE_LABELS: Record<string, string> = {
  "document-stated": "Document-stated",
  "calculated-from-document": "Calculated",
  "official-source": "Official-source",
  "not-found": "Not found",
};

export default function MyCasePage() {
  const [workspace, setWorkspace] = useState<CaseWorkspace | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setWorkspace(loadCaseWorkspace());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function clearCase() {
    clearCaseWorkspace();
    setWorkspace(null);
  }

  return (
    <main className="min-h-[100dvh] bg-[#fdfcfc] text-black">
      <header className="border-b border-[#e5e5e5]">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="font-display text-xl font-light">
            Claro
          </Link>
          <Link href="/check" className="text-sm text-[#777169] hover:text-black">
            Check
          </Link>
        </div>
      </header>

      {!hydrated ? (
        <section className="mx-auto max-w-[760px] px-5 py-20 text-center">
          <p className="text-sm text-[#777169]">Loading case workspace...</p>
        </section>
      ) : !workspace ? (
        <section className="mx-auto max-w-[760px] px-5 py-20 text-center">
          <p className="text-sm text-[#777169]">My Case</p>
          <h1 className="font-display mt-3 text-5xl font-light leading-tight">
            No evidence workspace yet.
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-base leading-7 text-[#777169]">
            Start with one focused flow to save policy facts, adviser claims,
            calculations, and meeting-prep questions here.
          </p>
          <Link href="/check" className="primary-button mt-8">
            Start with adviser check
          </Link>
        </section>
      ) : (
        <section className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8">
          <div className="flex flex-col gap-5 border-b border-[#e5e5e5] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-[#777169]">My Case</p>
              <h1 className="font-display mt-2 text-5xl font-light leading-tight">
                {workspace.id}
              </h1>
              <p className="mt-3 max-w-[620px] text-sm leading-6 text-[#777169]">
                Saved evidence record for the next licensed adviser
                conversation. Updated {new Date(workspace.updatedAt).toLocaleString("en-SG")}.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/check" className="primary-button">
                Continue checking
              </Link>
              <button onClick={clearCase} className="secondary-button">
                Clear case
              </button>
            </div>
          </div>

          <div className="grid gap-8 py-8 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-5">
              <Panel title="User context">
                <ContextRow label="Situation" value={workspace.context.situation} />
                <ContextRow label="Age" value={workspace.context.age} />
                <ContextRow label="Income" value={workspace.context.income} />
                <ContextRow label="Dependents" value={workspace.context.dependents} />
                <ContextRow label="Current cover" value={workspace.context.currentCover} />
                <ContextRow label="Concern" value={workspace.context.concern} />
              </Panel>

              <Panel title="Case history">
                <div className="space-y-4">
                  {workspace.events.map((event) => (
                    <div key={event.id} className="grid grid-cols-[48px_1fr] gap-3">
                      <span className="font-mono text-xs text-[#a59f97]">
                        {event.time}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#777169]">
                          {event.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </aside>

            <div className="space-y-8">
              <WorkspaceSection
                title="Policy facts"
                count={workspace.facts.length}
                empty="No policy facts loaded yet."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {workspace.facts.slice(0, 12).map((fact) => (
                    <FactCard key={fact.id} fact={fact} />
                  ))}
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                title="Adviser claims"
                count={workspace.statements.length}
                empty="No adviser claims captured yet."
              >
                <div className="space-y-3">
                  {workspace.statements.map((statement, index) => (
                    <div key={statement.id} className="border border-[#e5e5e5] bg-white p-4">
                      <div className="flex gap-3">
                        <span className="font-mono text-xs text-[#a59f97]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p className="text-sm leading-6">{statement.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                title="Evidence comparisons"
                count={workspace.comparisons.length}
                empty="Run the evidence review to compare claims against the policy."
              >
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
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                title="Calculations"
                count={workspace.calculations.length}
                empty="No calculations generated yet."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {workspace.calculations.map((calculation) => (
                    <CalculationCardView
                      key={calculation.id}
                      calculation={calculation}
                    />
                  ))}
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                title="Meeting-prep questions"
                count={workspace.report?.questionsForLicensedAdviser.length ?? 0}
                empty="Generate a meeting pack to save adviser questions."
              >
                <div className="space-y-3">
                  {workspace.report?.questionsForLicensedAdviser.map(
                    (question, index) => (
                      <div
                        key={`${question}-${index}`}
                        className="flex gap-4 border-t border-[#e5e5e5] pt-4"
                      >
                        <span className="font-mono text-sm text-[#a59f97]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p className="text-base leading-7">{question}</p>
                      </div>
                    )
                  )}
                </div>
              </WorkspaceSection>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function WorkspaceSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between border-b border-[#e5e5e5] pb-3">
        <h2 className="text-lg font-medium">{title}</h2>
        <span className="font-mono text-xs text-[#a59f97]">{count}</span>
      </div>
      {count === 0 ? (
        <div className="border border-dashed border-[#d8d4d0] bg-[#f5f3f1] p-5 text-sm text-[#777169]">
          {empty}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-[#e5e5e5] bg-white p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#a59f97]">{label}</p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function FactCard({ fact }: { fact: PolicyFact }) {
  return (
    <div className="border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{fact.label}</p>
        <SourceBadge label={SOURCE_LABELS[fact.sourceType] ?? fact.sourceType} />
      </div>
      <p className="mt-2 text-xl font-light">
        {String(fact.value)}
        {fact.unit ? ` ${fact.unit}` : ""}
      </p>
      {fact.quote && (
        <p className="mt-3 border-t border-[#e5e5e5] pt-3 text-xs leading-5 text-[#777169]">
          {fact.quote}
        </p>
      )}
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
      <p className="mt-3 text-sm leading-6 text-[#777169]">
        {comparison.explanation}
      </p>
      <p className="mt-3 border-t border-[#e5e5e5] pt-3 text-sm leading-6">
        Ask: {comparison.clarificationQuestion}
      </p>
    </div>
  );
}

function CalculationCardView({
  calculation,
}: {
  calculation: CalculationCard;
}) {
  return (
    <div className="border border-[#e5e5e5] bg-white p-4">
      <SourceBadge label="Calculated" />
      <p className="mt-3 text-sm text-[#777169]">{calculation.title}</p>
      <p className="mt-1 text-xl font-light">{calculation.result}</p>
      <p className="mt-2 font-mono text-xs leading-5 text-[#a59f97]">
        {calculation.formula}
      </p>
    </div>
  );
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit border border-[#e5e5e5] bg-[#f5f3f1] px-2.5 py-1 text-xs text-[#777169]">
      {label}
    </span>
  );
}
