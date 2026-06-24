# Claro Final-Day Engineering Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spend Wednesday 2026-06-24 building the strongest possible technical demo for Claro before submission work begins. Bryan and Janine both work on engineering. Ayman handles FA compliance review and later submission/pitch collateral.

**Architecture:** Keep the current one-page evidence desk as the main demo shell, but make the underlying product feel deeper than a static landing page. The center of gravity is a shared evidence record powering Ask, Decode, Verify, Review, Prepare, and History, with Verify + Evidence Report as the most complete workflow.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, OpenAI API optional, static seeded evidence in `src/data/demo-evidence.ts`, compare API in `src/app/api/statements/compare/route.ts`.

## Global Constraints

- Today is an engineering day. Devpost, pitch deck, and video scripting are secondary until the product is stronger.
- Bryan and Janine have similar technical depth, so split by product surface/backend ownership instead of "technical vs product."
- Ayman owns FA/domain/compliance review and can handle submission collateral later.
- The app must never produce personalized financial advice, product recommendations, buy/sell/keep/switch instructions, suitability verdicts, or rankings.
- The app must work even if `OPENAI_API_KEY` is missing or rate-limited.
- No new packages unless they directly unlock a demo-critical capability.
- Every pushed change should pass `npm run lint` and `OPENAI_API_KEY=dummy npm run build`.

---

## Owner Split For Today

| Owner | Engineering Lane | Outcome |
| --- | --- | --- |
| Janine | Evidence desk product surface and user workflow depth | The app feels like a real one-stop insurance evidence workspace, not a static showcase |
| Bryan | Backend reliability, OpenAI/fallback behavior, deployment, technical robustness | The demo works live, survives API failure, and has credible technical depth |
| Ayman | FA compliance, domain realism, later submission support | Claims, wording, and workflows are realistic and legally safe |

---

## P0 Scope: What Must Be Built Today

### 1. Honest Live AI / Fallback State

Owner: Bryan

Why this matters: If the app silently shows seeded output while claiming it is live AI, the demo becomes fragile and hard to defend.

- [ ] Inspect `src/app/api/statements/compare/route.ts`.
- [ ] Return a clear response metadata field such as `source: "ai" | "demo-fallback"` or `usedFallback: boolean`.
- [ ] Update the homepage UI so the evidence review badge says the truth:
  - [ ] Live AI review when OpenAI ran successfully.
  - [ ] Demo evidence fallback when seeded output was used.
- [ ] Confirm OpenAI errors do not crash the API.
- [ ] Confirm no API key still produces a useful demo.
- [ ] Run `npm run lint`.
- [ ] Run `OPENAI_API_KEY=dummy npm run build`.

### 2. Shared Evidence Record Must Feel Real

Owner: Janine

Why this matters: The product thesis is one-stop insurance evidence desk. The UI must make it obvious that every module is reading from one shared case, not six disconnected widgets.

- [ ] Inspect `src/app/page.tsx` and `src/data/demo-evidence.ts`.
- [ ] Strengthen the shared evidence record section with:
  - [ ] User context.
  - [ ] Uploaded/decoded artefacts.
  - [ ] Official-source grounding.
  - [ ] Adviser claim under review.
  - [ ] Current evidence status.
- [ ] Make Ask, Decode, Verify, Review, Prepare, and History visually refer back to the same evidence record.
- [ ] Make Verify the deepest section on the page.
- [ ] Avoid adding broad new modules unless they connect directly to the evidence record.
- [ ] Run `npm run lint`.
- [ ] Run `OPENAI_API_KEY=dummy npm run build`.

### 3. Make The Evidence Report Demo-Grade

Owner: Janine

Why this matters: The judge needs to see one strong "wow, this is useful" artifact. The evidence report is that artifact.

- [ ] Expand the Verify section into a report-like output:
  - [ ] Claim.
  - [ ] Verdict type: supported / unsupported / needs clarification.
  - [ ] Evidence used.
  - [ ] Missing evidence.
  - [ ] Consumer-safe next question.
  - [ ] Compliance-safe note.
- [ ] Add enough structured detail that it looks like the product did real work.
- [ ] Keep language factual and avoid advice.
- [ ] Make the report scannable in a 3-minute demo.

### 4. Make The Backend Demo Credible

Owner: Bryan

Why this matters: The product should not feel like only hardcoded UI. Even if seeded data exists, the technical architecture should show real AI-backed comparison capability.

- [ ] Confirm `src/app/api/statements/compare/route.ts` can accept user-entered statements.
- [ ] Confirm the request/response format is clean enough to explain.
- [ ] Add lightweight request validation if missing.
- [ ] Add a useful error message shape for failed requests.
- [ ] Keep seeded fallback deterministic.
- [ ] If time permits, add a tiny architecture note in the repo README or docs explaining:
  - [ ] Evidence input.
  - [ ] Comparison pipeline.
  - [ ] AI pass.
  - [ ] Fallback pass.
  - [ ] Compliance guardrails.

### 5. Decision Firewall Must Be Visible

Owner: Janine

Why this matters: Legal safety is part of the product, not just a disclaimer. It also differentiates Claro from a random chatbot.

- [ ] Ensure the page visibly refuses or redirects unsafe requests.
- [ ] Include examples of unsafe prompts:
  - [ ] "Should I buy this?"
  - [ ] "Should I cancel my current policy?"
  - [ ] "Which plan is best for me?"
- [ ] Show the safe replacement action:
  - [ ] "Here are the facts to verify."
  - [ ] "Here are questions to ask a licensed adviser."
  - [ ] "Here is what the evidence does and does not support."
- [ ] Ask Ayman to review this section first.

### 6. Deployment Readiness

Owner: Bryan

Why this matters: A strong local product is useless if the recorded/live demo breaks.

- [ ] Pull latest main before deploying.
- [ ] Run `npm run lint`.
- [ ] Run `OPENAI_API_KEY=dummy npm run build`.
- [ ] Deploy latest main.
- [ ] Test deployed homepage in a clean browser.
- [ ] Test "Run evidence review" on deployed site.
- [ ] Confirm console has no blocking errors.
- [ ] Share the final live link with Janine and Ayman.

---

## P1 Scope: Build If P0 Is Done Early

### 7. Lightweight Evidence History

Owner: Janine

- [ ] Make the History section feel like a real case log.
- [ ] Include timestamp-like steps, artefact names, and status changes.
- [ ] Keep it static if needed, but make it reinforce the "one case file" product.

### 8. Better User Input For Claim Verification

Owner: Bryan

- [ ] Let the user enter or edit the FA claim being checked.
- [ ] Send the entered claim to the compare endpoint.
- [ ] Render returned comparison results.
- [ ] Preserve seeded fallback if the endpoint fails.

### 9. Official Source Library

Owner: Janine

- [ ] Add a compact "source library" section or panel.
- [ ] Use official-source style labels only.
- [ ] Avoid pretending to have live retrieval if it is seeded.
- [ ] Show how each source connects to the evidence report.

### 10. README Technical Notes

Owner: Bryan

- [ ] Update README with setup commands.
- [ ] Document env vars.
- [ ] Document fallback behavior.
- [ ] Document demo path.

---

## Ayman's Lane Today

Ayman should not block Bryan or Janine's engineering work unless he finds a legal/domain issue.

- [ ] Review seeded demo claims.
- [ ] Review evidence report wording.
- [ ] Review decision firewall wording.
- [ ] Flag anything that sounds like regulated financial advice.
- [ ] Later: handle Devpost/pitch deck outline/submission materials after the technical product is stable.

---

## Suggested Work Order

### First 60-90 Minutes

Bryan:

- [ ] Pull main.
- [ ] Fix API fallback metadata.
- [ ] Confirm build/lint.

Janine:

- [ ] Strengthen shared evidence record.
- [ ] Strengthen evidence report UI.
- [ ] Check wording against legal guardrails.

### Next 2-3 Hours

Bryan:

- [ ] Add/verify user-entered claim flow if feasible.
- [ ] Improve API validation/error shape.
- [ ] Prepare deployment.

Janine:

- [ ] Make every module orbit the same case.
- [ ] Make decision firewall clearer.
- [ ] Add evidence history/source library polish if P0 is stable.

### Evening

Bryan:

- [ ] Deploy.
- [ ] Test live site.
- [ ] Fix demo-breaking bugs only.

Janine:

- [ ] QA live user flow.
- [ ] Write down exact demo path once the product is final.
- [ ] Hand Ayman final compliance-sensitive copy.

---

## Definition Of Done For Engineering

- [ ] Live site works from a clean browser.
- [ ] Evidence review works with OpenAI and without OpenAI.
- [ ] UI honestly labels AI vs fallback output.
- [ ] Shared evidence record is obvious.
- [ ] Verify + Evidence Report is the strongest workflow.
- [ ] Ask, Decode, Review, Prepare, and History feel connected to one case.
- [ ] Decision firewall is visible and compliance-safe.
- [ ] `npm run lint` passes.
- [ ] `OPENAI_API_KEY=dummy npm run build` passes.
- [ ] Ayman has reviewed the legal-sensitive wording.

---

## Scope Guard

Do not spend engineering time on Devpost, pitch deck, demo video editing, or long-form submission copy until the technical product feels good enough to record. Those are important, but they are not the bottleneck yet.

Do not build random extra features just to increase surface area. Every added feature must make the evidence desk stronger, deeper, or more defensible.
