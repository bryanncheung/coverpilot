import type { FinancialQuestionResponse, PolicyFact } from "@/types";
import { checkCompliance, COMPLIANCE_NOTICE } from "@/lib/compliance";
import {
  officialFactsForTopic,
  policyFactsForTopic,
  topicForText,
} from "@/lib/financial-topic-intelligence";

const RELATED_ACTIONS: Record<string, FinancialQuestionResponse["relatedActions"]> = {
  "policy-review-checklist": [
    { label: "Decode the policy document", href: "/decode" },
    { label: "Check what my adviser said", href: "/check" },
    { label: "Prepare meeting pack", href: "/prepare" },
  ],
  "distribution-cost": [
    { label: "Check an adviser cost claim", href: "/check" },
    { label: "Decode a policy document", href: "/decode" },
  ],
  "surrender-liquidity": [
    { label: "Check a surrender claim", href: "/check" },
    { label: "Decode a policy document", href: "/decode" },
  ],
  "guaranteed-vs-projected": [
    { label: "Check a returns claim", href: "/check" },
    { label: "Decode guaranteed values", href: "/decode" },
  ],
  "coverage-adequacy": [
    { label: "Prepare adviser questions", href: "/prepare" },
    { label: "Check a coverage claim", href: "/check" },
  ],
  "claims-exclusions": [
    { label: "Check a claims statement", href: "/check" },
    { label: "Decode exclusions from a document", href: "/decode" },
  ],
  "adviser-process": [
    { label: "Prepare meeting pack", href: "/prepare" },
    { label: "Check what was said", href: "/check" },
  ],
  "general-document": [
    { label: "Decode a financial document", href: "/decode" },
    { label: "Check what my adviser said", href: "/check" },
  ],
};

const PLAIN_ANSWERS: Record<string, string[]> = {
  "policy-review-checklist": [
    "Before signing, check five things: what you must pay, how long you must pay, what protection you get, what happens if you surrender early, and which figures are not guaranteed.",
    "For a whole life policy, the important tables are usually the premium table, benefit or sum assured section, surrender-value table, guaranteed versus non-guaranteed illustration, and distribution-cost disclosure.",
    "If an adviser makes a broad claim like 'low cost', 'flexible', or 'returns are strong', ask them to point to the exact page and row that supports it.",
  ],
  "distribution-cost": [
    "Distribution cost is the amount disclosed in the policy illustration that reflects the cost of distributing the policy, including commission and related distribution expenses.",
    "It does not automatically mean the policy is good or bad. It is a figure to understand alongside your premium, premium term, benefits, and alternatives.",
    "A useful check is to compare the total distribution cost against the total premiums you are expected to pay, then ask your adviser what that cost pays for.",
  ],
  "surrender-liquidity": [
    "Surrender value is the amount you may receive if you terminate the policy before maturity or before the end of coverage.",
    "Being allowed to surrender does not mean you get back everything you paid. Early surrender values can be much lower than total premiums paid.",
    "The clean way to check this is to compare the surrender value in each policy year against the premiums paid up to that year.",
  ],
  "guaranteed-vs-projected": [
    "Guaranteed value is the amount shown as guaranteed by the insurer, assuming the policy conditions are met.",
    "Projected surrender value includes non-guaranteed assumptions, such as bonuses or illustrated investment returns. It can help you understand possible upside, but it is not a promise.",
    "When reading a policy illustration, keep the guaranteed column separate from the projected or non-guaranteed column.",
  ],
  "coverage-adequacy": [
    "Coverage is the amount paid if a covered event happens, but whether it is enough depends on your liabilities, dependents, income, existing cover, and budget.",
    "The policy document can show the benefit amount and key conditions. It usually cannot prove whether the amount is personally enough for you.",
    "Ask your adviser to show the needs analysis behind the coverage amount, not just the product benefit table.",
  ],
  "claims-exclusions": [
    "A claims question depends on the benefit wording, exclusions, waiting periods, and claim conditions.",
    "A policy illustration may summarize benefits, but it may not contain every claim condition. The contract wording matters.",
    "Ask your adviser which exclusions or waiting periods apply to the specific benefit you care about.",
  ],
  "adviser-process": [
    "A good advice process should make the recommendation traceable: what need was identified, what alternatives were considered, and what trade-offs were explained.",
    "The policy document can show product facts, but it cannot show why this product was chosen for you unless the adviser documents that reasoning.",
    "Ask for the basis of advice in plain language, including what was ruled out and why.",
  ],
  "general-document": [
    "Start by separating the statement into checkable parts: premium, coverage, returns, surrender value, costs, exclusions, and assumptions.",
    "Then ask which parts are directly stated in the document and which parts are the adviser's interpretation.",
    "If the statement cannot be tied to a page, row, or official source, treat it as something to clarify before acting.",
  ],
};

function policyContextSentence(policyFacts: PolicyFact[]) {
  if (policyFacts.length === 0) {
    return "If you add a policy document, Claro can connect this explanation to your actual figures.";
  }
  const labels = policyFacts.slice(0, 3).map((fact) => fact.label.toLowerCase());
  return `For your loaded document, the most relevant facts are ${labels.join(", ")}. Use those as anchors when asking your adviser for clarification.`;
}

export function answerFinancialQuestion(
  question: string,
  facts: PolicyFact[] = []
): FinancialQuestionResponse {
  const compliance = checkCompliance(question);
  if (compliance.blocked) {
    return {
      blocked: true,
      blockReason: `${compliance.reason} ${compliance.redirect}`,
    };
  }

  const topic = topicForText(question);
  const policyFacts = policyFactsForTopic(topic, facts);
  const officialFacts = officialFactsForTopic(topic);
  const sourceFacts = [...policyFacts, ...officialFacts];
  const plainAnswer = PLAIN_ANSWERS[topic.id] ?? [
    topic.userFacingFrame,
    "A good way to understand this is to ask which exact document page supports the statement, and which parts depend on assumptions or adviser judgement.",
  ];
  const answer =
    policyFacts.length > 0
      ? [...plainAnswer, policyContextSentence(policyFacts)]
      : plainAnswer;

  return {
    blocked: false,
    topic: topic.label,
    answer,
    sourceFacts,
    officialSourceFacts: officialFacts,
    documentSourceFacts: policyFacts,
    questionsForLicensedAdviser: [
      topic.adviserQuestion,
      "Which part of the answer comes from the policy illustration, and which part comes from your judgement as a licensed adviser?",
      "What would change if the illustrated non-guaranteed values do not materialise?",
    ],
    relatedActions: RELATED_ACTIONS[topic.id],
    complianceNotice: COMPLIANCE_NOTICE,
  };
}
