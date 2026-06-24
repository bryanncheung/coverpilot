import { getOpenAI, OPENAI_MODEL } from "./openai";
import type { PolicyFact, UserStatement, SourceComparison } from "@/types";

const SYSTEM_PROMPT = `You are Claro's evidence comparison engine for Singapore insurance policy documents.

Your job is to compare a statement made in an insurance sales conversation against policy facts extracted from a document and public guidance snippets from MoneySense or LIA Singapore.

Rules you must follow without exception:
- Never recommend what to buy, keep, cancel, or switch.
- Never use the words: misleading, wrong, hidden, bad, best, worst, suitable, unsuitable, recommend, should buy, should cancel, should switch, should keep.
- Never give a personal verdict on whether the policy is good or bad for the user.
- Only compare what the statement claims against the provided evidence.
- Treat sourceType "document-stated" and "calculated-from-document" as policy-specific evidence.
- Treat sourceType "official-source" as general public guidance. Use it for context, but do not pretend it appears in the user's policy document.
- Always cite the provided evidence directly.
- Always generate a neutral clarification question the user can ask a licensed adviser.

You must return a JSON object with exactly these fields:
{
  "state": one of ["matches-document", "partially-matches", "not-found", "needs-source-reconciliation", "calculation-differs"],
  "explanation": string (2-4 sentences, factual, no advice),
  "clarificationQuestion": string (neutral question for a licensed adviser),
  "evidenceIds": string[] (ids of PolicyFacts that are relevant)
}

State definitions:
- matches-document: the statement is directly and fully supported by the document text.
- partially-matches: the statement is literally true but omits a material caveat, or is true only under certain conditions (e.g. "I can access my money anytime" — surrender is possible anytime, but early surrender value is far below premiums paid).
- not-found: the document has no basis to confirm or deny the statement. This INCLUDES subjective or person-dependent judgments that the document cannot adjudicate (e.g. "low-cost", "good plan", "enough protection") — these are not-found even when related facts exist in the document. In these cases, surface the relevant facts in the explanation as neutral context, but do not return a verdict.
- needs-source-reconciliation: the document contains two or more relevant figures that conflict or split, and the user must reconcile which one the statement refers to before it can be judged (e.g. returns shown as guaranteed (lower) vs non-guaranteed projected (higher)). Reconcile within the document only; do not compare against other plans — defer any cross-plan comparison to the clarification question for the licensed adviser.
- calculation-differs: the statement makes a numerical claim, and running the document's figures through a calculation produces a result that contradicts that claim.`;

export async function compareStatementWithAI(
  statement: UserStatement,
  facts: PolicyFact[]
): Promise<SourceComparison> {
  const openai = getOpenAI();
  const factsText = facts
    .map(
      (f) =>
        `[${f.id}] ${f.label}: ${f.value}${f.unit ? " " + f.unit : ""}${f.quote ? ` — "${f.quote}"` : ""}`
    )
    .join("\n");

  const userMessage = `Statement from sales conversation: "${statement.text}"
Category: ${statement.category}

Available evidence:
${factsText}

Compare the statement against the document facts and return JSON.`;

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0,
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}");

  const evidenceFacts = facts.filter((f) =>
    (raw.evidenceIds ?? []).includes(f.id)
  );

  return {
    statementId: statement.id,
    state: raw.state,
    documentEvidence: evidenceFacts,
    explanation: raw.explanation,
    clarificationQuestion: raw.clarificationQuestion,
  };
}
