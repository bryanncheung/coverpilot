# Claro Evidence Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Claro from a polished shell into a working case-review evidence workspace for the hackathon demo.

**Architecture:** Reuse the existing Next.js App Router, API routes, policy extraction, claim comparison, calculations, and compliance modules. Add a case workspace data model in session storage, a guided `/case-review` page to orchestrate the workflow, and a `/my-case` page to show persistent evidence state.

**Tech Stack:** Next.js, React client components, TypeScript, Tailwind CSS, browser sessionStorage, existing OpenAI-backed API routes.

## Global Constraints

- No financial advice: no buy, keep, cancel, switch, suitability, ranking, or recommendation output.
- Every important output must show a source label: Document-stated, Calculated, Official-source, User-provided, or Not found.
- Personal context may generate questions only, never conclusions.
- Keep edits scoped to the existing Next.js app.
- Do not add a database, auth, payment, or adviser matching in this pass.

---

### Task 1: Expand Workspace State

**Files:**
- Modify: `src/lib/workspace-session.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `CaseWorkspace`, `UserContext`, `saveCaseWorkspace`, `loadCaseWorkspace`, `updateCaseWorkspace`, `clearCaseWorkspace`.
- Consumes: existing `PolicyFact`, `UserStatement`, `SourceComparison`, `CalculationCard`, `MeetingPrepReport`.

- [x] Add a full case workspace type containing context, facts, statements, comparisons, calculations, report, source, and event history.
- [x] Add load/save/update helpers backed by `sessionStorage`.
- [x] Keep old Decode / Check helpers compatible.

### Task 2: Build Guided Case Review

**Files:**
- Create: `src/app/case-review/page.tsx`

**Interfaces:**
- Consumes: `/api/policy/extract`, `/api/statements/compare`, `/api/report/generate`, workspace helpers.
- Produces: a complete browser-visible case workflow and saved case state.

- [x] Add intake fields for situation, age, income, dependents, current cover, and concern.
- [x] Let user load sample policy or upload PDF.
- [x] Show extracted policy facts with manual edit controls.
- [x] Let user add adviser claims.
- [x] Run evidence review through the existing API.
- [x] Generate meeting pack through the existing API.
- [x] Save all outputs into the case workspace.
- [x] Show a decision-firewall test panel.

### Task 3: Build My Case Workspace

**Files:**
- Create: `src/app/my-case/page.tsx`

**Interfaces:**
- Consumes: `loadCaseWorkspace`, `clearCaseWorkspace`.
- Produces: persistent case record view.

- [x] Show current user context.
- [x] Show policy facts with source labels.
- [x] Show adviser claims and comparison states.
- [x] Show calculations and meeting-prep questions.
- [x] Show event history.
- [x] Let user return to Case Review or clear case.

### Task 4: Replace Homepage Shell With Product Launcher

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: no backend.
- Produces: clearer front door that links to `/case-review`, `/my-case`, `/decode`, `/check`, and `/prepare`.

- [x] Keep the ElevenLabs/ClearFA-inspired restrained visual style.
- [x] Reframe modules as entry points into one evidence workspace.
- [x] Remove any copy that implies a static mock demo is the full product.
- [x] Make the main CTA start the actual Case Review flow.

### Task 5: Align Legacy Routes

**Files:**
- Modify: `src/app/(workspace)/decode/page.tsx`
- Modify: `src/app/(workspace)/check/page.tsx`
- Modify: `src/app/(workspace)/prepare/page.tsx`

**Interfaces:**
- Consumes: new case workspace helpers.
- Produces: old pages remain usable and link into the new workspace.

- [x] Add links to Case Review and My Case.
- [x] Save extracted facts / checks / report into full case workspace when old routes are used.
- [x] Keep existing behavior working.

### Task 6: Verify

**Files:**
- Test: app build and local browser smoke test.

**Interfaces:**
- Consumes: completed app.
- Produces: confidence that Render build will work.

- [x] Run `npm run lint`.
- [x] Run `env OPENAI_API_KEY=dummy npm run build`.
- [x] Smoke test `/`, `/case-review`, and `/my-case`.
- [x] Fix any build, lint, or obvious browser errors.

