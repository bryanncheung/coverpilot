import Link from "next/link";

const USER_JOBS = [
  {
    title: "Check what I was told",
    body: "Paste an adviser claim and see what the policy facts actually support.",
    href: "/case-review?mode=claim",
  },
  {
    title: "Understand this policy",
    body: "Load a policy illustration and turn dense figures into cited facts.",
    href: "/case-review?mode=upload",
  },
  {
    title: "Prepare questions",
    body: "Leave with questions for a licensed adviser, not a recommendation.",
    href: "/case-review?demo=seeded",
  },
];

const EVIDENCE_CHAIN = [
  {
    label: "Claim",
    value: "This whole life plan is flexible and low-cost.",
  },
  {
    label: "Split",
    value: "Flexibility, cost, and guarantee are checked separately.",
  },
  {
    label: "Evidence",
    value: "Policy facts, surrender schedule, distribution cost, public guidance.",
  },
  {
    label: "Output",
    value: "Supported, unclear, calculation differs, or ask your adviser.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b cg-hairline">
        <div className="cg-shell flex h-12 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 bg-[var(--accent)]" />
            <span className="font-display text-xl font-light">CoverPilot</span>
          </div>
          <nav className="flex items-center gap-5 text-sm text-[var(--muted)]">
            <Link href="/case-review?mode=claim" className="hover:text-[var(--foreground)]">
              Check Claim
            </Link>
            <Link href="/my-case" className="hover:text-[var(--foreground)]">
              My Case
            </Link>
          </nav>
        </div>
      </header>

      <section className="cg-shell grid gap-10 pb-12 pt-12 lg:grid-cols-[0.98fr_1.02fr] lg:pb-16 lg:pt-16">
        <div className="max-w-[760px]">
          <p className="cg-kicker">Independent Singapore insurance check</p>
          <h1 className="font-display mt-5 text-[44px] font-light leading-[1.02] md:text-[70px]">
            Check what your insurance adviser said before you sign.
          </h1>
          <p className="mt-6 max-w-[650px] text-base leading-7 text-[var(--muted)]">
            Paste the claim, add the policy illustration, and CoverPilot shows
            what is supported, what is unclear, and what to ask next. No
            recommendations. No commissions. Just evidence and questions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/case-review?demo=seeded" className="primary-button">
              Try sample adviser check
            </Link>
            <Link href="/case-review?mode=claim" className="secondary-button">
              Check my own claim
            </Link>
            <Link
              href="/case-review?mode=upload"
              className="text-sm leading-10 text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
            >
              Upload policy illustration
            </Link>
          </div>
        </div>

        <div className="cg-card p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
            <div className="border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <p className="cg-kicker">Adviser claim</p>
              <p className="mt-5 text-2xl font-light leading-tight">
                “This plan is flexible, low-cost, and the returns are basically
                guaranteed.”
              </p>
              <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
                CoverPilot treats this as several checkable claims instead of
                answering with a generic paragraph.
              </p>
            </div>
            <div className="cg-focus-panel p-4">
              <p className="font-mono text-xs text-[color-mix(in_oklch,var(--background)_70%,transparent)]">
                SAMPLE REVIEW
              </p>
              <div className="mt-5 space-y-3">
                <VerdictRow label="Flexibility" value="Needs evidence" />
                <VerdictRow label="Low cost" value="Calculation differs" />
                <VerdictRow label="Guaranteed returns" value="Not found" />
              </div>
              <div className="mt-5 border-t border-[color-mix(in_oklch,var(--background)_30%,transparent)] pt-4 text-sm leading-6 text-[color-mix(in_oklch,var(--background)_78%,transparent)]">
                Ask your adviser to point to the surrender values, distribution
                cost table, and guaranteed versus non-guaranteed section.
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {EVIDENCE_CHAIN.map((item, index) => (
              <div
                key={item.label}
                className="border border-[var(--line)] bg-[var(--surface)] p-3"
              >
                <p className="font-mono text-xs text-[var(--soft)]">
                  {String(index + 1).padStart(2, "0")} {item.label}
                </p>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y cg-hairline bg-[var(--surface)]">
        <div className="cg-shell py-10">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="cg-kicker">What you can do here</p>
              <h2 className="font-display mt-3 text-4xl font-light leading-tight">
                Three simple jobs. One evidence engine underneath.
              </h2>
            </div>
            <Link href="/case-review?demo=seeded" className="secondary-button">
              See full demo
            </Link>
          </div>
          <div className="cg-process-grid mt-8">
            {USER_JOBS.map((item, index) => (
              <Link key={item.title} href={item.href} className="cg-process-card">
                <span className="cg-process-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-2xl font-light">{item.title}</span>
                  <span className="mt-3 block text-sm leading-6 text-[var(--muted)]">
                    {item.body}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="cg-shell py-14">
        <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr]">
          <div>
            <p className="cg-kicker">Why this is more than a chatbot</p>
            <h2 className="font-display mt-3 text-4xl font-light leading-tight">
              Consumer-simple on top. Startup-grade underneath.
            </h2>
          </div>
          <div className="cg-editorial-rows">
            <ReferenceRow
              index="01"
              title="AI advisory workflow"
              body="FP Alpha, Conquest, Jump, and Zocks show the pattern: turn messy financial documents and conversations into structured, auditable outputs."
            />
            <ReferenceRow
              index="02"
              title="Independent insurance trust"
              body="InsureLobang shows the consumer posture: independent, no commissions, source-backed checks, and simple entry points for confused buyers."
            />
            <ReferenceRow
              index="03"
              title="Singapore safety boundary"
              body="CoverPilot prepares evidence and questions. It does not tell users what to buy, keep, cancel, switch, or rank."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function VerdictRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[color-mix(in_oklch,var(--background)_30%,transparent)] pt-3">
      <span className="text-sm">{label}</span>
      <span className="bg-[color-mix(in_oklch,var(--background)_16%,transparent)] px-2 py-1 font-mono text-xs">
        {value}
      </span>
    </div>
  );
}

function ReferenceRow({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <div className="cg-editorial-row">
      <div className="cg-empty-column" />
      <div className="cg-card p-5">
        <p className="font-mono text-xs text-[var(--soft)]">{index}</p>
        <h3 className="font-display mt-4 text-3xl font-light leading-tight">
          {title}
        </h3>
      </div>
      <div className="border-t cg-hairline pt-4 text-sm leading-6 text-[var(--muted)]">
        {body}
      </div>
    </div>
  );
}
