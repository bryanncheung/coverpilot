import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("workspace persistence uses localStorage instead of sessionStorage", async () => {
  const source = await read("src/lib/workspace-session.ts");

  assert.match(source, /localStorage/);
  assert.doesNotMatch(source, /sessionStorage/);
});

test("case review redirects users into the three focused route architecture", async () => {
  const source = await read("src/app/case-review/page.tsx");

  assert.match(source, /destinationFromSearch/);
  assert.match(source, /\/check/);
  assert.match(source, /\/decode/);
  assert.match(source, /\/ask/);
  assert.match(source, /Choose one focused flow/);
});

test("resource-backed routes expose source links, PI formulas, and avoid canned comparison fallback", async () => {
  const checkPage = await read("src/app/(workspace)/check/page.tsx");
  const compareRoute = await read("src/app/api/statements/compare/route.ts");
  const calculations = await read("src/lib/calculations.ts");
  const sourceData = await read("src/data/official-sources(actual).ts");

  assert.match(checkPage, /View source/);
  assert.match(checkPage, /calc\.formula/);
  assert.match(calculations, /calc-dist-cost-pct/);
  assert.match(compareRoute, /compareStatementsDeterministically/);
  assert.doesNotMatch(compareRoute, /DEMO_COMPARISONS/);
  assert.match(sourceData, /sourceUrl/);
  assert.match(sourceData, /verifiedOn/);
});

test("ask route only uses document facts when the user explicitly opts in", async () => {
  const askPage = await read("src/app/(workspace)/ask/page.tsx");
  const qa = await read("src/lib/financial-qa.ts");
  const topicIntel = await read("src/lib/financial-topic-intelligence.ts");

  assert.match(askPage, /useDocumentContext/);
  assert.match(askPage, /Use my loaded document as context/);
  assert.match(askPage, /facts: useDocumentContext \? facts : \[\]/);
  assert.match(qa, /officialSourceFacts/);
  assert.match(qa, /documentSourceFacts/);
  assert.doesNotMatch(topicIntel, /facts\.slice\(0,\s*4\)/);
});

test("decode and check routes expose real policy upload handling", async () => {
  const decodePage = await read("src/app/(workspace)/decode/page.tsx");
  const checkPage = await read("src/app/(workspace)/check/page.tsx");
  const extractRoute = await read("src/app/api/policy/extract/route.ts");

  assert.match(decodePage, /readUploadError/);
  assert.match(decodePage, /await readUploadError\(res\)/);
  assert.match(checkPage, /uploadPolicy/);
  assert.match(checkPage, /Upload PDF/);
  assert.match(checkPage, /policy-specific check/);
  assert.match(extractRoute, /could read the PDF, but could not extract enough policy facts/);
});

test("policy extraction has deterministic fallback when OpenAI fails", async () => {
  const extract = await read("src/lib/extract.ts");
  const extractRoute = await read("src/app/api/policy/extract/route.ts");

  assert.match(extract, /extractFactsDeterministically/);
  assert.match(extract, /deterministic-fallback/);
  assert.match(extract, /OPENAI_MODEL/);
  assert.doesNotMatch(extractRoute, /PDF upload extraction requires OPENAI_API_KEY/);
  assert.match(extractRoute, /fallback: result\.source === "deterministic-fallback"/);
});
