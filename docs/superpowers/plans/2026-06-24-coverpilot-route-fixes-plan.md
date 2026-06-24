# Claro Route Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three core product routes so Check can use an uploaded policy illustration, Decode can reliably process uploaded PIs or explain the real failure, and Ask behaves like a clean consumer chatbot without leaking irrelevant sample policy facts.

**Architecture:** Keep the current three-route front door. Extract shared PDF upload and question-answer presentation logic into small local helpers/components so each route remains focused. Use official/public source snippets for general questions, and policy facts only when the user has explicitly uploaded or selected a document in the current route.

**Tech Stack:** Next.js App Router, React client components, TypeScript, localStorage workspace state, `pdf-parse`, OpenAI chat completions, existing Claro compliance guardrails.

## Global Constraints

- Consumer copy stays simple: "Understand financial advice before you act on it."
- No consumer-facing "evidence desk" framing.
- Do not preload sample policy figures into user routes.
- Sample data may appear only after explicit "Try sample" action.
- Never recommend what to buy, keep, cancel, or switch.
- Ask and Check can be chatbot-like, but answers must be source-backed and easy to read.
- General Ask answers must not show policy-specific examples unless the user attached or selected a document for that question.
- Decode must expose specific upload/extraction errors instead of replacing every server error with "Could not read the document."

---

## Current Root-Cause Findings

1. Check route has no upload path.
   - `src/app/(workspace)/check/page.tsx` only reads `loadPolicyWorkspace()` once at page load.
   - If no document is loaded, the user can paste a claim but cannot upload the PI from the same route.
   - This does not match the real user journey because checking an adviser claim usually needs the related policy illustration.

2. Decode route hides the real error.
   - `src/app/(workspace)/decode/page.tsx` throws a generic error whenever `/api/policy/extract` returns non-2xx.
   - `/api/policy/extract` already returns specific errors for missing API key, invalid PDF, too large PDF, and low extraction quality, but the UI discards them.
   - Local parser reproduction against `sample-policy-illustrations/Benefit Illustration.pdf` succeeds and extracts 21k+ characters, so the likely failure is after parsing: missing/misconfigured `OPENAI_API_KEY`, OpenAI extraction error, response-shape issue, or the current "facts length < 3" threshold.

3. Ask route leaks stale/sample policy facts.
   - `src/app/(workspace)/ask/page.tsx` loads policy facts from localStorage automatically.
   - `src/lib/financial-qa.ts` calls `policyFactsForTopic(topic, facts)`.
   - `policyFactsForTopic()` falls back to `facts.slice(0, 4)` when no exact topic facts match.
   - This causes general questions like "What should I check before signing a whole life policy?" to show irrelevant annual premium and policy examples from old/sample workspace facts.

## File Map

- Modify: `src/app/(workspace)/check/page.tsx`
  - Add inline PDF upload/decoded document state.
  - Let user attach policy illustration before running a claim check.
  - Keep claim splitting and comparison focused.

- Modify: `src/app/(workspace)/decode/page.tsx`
  - Read error body from `/api/policy/extract`.
  - Show specific, useful error messages.
  - Keep page visually simple.

- Modify: `src/app/(workspace)/ask/page.tsx`
  - Treat Ask as a chatbot-first route.
  - Default to public guidance only.
  - Add an explicit optional "Use loaded document context" toggle or attach-document action.
  - Present answer first, then sources, then adviser questions.

- Modify: `src/lib/financial-qa.ts`
  - Stop falling back to arbitrary policy facts.
  - Generate plain-English answers by topic.
  - Return source groups that separate public guidance from document facts.

- Modify: `src/lib/financial-topic-intelligence.ts`
  - Change `policyFactsForTopic()` so it returns an empty array when no matching policy facts exist.
  - Preserve official source selection.

- Modify: `src/app/api/policy/extract/route.ts`
  - Add diagnostic-safe error metadata.
  - Return extraction preview count/text length in development only if useful.
  - Do not log or return personal data.

- Optional Create: `src/components/policy-upload-card.tsx`
  - Shared upload component used by Check and Decode.
  - Keeps upload UI consistent without bloating route pages.

---

## Task 1: Make Decode Errors Honest and Actionable

**Files:**
- Modify: `src/app/(workspace)/decode/page.tsx`
- Modify: `src/app/api/policy/extract/route.ts`

**Interfaces:**
- Consumes: existing `/api/policy/extract` response shape.
- Produces: UI error handling that displays `{ error: string }` from API responses.

- [ ] **Step 1: Add a helper in Decode to read API error bodies**

Add this inside `DecodePage`, above `extractFacts()`:

```ts
async function readUploadError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? "Could not read the document. Please try again.";
  } catch {
    return "Could not read the document. Please try again.";
  }
}
```

- [ ] **Step 2: Replace the generic upload error**

In `extractFacts()`, replace:

```ts
if (!res.ok) throw new Error("Could not read the document. Please try again.");
```

with:

```ts
if (!res.ok) throw new Error(await readUploadError(res));
```

- [ ] **Step 3: Make the API distinguish extraction failure from low-confidence extraction**

In `src/app/api/policy/extract/route.ts`, keep the existing catch but make the messages specific:

```ts
if (facts.length < 3) {
  return NextResponse.json(
    {
      error:
        "Claro could read the PDF, but could not extract enough policy facts. Try a clearer policy illustration PDF or use the sample policy for the demo.",
    },
    { status: 422 }
  );
}
```

Keep the generic catch for parser/OpenAI failures:

```ts
return NextResponse.json(
  {
    error:
      "Claro could not finish extracting this PDF. Check that OPENAI_API_KEY is set on Render and that the uploaded file is a text-readable policy illustration.",
  },
  { status: 500 }
);
```

- [ ] **Step 4: Verify with a known PDF**

Run locally:

```bash
npm run build
```

Expected: build passes.

Then manually upload:

```text
sample-policy-illustrations/Benefit Illustration.pdf
```

Expected:
- If OpenAI key is configured: extracted facts appear.
- If OpenAI key is missing: UI shows the specific API key message.
- If OpenAI extraction fails: UI says extraction failed after reading the PDF, not the vague "could not read."

- [ ] **Step 5: Commit**

```bash
git add src/app/'(workspace)'/decode/page.tsx src/app/api/policy/extract/route.ts
git commit -m "Fix policy upload error handling"
```

---

## Task 2: Add Policy Illustration Upload to Check Route

**Files:**
- Modify: `src/app/(workspace)/check/page.tsx`
- Optional Create: `src/components/policy-upload-card.tsx`

**Interfaces:**
- Consumes: `/api/policy/extract`.
- Produces: `facts` state in Check that can come from upload, sample, or previous workspace.

- [ ] **Step 1: Change Check policy fact state from read-only to mutable**

Replace:

```ts
const [facts] = useState<PolicyFact[]>(() => policyWorkspace?.facts ?? []);
const [policySource] = useState<PolicyWorkspaceSource>(
  () => policyWorkspace?.source ?? "sample"
);
```

with:

```ts
const [facts, setFacts] = useState<PolicyFact[]>(() => policyWorkspace?.facts ?? []);
const [policySource, setPolicySource] = useState<PolicyWorkspaceSource>(
  () => policyWorkspace?.source ?? "uploaded"
);
const [uploadingPolicy, setUploadingPolicy] = useState(false);
const [uploadError, setUploadError] = useState<string | null>(null);
```

- [ ] **Step 2: Add file input and upload handler**

Add:

```ts
async function readUploadError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? "Could not read the policy illustration.";
  } catch {
    return "Could not read the policy illustration.";
  }
}

async function uploadPolicy(file: File) {
  if (file.type !== "application/pdf") {
    setUploadError("Please upload a PDF policy illustration.");
    return;
  }

  setUploadingPolicy(true);
  setUploadError(null);

  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/policy/extract", { method: "POST", body: form });
    if (!res.ok) throw new Error(await readUploadError(res));
    const data = (await res.json()) as { facts: PolicyFact[] };
    setFacts(data.facts);
    setPolicySource("uploaded");
    savePolicyWorkspace(data.facts, "uploaded");
    setResult(null);
  } catch (error) {
    setUploadError(error instanceof Error ? error.message : "Could not read the policy illustration.");
  } finally {
    setUploadingPolicy(false);
  }
}
```

- [ ] **Step 3: Add a simple document attachment panel above the adviser-claim box**

Place this before the "What did your adviser say?" panel:

```tsx
<div className="cp-panel cp-panel-pad cp-stack">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="cp-label">Policy illustration</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Attach the document behind the claim so Claro can check policy-specific figures.
      </p>
    </div>
    <label className="secondary-button cursor-pointer">
      {uploadingPolicy ? "Reading..." : facts.length > 0 ? "Replace PDF" : "Upload PDF"}
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadPolicy(file);
        }}
      />
    </label>
  </div>
  <div className="cp-empty">
    {facts.length > 0
      ? `${facts.length} document facts loaded for this check.`
      : "No policy illustration attached yet. You can split the adviser claim first, but policy-specific checking needs the PDF."}
  </div>
  {uploadError && <div className="cp-error">{uploadError}</div>}
</div>
```

- [ ] **Step 4: Prevent policy-specific checking when no policy is loaded**

In `runCheck()`, after statement validation:

```ts
if (facts.length === 0) {
  setError("Upload the related policy illustration before running a policy-specific check.");
  return;
}
```

This keeps Check honest: it can split claims without a document, but cannot pretend to verify them against a PI.

- [ ] **Step 5: Verify manually**

Run:

```bash
npm run build
```

Manual route test:
- Open `/check`.
- Upload a sample PI.
- Paste: `This plan is low-cost and the returns are guaranteed.`
- Split into checkable points.
- Run check.

Expected:
- No sample figures appear before upload.
- Uploaded fact count appears after upload.
- Check uses the uploaded facts.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(workspace)'/check/page.tsx
git commit -m "Add policy upload to adviser check"
```

---

## Task 3: Clean Up Ask So It Works Like a Consumer Chatbot

**Files:**
- Modify: `src/app/(workspace)/ask/page.tsx`
- Modify: `src/lib/financial-qa.ts`
- Modify: `src/lib/financial-topic-intelligence.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `FinancialQuestionRequest`.
- Produces: `FinancialQuestionResponse` with plain answer, public sources, optional document sources, adviser questions, and compliance notice.

- [ ] **Step 1: Stop arbitrary policy fact fallback**

In `policyFactsForTopic()` replace:

```ts
return selected.length > 0 ? selected : facts.slice(0, 4);
```

with:

```ts
return selected;
```

This prevents unrelated annual premium/sample facts from leaking into general questions.

- [ ] **Step 2: Add explicit document-context control to Ask**

In `AskPage`, add:

```ts
const [useDocumentContext, setUseDocumentContext] = useState(false);
```

Change the request body:

```ts
body: JSON.stringify({
  question: nextQuestion,
  facts: useDocumentContext ? facts : [],
}),
```

Add a quiet toggle below the textarea:

```tsx
{facts.length > 0 && (
  <label className="flex items-start gap-3 text-sm leading-6 text-[var(--muted)]">
    <input
      type="checkbox"
      checked={useDocumentContext}
      onChange={(event) => setUseDocumentContext(event.target.checked)}
      className="mt-1"
    />
    Use my loaded document as context for this question.
  </label>
)}
```

- [ ] **Step 3: Make answers direct and plain-English**

In `src/lib/financial-qa.ts`, replace the generic `answer` array with topic-specific plain-English answer builders. For example:

```ts
const PLAIN_ANSWERS: Record<string, string[]> = {
  "guaranteed-vs-projected": [
    "Guaranteed value is the amount the insurer is contractually showing as guaranteed, assuming the policy conditions are met.",
    "Projected surrender value includes non-guaranteed assumptions, such as bonuses or illustrated returns. It is useful for understanding upside, but it is not a promise.",
    "When reading a policy illustration, keep the guaranteed and non-guaranteed columns separate."
  ],
  "policy-review-checklist": [
    "Before signing, check what you must pay, how long you must pay it, what protection you get, what happens if you surrender early, and which figures are not guaranteed.",
    "The most important page is usually the policy illustration table because it separates premiums, benefits, surrender values, and distribution costs.",
    "If an adviser makes a broad claim, ask them to point to the exact page and row that supports it."
  ]
};
```

Then use:

```ts
const answer = PLAIN_ANSWERS[topic.id] ?? [
  topic.userFacingFrame,
  "A good way to understand this is to ask which exact document page supports the statement, and which parts depend on assumptions or adviser judgement."
];
```

- [ ] **Step 4: Rename "Sources used" into clearer groups**

Update response type:

```ts
sourceFacts?: PolicyFact[];
officialSourceFacts?: PolicyFact[];
documentSourceFacts?: PolicyFact[];
```

Return:

```ts
officialSourceFacts: officialFacts,
documentSourceFacts: policyFacts,
sourceFacts: sourceFacts,
```

In Ask UI, render:
- `Answer` first.
- `Public sources used` for MoneySense/LIA.
- `Your document context` only if `documentSourceFacts.length > 0`.
- `Questions to ask a licensed adviser`.

- [ ] **Step 5: Remove routed-topic prominence**

Change the answer header from:

```tsx
<p className="cp-source-label">Routed topic</p>
<h2>{answer.topic}</h2>
```

to:

```tsx
<p className="cp-source-label">Answer</p>
<h2 className="mt-2 text-lg font-semibold">{answer.topic}</h2>
```

The topic can remain as a small label, but the user should see the answer immediately, not the routing machinery.

- [ ] **Step 6: Verify manually**

Ask without document context:

```text
What should I check before signing a whole life policy?
```

Expected:
- No annual premium example.
- No sample policy figure.
- Direct plain-English checklist.
- Public sources only.

Ask:

```text
What's the difference between guaranteed and projected surrender value?
```

Expected:
- Clear explanation in simple English.
- Public sources listed below.
- No irrelevant policy facts.

Ask with document context enabled:

```text
What part of my policy is guaranteed?
```

Expected:
- Uses loaded document facts only if relevant.
- Document facts appear under "Your document context."

- [ ] **Step 7: Commit**

```bash
git add src/app/'(workspace)'/ask/page.tsx src/lib/financial-qa.ts src/lib/financial-topic-intelligence.ts src/types/index.ts
git commit -m "Clean up financial question answers"
```

---

## Task 4: Route-Level QA and Final Push

**Files:**
- No direct code edits unless QA finds issues.

**Interfaces:**
- Verifies all three front-door routes.

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 2: Run local app**

```bash
npm run dev
```

Expected: local Next server starts.

- [ ] **Step 3: Browser QA**

Check:
- `/` has one hero sentence and three clear choices.
- `/check` lets the user upload a PDF and paste adviser claims.
- `/decode` shows specific upload errors and extracted facts.
- `/ask` answers general questions without sample policy leakage.

- [ ] **Step 4: Commit any QA fixes**

```bash
git status --short
git add <changed-files>
git commit -m "Polish route QA issues"
```

- [ ] **Step 5: Push main**

```bash
git push origin main
```

Expected: Render can deploy latest `main`.

---

## Self-Review

- Spec coverage: The plan covers Check upload, Decode troubleshooting, Ask chatbot formatting, source-backed answer cleanup, and legal guardrails.
- Placeholder scan: No TBD/TODO placeholders. Each task includes target files, exact edits, and expected verification.
- Type consistency: New optional response fields are named `officialSourceFacts` and `documentSourceFacts` consistently across API and UI tasks.
- Scope control: No homepage redesign and no new product framing. This is only a route-functionality and answer-quality pass.
