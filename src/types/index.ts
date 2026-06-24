// Core shared types — build against these, do not create branch-local versions

export type PolicyFact = {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  sourceType:
    | "document-stated"
    | "calculated-from-document"
    | "official-source"
    | "not-found";
  page?: number;
  quote?: string;
};

export type UserStatement = {
  id: string;
  text: string;
  category:
    | "cost"
    | "liquidity"
    | "coverage"
    | "returns"
    | "guarantee"
    | "exclusion"
    | "other";
};

export type SourceComparison = {
  statementId: string;
  state:
    | "matches-document"
    | "partially-matches"
    | "not-found"
    | "needs-source-reconciliation"
    | "calculation-differs";
  documentEvidence: PolicyFact[];
  explanation: string;
  clarificationQuestion: string;
};

export type CalculationCard = {
  id: string;
  title: string;
  formula: string;
  result: string;
  inputs: PolicyFact[];
  caveat: string;
};

export type MeetingPrepReport = {
  policySummary: PolicyFact[];
  comparisons: SourceComparison[];
  calculations: CalculationCard[];
  questionsForLicensedAdviser: string[];
  complianceNotice: string;
};

// API request/response shapes

export type ExtractRequest = {
  mode: "seeded" | "upload";
  policyId?: string;
};

export type ExtractResponse = {
  facts: PolicyFact[];
};

export type CompareRequest = {
  facts: PolicyFact[];
  statements: UserStatement[];
};

export type CompareResponse = {
  comparisons: SourceComparison[];
  calculations: CalculationCard[];
  blocked: boolean;
  source?: "ai" | "demo-fallback";
  blockReason?: string;
};

export type ReportRequest = {
  facts: PolicyFact[];
  comparisons: SourceComparison[];
  calculations: CalculationCard[];
};

export type ReportResponse = {
  report: MeetingPrepReport;
};
