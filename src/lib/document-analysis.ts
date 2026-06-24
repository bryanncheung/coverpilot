import type { CalculationCard, PolicyFact } from "@/types";
import { runCalculations } from "@/lib/calculations";

export type DocumentAnalysisMetric = {
  label: string;
  value: string;
  note: string;
};

export type DocumentAnalysisSection = {
  title: string;
  body: string;
  facts: PolicyFact[];
};

export type DocumentAnalysis = {
  summary: DocumentAnalysisMetric[];
  calculations: CalculationCard[];
  sections: DocumentAnalysisSection[];
  sustainabilityQuestions: string[];
};

function factById(facts: PolicyFact[], ...ids: string[]) {
  return facts.find((fact) => ids.includes(fact.id));
}

function factsByIds(facts: PolicyFact[], ...ids: string[]) {
  return facts.filter((fact) => ids.includes(fact.id));
}

function money(value: number) {
  if (!Number.isFinite(value)) return "not found";
  return `S$${Math.round(value).toLocaleString("en-SG")}`;
}

function numberFromFact(fact?: PolicyFact) {
  if (!fact) return null;
  if (typeof fact.value === "number") return fact.value;
  const parsed = Number(String(fact.value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function yearsFromFact(fact?: PolicyFact) {
  if (!fact) return null;
  const value = String(fact.value).toLowerCase();
  if (value.includes("whole")) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function productType(facts: PolicyFact[]) {
  const classification = String(
    factById(facts, "classification", "product-classification")?.value ?? ""
  ).toLowerCase();
  const product = String(factById(facts, "product-name")?.value ?? "").toLowerCase();
  const joined = `${classification} ${product}`;
  if (joined.includes("term")) return "term";
  if (joined.includes("investment") || joined.includes("linked") || joined.includes("ilp")) return "ilp";
  if (joined.includes("whole")) return "whole-life";
  if (joined.includes("endowment")) return "endowment";
  return "insurance";
}

function distributionCostRatio(facts: PolicyFact[]) {
  const annualPremium = numberFromFact(factById(facts, "annual-premium"));
  const premiumTerm = yearsFromFact(factById(facts, "premium-term"));
  const distributionCost = numberFromFact(factById(facts, "distribution-cost"));
  if (!annualPremium || !premiumTerm || !distributionCost) return null;
  const totalPremiums = annualPremium * premiumTerm;
  return {
    distributionCost,
    totalPremiums,
    ratio: distributionCost / totalPremiums,
  };
}

function realValueAtMaturity(value: number | null, years: number | null, inflation = 0.025) {
  if (!value || !years) return null;
  return value / Math.pow(1 + inflation, years);
}

function estimateBreakeven(facts: PolicyFact[]) {
  const annualPremium = numberFromFact(factById(facts, "annual-premium"));
  if (!annualPremium) return null;
  const points = [
    { year: 5, fact: factById(facts, "surrender-value-yr5", "projected-surrender-yr5") },
    { year: 10, fact: factById(facts, "surrender-value-yr10", "projected-surrender-yr10") },
    { year: 15, fact: factById(facts, "surrender-value-yr15", "projected-surrender-yr15") },
    { year: 20, fact: factById(facts, "surrender-value-yr20", "projected-surrender-yr20") },
    { year: 25, fact: factById(facts, "surrender-value-yr25", "projected-surrender-yr25") },
    { year: 30, fact: factById(facts, "surrender-value-yr30", "projected-surrender-yr30") },
  ]
    .map((point) => ({
      year: point.year,
      value: numberFromFact(point.fact),
      fact: point.fact,
    }))
    .filter((point): point is { year: number; value: number; fact: PolicyFact } => point.value !== null && !!point.fact);

  const first = points.find((point) => point.value >= annualPremium * point.year);
  if (!first) return points.length ? { label: "Not shown in available rows", point: points[points.length - 1] } : null;
  return { label: `Around year ${first.year}`, point: first };
}

function buildSummary(facts: PolicyFact[]): DocumentAnalysisMetric[] {
  const annualPremium = numberFromFact(factById(facts, "annual-premium"));
  const premiumTerm = yearsFromFact(factById(facts, "premium-term"));
  const policyTerm = yearsFromFact(factById(facts, "policy-term"));
  const sumAssured = numberFromFact(factById(facts, "sum-assured", "death-benefit"));
  const costRatio = distributionCostRatio(facts);
  const breakeven = estimateBreakeven(facts);
  const projectedMaturity = numberFromFact(
    factById(facts, "projected-surrender-yr20", "projected-surrender-yr25", "projected-surrender-yr30")
  );
  const realMaturity = realValueAtMaturity(projectedMaturity, policyTerm ?? premiumTerm ?? 20);

  return [
    {
      label: "Premium commitment",
      value: annualPremium && premiumTerm ? `${money(annualPremium * premiumTerm)} over ${premiumTerm} years` : annualPremium ? `${money(annualPremium)} per year` : "not found",
      note: "Computed from annual premium and premium payment term where available.",
    },
    {
      label: "Protection amount",
      value: sumAssured ? money(sumAssured) : "not found",
      note: "This is the document-stated coverage or death benefit amount, not a suitability assessment.",
    },
    {
      label: "Distribution cost load",
      value: costRatio ? `${money(costRatio.distributionCost)} (${(costRatio.ratio * 100).toFixed(1)}% of total premiums)` : "not found",
      note: "Distribution cost is already priced into the policy, not an extra bill.",
    },
    {
      label: "Breakeven",
      value: breakeven?.label ?? "not enough surrender data",
      note: "Breakeven means the first extracted row where surrender value is at least premiums paid to date.",
    },
    {
      label: "Projected value in today's dollars",
      value: realMaturity ? money(realMaturity) : "not enough maturity data",
      note: "Nominal projected values are discounted at 2.5% inflation to show purchasing-power impact.",
    },
  ];
}

function buildSections(facts: PolicyFact[]): DocumentAnalysisSection[] {
  const type = productType(facts);
  const annualPremium = numberFromFact(factById(facts, "annual-premium"));
  const premiumTerm = yearsFromFact(factById(facts, "premium-term"));
  const costRatio = distributionCostRatio(facts);
  const breakeven = estimateBreakeven(facts);
  const distributionFacts = factsByIds(facts, "distribution-cost", "distribution-cost-notice");
  const surrenderFacts = factsByIds(
    facts,
    "surrender-value-notice",
    "surrender-value-yr5",
    "surrender-value-yr10",
    "surrender-value-yr15",
    "surrender-value-yr20",
    "projected-surrender-yr20"
  );
  const projectionFacts = facts.filter((fact) =>
    /projected|non-guaranteed|illustrated|return/i.test(`${fact.id} ${fact.label} ${fact.value}`)
  );

  return [
    {
      title: "Premium and commitment",
      body:
        annualPremium && premiumTerm
          ? `The document implies a total premium commitment of ${money(annualPremium * premiumTerm)} if premiums are paid for ${premiumTerm} years. This is a cash-flow fact, not advice on affordability.`
          : "The document did not expose enough structured premium-term data to compute the full premium commitment. Ask the adviser to identify the total premium row and payment term.",
      facts: factsByIds(facts, "annual-premium", "premium-term", "policy-term"),
    },
    {
      title: "Distribution cost and adviser economics",
      body: costRatio
        ? `The disclosed distribution cost is ${money(costRatio.distributionCost)}, equal to ${(costRatio.ratio * 100).toFixed(1)}% of the total premiums used in this calculation. This frames how much of the policy economics is distribution-related without judging the product.`
        : "Distribution cost was not extracted cleanly enough for a ratio. The useful follow-up is to ask for the Total Distribution Cost table and whether it covers the basic plan only or riders too.",
      facts: distributionFacts,
    },
    {
      title: "Surrender, liquidity, and breakeven",
      body:
        type === "term"
          ? "This appears to behave like a term-style product: no surrender value is expected by design. The key question is coverage duration, renewability, exclusions, and premium sustainability."
          : breakeven
            ? `The extracted surrender data suggests breakeven ${breakeven.label.toLowerCase()}. Before that point, stopping the policy may return less than premiums paid, depending on the actual surrender table.`
            : "Claro did not extract enough surrender rows to compute breakeven. This is one of the most important tables to ask the adviser to walk through.",
      facts: surrenderFacts,
    },
    {
      title: "Guaranteed versus projected values",
      body:
        projectionFacts.length > 0
          ? "Projected or illustrated values are not the same as guaranteed values. Treat them as scenario outputs and ask which column is guaranteed, which is non-guaranteed, and what assumptions drive the gap."
          : "No projected-value facts were extracted. If the policy has savings or investment value, ask for the guaranteed and non-guaranteed columns separately.",
      facts: projectionFacts,
    },
  ];
}

function buildSustainabilityQuestions(facts: PolicyFact[]): string[] {
  const annualPremium = numberFromFact(factById(facts, "annual-premium"));
  const premiumTerm = yearsFromFact(factById(facts, "premium-term"));
  const sumAssured = numberFromFact(factById(facts, "sum-assured", "death-benefit"));
  const costRatio = distributionCostRatio(facts);
  const breakeven = estimateBreakeven(facts);

  return [
    annualPremium
      ? `If your income drops next year, can you still pay ${money(annualPremium)} per year without using emergency savings?`
      : "Can you identify the exact annual premium and payment frequency in the document?",
    premiumTerm
      ? `Are you comfortable committing to a ${premiumTerm}-year premium payment period?`
      : "Can your adviser confirm how many years premiums must be paid?",
    sumAssured
      ? `Is the ${money(sumAssured)} protection amount meant to cover death, critical illness, TPD, or a mix of benefits?`
      : "Can your adviser point to the exact benefit amount and what event triggers it?",
    costRatio
      ? `Do you understand that ${money(costRatio.distributionCost)} is disclosed as distribution cost within the policy economics?`
      : "Can your adviser show the Total Distribution Cost table and explain whether riders are included?",
    breakeven
      ? `Are you comfortable waiting until ${breakeven.label.toLowerCase()} before extracted surrender values appear to catch up with premiums paid?`
      : "Can your adviser show the surrender table row where surrender value first meets premiums paid?",
  ];
}

export function buildDocumentAnalysis(facts: PolicyFact[]): DocumentAnalysis {
  return {
    summary: buildSummary(facts),
    calculations: runCalculations(facts),
    sections: buildSections(facts),
    sustainabilityQuestions: buildSustainabilityQuestions(facts),
  };
}
