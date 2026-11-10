import type { DemoRole } from "./story.ts";

// The demo accounts (made by scripts/demo-world.ts, which reuses them). Fixed here so proxy.ts can tell a demo
// session from a real one without a database call. Ids, not secrets.
export const DEMO_IDS: Record<DemoRole, string> = {
  maya: "25778a8b-a2b4-47c6-a012-e4f2ad695531",
  lena: "3e8fdfa3-cd11-4c02-889a-925e9174826a",
  mike: "8c0cb223-62ca-45c7-8203-fd6854c682c2",
  sam: "dd014f0e-b3aa-4e9d-9a4c-ee52fa682bcc",
};
const IDS = new Set(Object.values(DEMO_IDS));

/** The tour bar's cookie: "step.role". Not a session: the signed user cookie is. */
export const DEMO_COOKIE = "arcon_demo";


export const VIEW_ONLY = "This is the demo, so it's view only. Sign up free to try it on your own project.";

// What a demo session may still send: the interview's live taste card, signing out, and asking Arcon's agent for a fee
// note (a bill's note, a reminder, what a fee is for), which drafts words and saves nothing; sending one stays refused.
const OPEN = [
  { method: "POST", path: "/api/interview/taste" },
  { method: "DELETE", path: "/api/session" },
  { method: "POST", path: /^\/api\/projects\/[0-9a-f-]{36}\/fees\/\d+\/note$/ },
];

/** Whether a request from this user must be refused: anything but reading, for a demo account. */
export function refuseDemo(userId: string | null, method: string, path: string): boolean {
  if (!userId || !IDS.has(userId) || method === "GET" || method === "HEAD") return false;
  return !OPEN.some((o) => o.method === method && (typeof o.path === "string" ? path === o.path : o.path.test(path)));
}
