import { openai } from "./openai";
import type { PolicyFact, UserStatement, SourceComparison } from "@/types";

const SYSTEM_PROMPT = `You are CoverPilot's evidence comparison engine for Singapore insurance policy documents.

Your job is to compare a statement made in an insurance sales conversation against the facts extracted from a policy illustration document.

Rules you must follow without exception:
- Never recommend what to buy, keep, cancel, or switch.
- Never use the words: misleading, wrong, hidden, bad, best, worst, suitable, unsuitable, recommend.
- Never give a personal verdict on whether the policy is good or bad for the user.
- Only compare what the statement claims against what the document says.
- Always cite the document evidence directly.
- Always generate a neutral clarification question the user can ask a licensed adviser.

You must return a JSON object with exactly these fields:
{
  "state": one of ["matches-document", "partially-matches", "not-found", "needs-source-reconciliation", "calculation-differs"],
  "explanation": string (2-4 sentences, factual, no advice),
  "clarificationQuestion": string (neutral question for a licensed adviser),
  "evidenceIds": string[] (ids of PolicyFacts that are relevant)
}

State definitions:
- matches-document: the statement is directly supported by the document text
- partially-matches: the statement is partially supported but missing important caveats or context
- not-found: the document does not contain information to verify or contradict the statement
- needs-source-reconciliation: the statement cannot be verified from the document alone and requires an official source
- calculation-differs: the statement makes a numerical claim that differs from what the document figures show`;

export async function compareStatementWithAI(
  statement: UserStatement,
  facts: PolicyFact[]
): Promise<SourceComparison> {
  const factsText = facts
    .map(
      (f) =>
        `[${f.id}] ${f.label}: ${f.value}${f.unit ? " " + f.unit : ""}${f.quote ? ` — "${f.quote}"` : ""}`
    )
    .join("\n");

  const userMessage = `Statement from sales conversation: "${statement.text}"
Category: ${statement.category}

Policy document facts:
${factsText}

Compare the statement against the document facts and return JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
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
