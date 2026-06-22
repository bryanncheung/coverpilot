import { openai } from "./openai";
import type { PolicyFact } from "@/types";

const EXTRACT_SYSTEM_PROMPT = `You are CoverPilot's policy document extraction engine for Singapore insurance policy illustrations.

Your job is to read raw text from a policy illustration and extract structured facts.

Rules you must follow:
- Only extract facts that are explicitly stated in the document text. Do not infer or guess.
- If a value is not present in the text, do not include it.
- For non-guaranteed values, always note they are non-guaranteed in the label or value.
- Never make recommendations or judgements about the policy.

Return a JSON object with a single "facts" array. Each fact must match this shape:
{
  "id": string (kebab-case, unique, e.g. "annual-premium"),
  "label": string (human-readable label),
  "value": string or number,
  "unit": string or null (e.g. "SGD", "years", "SGD/year"),
  "sourceType": "document-stated" | "calculated-from-document" | "not-found",
  "page": number or null,
  "quote": string (exact quote from the document that supports this fact, max 200 chars)
}

Extract these facts if present:
- Annual premium (and frequency)
- Premium payment term
- Policy term
- Sum assured / death benefit
- Distribution cost (year 1 and subsequent years if available)
- Guaranteed surrender values by year (5, 10, 15, 20 if available)
- Projected (non-guaranteed) surrender values
- Guaranteed vs non-guaranteed breakdown notice
- Any key exclusions or waiting periods
- Policy type (whole life, term, ILP, endowment, etc.)`;

export async function extractFactsFromPDF(pdfBuffer: Buffer): Promise<PolicyFact[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const parsed = await pdfParse(pdfBuffer);
  const text = parsed.text.slice(0, 12000); // stay within token budget

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract structured facts from this Singapore insurance policy document text:\n\n${text}`,
      },
    ],
    temperature: 0,
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}");
  return (raw.facts ?? []) as PolicyFact[];
}
