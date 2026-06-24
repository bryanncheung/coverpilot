import type { PolicyFact } from "@/types";

// Official-source reference snippets (MoneySense / LIA Singapore).
// These are verbatim, attributable statements used to give regulator-grade
// context next to a user's policy facts. sourceType is always "official-source".
// They are NOT advice and NOT specific to any one policy — they explain how
// distribution cost, guaranteed-vs-non-guaranteed values, and illustrated
// rates work in the Singapore market.
//
// Each entry carries the exact quote, the issuing body, and the source URL so
// the app can cite it transparently. Last verified: 2026-06-24.

export type OfficialSource = {
  id: string;
  topic: "distribution-cost" | "guaranteed-vs-non-guaranteed" | "illustrated-rate" | "early-surrender";
  body: "MoneySense" | "LIA Singapore";
  quote: string;
  url: string;
  verifiedOn: string;
};

export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: "ms-distribution-cost",
    topic: "distribution-cost",
    body: "MoneySense",
    quote:
      "There may be no cash value in the first three years after policy inception as most of the premiums have been used to offset the total distribution costs of such products (e.g. commissions and benefits paid to your financial adviser).",
    url: "https://www.moneysense.gov.sg/understanding-whole-life-insurance/",
    verifiedOn: "2026-06-24",
  },
  {
    id: "ms-policy-illustration",
    topic: "distribution-cost",
    body: "MoneySense",
    quote:
      "A policy illustration provides the benefits or projected amounts payable in a claim or early termination of the policy, including total cash values and death benefits, premiums and cost of distribution and charges.",
    url: "https://www.moneysense.gov.sg/interpreting-your-insurance-documents/",
    verifiedOn: "2026-06-24",
  },
  {
    id: "lia-total-distribution-cost",
    topic: "distribution-cost",
    body: "LIA Singapore",
    quote:
      "The total costs of distribution table shows the total costs that an insurer expects to incur in relation to your policy, including the cost of any financial advice provided to you. The Total Distribution Cost To-date is the sum of each year's expected distribution-related costs, without interest.",
    url: "https://www.lia.org.sg/industry-guidelines/industry-practices/2024/lia-guidelines-on-policy-illustrations-cover-page-and-bundled-product-disclosure/",
    verifiedOn: "2026-06-24",
  },
  {
    id: "ms-guaranteed-vs-non-guaranteed",
    topic: "guaranteed-vs-non-guaranteed",
    body: "MoneySense",
    quote:
      "A portion of the total illustrated cash values for participating plans and ILPs is not guaranteed. How much you get in bonuses depends on factors such as the par fund's investment performance and future outlook, amounts paid as claims and expenses incurred by the par fund.",
    url: "https://www.moneysense.gov.sg/participating-versus-non-participating-policies/",
    verifiedOn: "2026-06-24",
  },
  {
    id: "lia-illustrated-rate",
    topic: "illustrated-rate",
    body: "LIA Singapore",
    quote:
      "Following the latest revision effective 1 July 2021, the revised cap is 4.25% p.a. for the Upper Illustration Rate, and the resulting cap for the Lower Illustration Rate is 3.00%. These rates are used purely for illustrative purposes and do not represent upper and lower limits of the investment performance of an insurer's Par Fund.",
    url: "https://www.lia.org.sg/tools-and-resources/illustrated-investment-rate-of-return-for-par-policies/",
    verifiedOn: "2026-06-24",
  },
];

// Expose the snippets as PolicyFacts so they can sit alongside document facts
// in the evidence desk (sourceType: "official-source").
export const OFFICIAL_SOURCE_FACTS: PolicyFact[] = OFFICIAL_SOURCES.map((s) => ({
  id: s.id,
  label: `${s.body} — ${s.topic.replace(/-/g, " ")}`,
  value: s.quote,
  sourceType: "official-source",
  quote: s.quote,
}));

export function officialSourcesForTopic(
  topic: OfficialSource["topic"]
): OfficialSource[] {
  return OFFICIAL_SOURCES.filter((s) => s.topic === topic);
}
