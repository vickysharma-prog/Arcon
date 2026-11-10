import { supabaseAdmin } from "../supabase/admin.ts";
import { isUnlocked } from "./stage.ts";
import type { Project } from "./store.ts";

// Whether a project is open: paid for, carried by a pro on it with a live plan or trial, or a demo.

type Pro = { plan: string; plan_until: string | null; trial_until: string | null; demo: boolean };

/** When this person's pro access ends: a live Studio or Build plan, else their trial. */
export const proUntil = (p: Pick<Pro, "plan" | "plan_until" | "trial_until">) => {
  const plan = p.plan === "pro" || p.plan === "build" ? p.plan_until : null;
  return [plan, p.trial_until].filter(Boolean).sort().at(-1) ?? null;
};

/**
 * A pro's own client project runs on their plan or trial. An owner's project opens by paying for it, or when a pro on it
 * has a paid plan; a trial alone doesn't open someone else's project (Vicky, 16 Oct).
 */
export async function unlockedFor(p: Pick<Project, "id" | "owner_id" | "unlocked_at" | "mode">): Promise<boolean> {
  if (p.unlocked_at) return true;
  const db = supabaseAdmin();
  const { data: members } = await db.from("project_members").select("user_id").eq("project_id", p.id).in("role", ["architect", "builder"]);
  const ids = [p.owner_id, ...(members ?? []).map((m) => m.user_id)].filter((x): x is string => !!x);
  if (!ids.length) return false;
  const { data } = await db.from("profiles").select("plan, plan_until, trial_until, demo").in("user_id", ids);
  const pros = (data ?? []) as Pro[];
  const until = p.mode === "pro" ? pros.map(proUntil) : pros.map((x) => (x.plan === "pro" || x.plan === "build" ? x.plan_until : null));
  return isUnlocked(p, until, Date.now(), pros.some((x) => x.demo));
}

/** Unlock a project once PayPal has captured its payment (lib/paypal/settle.ts is the only caller). */
export async function unlockProject(id: string) {
  const { error } = await supabaseAdmin().from("projects").update({ unlocked_at: new Date().toISOString() }).eq("id", id).is("unlocked_at", null);
  if (error) throw new Error(error.message);
}

/** Whether a pro's plan or trial is live right now (or they're a demo account). */
export const proActive = (p: Pro | null) => !!p && (p.demo || isUnlocked({}, [proUntil(p)]));
