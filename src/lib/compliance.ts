// Decision Firewall — blocks prompts that cross into financial advice territory.
// Any free-text input must pass through checkCompliance before AI processing.

const BLOCKED_PATTERNS = [
  /should i (buy|get|take|purchase|keep|cancel|switch|drop|hold)/i,
  /which (policy|plan|product) is (better|best|worse|worst)/i,
  /is this (policy|plan|product) (good|bad|suitable|right|worth it)/i,
  /recommend(ed)? (me|for me|a policy|a plan)/i,
  /worth (buying|getting|it)/i,
  /better (than|off with)/i,
  /should i (renew|surrender|lapse)/i,
  /tell me (what|which) (to|policy|plan)/i,
];

export type ComplianceResult =
  | { blocked: false }
  | { blocked: true; reason: string; redirect: string };

export function checkCompliance(input: string): ComplianceResult {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(input)) {
      return {
        blocked: true,
        reason:
          "Claro does not make buying, keeping, cancelling, or switching recommendations. This is a regulated financial advisory activity that requires a licensed adviser.",
        redirect:
          "Claro can extract facts from your policy document, compare statements against source text, and prepare questions for a licensed adviser. Would you like to do that instead?",
      };
    }
  }
  return { blocked: false };
}

export const COMPLIANCE_NOTICE =
  "Claro extracts facts, compares statements, and prepares questions. It does not recommend what to buy, keep, cancel, or switch. Consult a licensed financial adviser before making any insurance decisions.";

// Words that must not appear in generated outputs
export const UNSAFE_OUTPUT_WORDS = [
  "misleading",
  "wrong",
  "hidden",
  "bad",
  "best",
  "worst",
  "suitable",
  "unsuitable",
  "recommend",
  "should buy",
  "should cancel",
  "should switch",
  "should keep",
];
