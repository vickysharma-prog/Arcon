import { readPurpose } from "./order.ts";
import type { Subscription } from "./client.ts";

// Pro plans on PayPal Subscriptions: Studio ("pro") and Build, each by the month or the year. The PayPal plan ids are
// made once by scripts/paypal-setup.ts and kept in the environment.

export type Plan = "pro" | "build";
export type Cycle = "month" | "year";

export const PRICES: Record<Plan, Record<Cycle, number>> = { pro: { month: 99, year: 990 }, build: { month: 299, year: 2990 } };
export const PLAN_NAME: Record<Plan, string> = { pro: "Studio", build: "Build" };

const ENV: Record<Plan, Record<Cycle, string>> = {
  pro: { month: "PAYPAL_PLAN_PRO_MONTH", year: "PAYPAL_PLAN_PRO_YEAR" },
  build: { month: "PAYPAL_PLAN_BUILD_MONTH", year: "PAYPAL_PLAN_BUILD_YEAR" },
};

export const planId = (plan: Plan, cycle: Cycle, env: Record<string, string | undefined> = process.env) => env[ENV[plan][cycle]] ?? null;

/** Which of Arcon's plans a PayPal plan id is, or null for one Arcon didn't make. */
export function planOf(id: string, env: Record<string, string | undefined> = process.env): { plan: Plan; cycle: Cycle } | null {
  for (const plan of ["pro", "build"] as const) for (const cycle of ["month", "year"] as const) if (env[ENV[plan][cycle]] === id) return { plan, cycle };
  return null;
}

const DAY = 86_400_000;

/**
 * What a subscription means for the person's profile, or null when it isn't one of Arcon's or isn't theirs.
 * Active: the plan runs to the next charge, with a day's grace for PayPal to take it. Cancelled: it runs to the end of
 * what was paid (`plan_until` is left as it is). Suspended or expired: it ends now.
 */
export function profileFrom(sub: Subscription, now = Date.now(), env: Record<string, string | undefined> = process.env):
  | { userId: string; plan: Plan; until: string | null | "keep"; subscription: string | null }
  | null {
  const who = readPurpose(sub.custom_id);
  const which = planOf(sub.plan_id, env);
  if (!who || who.kind !== "plan" || !which || which.plan !== who.plan) return null;
  if (sub.status === "ACTIVE") {
    const next = sub.billing_info?.next_billing_time;
    const until = next ? new Date(new Date(next).getTime() + DAY).toISOString() : new Date(now + (which.cycle === "year" ? 366 : 31) * DAY).toISOString();
    return { userId: who.userId, plan: which.plan, until, subscription: sub.id };
  }
  if (sub.status === "CANCELLED") return { userId: who.userId, plan: which.plan, until: "keep", subscription: null };
  if (sub.status === "SUSPENDED" || sub.status === "EXPIRED") return { userId: who.userId, plan: which.plan, until: new Date(now).toISOString(), subscription: null };
  return null; // APPROVAL_PENDING, APPROVED: nothing paid yet
}
