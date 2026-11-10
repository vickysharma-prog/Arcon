import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin.ts";
import { ROLES, type Plan } from "./roles.ts";

export { ROLES, ROLE_LABEL, type Role, type Plan } from "./roles.ts";

// A person's account: the role they picked at sign-up and a short profile for that role.

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

/** What the sign-up and account forms may send. Company is required where the role works under a name. */
export const ProfileInput = z
  .object({
    role: z.enum(ROLES),
    name: text(80),
    company: optional(100),
    city: optional(80),
    units: z.enum(["metric", "imperial"]).default("metric"),
    crew_size: z.coerce.number().int().min(1).max(10000).optional().nullable(),
    trades: z.array(text(40)).max(20).default([]),
    // Pros only: shown to clients looking for someone ("Suggest someone"), and whether to be listed at all.
    about: optional(400),
    fee_note: optional(120),
    listed: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    if ((p.role === "architect" || p.role === "builder") && !p.company)
      ctx.addIssue({ code: "custom", path: ["company"], message: p.role === "architect" ? "Add your studio's name" : "Add your company's name" });
  })
  .transform((p) => ({
    ...p,
    // fields that only make sense for builders are dropped for everyone else
    crew_size: p.role === "builder" ? (p.crew_size ?? null) : null,
    trades: p.role === "builder" ? p.trades : [],
    about: p.role === "architect" || p.role === "builder" ? p.about : null,
    fee_note: p.role === "architect" || p.role === "builder" ? p.fee_note : null,
  }));
export type ProfileInput = z.infer<typeof ProfileInput>;

export type Profile = ProfileInput & { user_id: string; logo_url: string | null; plan: Plan; plan_until: string | null; trial_until: string | null; demo: boolean; paypal_email?: string | null; paypal_subscription?: string | null };

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin().from("profiles").select().eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}

const TRIAL_DAYS = 14;

export async function saveProfile(userId: string, input: ProfileInput): Promise<Profile> {
  // A pro's 14-day trial starts the first time they say they're an architect or builder; no card needed.
  const before = await getProfile(userId);
  const pro = input.role === "architect" || input.role === "builder";
  const trial = pro && !before?.trial_until ? { trial_until: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString() } : {};
  const { data, error } = await supabaseAdmin().from("profiles").upsert({ user_id: userId, ...input, ...trial }).select().single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function setLogo(userId: string, url: string | null) {
  const { error } = await supabaseAdmin().from("profiles").update({ logo_url: url }).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Projects this browser started as a guest move into the account. A project that already has an owner is never taken. */
export async function claimGuestProjects(userId: string, guestId: string | null): Promise<number> {
  if (!guestId) return 0;
  const { data, error } = await supabaseAdmin()
    .from("projects")
    .update({ owner_id: userId })
    .eq("guest_id", guestId)
    .is("owner_id", null)
    .select("id");
  if (error) throw new Error(error.message);
  return data.length;
}

export type ProjectCard = { id: string; title: string | null; space_type: string | null; status: string; mode: string; site: { location?: string }; updated_at: string; chosen_option: number | null; unlocked_at: string | null; designed_for: string | null; toured_at?: string | null };

export async function projectsOf(userId: string): Promise<ProjectCard[]> {
  const { data, error } = await supabaseAdmin()
    .from("projects")
    .select("id, title, space_type, status, mode, site, updated_at, chosen_option, unlocked_at, designed_for, toured_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data as ProjectCard[];
}

/** Only same-site paths are followed after sign-in, so a link can't bounce people to another site. */
export const safeNext = (next: string | null | undefined, fallback = "/home") =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;

export async function emailOf(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}
