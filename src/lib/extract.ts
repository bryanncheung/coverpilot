import { getOpenAI, OPENAI_MODEL } from "./openai";
import type { PolicyFact } from "@/types";

export type ExtractionSource = "ai" | "deterministic-fallback";

export type ExtractionResult = {
  facts: PolicyFact[];
  source: ExtractionSource;
  textLength: number;
  aiError?: string;
};

const EXTRACT_SYSTEM_PROMPT = `You are Claro's policy document extraction engine for Singapore insurance policy illustrations.

Your job is to read raw text from a policy illustration and extract structured facts.

Rules you must follow:
- Only extract facts that are explicitly stated in the document text. Do not infer or guess.
- If a value is not present in the text, do not include it.
- For non-guaranteed values, always note they are non-guaranteed in the label or value.
- Never make recommendations or judgements about the policy.
- Do not extract names, policy numbers, NRIC/passport numbers, phone numbers, addresses, adviser names, dates of birth, or other personal identifiers.
- Prefer policy/product facts from the Cover Page, Product Summary, Policy Illustration, Plan Summary, table of values, and charges/distribution-cost sections.

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
- Product / plan name
- Participating / non-participating / investment-linked / term / whole life / endowment classification
- Plan and rider rows from the plan summary
- Annual premium (and frequency)
- Premium frequency
- Premium payment term
- Policy term
- Coverage amount / sum assured for each main plan or rider
- Sum assured / death benefit
- Total Distribution Cost over the policy if stated — this is the LIA-disclosed figure and should be captured whenever present
- Distribution cost by year if the table provides yearly values
- Guaranteed surrender values by year (5, 10, 15, 20 if available)
- Projected (non-guaranteed) surrender values
- Cash value / maturity value / protection value tables
- Guaranteed vs non-guaranteed breakdown notice
- Illustrated investment rate of return, if stated
- Charges or fees, including policy fees, management fees, insurance charges, surrender charges, or fund charges
- Any key exclusions or waiting periods
- Important cover-page warnings or product-risk statements

Use these canonical IDs whenever the matching value exists:
- product-name
- classification
- annual-premium
- premium-frequency
- premium-term
- policy-term
- sum-assured
- death-benefit
- distribution-cost
- distribution-cost-yr1
- surrender-value-yr5
- surrender-value-yr10
- surrender-value-yr15
- surrender-value-yr20
- surrender-value-yr25
- surrender-value-yr30
- projected-surrender-yr5
- projected-surrender-yr10
- projected-surrender-yr15
- projected-surrender-yr20
- projected-surrender-yr25
- projected-surrender-yr30
- illustrated-low-rate
- illustrated-high-rate
- non-guaranteed-notice`;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function quoteAround(text: string, index: number, length: number) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 120);
  return text.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 200);
}

function cleanMoney(value: string) {
  return Number(value.replace(/[$,\s]/g, ""));
}

function uniqueFacts(facts: PolicyFact[]) {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    if (seen.has(fact.id)) return false;
    seen.add(fact.id);
    return true;
  });
}

function addRegexFact(
  facts: PolicyFact[],
  text: string,
  config: {
    id: string;
    label: string;
    regex: RegExp;
    unit?: string;
    value?: (match: RegExpExecArray) => string | number;
  }
) {
  const match = config.regex.exec(text);
  if (!match) return;
  facts.push({
    id: config.id,
    label: config.label,
    value: config.value ? config.value(match) : match[1]?.trim(),
    unit: config.unit,
    sourceType: "document-stated",
    quote: quoteAround(text, match.index, match[0].length),
  });
}

export function extractFactsDeterministically(rawText: string): PolicyFact[] {
  const text = normalizeText(rawText);
  const facts: PolicyFact[] = [];

  addRegexFact(facts, text, {
    id: "product-name",
    label: "Product / plan name",
    regex: /\b(GREAT\s+(?:Life|Wealth|Term)[A-Za-z0-9\s\-]+?)(?:\s+\(\d+\)|\s+Policy term|\s+Name of Insurer)/i,
    value: (match) => match[1].replace(/\s+/g, " ").trim(),
  });
  addRegexFact(facts, text, {
    id: "annual-premium",
    label: "Annual premium",
    regex: /(?:annual premium payable is|annual premium|basic regular premium:|basic premium:|your plan)\s*(?:per year\s*)?\$?\s*([\d,]+(?:\.\d{2})?)/i,
    unit: "SGD/year",
    value: (match) => cleanMoney(match[1]),
  });
  addRegexFact(facts, text, {
    id: "sum-assured",
    label: "Basic sum assured",
    regex: /basic sum assured:[^$]{0,80}\$\s*([\d,]+(?:\.\d{2})?)/i,
    unit: "SGD",
    value: (match) => cleanMoney(match[1]),
  });
  addRegexFact(facts, text, {
    id: "policy-term",
    label: "Policy term",
    regex: /policy term:?\s*(?:you pay for:)?\s*(whole of life|\d+\s*years?)/i,
    value: (match) => match[1].replace(/\s+/g, " "),
  });
  addRegexFact(facts, text, {
    id: "premium-term",
    label: "Premium payment term",
    regex: /(?:you pay for:|premium term)\s*(whole of life|\d+\s*years?)/i,
    value: (match) => match[1].replace(/\s+/g, " "),
  });
  addRegexFact(facts, text, {
    id: "distribution-cost",
    label: "Total distribution cost",
    regex: /total distribution cost(?: of this product)?(?: is| to-date is)?[^$]{0,140}\$\s*([\d,]+(?:\.\d{2})?)/i,
    unit: "SGD",
    value: (match) => cleanMoney(match[1]),
  });
  addRegexFact(facts, text, {
    id: "distribution-cost-notice",
    label: "Distribution cost notice",
    regex: /(total distribution cost[^.]{40,260}\.)/i,
    value: (match) => match[1].replace(/\s+/g, " ").trim(),
  });
  addRegexFact(facts, text, {
    id: "surrender-value-notice",
    label: "Surrender value notice",
    regex: /(WHAT HAPPENS IF YOU SURRENDER YOUR POLICY EARLY\?[^.]{40,260}\.)/i,
    value: (match) => match[1].replace(/\s+/g, " ").trim(),
  });
  addRegexFact(facts, text, {
    id: "guaranteed-only-notice",
    label: "Guaranteed benefits notice",
    regex: /(guaranteed benefits only[^.]{0,180}\.)/i,
    value: (match) => match[1].replace(/\s+/g, " ").trim(),
  });

  return uniqueFacts(facts).filter(
    (fact) => fact.value !== undefined && String(fact.value).trim().length > 0
  );
}

function describeAIError(error: unknown) {
  if (error && typeof error === "object") {
    const maybe = error as { status?: number; code?: string; message?: string };
    return [maybe.status, maybe.code, maybe.message].filter(Boolean).join(" ");
  }
  return error instanceof Error ? error.message : "Unknown AI extraction error";
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // pdfjs expects these browser primitives in server runtimes. We only extract
  // text, so lightweight shims are enough and avoid native canvas failures on
  // Render/Next.
  const globals = globalThis as Record<string, unknown>;
  const DOMMatrixShim = class DOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    scaleSelf() {
      return this;
    }
    translateSelf() {
      return this;
    }
    multiplySelf() {
      return this;
    }
  };
  const ImageDataShim = class ImageData {
    constructor(
      public data: Uint8ClampedArray,
      public width: number,
      public height: number
    ) {}
  };
  const Path2DShim = class Path2D {};
  globals["DOMMatrix"] ??= DOMMatrixShim;
  globals["ImageData"] ??= ImageDataShim;
  globals["Path2D"] ??= Path2DShim;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { pathToFileURL } = await import("node:url");
  const path = await import("node:path");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" ")
      );
      page.cleanup();
    }
    return pageTexts.join("\n\n");
  } finally {
    await doc.destroy();
  }
}

async function extractFactsWithAI(text: string): Promise<PolicyFact[]> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
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

export async function extractFactsFromPDF(pdfBuffer: Buffer): Promise<ExtractionResult> {
  const fullText = await extractTextFromPDF(pdfBuffer);
  const text = fullText.slice(0, 12000); // stay within token budget
  const fallbackFacts = extractFactsDeterministically(fullText);

  if (!text.trim()) {
    return {
      facts: fallbackFacts,
      source: "deterministic-fallback",
      textLength: 0,
      aiError: "PDF text extraction returned no text.",
    };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      facts: fallbackFacts,
      source: "deterministic-fallback",
      textLength: fullText.length,
      aiError: "OPENAI_API_KEY is not configured.",
    };
  }

  try {
    const aiFacts = await extractFactsWithAI(text);
    if (aiFacts.length >= 3) {
      return {
        facts: aiFacts,
        source: "ai",
        textLength: fullText.length,
      };
    }
    return {
      facts: fallbackFacts.length > aiFacts.length ? fallbackFacts : aiFacts,
      source: "deterministic-fallback",
      textLength: fullText.length,
      aiError: `AI extraction returned only ${aiFacts.length} facts.`,
    };
  } catch (error) {
    return {
      facts: fallbackFacts,
      source: "deterministic-fallback",
      textLength: fullText.length,
      aiError: describeAIError(error),
    };
  }
}
