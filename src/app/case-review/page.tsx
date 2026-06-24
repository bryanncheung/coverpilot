"use client";

import Link from "next/link";
import { useEffect } from "react";

function destinationFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  if (mode === "upload") return "/decode";
  if (mode === "ask") return "/ask";
  return "/check";
}

export default function CaseReviewRedirectPage() {
  useEffect(() => {
    window.location.replace(destinationFromSearch(window.location.search));
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <div className="max-w-md text-center">
        <p className="cg-kicker">Claro</p>
        <h1 className="font-display mt-4 text-4xl font-light">
          Choose one focused flow.
        </h1>
        <div className="mt-8 grid gap-3">
          <Link className="secondary-button" href="/check">
            Check what my adviser said
          </Link>
          <Link className="secondary-button" href="/decode">
            Understand a financial document
          </Link>
          <Link className="secondary-button" href="/ask">
            Ask a financial question
          </Link>
        </div>
      </div>
    </main>
  );
}
