# FA3 — Statement Answer-Key (Eval Ground Truth)

**Owner:** Ayman (FA / compliance authority)
**Status:** Locked — 2026-06-24
**Source policy:** `demo-wholelife-sg-2026` (seeded whole-life par; S$3,600/yr premium, 20yr term, S$100k SA)
**Purpose:** Ground-truth comparison states for the 5 demo statements. Wire into the eval harness as the expected output for `POST /api/statements/compare`.

---

## The five comparison states (reference)

| State | Meaning |
|---|---|
| `matches-document` | Statement agrees with what the document says. No conflict. |
| `partially-matches` | Literally true but omits something material / true only under conditions. |
| `not-found` | Document has no basis to confirm or deny (usually subjective claims). Not contradicted — just outside the document. |
| `needs-source-reconciliation` | Document has relevant figures that conflict/split; user must reconcile two legitimate numbers. |
| `calculation-differs` | The deterministic math contradicts the statement's implication. |

---

## Answer-key

| # | Statement | Category | **Locked state** | Reasoning |
|---|---|---|---|---|
| s1 | "This is a low-cost plan." | cost | **`not-found`** | Comparative value-judgment ("low" vs what?). Document has cost facts but no benchmark to adjudicate. Surface **Total Distribution Cost (S$10,800 = 15% of total premiums)** as context, plus an adviser question. |
| s2 | "I can access my money anytime." | liquidity | **`partially-matches`** | Literally true (can surrender anytime) but omits that early surrender value is far below premiums paid — e.g. S$7,200 returned vs S$18,000 paid at year 5. Show shortfall in the explanation. |
| s3 | "It's a good savings plan." | returns | **`not-found`** | Subjective, buyer/goal-dependent. Surface guaranteed vs projected returns as context. Never echo "good" (unsafe-words list). |
| s4 | "The returns are attractive." | returns | **`needs-source-reconciliation`** | Points at a specific quantity (returns) the document presents as two conflicting figures: guaranteed (low) vs projected 4.25% (higher). Reconcile **within the document**. Cross-plan comparison must NOT be done by the app (compliance: "better than" / "best" are blocked) — defer it to the adviser question. |
| s5 | "I have enough protection." | coverage | **`not-found`** | "Enough" requires a personal needs-analysis (income, dependents, debts, existing cover) absent from the document. Surface the S$100,000 sum assured as context + a needs-based adviser question. |

---

## Guiding principle (carry into eval design)

**The deciding test: can the document directly test the claim, or is it a value-judgment the document can't settle?**

- **Value-judgment the document can't settle → `not-found`.** Needs a benchmark ("low vs what?"), the buyer's goals ("good for whom?"), or their personal situation ("enough for my needs?") — none of which is in the document. Surface related facts as context; never return a verdict. (s1, s3, s5)
- **Factual claim the document can test → `partially-matches` / `calculation-differs` / `needs-source-reconciliation`**, depending on whether the document *qualifies* it (s2), *contradicts it via math*, or *splits on it* with two competing figures (s4).

**`not-found` vs `needs-source-reconciliation`** — the gap's location decides it: `not-found` = nothing in the document can settle the claim (gap is *outside* the document); `needs-source-reconciliation` = the document settles it but with two competing numbers the user must reconcile (gap is *inside* the document).

## Compliance notes

- The app must never echo judgment words from the unsafe list (`good`, `best`, `misleading`, `wrong`, etc.) back as a verdict.
- For s4, the app surfaces the in-document guaranteed-vs-projected reconciliation only. Any cross-plan comparison is framed as a **question for the licensed adviser**, e.g.: *"Which of these return figures is guaranteed, and how do the guaranteed returns compare to other plans you would recommend?"* — the app frames the question; the adviser makes the comparison.

## Open dependency

- s1's context fact (70% Year-1 distribution cost) is currently an **unverified placeholder** — to be amended after checking a real Policy Illustration. See FA1.
