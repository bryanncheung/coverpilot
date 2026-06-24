import Link from "next/link";

const ACTIONS = [
  {
    title: "Check what my adviser said",
    detail: "For a claim from a meeting, WhatsApp, or sales pitch.",
    href: "/check",
  },
  {
    title: "Understand a financial document",
    detail: "For a policy illustration or financial PDF.",
    href: "/decode",
  },
  {
    title: "Ask a financial question",
    detail: "For a general concept before speaking to an adviser.",
    href: "/ask",
  },
];

export default function Home() {
  return (
    <main className="cp-page">
      <div className="flex min-h-[100dvh] flex-col">
        <header className="cp-shell flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-2xl font-light">
            Claro
          </Link>
          <Link
            href="/my-case"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            My Case
          </Link>
        </header>

        <section className="cp-shell grid flex-1 items-center py-10 md:py-16">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.72fr] lg:items-end">
            <div>
              <p className="cg-kicker">Singapore financial advice clarity</p>
              <h1 className="font-display mt-6 max-w-4xl text-[52px] font-light leading-[0.94] tracking-[-0.02em] md:text-[88px]">
                Understand financial advice before you act on it.
              </h1>
            </div>

            <div className="space-y-3">
              {ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group block border border-[var(--line)] bg-[var(--surface)] px-5 py-5 text-left transition duration-200 hover:border-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                >
                  <span className="flex items-start justify-between gap-5">
                    <span>
                      <span className="block text-lg font-medium leading-tight">
                        {action.title}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">
                        {action.detail}
                      </span>
                    </span>
                    <span className="text-sm text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--foreground)]">
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <p className="mt-10 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Claro helps you read, check, and prepare questions. It does
            not tell you what to buy, keep, cancel, or switch.
          </p>
        </section>
      </div>
    </main>
  );
}
