import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { money } from "./fees.ts";

// Arcon's agent for a pro's fees writes the words around a payment: the note that goes with a bill (what was done
// since the last one, from the project's own record), a polite reminder when one is overdue, and, for the client,
// what a fee is for. It never decides an amount: every figure comes from the milestone the pro set out, and a draft
// that names any other amount is thrown away for a plain one. The pro reads and sends it; nothing moves on its own.

export type NoteKind = "bill" | "remind" | "explain";
export type NoteFacts = {
  kind: NoteKind;
  pro: string; // the studio or company billing
  client: string | null;
  project: string;
  milestone: { label: string; amount: number; currency: string; billedDaysAgo: number | null };
  done: string[]; // what happened on the project since the last bill, newest last (thread events)
  paypal: boolean; // whether the client can pay it with PayPal in Arcon
};

const Draft = z.object({ text: z.string().describe("the message, plain text, no greeting line of its own, no signature") });

export function notePrompt(f: NoteFacts): string {
  const fee = money(f.milestone.amount, f.milestone.currency);
  const record = f.done.length ? f.done.map((d) => `- ${d}`).join("\n") : "- (nothing recorded yet)";
  const pay = f.paypal ? "The client can pay it with PayPal straight from the project in Arcon." : "The client pays it the usual way and marks it paid in Arcon.";
  const task = {
    bill: `Write the short note ${f.pro} sends with this bill to ${f.client ?? "their client"}: what this stage covered, drawn ONLY from the record below (name 2 to 4 concrete things), then the fee and how to pay. Warm, confident, 50 to 90 words.`,
    remind: `Write a polite reminder from ${f.pro} to ${f.client ?? "their client"}: this fee was billed ${f.milestone.billedDaysAgo ?? "some"} days ago and isn't paid yet. Kind and brief, no pressure or blame, offer to help if anything is unclear. 35 to 60 words.`,
    explain: `${f.client ?? "The client"} asks what this fee is for. Explain it in plain words from the record below: what the stage is, what they received for it. Reassuring, 40 to 70 words, speaking as Arcon (not as the pro).`,
  }[f.kind];
  return `${task}

Project: ${f.project}
Fee: ${f.milestone.label}, ${fee}
${pay}

What happened on the project:
${record}

Rules: mention no amount other than ${fee}. Don't invent work that isn't in the record${f.done.length ? "" : " (it is empty, so name the stage and claim nothing about what was done)"}. No markdown.`;
}

// every figure that looks like money in a text ("$2,400", "2400 USD", "USD 2,400.00")
const AMOUNTS = /(?:[$€£₹]|\b(?:USD|EUR|GBP|INR|AUD|CAD|SGD|AED)\s?)\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:USD|EUR|GBP|INR|AUD|CAD|SGD|AED|dollars|euros|pounds|rupees)\b/gi;

/** Whether a draft names only the milestone's own amount (or none). */
export function onlyItsAmount(text: string, amount: number): boolean {
  for (const m of text.matchAll(AMOUNTS)) {
    const n = Number((m[1] ?? m[2]).replace(/,/g, ""));
    if (Math.abs(n - amount) > 0.005) return false;
  }
  return true;
}

/** The plain note used when the model is busy, or its draft broke a rule. */
export function plainNote(f: NoteFacts): string {
  const fee = money(f.milestone.amount, f.milestone.currency);
  const how = f.paypal ? "You can pay it with PayPal right from the project." : "Mark it paid in Arcon once it's sent.";
  if (f.kind === "remind") return `A gentle reminder that ${f.milestone.label} (${fee}) is still open. ${how} If anything about it is unclear, just reply here.`;
  if (f.kind === "explain") return `${f.milestone.label} is ${fee}, ${f.pro}'s fee for this stage of ${f.project}.${f.done.length ? ` It covers what's on the project so far, like ${f.done.slice(-2).join(" and ").toLowerCase()}.` : ""}`;
  return `${f.milestone.label} is done${f.done.length ? `: ${f.done.slice(-3).join("; ").toLowerCase()}` : ""}. The fee for this stage is ${fee}. ${how}`;
}

/** A draft for the pro (or the client's explanation): the model's words when they keep to the rules, else the plain note. */
export async function draftNote(f: NoteFacts, model: LanguageModel | null): Promise<{ text: string; by: "agent" | "plain" }> {
  if (!model) return { text: plainNote(f), by: "plain" };
  try {
    const { output } = await generateText({ model, output: Output.object({ schema: Draft }), prompt: notePrompt(f), maxRetries: 0, abortSignal: AbortSignal.timeout(12_000) });
    const text = output.text.trim().replace(/\s+\n/g, "\n");
    if (text.length < 20 || text.length > 900 || !onlyItsAmount(text, f.milestone.amount)) return { text: plainNote(f), by: "plain" };
    return { text, by: "agent" };
  } catch {
    return { text: plainNote(f), by: "plain" };
  }
}
