import { NextRequest, NextResponse } from "next/server";
import type { CompareRequest, CompareResponse } from "@/types";
import { checkCompliance } from "@/lib/compliance";
import { runCalculations } from "@/lib/calculations";
import { compareStatementWithAI } from "@/lib/compare";

export async function POST(req: NextRequest) {
  const body: CompareRequest = await req.json();
  const { facts, statements } = body;

  // Compliance firewall — check all statements before any processing
  for (const stmt of statements) {
    const result = checkCompliance(stmt.text);
    if (result.blocked) {
      const response: CompareResponse = {
        comparisons: [],
        calculations: [],
        blocked: true,
        blockReason: result.reason,
      };
      return NextResponse.json(response);
    }
  }

  // Run AI comparisons in parallel
  const comparisons = await Promise.all(
    statements.map((stmt) => compareStatementWithAI(stmt, facts))
  );

  const calculations = runCalculations(facts);

  const response: CompareResponse = {
    comparisons,
    calculations,
    blocked: false,
  };
  return NextResponse.json(response);
}

