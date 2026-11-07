"use client";

import { TourNext } from "@/components/demo/TourBar";
import { DeleteProject } from "./DeleteProject";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { STEPS, type StepId } from "./steps";
import { TeamPanel } from "./TeamPanel";
import { ThreadView, type Room } from "./ThreadView";
import { Fees } from "./Fees";
import { SiteCard, SiteView } from "./SiteView";
import type { Layout } from "@/lib/layout/schema";
import { ROLE_NAME, can, type MemberRole, type ProjectRole } from "@/lib/project/access";
import { nextLine, STAGES, stageOf, tabsFor, unlockPrice, type Tab } from "@/lib/project/stage";
import { chime, ok, tick } from "@/components/fx/sfx";

type Home = {
  id: string;
  title: string | null;
  space_type: string | null;
  status: Parameters<typeof stageOf>[0]["status"];
  chosen_option: number | null;
  unlocked?: boolean;
  unread?: number;
  pros?: string[];
  mode?: "owner" | "pro";
  studio?: { id: string; name: string; logo_url: string | null } | null;
  options?: Layout[] | null;
  /** a pro's own project: what kind of pro owns it (a builder's design-and-build needs no other builder) */
  ownerKind?: string | null;
  /** a pro who's been asked to join: the request to answer here */
  request?: { id: number; role: "architect" | "builder"; from: string; message: string | null } | null;
  site: { location?: string; units?: "imperial" | "metric" };
};

// A project once its guided steps are done: whose it is, where it is in its life, and tabs for this person.
// The tabs show the same step screens as the guided tour, so every button inside them keeps working.
export function ProjectHome({
  p,
  role,
  whose,
  step,
  pane,
  setStep,
  showPane,
  discuss,
  onStatus,
  body,
  onUnlocked,
  onTour,
}: {
  p: Home;
  role: ProjectRole;
  whose: string | null;
  step: StepId;
  pane: "overview" | "thread" | "site" | null;
  setStep: (s: StepId) => void;
  showPane: (pane: "overview" | "thread" | "site") => void;
  discuss: Room | null;
  onStatus: (status: string) => void;
  body: (s: StepId) => ReactNode;
  onUnlocked: () => void;
  onTour: () => void;
}) {
  const unlocked = !!p.unlocked;
  const tabs = tabsFor(role, unlocked);
  const active: Tab = pane ? (tabs.find((t) => t.id === pane) ?? tabs[0]) : (tabs.find((t) => t.steps.includes(step)) ?? tabs[0]);
  const stage = stageOf(p);
  const label = (s: string) => (s === "brief" ? (whose ? `${whose}'s style` : "Style") : s === "walkthrough" ? "3D" : (STEPS.find((x) => x.id === s)?.label ?? s));
  // the Team panel, open for a role ("builder") or just open
  const [team, setTeam] = useState<MemberRole | boolean>(false);

  return (
    <div className="flex flex-1 flex-col">
      {p.request && <AskedToJoin request={p.request} title={p.title} />}
      <header className="mx-auto w-full max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-ink-soft">
              {whose ? `${whose}'s design` : "Your design"}
              {role !== "owner" && <span className="ml-2 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent">You&apos;re the {ROLE_NAME[role].toLowerCase()}</span>}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl">{p.title ?? "Your project"}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TourNext />
            {/* The studio behind the design, shown to its clients (the pros themselves don't need their own logo back). */}
            {p.studio && (role === "client" || role === "viewer" || (role === "owner" && p.mode !== "pro")) && (
              <span className="flex items-center gap-2 rounded-full border border-line bg-paper-raised py-1 pl-1 pr-3 text-xs">
                {p.studio.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.studio.logo_url} alt="" className="h-6 w-6 rounded-full object-contain" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-btn text-[10px] text-btn-ink">{p.studio.name[0]}</span>
                )}
                Designed with {p.studio.name}
              </span>
            )}
            {!unlocked && <span className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft">Preview</span>}
          </div>
        </div>
        {/* Where the project is in its life */}
        <ol className="mt-5 grid grid-cols-6 gap-1.5" aria-label="Project progress">
          {STAGES.map((s, i) => (
            <li key={s.id} aria-current={i === stage ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${i < stage ? "bg-leaf" : i === stage ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 block truncate text-[11px] sm:text-xs ${i === stage ? "font-medium text-ink" : "text-ink-soft"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
        <nav aria-label="Project" className="mt-6 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => (t.id === "overview" || t.id === "thread" || t.id === "site" ? (tick(), showPane(t.id)) : setStep(t.steps[0] as StepId))}
              aria-current={active.id === t.id ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${active.id === t.id ? "border-accent text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
            >
              {t.label}
              {t.locked && <span aria-label="locked"> 🔒</span>}
              {t.id === "thread" && !!p.unread && pane !== "thread" && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-white">{p.unread}</span>}
            </button>
          ))}
        </nav>
        {!active.locked && active.steps.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {active.steps.map((s) => (
              <button
                key={s}
                onClick={() => setStep(s as StepId)}
                aria-pressed={step === s}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${step === s ? "bg-btn text-btn-ink" : "border border-line text-ink-soft hover:text-ink"}`}
              >
                {label(s)}
                {s === "workspace" && !unlocked && " 🔒"}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* No exit animation: the 3D's room labels are separate React roots and break if kept alive while leaving. */}
      <motion.div key={pane ?? step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex-1 pt-4">
          {active.id === "site" ? (
            <SiteView projectId={p.id} onStatus={onStatus} onPlans={() => setStep("plans")} onTeam={() => setTeam("builder")} />
          ) : active.id === "thread" ? (
            <ThreadView
              key={discuss?.id ?? "thread"}
              projectId={p.id}
              layout={p.chosen_option !== null ? (p.options?.[p.chosen_option] ?? null) : null}
              units={p.site.units ?? (p.site.location && /\b(US|USA|TX|CA|NY|FL)\b/.test(p.site.location) ? "imperial" : "metric")}
              room={discuss}
              onStatus={onStatus}
            />
          ) : active.id === "overview" ? (
            <Overview p={p} role={role} whose={whose} unlocked={unlocked} go={(s) => setStep(s)} onSite={() => showPane("site")} onThread={() => showPane("thread")} onTeam={(r?: MemberRole) => setTeam(r ?? true)} onUnlocked={onUnlocked} onTour={onTour} />
          ) : active.locked || (step === "workspace" && !unlocked) ? (
            <div className="mx-auto max-w-6xl px-4 py-8">
              <Unlock p={p} role={role} onUnlocked={onUnlocked} />
            </div>
          ) : (
            body(step)
          )}
      </motion.div>
      {typeof document !== "undefined" && createPortal(<AnimatePresence>{team && <TeamPanel id={p.id} want={typeof team === "string" ? team : undefined} onClose={() => setTeam(false)} />}</AnimatePresence>, document.body)}
    </div>
  );
}

function Overview({ p, role, whose, unlocked, go, onSite, onThread, onTeam, onUnlocked, onTour }: { p: Home; role: ProjectRole; whose: string | null; unlocked: boolean; go: (s: StepId) => void; onSite: () => void; onThread: () => void; onTeam: (role?: MemberRole) => void; onUnlocked: () => void; onTour: () => void }) {
  const plan = p.chosen_option !== null ? p.options?.[p.chosen_option]?.concept?.name : null;
  const cards: { title: string; text: string; to?: StepId; action?: () => void; locked?: boolean }[] = [
    { title: "Design", text: plan ? `${plan}: style, plans and 3D` : "Style, plans and 3D", to: "brief" },
    ...(role !== "viewer" ? [{ title: "Budget & shopping", text: "Cost by room and the shopping list", to: "budget" as StepId, locked: !unlocked }] : []),
    { title: "Thread", text: p.unread ? `${p.unread} new message${p.unread === 1 ? "" : "s"}` : "Talk with everyone on the project; reviews happen here", action: onThread },
    { title: "Team", text: "Who's on this project, and invite people", action: onTeam },
    ...(role !== "viewer" ? [{ title: "Files", text: "PDF, CAD drawing, sketches, video", to: "drawings" as StepId, locked: !unlocked }] : []),
  ];
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16">
      <p className="rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4">
        <span className="text-xs uppercase tracking-widest text-accent">Next</span>
        <span className="mt-1 block text-lg">{nextLine(p, role)}</span>
      </p>
      {!unlocked && (
        <div className="mt-4">
          <Unlock p={p} role={role} onUnlocked={onUnlocked} />
        </div>
      )}
      {(p.status === "building" || p.status === "done") && role !== "viewer" && <SiteCard projectId={p.id} status={p.status} onOpen={onSite} />}
      {role === "owner" && <WhoBuilds p={p} whose={whose} onTeam={onTeam} />}
      {role !== "viewer" && <Fees projectId={p.id} location={p.site.location} />}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.title}
            onClick={() => (c.action ? c.action() : c.to && go(c.to))}
            className="group rounded-2xl border border-line bg-paper-raised p-5 text-left transition hover:-translate-y-0.5 hover:border-accent"
          >
            <p className="font-serif text-2xl group-hover:text-accent">
              {c.title}
              {c.locked && <span className="ml-2 text-sm">🔒</span>}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{c.text}</p>
          </button>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {can(role, "edit") && (
          <button onClick={onTour} className="text-sm text-ink-soft hover:text-accent">
            ↻ Take the guided tour again
          </button>
        )}
        {role === "owner" && <DeleteProject id={p.id} name={p.title ?? "this project"} variant="link" />}
      </div>
    </main>
  );
}

// The unlock card. ponytail: unlocking is free until PayPal checkout lands (R5); the button says so plainly.
// `lead`: what the step behind it opens, when it stands in for one step of the guided tour.
export function Unlock({ p, role, onUnlocked, lead }: { p: Pick<Home, "id" | "space_type">; role: ProjectRole; onUnlocked: () => void; lead?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const price = unlockPrice(p.space_type);
  async function unlock() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${p.id}/unlock`, { method: "POST" });
    setBusy(false);
    if (res.status === 401) {
      // a guest signs in (their project comes with them), then lands back here to unlock
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't unlock. Please try again.");
    chime();
    // a moment to see it worked, then the project opens up
    setDone(true);
    setTimeout(onUnlocked, 1600);
  }
  if (done)
    return (
      <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-leaf/40 bg-leaf/5 p-5" role="status">
        <p className="font-serif text-2xl text-leaf">✓ Unlocked</p>
        <p className="mt-1 text-sm text-ink-soft">Everything is open: the walk inside, the budget, the shopping list, Make changes, every download and your team.</p>
      </motion.section>
    );
  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <p className="font-serif text-2xl">Unlock this project</p>
      {lead && <p className="mt-1 font-medium">{lead}</p>}
      <p className="mt-1 text-sm text-ink-soft">
        You&apos;re seeing the preview: your style, the three plans and the 3D from outside. Unlocking opens the walk inside, the budget, the shopping list, Make
        changes, every download and inviting your architect or builder. One payment of ${price} for this project.
      </p>
      {role === "owner" ? (
        <button onClick={unlock} disabled={busy} className="glow-btn mt-4 rounded-full px-6 py-2.5 text-sm disabled:opacity-60">
          {busy ? "Unlocking…" : `Unlock for $${price} · free during the preview`}
        </button>
      ) : (
        <p className="mt-4 text-sm">Ask the project&apos;s owner to unlock it.</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

// "Who will build this?" for an owner without an architect or builder yet: invite your own, let Arcon suggest
// pros by taste, or not yet (hidden on this device until the next stage).
function WhoBuilds({ p, whose, onTeam }: { p: Home; whose: string | null; onTeam: (role: MemberRole) => void }) {
  // A pro's own client project already has its designer; a builder's own (design-and-build) needs no one else.
  const need = p.mode === "pro" && p.ownerKind === "builder" ? null : p.mode !== "pro" && !p.pros?.includes("architect") && stageOf(p) < 3 ? "architect" : !p.pros?.includes("builder") ? "builder" : null;
  const key = `arcon-who-${p.id}-${need}-${stageOf(p)}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (!need || hidden) return null;
  return (
    <section className="mt-4 rounded-2xl border border-line bg-paper-raised p-5">
      <p className="font-serif text-2xl">{need === "architect" ? "Who will design and build this with you?" : "Who will build this?"}</p>
      <p className="mt-1 text-sm text-ink-soft">
        {need === "architect" ? "Bring in an architect or interior designer to refine the plan and see it through." : "Bring in a builder to price it, plan the site and build it."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => (tick(), onTeam(need))} className="glow-btn rounded-full px-5 py-2 text-sm">
          I have one, invite them
        </button>
        <a href={`/pros?project=${p.id}&role=${need}`} onClick={() => tick()} className="rounded-full border border-line px-5 py-2 text-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent">
          {whose ? `Suggest someone who fits ${whose}'s taste` : "Suggest someone who fits my taste"}
        </a>
        <button
          onClick={() => {
            tick();
            setHidden(true);
            try {
              localStorage.setItem(key, "1");
            } catch {}
          }}
          className="rounded-full px-4 py-2 text-sm text-ink-soft hover:text-ink"
        >
          Not yet
        </button>
      </div>
    </section>
  );
}

// A pro asked to join looks at the design here, then answers right on it.
function AskedToJoin({ request, title }: { request: NonNullable<Home["request"]>; title: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function answer(accept: boolean) {
    tick();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pros/requests/${request.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accept }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't go through.");
    ok();
    window.location.assign(accept ? window.location.pathname : "/home?view=requests");
  }
  return (
    <section className="mx-auto mb-4 w-full max-w-6xl px-4">
      <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
        <p className="font-medium">
          {request.from} asked you to join {title ?? "this project"} as the {request.role}
        </p>
        {request.message && <p className="mt-1 text-sm text-ink-soft">&ldquo;{request.message}&rdquo;</p>}
        <p className="mt-1 text-xs text-ink-soft">Look around the design first; you join only if you say yes.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => answer(true)} disabled={busy} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60">
            Accept
          </button>
          <button onClick={() => answer(false)} disabled={busy} className="rounded-full border border-line px-5 py-2 text-sm transition hover:border-accent disabled:opacity-60">
            Decline
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
