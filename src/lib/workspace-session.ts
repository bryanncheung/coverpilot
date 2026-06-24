import type {
  CalculationCard,
  CaseEvent,
  MeetingPrepReport,
  PolicyFact,
  SourceComparison,
  UserContext,
  UserStatement,
} from "@/types";

export type PolicyWorkspaceSource = "sample" | "uploaded" | "sample-fallback";

export type PolicyWorkspace = {
  facts: PolicyFact[];
  source: PolicyWorkspaceSource;
  savedAt: string;
};

export type CheckWorkspace = {
  statements: UserStatement[];
  comparisons: SourceComparison[];
  calculations: CalculationCard[];
  savedAt: string;
};

export type CaseWorkspace = {
  id: string;
  context: UserContext;
  facts: PolicyFact[];
  factsSource: PolicyWorkspaceSource;
  statements: UserStatement[];
  comparisons: SourceComparison[];
  calculations: CalculationCard[];
  reviewSource?: "ai" | "demo-fallback";
  report: MeetingPrepReport | null;
  events: CaseEvent[];
  updatedAt: string;
};

const POLICY_KEY = "coverpilot_policy_workspace";
const CHECK_KEY = "coverpilot_check_workspace";
const CASE_KEY = "coverpilot_case_workspace";

export const DEFAULT_USER_CONTEXT: UserContext = {
  situation: "FA meeting tomorrow",
  age: "25",
  income: "S$4,000/month",
  dependents: "No dependents declared",
  currentCover: "Basic employer coverage",
  concern: "I want to know what the policy document supports before deciding what to ask.",
};

export function createCaseEvent(title: string, detail: string): CaseEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString("en-SG", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    title,
    detail,
  };
}

export function createEmptyCaseWorkspace(): CaseWorkspace {
  return {
    id: `CP-${new Date().getFullYear()}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`,
    context: DEFAULT_USER_CONTEXT,
    facts: [],
    factsSource: "sample",
    statements: [],
    comparisons: [],
    calculations: [],
    report: null,
    events: [
      createCaseEvent(
        "Case opened",
        "A new insurance evidence workspace was created."
      ),
    ],
    updatedAt: new Date().toISOString(),
  };
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function savePolicyWorkspace(
  facts: PolicyFact[],
  source: PolicyWorkspaceSource
) {
  if (!canUseLocalStorage()) return;
  const payload: PolicyWorkspace = {
    facts,
    source,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(POLICY_KEY, JSON.stringify(payload));
  window.localStorage.removeItem(CHECK_KEY);
}

export function loadPolicyWorkspace(): PolicyWorkspace | null {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(POLICY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PolicyWorkspace;
    if (!Array.isArray(parsed.facts) || !parsed.source) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPolicyWorkspace() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(POLICY_KEY);
  window.localStorage.removeItem(CHECK_KEY);
}

export function saveCheckWorkspace(
  statements: UserStatement[],
  comparisons: SourceComparison[],
  calculations: CalculationCard[]
) {
  if (!canUseLocalStorage()) return;
  const payload: CheckWorkspace = {
    statements,
    comparisons,
    calculations,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(CHECK_KEY, JSON.stringify(payload));
}

export function loadCheckWorkspace(): CheckWorkspace | null {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(CHECK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckWorkspace;
    if (
      !Array.isArray(parsed.statements) ||
      !Array.isArray(parsed.comparisons) ||
      !Array.isArray(parsed.calculations)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCaseWorkspace(workspace: CaseWorkspace) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(
    CASE_KEY,
    JSON.stringify({ ...workspace, updatedAt: new Date().toISOString() })
  );
}

export function loadCaseWorkspace(): CaseWorkspace | null {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(CASE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CaseWorkspace;
    if (!parsed.id || !parsed.context || !Array.isArray(parsed.events)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function updateCaseWorkspace(
  updater: (workspace: CaseWorkspace) => CaseWorkspace
): CaseWorkspace {
  const current = loadCaseWorkspace() ?? createEmptyCaseWorkspace();
  const next = updater(current);
  saveCaseWorkspace(next);
  return { ...next, updatedAt: new Date().toISOString() };
}

export function clearCaseWorkspace() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(CASE_KEY);
  window.localStorage.removeItem(POLICY_KEY);
  window.localStorage.removeItem(CHECK_KEY);
}
