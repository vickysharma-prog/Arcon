// How a design moves through review, and how the project's own events read in the thread. Pure, so the browser
// and the server say the same thing.

type Status = "interview" | "designing" | "ready" | "review" | "approved" | "building" | "done";

export type ThreadEvent =
  | { type: "chose"; plan: string }
  | { type: "changed"; version: number; note: string }
  | { type: "joined"; role: string }
  | { type: "answered" }
  | { type: "review"; version: number }
  | { type: "approved"; version: number; note?: string | null; for?: string | null }
  | { type: "changes"; version: number; note?: string | null; for?: string | null }
  | { type: "fee"; action: "added" | "bill" | "paid" | "received" | "paypal"; label: string; amount: string }
  | { type: "unlocked"; amount: string }
  | { type: "handover"; to: string }
  | { type: "movein"; what: "snag" | "fixed" | "closed" | "reopened" | "pack" | "moved"; note?: string | null; for?: string | null }
  | { type: "change"; what: "asked" | "approved" | "declined"; version: number; cost?: string; note?: string | null; for?: string | null }
  | { type: "site"; what: "started" | "phase" | "update" | "finished"; name?: string; pct?: number; note?: string }
  | { type: "quote"; what: "sent" | "accepted" | "declined"; amount: string; against?: string; note?: string | null; for?: string | null }
  | { type: "visit"; note: string }
  | { type: "signoff"; name: string; note?: string | null };

/** One line for the thread: "Priya approved version 3." */
export function eventText(e: ThreadEvent, who: string): string {
  switch (e.type) {
    case "chose":
      return `${who} chose the ${e.plan} plan.`;
    case "changed":
      return `${who} changed the design: ${e.note} (version ${e.version}).`;
    case "joined":
      return `${who} joined as the ${e.role}.`;
    case "answered":
      return `${who} answered the questions. The design is being made now.`;
    case "review":
      return `${who} sent version ${e.version} for review.`;
    case "approved":
      // `for`: a client who isn't on Arcon, whose answer the pro records from their meeting
      return e.for ? `${e.for} approved version ${e.version} in person (recorded by ${who}).${e.note ? ` "${e.note}"` : ""}` : `${who} approved version ${e.version}.${e.note ? ` "${e.note}"` : ""}`;
    case "changes":
      return e.for ? `${e.for} asked for changes to version ${e.version} in person (recorded by ${who}).${e.note ? ` "${e.note}"` : ""}` : `${who} asked for changes to version ${e.version}.${e.note ? ` "${e.note}"` : ""}`;
    case "fee":
      return e.action === "added"
        ? `${who} set out the fees: ${e.label} (${e.amount}).`
        : e.action === "bill"
          ? `${who} billed ${e.label}: ${e.amount}.`
          : e.action === "paid"
            ? `${who} marked ${e.label} as paid (${e.amount}).`
            : e.action === "paypal"
              ? `${who} paid ${e.label} with PayPal: ${e.amount}. Settled.`
            : `${who} confirmed receiving ${e.label} (${e.amount}).`;
    case "unlocked":
      return `${who} unlocked the project (${e.amount}, paid with PayPal): the budget, shopping list, changes and drawings are open.`;
    case "site":
      return e.what === "started"
        ? `${who} started the building site. First up: ${e.name}.`
        : e.what === "phase"
          ? `${who} finished ${e.name}.`
          : e.what === "finished"
            ? `${who} finished the build. Next: walk through it together and list anything to fix before the handover.`
            : `Site update from ${who}${e.name ? ` (${e.name}${e.pct !== undefined ? `, ${e.pct}%` : ""})` : ""}: ${e.note}`;
    case "movein":
      switch (e.what) {
        case "snag":
          return `${who} listed a snag: ${e.note}`;
        case "fixed":
          return `${who} fixed a snag: ${e.note}`;
        case "closed":
          return `${who} signed off a snag: ${e.note}`;
        case "reopened":
          return `${who} sent a snag back: ${e.note}`;
        case "pack":
          return `${who} handed over the pack: ${e.note}, the drawings and the notes.`;
        case "moved":
          return `${e.for ? `${e.for} (in person, recorded by ${who})` : who} accepted the handover. Moved in!${e.note ? ` "${e.note}"` : ""}`;
      }
      return "";
    case "change": {
      const by = e.for ? `${e.for} (in person, recorded by ${who})` : who;
      return e.what === "asked"
        ? `${who} asked to change the approved design (version ${e.version}, ${e.cost ?? "cost to come"}). It needs approving before it's built.`
        : e.what === "approved"
          ? `${by} approved the change: version ${e.version} is what gets built (${e.cost ?? "same cost"}).${e.note ? ` "${e.note}"` : ""}`
          : `${by} declined the change; the design is back as approved (version ${e.version}).${e.note ? ` "${e.note}"` : ""}`;
    }
    case "handover":
      return `${who} handed the project over to ${e.to}, who now runs it. ${who} stays on as the client.`;
    case "quote": {
      const by = e.for ? `${e.for} (in person, recorded by ${who})` : who;
      return e.what === "sent"
        ? `${who} sent a quote for the build: ${e.amount}${e.against ? `, ${e.against}` : ""}.${e.note ? ` "${e.note}"` : ""}`
        : e.what === "accepted"
          ? `${by} accepted the quote (${e.amount}). It's the site's budget now.`
          : `${by} declined the quote (${e.amount}).${e.note ? ` "${e.note}"` : ""}`;
    }
    case "visit":
      return `${who} visited the site: ${e.note}`;
    case "signoff":
      return `${who} checked and signed off ${e.name}.${e.note ? ` "${e.note}"` : ""}`;
  }
}

/** A design can go for review once a plan is chosen and it isn't already in review, approved or being built. */
export const canSendForReview = (p: { status: Status; chosen_option: number | null }) => p.chosen_option !== null && (p.status === "designing" || p.status === "ready");

/** Where the project goes after each review step. A change during review goes back to design; a change to an
 *  approved design stays approved and waits as a change request (lib/project/change.ts). */
export function statusAfter(step: "send" | "approve" | "changes" | "edit", now: Status): Status {
  if (step === "send") return "review";
  if (step === "approve") return "approved";
  if (step === "changes") return "ready";
  return now === "review" ? "ready" : now;
}
