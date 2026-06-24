import type { PolicyFact, UserStatement } from "@/types";

// Seeded demo: 25-year-old early-career Singaporean, FA meeting tomorrow.
// Whole Life policy illustration — figures to be reviewed by Ayman.
export const SEEDED_POLICY_ID = "demo-wholelife-sg-2026";

export const SEEDED_FACTS: PolicyFact[] = [
  {
    id: "annual-premium",
    label: "Annual Premium",
    value: 3600,
    unit: "SGD/year",
    sourceType: "document-stated",
    page: 2,
    quote:
      "The annual premium payable is S$3,600 for a premium payment term of 20 years.",
  },
  {
    id: "premium-term",
    label: "Premium Payment Term",
    value: 20,
    unit: "years",
    sourceType: "document-stated",
    page: 2,
    quote: "Premium payment term: 20 years.",
  },
  {
    id: "policy-term",
    label: "Policy Term",
    value: "Whole of Life",
    sourceType: "document-stated",
    page: 1,
    quote: "This is a whole of life participating policy.",
  },
  {
    id: "sum-assured",
    label: "Sum Assured (Death Benefit)",
    value: 100000,
    unit: "SGD",
    sourceType: "document-stated",
    page: 3,
    quote:
      "Upon death, the sum assured of S$100,000 is payable together with any accumulated bonuses.",
  },
  {
    id: "distribution-cost",
    label: "Total Distribution Cost",
    value: 10800,
    unit: "SGD",
    sourceType: "document-stated",
    page: 5,
    // TODO(Ayman): confirm against a real Policy Illustration. 15% of total
    // premiums is a representative figure for a healthy 25-yo par whole-life;
    // varies person to person (age, health, loadings).
    quote:
      "Total Distribution Cost over the policy: S$10,800 (approx. 15% of total premiums payable).",
  },
  {
    id: "surrender-value-yr5",
    label: "Guaranteed Surrender Value — Year 5",
    value: 7200,
    unit: "SGD",
    sourceType: "document-stated",
    page: 6,
    quote: "Guaranteed surrender value at end of year 5: S$7,200.",
  },
  {
    id: "surrender-value-yr10",
    label: "Guaranteed Surrender Value — Year 10",
    value: 22500,
    unit: "SGD",
    sourceType: "document-stated",
    page: 6,
    quote: "Guaranteed surrender value at end of year 10: S$22,500.",
  },
  {
    id: "surrender-value-yr20",
    label: "Guaranteed Surrender Value — Year 20",
    value: 58000,
    unit: "SGD",
    sourceType: "document-stated",
    page: 6,
    quote: "Guaranteed surrender value at end of year 20: S$58,000.",
  },
  {
    id: "projected-surrender-yr20",
    label: "Projected (Non-Guaranteed) Surrender Value — Year 20",
    value: 79200,
    unit: "SGD",
    sourceType: "document-stated",
    page: 6,
    quote:
      "Projected surrender value at end of year 20 (illustrated at 4.25% p.a.): S$79,200. This is not guaranteed.",
  },
  {
    id: "non-guaranteed-notice",
    label: "Non-Guaranteed Components",
    value:
      "Bonuses and illustrated returns are not guaranteed and depend on fund performance.",
    sourceType: "document-stated",
    page: 4,
    quote:
      "Non-guaranteed values are based on an illustrated investment rate of return of 4.25% p.a. Actual bonuses will vary.",
  },
  {
    id: "exclusion-suicide",
    label: "Key Exclusion — Suicide",
    value: "Suicide within 1 year of policy inception is excluded.",
    sourceType: "document-stated",
    page: 8,
    quote:
      "This policy does not cover death resulting from suicide within one year of the commencement date.",
  },
];

export const SEEDED_STATEMENTS: UserStatement[] = [
  { id: "s1", text: "This is a low-cost plan.", category: "cost" },
  { id: "s2", text: "I can access my money anytime.", category: "liquidity" },
  { id: "s3", text: "It's a good savings plan.", category: "returns" },
  { id: "s4", text: "The returns are attractive.", category: "returns" },
  { id: "s5", text: "I have enough protection.", category: "coverage" },
];
