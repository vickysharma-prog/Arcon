import type { DemoRole } from "./story.ts";

// The tour: one stop per page, as the person whose view it is, in chapters a visitor can jump between. Pure,
// so the /demo route, the tour bar and the tests agree. Paths name projects by key; the /demo route fills in the
// seeded ids. After the last stop, /demo/done thanks them and hands over to "Try it yourself".

export type ProjectKey = "maya" | "parks" | "ana" | "sam";
export type Stop = { as: DemoRole; path: string; title: string; what: string; chapter: number; project: string };

export const CHAPTERS = ["Maya designs her home", "Her architect and builder", "Not only homes"] as const;

export const TOUR: Stop[] = [
  { chapter: 0, project: "Maya's house", as: "maya", path: "/start?demo=1", title: "Maya tells Arcon how her family lives", what: "The interview plays itself with Maya's answers. Her three picks are read as she taps them." },
  { chapter: 0, project: "Maya's house", as: "maya", path: "/project/{maya}?step=brief", title: "Arcon reads her taste", what: "Chateau Marmont, West Elm and Mad Men become style words, materials and brands. Each choice says which pick it came from." },
  { chapter: 0, project: "Maya's house", as: "maya", path: "/project/{maya}?step=plans", title: "Three plans, each with its reasons", what: "Drawn by Arcon's layout engine from her answers and ranked by how well each fits how the family lives, with the trade-offs on every card." },
  { chapter: 0, project: "Maya's house", as: "maya", path: "/project/{maya}?step=walkthrough#walk", title: "Walk through it in 3D", what: "Furniture in her style, day and night. Look around opens the house from above with every room named." },
  { chapter: 0, project: "Maya's house", as: "maya", path: "/project/{maya}?step=budget", title: "A budget in dollars, room by room", what: "Los Angeles rates, three finish levels, the greenery score and how long the build takes." },
  { chapter: 0, project: "Maya's house", as: "maya", path: "/project/{maya}?step=shop", title: "A shopping list from her taste", what: "Every piece in the 3D, priced, from brands matched to what Maya loves, each saying which pick it came from." },
  { chapter: 0, project: "Maya's house", as: "maya", path: "/project/{maya}?step=drawings", title: "Sketches and drawings for the builder", what: "Hand-drawn sketches, plans, elevations and schedules, as a PDF and as DXF for CAD, made from the same design as the 3D." },
  { chapter: 1, project: "Ortiz Studio", as: "lena", path: "/home?view=fees", title: "Lena's studio and her fees", what: "The architect's side: every client by stage, what's waiting on her, and one thread per project. Her fee ledger across clients shows each fee billed, waiting or settled, and the ones clients paid through PayPal, straight into her account." },
  { chapter: 1, project: "Maya's house", as: "maya", path: "/project/{maya}?tab=overview#fees", title: "Fees, paid with PayPal", what: "Maya paid Lena's first fee with PayPal, straight into Lena's account, and it settled the moment it went through. Try it: press Pay with PayPal on Drawings and permits and pay with the sandbox test card shown there (no real money, no sign-up). Ask \"What is this for?\" first and Arcon explains the fee." },
  { chapter: 1, project: "Maya's house", as: "lena", path: "/project/{maya}?tab=thread#latest", title: "Bills written with Arcon", what: "When Lena or Mike presses Bill, Arcon's agent reads what happened since their last bill and drafts the note; they read it and send it. The bills and notes sit in the thread with the design, the approvals and the site. Arcon writes the words; the amount is always the one the pro set." },
  { chapter: 1, project: "Maya's house", as: "mike", path: "/project/{maya}?tab=site", title: "Mike runs the building site", what: "Phases on a timeline, today's crew, materials in sq ft and pounds, his quote, and each finished stage signed off by Lena. Maya pays each stage with PayPal as it finishes, straight to Mike; the one just finished is billed with Arcon's note." },
  { chapter: 1, project: "Ana's apartment", as: "lena", path: "/project/{ana}?tab=site", title: "The last week before moving in", what: "Ana's apartment: the snag list (one fixed, two to go), the handover pack, and the keys waiting for Ana to accept. Every finished stage is paid through PayPal; the last stage and the handover are still to come." },
  { chapter: 2, project: "Sam's café", as: "sam", path: "/project/{sam}?step=brief#neighbourhood", title: "A café, read against its street", what: "Sam's Brooklyn café, unlocked with one PayPal payment: Arcon reads who already comes to the cafés nearby, by age, and ranks them against Sam's taste." },
  { chapter: 2, project: "Sam's café", as: "sam", path: "/project/{sam}?step=walkthrough#reveal", title: "Sam's café by night", what: "The sign over the door, then inside: the counter and back bar along the back wall, a coloured glass pendant over every table, a neon cup and an LED cove from rose to teal. Day switches the lights off." },
];

/** A stop's real path, with the seeded project ids filled in. */
export const pathOf = (stop: Stop, ids: Partial<Record<ProjectKey, string>>) => stop.path.replace(/\{(\w+)\}/g, (_, k: ProjectKey) => ids[k] ?? "");

/** The stop for a step number from a URL (1-based), kept in range. */
export const stopAt = (n: number) => Math.min(TOUR.length, Math.max(1, Math.trunc(n) || 1));

/** The first stop (1-based) of each chapter. */
export const chapterStarts = () => CHAPTERS.map((_, c) => TOUR.findIndex((s) => s.chapter === c) + 1);

// Who is on which project, so switching role keeps the page when that person is on it too.
const ON: Record<ProjectKey, DemoRole[]> = { maya: ["maya", "lena", "mike"], parks: ["lena"], ana: ["lena", "mike"], sam: ["sam"] };

/** Where a role switch lands: the same project page if they're on it, otherwise their home. */
export function switchTo(as: DemoRole, from: string, ids: Partial<Record<ProjectKey, string>>): string {
  const id = from.match(/^\/project\/([0-9a-f-]{36})/)?.[1];
  const key = (Object.keys(ids) as ProjectKey[]).find((k) => ids[k] === id);
  return key && ON[key].includes(as) ? from : "/home";
}
