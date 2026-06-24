# Claro Evidence Workspace Design

Date: 2026-06-24

## Decision

Build Claro as an evidence workspace, with Case Review as the main hackathon demo flow.

The product should not be a generic chatbot, a static dashboard, or a ClearFA-style one-shot report. It should guide a Singapore consumer through one coherent case: prepare for an insurance / FA conversation by combining policy facts, adviser claims, deterministic calculations, official-source context, and compliance-safe meeting questions.

## Product Thesis

Claro is Singapore's AI insurance evidence desk. It helps users ask insurance questions, decode policy documents, verify adviser claims, prepare for FA meetings, and keep a reusable case record without giving financial advice.

The hackathon demo proves the thesis through one case:

> A young Singapore consumer has an FA meeting tomorrow, a proposed policy illustration, and several adviser claims. Claro turns those inputs into a sourced meeting-prep pack.

## Three Workflow Constraints

### 1. Copy Top AI / Financial-Advisory Startup Patterns

Claro must feel like a domain workflow system, not an LLM wrapper.

The product copies:

- FP Alpha: document intelligence and client-ready reports.
- Conquest: deterministic calculations and audit trail.
- Jump / Zocks / Legora: workspace and meeting lifecycle.
- Truebill / PortfolioPilot: hidden-cost visibility and dashboard-plus-assistant shape.
- Casetext / Checkr: source-backed expert workflow and compliance controls.

### 2. Rerun Pre-AI Singapore Insurance Workflows With AI

Claro automates the first-pass labor that previously required static content, comparison portals, or human second opinions.

The product copies and reruns:

- MoneySense: official-source education and FA process guidance.
- CompareFIRST: policy comparison context, without becoming a product recommender.
- Planner Bee / PolicyPal: policy review and insurance management, but AI-first.
- Human FA second opinions: first-pass review before the licensed adviser conversation.

### 3. Copy And Contextualize InsureLobang

Claro borrows InsureLobang's broad consumer surface and trust stance:

- FAQ / Ask.
- Check Advice / Verify.
- Policy Breakdown / Decode.
- Gap Calculator / benchmark discussion.
- independent, no-commission, official-source framing.

Claro improves on the shape by connecting these jobs into one evidence record rather than separate tools.

## Core User Flow

1. User starts a case from the homepage.
2. User can choose one of four entry points: Ask, Decode, Verify, or Prepare.
3. The recommended guided flow is:
   - enter light context,
   - load sample policy or upload PDF,
   - review extracted facts,
   - paste adviser claims,
   - run evidence review,
   - review calculations and source labels,
   - generate meeting-prep pack,
   - test the decision firewall.
4. The My Case workspace shows saved case state:
   - user context,
   - policy facts,
   - adviser claims,
   - comparisons,
   - calculations,
   - report questions,
   - event history.

## Compliance Rules

Claro can:

- extract policy facts,
- cite policy clauses,
- explain general insurance concepts,
- run transparent calculations from document facts,
- compare user-provided statements to source text,
- identify missing information,
- generate neutral questions for a licensed adviser.

Claro cannot:

- recommend a policy,
- rank policies,
- say a policy is suitable or unsuitable,
- say the user is underinsured as a conclusion,
- tell users to buy, keep, cancel, switch, renew, surrender, or hold,
- generate product shortlists,
- route users to advisers as lead generation.

Personal context can affect which questions are prepared. It cannot produce recommendations.

Every important output must show a source label:

- Document-stated.
- Calculated.
- Official-source.
- User-provided.
- Not found.

## Build Scope

For this implementation pass, build:

- a redesigned homepage that launches the real workspace flow,
- a Case Review page that orchestrates intake, document loading, claim checking, calculations, and report generation,
- a My Case page that persists the evidence record in browser storage,
- stronger session storage types for full case state,
- manual fact correction for extracted facts,
- clearer source badges and compliance copy,
- links from existing Decode / Check / Prepare routes into the workspace.

Do not build:

- login,
- backend database persistence,
- payment,
- adviser matching,
- product comparison recommendations,
- multi-user sharing.

## Success Criteria

The demo must show:

- a real start-to-report flow,
- visible policy facts,
- editable extracted facts,
- adviser claim checking,
- deterministic calculation cards,
- a saved My Case workspace,
- meeting-prep questions,
- a decision-firewall refusal,
- and compliance-safe copy throughout.

