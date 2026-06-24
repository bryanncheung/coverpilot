import type { PolicyFact, SourceComparison, UserStatement } from "@/types";

function factsById(facts: PolicyFact[], ids: string[]) {
  return ids.map((id) => facts.find((fact) => fact.id === id)).filter(Boolean) as PolicyFact[];
}

function firstAvailableFacts(facts: PolicyFact[], ids: string[]) {
  const selected = factsById(facts, ids);
  return selected.length > 0 ? selected : facts.slice(0, 4);
}

function valueOf(fact?: PolicyFact) {
  if (!fact) return "not found";
  return `${fact.value}${fact.unit ? ` ${fact.unit}` : ""}`;
}

export function compareStatementDeterministically(
  statement: UserStatement,
  facts: PolicyFact[]
): SourceComparison {
  const lower = statement.text.toLowerCase();
  const annualPremium = facts.find((fact) => fact.id === "annual-premium");
  const premiumTerm = facts.find((fact) => fact.id === "premium-term");
  const distributionCost = facts.find((fact) => fact.id === "distribution-cost");
  const sumAssured = facts.find((fact) => fact.id === "sum-assured");
  const guaranteedYear20 = facts.find((fact) => fact.id === "surrender-value-yr20");
  const projectedYear20 = facts.find(
    (fact) => fact.id === "projected-surrender-yr20"
  );
  const nonGuaranteedNotice = facts.find(
    (fact) => fact.id === "non-guaranteed-notice"
  );

  if (statement.category === "cost" || /cost|cheap|expensive|fee|charge|commission/.test(lower)) {
    const evidence = firstAvailableFacts(facts, [
      "annual-premium",
      "premium-term",
      "distribution-cost",
    ]);
    return {
      statementId: statement.id,
      state: "not-found",
      documentEvidence: evidence,
      explanation: `The policy facts show annual premium ${valueOf(annualPremium)}, premium term ${valueOf(premiumTerm)}, and total distribution cost ${valueOf(distributionCost)}. The document does not itself define whether those figures are low or high; that comparison needs a benchmark or adviser explanation.`,
      clarificationQuestion:
        "Which exact policy illustration figures and benchmark are you using when describing the policy cost?",
    };
  }

  if (statement.category === "liquidity" || /access|withdraw|cash out|surrender|liquid/.test(lower)) {
    const evidence = firstAvailableFacts(facts, [
      "surrender-value-yr5",
      "surrender-value-yr10",
      "surrender-value-yr20",
    ]);
    return {
      statementId: statement.id,
      state: "partially-matches",
      documentEvidence: evidence,
      explanation:
        "The policy facts include surrender values, so access through surrender is a policy mechanism. The statement needs qualification because the amount available depends on the policy year and may be below premiums paid, especially earlier in the policy.",
      clarificationQuestion:
        "If I surrender in each policy year, what amount would I receive and how does that compare with premiums paid to date?",
    };
  }

  if (
    statement.category === "returns" ||
    statement.category === "guarantee" ||
    /return|project|interest|savings|guarantee|guaranteed|yield/.test(lower)
  ) {
    const evidence = firstAvailableFacts(facts, [
      "surrender-value-yr20",
      "projected-surrender-yr20",
      "non-guaranteed-notice",
    ]);
    return {
      statementId: statement.id,
      state: projectedYear20 || nonGuaranteedNotice ? "needs-source-reconciliation" : "not-found",
      documentEvidence: evidence,
      explanation: `The policy facts separate guaranteed values (${valueOf(guaranteedYear20)} at year 20 where available) from projected or non-guaranteed values (${valueOf(projectedYear20)} where available). A returns claim needs to specify whether it relies on guaranteed values, projected values, or both.`,
      clarificationQuestion:
        "Can you separate the guaranteed figures from the projected non-guaranteed figures and explain which part your statement relies on?",
    };
  }

  if (statement.category === "coverage" || /cover|coverage|protection|sum assured|death|critical/.test(lower)) {
    const evidence = firstAvailableFacts(facts, ["sum-assured", "exclusion-suicide"]);
    return {
      statementId: statement.id,
      state: "not-found",
      documentEvidence: evidence,
      explanation: `The policy facts show sum assured ${valueOf(sumAssured)} where available, plus any extracted exclusions or conditions. The document alone cannot determine whether that coverage is enough for the user's liabilities, dependents, income, existing assets, or goals.`,
      clarificationQuestion:
        "How did you calculate the proposed coverage amount against my liabilities, dependents, income, existing assets, and existing insurance?",
    };
  }

  if (statement.category === "exclusion" || /exclude|exclusion|waiting|claim|condition/.test(lower)) {
    const evidence = firstAvailableFacts(facts, ["exclusion-suicide"]);
    return {
      statementId: statement.id,
      state: evidence.length > 0 ? "partially-matches" : "not-found",
      documentEvidence: evidence,
      explanation:
        "The evidence record surfaces any extracted exclusions or claim conditions, but the statement should be checked against the full policy contract and benefit schedule before relying on it.",
      clarificationQuestion:
        "Which exact exclusions, waiting periods, and claim conditions apply to this benefit?",
    };
  }

  return {
    statementId: statement.id,
    state: "not-found",
    documentEvidence: facts.slice(0, 4),
    explanation:
      "The extracted policy facts do not directly support this statement. CoverPilot can only compare the statement against facts present in the evidence record.",
    clarificationQuestion:
      "Can you point me to the exact policy illustration page or clause that supports this statement?",
  };
}

export function compareStatementsDeterministically(
  statements: UserStatement[],
  facts: PolicyFact[]
): SourceComparison[] {
  return statements.map((statement) =>
    compareStatementDeterministically(statement, facts)
  );
}
