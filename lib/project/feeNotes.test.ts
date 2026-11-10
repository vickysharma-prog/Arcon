import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV3 } from "ai/test";
import { draftNote, notePrompt, onlyItsAmount, plainNote, type NoteFacts } from "./feeNotes.ts";

const facts = (o: Partial<NoteFacts> = {}): NoteFacts => ({
  kind: "bill",
  pro: "Lena Ortiz Studio",
  client: "Maya",
  project: "Maya's house",
  milestone: { label: "Design", amount: 2400, currency: "USD", billedDaysAgo: null },
  done: ["Maya chose the Courtyard plan", "Lena changed the design: a bigger study (version 3)", "Maya approved version 3"],
  paypal: true,
  ...o,
});

// a model that answers with this text, the way generateText's structured output expects it
const says = (text: string) =>
  new MockLanguageModelV3({ doGenerate: async () => ({ content: [{ type: "text", text: JSON.stringify({ text }) }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] }) });

test("only the milestone's own amount may appear", () => {
  assert.equal(onlyItsAmount("Design is done. The fee is $2,400.", 2400), true);
  assert.equal(onlyItsAmount("No figures here at all.", 2400), true);
  assert.equal(onlyItsAmount("That's 2400 USD, or USD 2,400.00.", 2400), true);
  assert.equal(onlyItsAmount("The fee is $2,400 and the next one is $3,200.", 2400), false);
  assert.equal(onlyItsAmount("Pay $240 now.", 2400), false);
  assert.equal(onlyItsAmount("Around 2,500 dollars.", 2400), false);
  assert.equal(onlyItsAmount("Room 3 is 12 m² and version 3 is approved.", 2400), true); // numbers that aren't money
});

test("the prompt carries the record, the fee and how to pay, and forbids other amounts", () => {
  const p = notePrompt(facts());
  assert.match(p, /Maya approved version 3/);
  assert.match(p, /Design, \$2,400/);
  assert.match(p, /PayPal/);
  assert.match(p, /mention no amount other than \$2,400/);
  assert.match(notePrompt(facts({ kind: "remind", milestone: { label: "Design", amount: 2400, currency: "USD", billedDaysAgo: 16 } })), /billed 16 days ago/);
  assert.match(notePrompt(facts({ paypal: false })), /usual way/);
  assert.match(notePrompt(facts({ done: [] })), /claim nothing about what was done/);
  assert.doesNotMatch(notePrompt(facts()), /claim nothing/);
});

test("a good draft is kept as the agent's", async () => {
  const text = "Design is complete: you chose the Courtyard plan, we enlarged the study, and you approved version 3. The fee for this stage is $2,400, payable with PayPal from the project.";
  assert.deepEqual(await draftNote(facts(), says(text)), { text, by: "agent" });
});

test("a draft that invents an amount is replaced by the plain note", async () => {
  const r = await draftNote(facts(), says("Design is done. Please pay $2,400 now and $3,200 next month for approval."));
  assert.equal(r.by, "plain");
  assert.equal(r.text, plainNote(facts()));
  assert.ok(onlyItsAmount(r.text, 2400));
});

test("no model, a failing model or an empty draft all fall back to the plain note", async () => {
  assert.equal((await draftNote(facts(), null)).by, "plain");
  const broken = new MockLanguageModelV3({ doGenerate: async () => { throw new Error("busy"); } });
  assert.equal((await draftNote(facts(), broken)).by, "plain");
  assert.equal((await draftNote(facts(), says("ok"))).by, "plain");
});

test("plain notes say the fee and how to pay, for each kind", () => {
  assert.match(plainNote(facts()), /\$2,400.*PayPal/);
  assert.match(plainNote(facts({ kind: "remind" })), /reminder.*Design.*\$2,400/);
  assert.match(plainNote(facts({ kind: "explain" })), /Lena Ortiz Studio's fee/);
  assert.match(plainNote(facts({ paypal: false })), /Mark it paid/);
});
