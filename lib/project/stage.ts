import { can, type ProjectRole } from "./access.ts";

// The rules behind the project home: where a project is in its life, which tabs each person sees, what stays
// locked until the project is unlocked, and what it costs. Safe to import from the browser.

export const STAGES = [
  { id: "know", label: "Know you" },
  { id: "design", label: "Design" },
  { id: "review", label: "Review" },
  { id: "approved", label: "Approved" },
  { id: "building", label: "Building" },
  { id: "done", label: "Moved in" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

type Status = "interview" | "designing" | "ready" | "review" | "approved" | "building" | "done";

/** Where the project is now, as an index into STAGES. */
export function stageOf(p: { status: Status; chosen_option: number | null }): number {
  switch (p.status) {
    case "interview":
      return 0;
    case "review":
      return 2;
    case "approved":
      return 3;
    case "building":
      return 4;
    case "done":
      return 5;
    default:
      return 1; // designing or ready: the design is being made or worked on
  }
}

/** One line on what happens next, said to this person. */
export function nextLine(p: { status: Status; chosen_option: number | null }, role: ProjectRole): string {
  const pro = role === "architect" || role === "builder";
  switch (p.status) {
    case "interview":
      return pro ? "Waiting for the client's answers to Let's get to know you." : "Finish Let's get to know you to see your design.";
    case "designing":
    case "ready":
      if (p.chosen_option === null) return can(role, "edit") ? "Pick one of the three plans." : "The plan is still being chosen.";
      return can(role, "edit") ? "Make any changes, then send it for review." : "The design is being worked on.";
    case "review":
      return can(role, "approve") ? "Look it over, then approve it or ask for changes." : "Waiting for the client to approve.";
    case "approved":
      return role === "builder" ? "Approved. Plan the site and start building." : "Approved. Next: bring in your builder.";
    case "building":
      return role === "builder" ? "Keep the site updated for everyone." : "Building is under way. Follow the progress here.";
    case "done":
      return "Handed over. Enjoy the space.";
  }
}

export type TabId = "overview" | "design" | "thread" | "site" | "money" | "files";
export type Tab = { id: TabId; label: string; steps: readonly string[]; locked: boolean };

/** The tabs on the project home for this person. Locked tabs still show, with an unlock card inside. */
export function tabsFor(role: ProjectRole, unlocked: boolean): Tab[] {
  const tabs: Tab[] = [
    { id: "overview", label: "Overview", steps: [], locked: false },
    { id: "design", label: "Design", steps: can(role, "edit") ? ["brief", "plans", "walkthrough", "workspace"] : ["brief", "plans", "walkthrough"], locked: false },
    { id: "thread", label: "Thread", steps: [], locked: false },
  ];
  // The building site: always there, so everyone can see what it takes to get building.
  if (role !== "viewer") tabs.push({ id: "site", label: "Site", steps: [], locked: false });
  if (role !== "viewer") {
    tabs.push({ id: "money", label: "Budget & shopping", steps: ["budget", "shop"], locked: !unlocked });
    tabs.push({ id: "files", label: "Files", steps: ["drawings"], locked: !unlocked });
  }
  return tabs;
}

/** The steps that wait for unlocking, in the guided tour and on the project home alike: the budget, the shopping list,
 *  making changes and the exports. Style, the three plans and the 3D from outside stay free. */
export const lockedSteps = (unlocked: boolean): string[] => (unlocked ? [] : ["budget", "shop", "workspace", "drawings"]);

/** The one-time price to unlock a project: businesses get more (neighbourhood read, more rooms), so pay more. */
export const unlockPrice = (spaceType: string | null | undefined) => (["cafe", "office", "shop", "hotel"].includes(spaceType ?? "") ? 299 : 149);

/**
 * A project is open when it was paid for, a pro on it has an active plan or trial, or it is a demo.
 * `pros` lists the plan end dates of the pros on the project (null when they have none).
 */
export function isUnlocked(p: { unlocked_at?: string | null }, pros: (string | null)[], now = Date.now(), demo = false): boolean {
  return demo || !!p.unlocked_at || pros.some((until) => !!until && new Date(until).getTime() > now);
}

/** The name a shared design goes by: the person it was designed for, else its owner. */
export const whoseName = (designedFor: string | null | undefined, ownerName: string | null | undefined) => (designedFor || ownerName)?.trim().split(/\s+/)[0] ?? null;
