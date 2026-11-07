import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import { HOME_TITLE } from "@/lib/shell/nav";
import { crewOf, deliveriesOf, feeLedger, moneyOf, sitesRunBy } from "@/lib/manage/data";
import { CrewBoard, Deliveries, FeeLedger, SiteMoney } from "@/components/manage/Manage";
import { Reveal } from "@/components/fx/Motion";
import { currentUser } from "@/lib/auth/server";
import { getProfile, projectsOf, type Profile, type ProjectCard } from "@/lib/account/profile";
import { STAGES, nextLine, stageOf } from "@/lib/project/stage";
import { ROLE_SHORT } from "@/lib/account/roles";
import { NewClient } from "@/components/account/NewClient";
import { DeleteProject } from "@/components/project/DeleteProject";
import { Requests } from "@/components/pros/Requests";
import { dayIn } from "@/lib/site/plan";
import { memberProjects } from "@/lib/project/team";
import { PageLoading } from "@/components/fx/PageLoading";
import { Decode } from "@/components/fx/Decode";
import { ROLE_NAME, type ProjectRole } from "@/lib/project/access";
import { boardFor, type Board } from "@/lib/home/board";
import { requestsFor } from "@/lib/pros/directory";
import { statusLine, type Wait } from "@/lib/home/waiting";
import { projectName, SPACE } from "@/lib/home/names";
import { PlanSketch } from "@/components/home/PlanSketch";
import { OpeningDay, PlanOr3D } from "@/components/home/Focus";
import { TourNext } from "@/components/demo/TourBar";

export const metadata: Metadata = { title: "Your projects · Arcon" };

// The signed-in home, on the right of the sidebar. By default it puts the project in focus up front (the one last
// opened, ?p=, else the newest): its plan, where it stands, what's next, and what's waiting on this person. Each of
// the sidebar's tools opens here as a view (?view=): what's waiting, the inbox, every project, a studio's pipeline,
// a builder's day on site, requests and fees.

const YOUR: Record<string, string> = { house: "Your house", apartment: "Your home", studio: "Your studio", cafe: "Your café", office: "Your office", shop: "Your shop", hotel: "Your hotel" };
const BUSINESS = ["cafe", "office", "shop", "hotel"];
const VIEWS = {
  waiting: "Waiting on you",
  inbox: "Inbox",
  all: "All projects",
  pipeline: "Pipeline",
  today: "Today on site",
  requests: "Requests",
  fees: "Fee ledger",
  crew: "Crew & wages",
  deliveries: "Materials & deliveries",
  money: "Site money",
} as const;
type View = keyof typeof VIEWS;
const isView = (v: string | undefined): v is View => !!v && v in VIEWS;

type Card = ProjectCard & { role: ProjectRole; owner?: string | null };

function when(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** What this person's plan gives them, said plainly: a live plan, the trial days left, or nothing for one-time users. */
function planLine(p: Profile): string | null {
  if (p.role !== "architect" && p.role !== "builder") return null;
  const name = p.role === "architect" ? "Studio" : "Build";
  if (p.demo || ((p.plan === "pro" || p.plan === "build") && p.plan_until && new Date(p.plan_until) > new Date())) return `${name} plan active`;
  const left = p.trial_until ? Math.ceil((new Date(p.trial_until).getTime() - Date.now()) / 86_400_000) : 0;
  return left > 0 ? `${name} trial: ${left} day${left === 1 ? "" : "s"} left` : `Your ${name} trial has ended. Your projects stay open to read and sites keep running; design changes and new clients wait for a plan.`;
}

const stage = (p: Card) => stageOf(p as Parameters<typeof stageOf>[0]);

async function HomePageBody({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);
  const view = isView(one("view")) ? (one("view") as View) : null;
  const userId = await currentUser();
  if (!userId) redirect(`/login?next=${encodeURIComponent("/home")}`);
  const profile = await getProfile(userId);
  if (!profile) redirect("/welcome?next=/home");
  const [own, shared] = await Promise.all([projectsOf(userId), memberProjects(userId)]);
  // Every project this person is on, newest first, each with their role on it.
  const projects: Card[] = [...own.map((p) => ({ ...p, role: "owner" as ProjectRole })), ...shared].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  // the project asked for (the one last opened) leads, so the board works out its estimate and opening day
  const asked = projects.findIndex((p) => p.id === one("p"));
  if (asked > 0) projects.unshift(...projects.splice(asked, 1));
  const today = dayIn((await cookies()).get("arcon_tz")?.value);
  const board = await boardFor(
    userId,
    projects.map((p) => ({ id: p.id, name: projectName(p), role: p.role, mode: p.mode, status: p.status, chosen_option: p.chosen_option, space_type: p.space_type, site: p.site })),
    today,
  );
  // a pro asked to join a project answers first: it leads what's waiting
  if (profile.role === "architect" || profile.role === "builder")
    board.waits.unshift(...(await requestsFor(userId)).map((r) => ({ projectId: r.project_id, kind: "request" as const, text: `${r.from} asked you to join ${r.title ?? "their project"} as the ${r.role}`, href: `/project/${r.project_id}` })));
  // the running of the business: fees for anyone with them; crew, deliveries and money for the sites they run
  const mine = projects.map((p) => ({ id: p.id, name: projectName(p), role: p.role, mode: p.mode as "owner" | "pro", location: p.site?.location ?? null }));
  const sites = view === "crew" || view === "deliveries" || view === "money" ? await sitesRunBy(mine) : [];
  const [fees, crew, deliveries, siteMoney] = await Promise.all([
    view === "fees" ? feeLedger(mine, userId) : null,
    view === "crew" ? crewOf(userId, sites, today) : null,
    view === "deliveries" ? deliveriesOf(sites, today) : null,
    view === "money" ? moneyOf(sites) : null,
  ]);
  const role = profile.role;
  const pro = role === "architect" || role === "builder";
  const plan = planLine(profile);
  const line = statusLine(projects.map((p) => STAGES[stage(p)].label), board.waits.length);

  const title = view ? (view === "fees" && role === "owner" ? "Payments" : view === "fees" && role === "builder" ? "Fees & payments" : view === "all" && role === "owner" ? "All my spaces" : VIEWS[view]) : HOME_TITLE[role];

  return (
    <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-2 sm:px-8">
      {/* a faint blueprint grid behind the top of the page */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 opacity-[0.06] [background-image:linear-gradient(var(--accent)_1px,transparent_1px),linear-gradient(90deg,var(--accent)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <Reveal>
        <p className="text-sm text-ink-soft">
          {greeting()}, {profile.name.split(" ")[0]}
          <span className="ml-2 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent">{ROLE_SHORT[role]}</span>
          {profile.company && <> · {profile.company}</>}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-5xl sm:text-6xl">
            <Decode key={title} text={title} />
          </h1>
          <TourNext />
        </div>
        <p className="mt-3 font-mono text-xs text-ink-soft">
          <span className="text-accent">&gt; </span>
          <Decode text={line} delay={0.4} speed={14} />
          {plan && <span className="ml-2 text-accent">· {plan}</span>}
        </p>
      </Reveal>

      {projects.length === 0 && view !== "requests" ? (
        <Empty pro={pro} />
      ) : view === "waiting" ? (
        <Waiting waits={board.waits} all />
      ) : view === "inbox" ? (
        <Inbox projects={projects} board={board} />
      ) : view === "all" ? (
        <Grid projects={projects} board={board} />
      ) : view === "pipeline" ? (
        <StudioBoard projects={projects} board={board} />
      ) : view === "today" ? (
        <SitesBoard projects={projects} board={board} />
      ) : view === "requests" ? (
        <RequestsView />
      ) : fees ? (
        <FeeLedger lines={fees.lines} totals={fees.totals} pro={pro} />
      ) : crew ? (
        <CrewBoard lines={crew.lines} sites={sites} today={today} currency={sites[0]?.currency ?? "USD"} onSite={crew.onSite} earned={crew.earned} />
      ) : deliveries ? (
        <Deliveries {...deliveries} currency={Object.fromEntries(sites.map((s) => [s.id, s.currency]))} />
      ) : siteMoney ? (
        <SiteMoney sites={siteMoney} />
      ) : (
        <>
          <Cockpit projects={projects} board={board} pro={pro} />
          <Waiting waits={board.waits} />
          {projects.length > 1 && (
            <>
              <p className="mt-10 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
                Recent
                <Link href="/home?view=all" className="normal-case tracking-normal text-accent hover:underline">
                  All {projects.length}
                </Link>
              </p>
              <Grid projects={projects.slice(1, 4)} board={board} />
            </>
          )}
        </>
      )}
    </main>
  );
}

// What's waiting on this person, most urgent first.
const KIND: Record<Wait["kind"], { mark: string; tone: string }> = {
  request: { mark: "Asked", tone: "text-accent border-accent/40 bg-accent/5" },
  quote: { mark: "Quote", tone: "text-accent border-accent/40 bg-accent/5" },
  bill: { mark: "Bill", tone: "text-leaf border-leaf/40 bg-leaf/5" },
  review: { mark: "Review", tone: "text-accent border-accent/40 bg-accent/5" },
  change: { mark: "Change", tone: "text-amber-600 border-amber-500/40 bg-amber-500/5" },
  handover: { mark: "Move in", tone: "text-leaf border-leaf/40 bg-leaf/5" },
  snags: { mark: "Snags", tone: "text-amber-600 border-amber-500/40 bg-amber-500/5" },
  changes: { mark: "Changes", tone: "text-amber-600 border-amber-500/40 bg-amber-500/5" },
  pay: { mark: "Pay", tone: "text-accent border-accent/40 bg-accent/5" },
  confirm: { mark: "Confirm", tone: "text-leaf border-leaf/40 bg-leaf/5" },
  late: { mark: "Behind", tone: "text-red-600 border-red-500/40 bg-red-500/5" },
  choose: { mark: "Choose", tone: "text-accent border-accent/40 bg-accent/5" },
  messages: { mark: "Thread", tone: "text-ink-soft border-line bg-paper" },
};

function Waiting({ waits, all = false }: { waits: Wait[]; all?: boolean }) {
  if (!waits.length) return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-leaf/40 bg-leaf/5 px-3 py-1 text-sm text-leaf">✓ Nothing waiting on you</p>;
  const shown = all ? waits : waits.slice(0, 5);
  return (
    <Reveal delay={0.05} className="mt-6 rounded-2xl border border-line bg-paper-raised p-4">
      <p className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
        Waiting on you · {waits.length}
        {shown.length < waits.length && (
          <Link href="/home?view=waiting" className="normal-case tracking-normal text-accent hover:underline">
            See all
          </Link>
        )}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {shown.map((w, i) => (
          <li key={i}>
            <Link href={w.href} className="group flex items-center gap-3 py-2.5 text-sm">
              <span className={`w-20 shrink-0 rounded-full border px-2 py-0.5 text-center font-mono text-[10px] uppercase tracking-wider ${KIND[w.kind].tone}`}>{KIND[w.kind].mark}</span>
              <span className="min-w-0 flex-1 truncate group-hover:text-accent">{w.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

// The stages as a rail, the current one lit.
function Rail({ at }: { at: number }) {
  return (
    <ol className="mt-5 grid grid-cols-6 gap-1.5" aria-label={`Stage: ${STAGES[at].label}`}>
      {STAGES.map((s, j) => (
        <li key={s.id}>
          <span className={`block h-1 rounded-full ${j < at ? "bg-leaf" : j === at ? "animate-pulse bg-accent" : "bg-line"}`} />
          <span className={`mt-1.5 block truncate text-[10px] sm:text-xs ${j === at ? "text-accent" : "text-ink-soft"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

// The project in focus, for every role: its plan (3D on a tap), where it stands, what's next, its numbers, and the
// ways in. A business (by its kind of space) also gets its opening day; a site being built, today's progress.
function Cockpit({ projects, board, pro }: { projects: Card[]; board: Board; pro: boolean }) {
  const focus = projects[0];
  const at = stage(focus);
  const site = board.sites.find((s) => s.id === focus.id);
  const isBusiness = BUSINESS.includes(focus.space_type ?? "");
  return (
    <>
      <Reveal delay={0.08} className="mt-6 overflow-hidden rounded-3xl border border-line bg-paper-raised">
        <div className="grid lg:grid-cols-[1.15fr_1fr]">
          <div className="relative border-b border-line bg-paper p-4 lg:border-b-0 lg:border-r">
            <PlanOr3D projectId={focus.id} layout={board.focus?.layout ?? null}>
              <PlanSketch sketch={board.sketches[focus.id]} labels className="h-full max-h-[22rem] w-full" />
            </PlanOr3D>
          </div>
          <div className="p-6">
            <p className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
              <span>{SPACE[focus.space_type ?? ""] ?? "Project"}{focus.site?.location ? ` · ${focus.site.location}` : ""}</span>
              {focus.role === "owner" && <DeleteProject id={focus.id} name={projectName(focus)} variant="card" />}
            </p>
            <Link href={`/project/${focus.id}`} className="mt-2 block font-serif text-4xl leading-tight hover:text-accent">
              {projectName(focus)}
            </Link>
            {focus.owner && focus.role !== "owner" && (
              <p className="text-sm text-ink-soft">
                {focus.owner.split(" ")[0]}&apos;s design · you&apos;re the {ROLE_NAME[focus.role].toLowerCase()}
              </p>
            )}
            <Rail at={at} />
            {site && (
              <div className="mt-4">
                <p className="flex items-baseline justify-between text-xs text-ink-soft">
                  <span>
                    {site.now ?? (focus.status === "done" ? "Handed over" : "Built: the handover is next")} · {site.onSite} on site today
                    {site.late > 0 && <span className="text-red-600"> · {site.late} behind</span>}
                  </span>
                  <span className="font-serif text-xl text-ink">{site.overall}%</span>
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gradient-to-r from-leaf to-accent" style={{ width: `${site.overall}%` }} />
                </div>
              </div>
            )}
            <p className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Next</span>
              <span className="mt-0.5 block">{site && site.overall >= 100 && focus.status === "building" ? (focus.role === "builder" ? "Built. Fix any snags and hand over the pack; the client accepts the handover." : "Built. Walk through it, list anything to fix, then accept the handover.") : nextLine(focus as Parameters<typeof nextLine>[0], focus.role)}</span>
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {board.focus?.estimate && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Estimate, mid-range</p>
                  <p className="mt-1 font-serif text-2xl">{board.focus.estimate}</p>
                </div>
              )}
              {isBusiness ? (
                <OpeningDay projectId={focus.id} date={board.focus?.opening ?? null} set={!!board.focus?.openingSet} canEdit={focus.role === "owner"} />
              ) : (
                board.unread[focus.id] > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Thread</p>
                    <p className="mt-1 font-serif text-2xl">{board.unread[focus.id]} new</p>
                  </div>
                )
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/project/${focus.id}`} className="glow-btn rounded-full px-5 py-2.5 text-sm">
                Open project
              </Link>
              <Link href={`/project/${focus.id}?tab=thread`} className="rounded-full border border-line px-5 py-2.5 text-sm transition hover:border-accent hover:text-accent">
                Thread{board.unread[focus.id] ? ` · ${board.unread[focus.id]}` : ""}
              </Link>
              {(focus.status === "building" || focus.status === "done" || focus.role === "builder") && (
                <Link href={`/project/${focus.id}?tab=site`} className="rounded-full border border-line px-5 py-2.5 text-sm transition hover:border-accent hover:text-accent">
                  Site
                </Link>
              )}
            </div>
          </div>
        </div>
      </Reveal>
      {pro && (board.money.billed || board.money.received) && (
        <Reveal delay={0.06} className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <Stat label="Billed, to be paid" value={board.money.billed ?? "—"} />
          <Stat label="Received" value={board.money.received ?? "—"} tone="text-leaf" />
        </Reveal>
      )}
    </>
  );
}

// Inbox: every project with messages not yet read, straight into its thread.
function Inbox({ projects, board }: { projects: Card[]; board: Board }) {
  const unread = projects.filter((p) => board.unread[p.id] > 0);
  if (!unread.length) return <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-leaf/40 bg-leaf/5 px-3 py-1 text-sm text-leaf">✓ All caught up. New messages on your projects show here.</p>;
  return (
    <ul className="mt-6 space-y-2">
      {unread.map((p, i) => (
        <Reveal key={p.id} delay={0.04 * i}>
          <Link href={`/project/${p.id}?tab=thread`} className="group flex items-center gap-4 rounded-2xl border border-line bg-paper-raised p-3 transition hover:border-accent">
            <PlanSketch sketch={board.sketches[p.id]} className="h-12 w-20 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium group-hover:text-accent">{projectName(p)}</span>
              <span className="block truncate text-xs text-ink-soft">{p.owner && p.role !== "owner" ? `${p.owner.split(" ")[0]}'s design · ` : ""}{STAGES[stage(p)].label}</span>
            </span>
            <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs text-white">{board.unread[p.id]} new</span>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}

// Requests from owners who'd like this pro on their project.
function RequestsView() {
  return (
    <>
      <Requests />
      <p className="mt-6 text-sm text-ink-soft">Owners find you in Find a pro, matched by taste to the projects you&apos;ve designed in Arcon. Their requests show here, newest first.</p>
    </>
  );
}

// Studio: every client by stage. The stage comes from what has happened on the project, so the columns can't be
// dragged.
function StudioBoard({ projects, board }: { projects: Card[]; board: Board }) {
  return (
    <>
      <Reveal delay={0.1} className="-mx-4 mt-8 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[60rem] grid-cols-6 items-start gap-3">
          {STAGES.map((s, i) => {
            const here = projects.filter((p) => stage(p) === i);
            return (
              <section key={s.id} aria-label={s.label} className="rounded-2xl border border-line bg-paper-raised/60 p-2">
                <p className="flex items-center justify-between px-1.5 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                  {s.label}
                  <span className={here.length ? "text-accent" : ""}>{here.length}</span>
                </p>
                <ul className="space-y-2">
                  {here.map((p) => (
                    <li key={p.id}>
                      <Link href={`/project/${p.id}`} className="group block rounded-xl border border-line bg-paper p-2.5 transition hover:-translate-y-0.5 hover:border-accent">
                        <PlanSketch sketch={board.sketches[p.id]} className="h-16 w-full" />
                        <p className="mt-2 truncate text-sm font-medium group-hover:text-accent">{projectName(p)}</p>
                        <p className="flex justify-between gap-1 text-xs text-ink-soft">
                          <span className="truncate">{p.owner ? p.owner.split(" ")[0] : "Your project"}</span>
                          {board.unread[p.id] > 0 && <span className="text-accent">● {board.unread[p.id]}</span>}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
                {!here.length && <p className="px-1.5 pb-2 text-xs text-ink-soft/60">—</p>}
              </section>
            );
          })}
        </div>
      </Reveal>
    </>
  );
}

// Sites: today on every site first, then the rest of the builder's projects.
function SitesBoard({ projects, board }: { projects: Card[]; board: Board }) {
  const live = board.sites;
  const others = projects.filter((p) => !live.some((s) => s.id === p.id));
  return (
    <>
      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Today on site</p>
      {live.length ? (
        <ul className="mt-2 space-y-2">
          {live.map((s, i) => {
            const p = projects.find((x) => x.id === s.id)!;
            return (
              <Reveal key={s.id} delay={0.05 * i}>
                <Link href={`/project/${s.id}?tab=site`} className="group grid items-center gap-4 rounded-2xl border border-line bg-paper-raised p-4 transition hover:border-accent sm:grid-cols-[6rem_1fr_auto]">
                  <PlanSketch sketch={board.sketches[s.id]} className="hidden h-14 w-full sm:block" />
                  <div className="min-w-0">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium group-hover:text-accent">{projectName(p)}</span>
                      <span className="font-serif text-2xl">{s.overall}%</span>
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-gradient-to-r from-leaf to-accent" style={{ width: `${s.overall}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {s.now ?? (p.status === "done" ? "Handed over" : "Built: the handover is next")} · {s.onSite} on site today
                      {s.late > 0 && <span className="text-red-600"> · {s.late} behind</span>}
                    </p>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 rounded-2xl border border-dashed border-line p-5 text-sm text-ink-soft">No site is being built yet. When a design is approved, start its site from the project&apos;s Site tab.</p>
      )}
      {others.length > 0 && (
        <>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Other projects</p>
          <Grid projects={others} board={board} />
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-raised px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">{label}</p>
      <p className={`mt-1 font-serif text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

// Project cards with their plans drawing themselves.
function Grid({ projects, board }: { projects: Card[]; board: Board }) {
  return (
    <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p, i) => {
        const at = stage(p);
        const tag = p.role !== "owner" ? `You're the ${ROLE_NAME[p.role].toLowerCase()}` : (YOUR[p.space_type ?? ""] ?? "Yours");
        return (
          <li key={p.id} className="relative">
            <Reveal delay={0.04 * Math.min(i, 8)}>
              <Link href={`/project/${p.id}`} className="group block rounded-2xl border border-line bg-paper-raised p-4 transition hover:-translate-y-0.5 hover:border-accent">
                <div className="rounded-xl bg-paper p-2">
                  <PlanSketch sketch={board.sketches[p.id]} className="h-28 w-full" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] uppercase tracking-widest text-ink-soft">
                  <span>{SPACE[p.space_type ?? ""] ?? "Project"}</span>
                  <span className={`rounded-full border border-line px-2 py-0.5 normal-case tracking-normal ${p.role === "owner" ? "mr-9" : ""}`}>{tag}</span>
                </div>
                <p className="mt-2 font-serif text-2xl leading-tight group-hover:text-accent">{projectName(p)}</p>
                {p.owner && p.role !== "owner" && <p className="text-sm text-ink-soft">{p.owner.split(" ")[0]}&apos;s design</p>}
                <ol className="mt-3 grid grid-cols-6 gap-1" aria-label={`Stage: ${STAGES[at].label}`}>
                  {STAGES.map((s, j) => (
                    <li key={s.id} className={`h-1 rounded-full ${j < at ? "bg-leaf" : j === at ? "bg-accent" : "bg-line"}`} />
                  ))}
                </ol>
                <p className="mt-2 flex items-center justify-between text-sm text-ink-soft">
                  <span className="text-ink">{STAGES[at].label}</span>
                  <span>
                    {board.unread[p.id] > 0 && <span className="mr-2 text-accent">● {board.unread[p.id]}</span>}
                    {when(p.updated_at)}
                  </span>
                </p>
              </Link>
              {p.role === "owner" && (
                <div className="absolute right-6 top-[9.6rem]">
                  <DeleteProject id={p.id} name={projectName(p)} variant="card" />
                </div>
              )}
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ pro }: { pro: boolean }) {
  return (
    <Reveal delay={0.1} className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
      <PlanSketch sketch={null} className="mx-auto h-24 w-40" />
      <p className="mt-4 font-serif text-3xl">{pro ? "No clients yet" : "Nothing here yet"}</p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        {pro
          ? "Add a client: answer Let's get to know you with them, or send them a link. Arcon designs around their taste, and the project lands here."
          : "Answer a few questions about you and your space. Arcon turns your taste into a floor plan, a 3D walkthrough and a budget."}
      </p>
      <div className="mt-6 flex justify-center">
        {pro ? (
          <NewClient />
        ) : (
          <Link href="/start" className="glow-btn inline-block rounded-full px-6 py-3">
            Start your first design
          </Link>
        )}
      </div>
    </Reveal>
  );
}

// The header shows at once; the part that needs the signed-in user streams in behind it.
export default function HomePage({ searchParams }: PageProps<"/home">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<PageLoading label="Loading your projects" />}>
        <HomePageBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
