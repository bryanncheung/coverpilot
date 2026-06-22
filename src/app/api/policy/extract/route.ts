import { NextRequest, NextResponse } from "next/server";
import type { ExtractResponse } from "@/types";
import { SEEDED_FACTS, SEEDED_POLICY_ID } from "@/data/seeded-policy";
import { extractFactsFromPDF } from "@/lib/extract";

// POST /api/policy/extract
// Body: JSON { mode: "seeded" } OR multipart/form-data with a "file" field (PDF)
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // Seeded JSON mode
  if (contentType.includes("application/json")) {
    const body = await req.json();
    if (body.mode === "seeded" || body.policyId === SEEDED_POLICY_ID) {
      const response: ExtractResponse = { facts: SEEDED_FACTS };
      return NextResponse.json(response);
    }
    return NextResponse.json(
      { error: "Invalid mode. Use mode: 'seeded' or upload a PDF." },
      { status: 400 }
    );
  }

  // PDF upload mode
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file");

      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const facts = await extractFactsFromPDF(buffer);

      // Fallback to seeded if extraction returns nothing useful
      if (facts.length < 3) {
        console.warn("PDF extraction returned too few facts, falling back to seeded data");
        return NextResponse.json({ facts: SEEDED_FACTS, fallback: true });
      }

      const response: ExtractResponse = { facts };
      return NextResponse.json(response);
    } catch (err) {
      console.error("PDF extraction error:", err);
      // Graceful fallback — demo never breaks
      return NextResponse.json({ facts: SEEDED_FACTS, fallback: true });
    }
  }

  return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
}
