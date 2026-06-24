import { NextRequest, NextResponse } from "next/server";
import type { CompareRequest, CompareResponse } from "@/types";
import { checkCompliance } from "@/lib/compliance";
import { runCalculations } from "@/lib/calculations";
import { compareStatementsDeterministically } from "@/lib/deterministic-compare";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, {
    scope: "statement-compare",
    limit: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  let body: CompareRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { facts, statements } = body;

  if (!Array.isArray(facts) || !Array.isArray(statements)) {
    return NextResponse.json(
      { error: "Request must include facts and statements arrays" },
      { status: 400 }
    );
  }

  // Compliance firewall — check all statements before any processing
  for (const stmt of statements) {
    const result = checkCompliance(stmt.text);
    if (result.blocked) {
      const response: CompareResponse = {
        comparisons: [],
        calculations: [],
        blocked: true,
        source: "deterministic",
        blockReason: result.reason,
      };
      return NextResponse.json(response);
    }
  }

  let comparisons = compareStatementsDeterministically(statements, facts);
  let source: CompareResponse["source"] = "deterministic";
  if (process.env.OPENAI_API_KEY) {
    try {
      const { compareStatementWithAI } = await import("@/lib/compare");
      // Run AI comparisons in parallel
      comparisons = await Promise.all(
        statements.map((stmt) => compareStatementWithAI(stmt, facts))
      );
      source = "ai";
    } catch (error) {
      console.warn(
        "AI comparison failed, falling back to deterministic evidence comparison",
        error
      );
    }
  }

  const calculations = runCalculations(facts);

  const response: CompareResponse = {
    comparisons,
    calculations,
    blocked: false,
    source,
  };
  return NextResponse.json(response);
}
