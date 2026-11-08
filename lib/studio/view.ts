import type { Layout } from "../layout/schema.ts";
import type { Project } from "../project/store.ts";
import type { ProjectRole } from "../project/access.ts";
import type { Estimate } from "../budget/costs.ts";
import { money } from "../budget/costs.ts";

// What Arcon Studio reads about a project. Pure, so the shape Studio relies on is tested without a database.

export type StudioRoom = { id: string; name: string; kind: string; floor: number; area: number; rect: { x: number; y: number; w: number; h: number }; zone: string; open?: boolean };

export type StudioDesign = {
  id: string;
  title: string;
  spaceType: string | null;
  status: Project["status"];
  role: ProjectRole;
  canEdit: boolean;
  location: string | null;
  units: "imperial" | "metric";
  version: number;
  locked: boolean;
  concept: { name: string; summary: string | null; why: string[] } | null;
  shell: { width: number; depth: number };
  floors: number;
  rooms: StudioRoom[];
  /** Every space on the plan, corridors and stairs too, for drawing it. */
  spaces: StudioRoom[];
  url: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Spaces a person lives in: corridors and stairs are drawn but not listed as rooms. */
const isRoom = (kind: string) => kind !== "corridor" && kind !== "stairs";

export function designView(p: Project, layout: Layout, role: ProjectRole, canEdit: boolean, version: number, locked: boolean, origin: string): StudioDesign {
  const spaces = layout.floors.flatMap((f) =>
    f.spaces.map((s) => ({ id: s.id, name: s.name, kind: s.kind, floor: f.level, area: round1(s.rect.w * s.rect.h), rect: s.rect, zone: s.zone, ...(s.open === undefined ? {} : { open: s.open }) })),
  );
  return {
    id: p.id,
    title: p.title ?? "Untitled project",
    spaceType: p.space_type,
    status: p.status,
    role,
    canEdit,
    location: p.site?.location ?? null,
    units: p.site?.units ?? "metric",
    version,
    locked,
    concept: layout.concept ? { name: layout.concept.name, summary: layout.concept.summary ?? null, why: layout.concept.why } : null,
    shell: layout.shell,
    floors: layout.floors.length,
    rooms: spaces.filter((s) => isRoom(s.kind)),
    spaces,
    url: `${origin}/project/${p.id}`,
  };
}

export type StudioBudget = {
  currency: string;
  tier: string;
  low: number;
  high: number;
  text: string;
  area: number;
  byCategory: { category: string; amount: number }[];
  rooms: { id: string; name: string; total: number }[];
};

export function budgetView(e: Estimate): StudioBudget {
  return {
    currency: e.market.currency,
    tier: e.tier,
    low: Math.round(e.total.low),
    high: Math.round(e.total.high),
    text: `${money(e.total.low, e.market)} to ${money(e.total.high, e.market)}`,
    area: round1(e.area),
    byCategory: Object.entries(e.byCategory)
      .map(([category, amount]) => ({ category, amount: Math.round(amount ?? 0) }))
      .sort((a, b) => b.amount - a.amount),
    rooms: e.rooms.map((r) => ({ id: r.id, name: r.name, total: Math.round(r.total) })).sort((a, b) => b.total - a.total),
  };
}
