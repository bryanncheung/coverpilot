import { NextRequest, NextResponse } from "next/server";
import type { ExtractResponse } from "@/types";
import { SEEDED_FACTS, SEEDED_POLICY_ID } from "@/data/seeded-policy";
import { applyRateLimit } from "@/lib/rate-limit";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF", "utf8");

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
    const rateLimited = applyRateLimit(req, {
      scope: "policy-extract",
      limit: 12,
      windowMs: 60 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "PDF upload extraction requires OPENAI_API_KEY. Use the sample policy or configure the API key.",
        },
        { status: 503 }
      );
    }

    try {
      const form = await req.formData();
      const file = form.get("file");

      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "PDF is too large. Please upload a file under 25 MB." },
          { status: 413 }
        );
      }
      if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
        return NextResponse.json(
          { error: "Uploaded file does not appear to be a valid PDF." },
          { status: 415 }
        );
      }

      const { extractFactsFromPDF } = await import("@/lib/extract");
      const facts = await extractFactsFromPDF(buffer);

      if (facts.length < 3) {
        return NextResponse.json(
          {
            error:
              "CoverPilot could not extract enough policy facts from this PDF. Please use a clearer policy illustration or enter the key figures manually.",
          },
          { status: 422 }
        );
      }

      const response: ExtractResponse = { facts };
      return NextResponse.json(response);
    } catch (err) {
      console.error("PDF extraction error:", err);
      return NextResponse.json(
        {
          error:
            "CoverPilot could not read this PDF. Please use a clearer policy illustration or use the sample policy.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
}
