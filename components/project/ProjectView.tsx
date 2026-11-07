"use client";

import { TourNext } from "@/components/demo/TourBar";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatedMark } from "@/components/AnimatedMark";
import { Decode, TypeLog } from "@/components/fx/Decode";
import { processingLog } from "@/lib/design/log";
import { chime, preload, startProcessing, transition as stepSound } from "@/components/fx/sfx";
import { PlanSvg } from "@/components/plan/PlanSvg";
import type { Brief } from "@/lib/design/brief";
import { compare, sayClaim } from "@/lib/design/compare";
import type { Layout } from "@/lib/layout/schema";
import type { Project } from "@/lib/project/store";
import { canLeave, isStep, STEPS, type StepId } from "./steps";
import { can, ROLE_NAME, type ProjectRole } from "@/lib/project/access";
import { Workspace } from "./Workspace";
import { ProjectHome, Unlock } from "./ProjectHome";
import { lockedSteps } from "@/lib/project/stage";
import { Waiting } from "./Waiting";
import { ExportStep } from "./ExportStep";
import { WalkthroughStep } from "./WalkthroughStep";
import { CheckPlan } from "@/components/import/CheckPlan";
import { importedOf } from "@/lib/plan-import/edits";
import { creditOf, sayCredit, styleWords, tasteTrail } from "@/lib/design/trail";
import { TasteTrail } from "./TasteTrail";
import { Moodboard } from "./Moodboard";
import { Neighbourhood } from "./Neighbourhood";
import { ArtAndSound } from "./ArtAndSound";
import { NEAR } from "@/lib/neighbourhood/read";
import { BudgetStep } from "./BudgetStep";
import { ShoppingStep } from "./ShoppingStep";
import type { Tier } from "@/lib/budget/costs";
import { HudCard, Reveal } from "@/components/fx/Motion";
import { PageLoading } from "@/components/fx/PageLoading";
import { tick } from "@/components/fx/sfx";
import { choicesOf, type Ticked } from "@/lib/green/improve";

const greenTicked = (interview: Record<string, unknown> | null | undefined): Ticked => (Array.isArray(interview?.green) ? (interview.green as Ticked) : []);

type View = Omit<Project, "owner_id" | "guest_id"> & { brief: Brief | null; options?: Layout[] | null; role?: ProjectRole; unlocked?: boolean; whose?: string | null; unread?: number; pros?: string[]; studio?: { id: string; name: string; logo_url: string | null } | null };

// Routes that change the design answer with the project alone; who is looking (role, name, lock, unread) stays.
const keep = (old: View | null, next: View): View => (old ? { ...next, role: old.role, whose: old.whose, unlocked: old.unlocked, unread: old.unread, pros: old.pros, studio: old.studio } : next);

const WORK = ["read", "taste", "brief", "program", "plans"]; // progress ticks while the design request runs

export function ProjectView({ id }: { id: string }) {
  const [p, setP] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [work, setWork] = useState(0);
  // The URL names the part on show (?step=plans, ?tab=thread): links and the sidebar open a part by changing it, and
  // the page writes it back as people move around, so the two always agree.
  const search = useSearchParams();
  const askedStep = search.get("step");
  const askedTab = search.get("tab");
  const asTab = (t: string | null) => (t === "overview" || t === "thread" || t === "site" ? t : null);
  const [step, setStepState] = useState<StepId>(() => (isStep(askedStep) ? askedStep : "brief"));
  const still = useReducedMotion();
  // The quality tier the client picks on the budget or the shopping list; null keeps their taste's tier.
  const [tier, setTier] = useState<Tier | null>(null);
  // One object per saved list, so the 3D only re-furnishes when the plants actually change.
  const green = p?.interview?.green;
  const extraPlants = useMemo(() => choicesOf(greenTicked({ green })).extra, [green]);
  const [choosing, setChoosing] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  // How many changes were just made in "Make changes", shown on the steps that now reflect them.
  const [edited, setEdited] = useState(0);
  // On the project home: the Overview tab, or the tab holding `step`. Taking the guided tour again sets `touring`.
  const [pane, setPane] = useState<"overview" | "thread" | "site" | null>(() => (isStep(askedStep) ? null : (asTab(askedTab) ?? "overview")));
  // A room someone wants to talk about, picked in the 3D ("Discuss this room").
  const [discuss, setDiscuss] = useState<{ id: string; name: string; level: number } | null>(null);
  const [touring, setTouring] = useState(false);
  const key = `arcon-step-${id}`;

  const setStep = (s: StepId) => {
    stepSound();
    setPane(null);
    setStepState(s);
    try {
      sessionStorage.setItem(key, s);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // With no part in the URL, resume where this browser tab left off.
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.has("step") || params.has("tab")) return;
      const saved = sessionStorage.getItem(key);
      if (isStep(saved)) setStepState(saved);
    } catch {}
  }, [key]);

  // A new part asked for in the URL, or by the sidebar on this page: show it. No sound or scroll; the link moved.
  const show = useCallback((s: string | null, t: string | null) => {
    if (isStep(s)) {
      setPane(null);
      setStepState((old) => (old === s ? old : s));
    } else if (asTab(t)) setPane(asTab(t));
  }, []);
  useEffect(() => show(askedStep, askedTab), [show, askedStep, askedTab]);
  useEffect(() => {
    const part = (e: Event) => {
      const q = new URLSearchParams((e as CustomEvent<string>).detail);
      show(q.get("step"), q.get("tab"));
    };
    window.addEventListener("arcon:part", part);
    return () => window.removeEventListener("arcon:part", part);
  }, [show]);

  const design = useCallback(async () => {
    setError(null);
    const started = performance.now();
    const timer = setInterval(() => setWork((s) => Math.min(s + 1, WORK.length - 1)), 4000);
    try {
      const res = await fetch(`/api/projects/${id}/design`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Design failed");
      setWork(WORK.length);
      // Let the engine log finish typing before the reveal, even when the design comes back fast.
      await new Promise((r) => setTimeout(r, Math.max(900, 6500 - (performance.now() - started))));
      chime();
      setP((old) => keep(old, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Design failed");
    } finally {
      clearInterval(timer);
    }
  }, [id]);

  // Straight from the interview (?design=1): "Now design my space" was the click, so the design starts on arrival
  // instead of asking again.
  const autoDesign = search.get("design") === "1";
  useEffect(() => {
    if (!autoDesign || !p || started || (p.brief && p.options?.length) || p.status === "interview") return;
    if (!can(p.role ?? "owner", "edit") && p.role !== "client") return;
    preload();
    setStarted(true);
    // the client who answered everything sees their style and the plans revealed, as an owner does
    const client = p.role === "client";
    void design().then(() => client && setStep("brief"));
  }, [autoDesign, p, started, design]);

  // ...and the part on show goes back into the URL, so a link to the same part from elsewhere still lands.
  const homeMode = !!p && ((p.role ?? "owner") !== "owner" || !!p.toured_at || p.mode === "pro") && !touring;
  useEffect(() => {
    if (!p) return;
    const want = homeMode && pane ? `tab=${pane}` : `step=${step}`;
    if (location.search === `?${want}`) return;
    history.replaceState(history.state, "", `${location.pathname}?${want}`);
    // the sidebar and breadcrumb follow the URL; a rewrite like this one doesn't reach them by itself
    window.dispatchEvent(new Event("arcon:url"));
  }, [p, homeMode, pane, step]);

  // Reaching Share & export finishes the guided tour: from the next visit the project opens on its home.
  const toured = !!p?.toured_at;
  useEffect(() => {
    if (step === "drawings" && p?.id && (p.role ?? "owner") === "owner" && !toured) void fetch(`/api/projects/${p.id}/tour`, { method: "POST" }).catch(() => {});
  }, [step, p?.id, p?.role, toured]);


  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("private");
        const body: View = await res.json();
        setP(body);
      })
      .catch((e) => setError(e.message));
  }, [id, design]);

  const choose = async (option: number) => {
    setChoosing(option);
    const res = await fetch(`/api/projects/${id}/choose`, { method: "POST", body: JSON.stringify({ option }) });
    if (res.ok) {
      const next = await res.json();
      setP((old) => keep(old, next));
    }
    setChoosing(null);
  };

  if (error === "private")
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-serif text-4xl">This project is private</p>
        <p className="mt-3 text-ink-soft">Sign in with the account it belongs to, or ask its owner for an invite link.</p>
        <a href={`/login?next=${encodeURIComponent(`/project/${id}`)}`} className="glow-btn mt-6 inline-block rounded-full px-6 py-3">
          Sign in
        </a>
      </main>
    );
  if (error)
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-lg">{error}</p>
        {p && (
          <button onClick={() => void design()} className="mt-6 rounded-full bg-btn px-6 py-3 text-btn-ink">
            Try again
          </button>
        )}
      </main>
    );

  // A plan the user uploaded is checked first: rooms, size and a few loves for the styling.
  const imported = p ? importedOf(p.interview) : null;
  // What this person may do here: clients and viewers look and comment, they don't change the design.
  const role = p?.role ?? "owner";
  const editor = can(role, "edit");
  if (p && imported && !imported.confirmed && editor)
    return (
      <CheckPlan
        id={id}
        imported={imported}
        units={p.site.units ?? "imperial"}
        onDone={(next) => {
          setP((old) => keep(old, next as View));
          // "Design with my plan" was the click: no second button before the design
          const n = next as View;
          if (!n.brief || !n.options?.length) {
            preload();
            setStarted(true);
            void design();
          }
        }}
      />
    );

  // A design that hasn't been made yet waits for one click: the reveal starts on the user's cue,
  // and that click is what lets the browser play its sounds.
  // A pro's project for a client that still waits for Let's get to know you.
  if (p && p.status === "interview") return <Waiting id={p.id} whose={p.whose ?? p.designed_for ?? null} role={role} />;
  if (p && (!p.brief || !p.options?.length) && !editor && role !== "client")
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <AnimatedMark size={90} growing={false} />
        <p className="mt-8 font-serif text-4xl">The design is on its way</p>
        <p className="mt-3 text-ink-soft">{p.title ?? "This project"} hasn&apos;t been designed yet. You&apos;ll see it here as soon as it is.</p>
      </main>
    );
  if (p && (!p.brief || !p.options?.length) && !started)
    return (
      <Ready
        title={p.title}
        onStart={() => {
          preload();
          setStarted(true);
          void design();
        }}
      />
    );
  if (!p) return <PageLoading label="Opening the project" />;
  if (!p.brief || !p.options?.length) return <Processing p={p} done={work >= WORK.length} />;

  // Someone else's project reads as theirs: "Vicky's style", "Vicky's design".
  const whose = p.whose ?? null;
  // The guided steps run until the creator reaches Share & export; then, for everyone else, and for a pro's client
  // projects (the pro knows their way around), the project home.
  const home = (role !== "owner" || !!p.toured_at || p.mode === "pro") && !touring;
  const steps = (editor ? STEPS : STEPS.filter((s) => s.id !== "workspace")).map((s) => (s.id === "brief" && whose ? { ...s, label: `${whose}'s style` } : s)) as typeof STEPS[number][];
  const next = steps[steps.findIndex((s) => s.id === step) + 1]?.id ?? null;
  // One step's screen, shown in the guided tour or inside a tab of the project home.
  const d = p as View & { brief: Brief; options: Layout[] };
  // What a locked project's steps open, said on the unlock card that stands in for them (the paywall: style, plans and
  // the 3D from outside are free; the rest opens with unlocking).
  const LOCKED: Partial<Record<StepId, string>> = {
    budget: "The budget opens here: what your design costs, room by room, in your currency.",
    shop: "The shopping list opens here: pieces from brands in your taste, and stores near you.",
    workspace: "Make changes opens here: change rooms by tapping or typing, and the plan, 3D and budget follow.",
    drawings: "Share and export opens here: the drawings pack (PDF and CAD), sketches and the walkthrough video.",
  };
  const body = (s: StepId, guided: boolean) =>
    lockedSteps(!!(p as View).unlocked).includes(s) && LOCKED[s] ? (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Unlock p={p as View} role={role} lead={LOCKED[s]} onUnlocked={() => setP((old) => (old ? { ...old, unlocked: true } : old))} />
      </div>
    ) : (
    <>
          {edited > 0 && (s === "walkthrough" || s === "budget" || s === "shop") && (
        <div className="mx-auto mb-3 flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4">
          <p className="rounded-full border border-leaf/50 bg-leaf/5 px-4 py-1.5 text-sm text-leaf">
            ✓ Your {edited === 1 ? "change is" : `${edited} changes are`} in. The walkthrough, budget and shopping list are all updated.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStep("workspace")} className="rounded-full px-3 py-1.5 text-sm text-ink-soft transition hover:text-ink">
              Back to Make changes
            </button>
            <button type="button" onClick={() => setStep("drawings")} className="rounded-full border border-accent/50 px-4 py-1.5 text-sm text-accent transition hover:bg-accent hover:text-btn-ink">
              Done? Share &amp; export
            </button>
          </div>
        </div>
      )}
      {s === "brief" && <BriefStep p={d} brief={d.brief} whose={whose} />}
      {s === "plans" && <PlansStep p={d} options={d.options} choosing={choosing} choose={editor ? choose : null} />}
      {s === "walkthrough" && (
        <WalkthroughStep
          layout={d.options[d.chosen_option ?? 0]}
          spaceType={d.space_type}
          newBuild={(d.interview?.project as { newBuild?: boolean } | undefined)?.newBuild === true}
          extraPlants={extraPlants}
          projectId={d.id}
          location={d.site.location}
          tier={tier}
          brief={d.brief}
          taste={d.taste}
          title={d.title}
          option={d.chosen_option ?? 0}
          planName={d.options[d.chosen_option ?? 0]?.concept?.name}
          changePlan={() => setStep("plans")}
          next={guided && next ? { label: `Next: ${steps.find((x) => x.id === next)?.label}`, go: () => setStep(next) } : undefined}
          preview={!d.unlocked}
          onDiscuss={
            guided
              ? undefined
              : (name) => {
                  const floor = d.options[d.chosen_option ?? 0].floors.find((f) => f.spaces.some((x) => x.name === name));
                  const space = floor?.spaces.find((x) => x.name === name);
                  if (!floor || !space) return;
                  setDiscuss({ id: space.id, name, level: floor.level });
                  setPane("thread");
                }
          }
        />
      )}
      {s === "budget" && d.options?.[d.chosen_option ?? 0] && (
        <BudgetStep
          tier={tier}
          onTier={setTier}
          id={d.id}
          layout={d.options[d.chosen_option ?? 0]}
          location={d.site.location}
          interview={d.interview}
          brief={d.brief}
          profile={d.taste}
          lot={d.site.width && d.site.depth ? { width: d.site.width, depth: d.site.depth } : null}
          ticked={greenTicked(d.interview)}
          onTicked={(t) => setP((old) => (old ? { ...old, interview: { ...old.interview, green: t } } : old))}
          units={d.site.units ?? "imperial"}
        />
      )}
      {s === "shop" && <ShoppingStep id={d.id} location={d.site.location} tier={tier} onTier={setTier} />}
      {s === "drawings" && <ExportStep p={d} tier={tier} onWalkthrough={() => setStep("walkthrough")} />}
      {s === "workspace" && editor && d.unlocked && <Workspace
          p={d}
          tier={tier}
          ticked={greenTicked(d.interview)}
          onProject={(next) => setP((old) => keep(old, next))}
          onDone={(n) => {
            setEdited(n);
            setStep("walkthrough");
          }}
        />}
    </>
    );

  if (home)
    return (
      <ProjectHome
        p={p}
        role={role}
        whose={whose}
        step={step}
        pane={pane}
        setStep={setStep}
        showPane={setPane}
        discuss={discuss}
        onStatus={(status) => setP((old) => (old && old.status !== status ? { ...old, status: status as View["status"] } : old))}
        body={(s) => body(s, false)}
        onUnlocked={() => setP((old) => (old ? { ...old, unlocked: true } : old))}
        onTour={() => {
          setTouring(true);
          setStep("brief");
        }}
      />
    );

  return (
    <div className="flex flex-1 flex-col">
      {role !== "owner" && (
        <div className="mx-auto mb-3 flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 text-sm">
          <span className="font-serif text-xl">{whose ? `${whose}'s design` : "Shared design"}</span>
          {whose && <span className="text-ink-soft">designed around {whose}&apos;s taste</span>}
          <span className="rounded-full bg-accent/10 px-3 py-0.5 text-xs text-accent">You&apos;re the {ROLE_NAME[role].toLowerCase()}</span>
        </div>
      )}
      {(step === "drawings" || touring) && (
        <div className="mx-auto flex w-full max-w-6xl justify-end px-4">
          <button
            onClick={() => {
              setTouring(false);
              setPane("overview");
              setP((old) => (old ? { ...old, toured_at: old.toured_at ?? new Date().toISOString() } : old));
              void fetch(`/api/projects/${p.id}/tour`, { method: "POST" }).catch(() => {});
            }}
            className="rounded-full border border-accent/50 px-4 py-1.5 text-sm text-accent transition hover:bg-accent hover:text-btn-ink"
          >
            Go to project home
          </button>
        </div>
      )}
      <Progress steps={steps} step={step} onJump={(s) => steps.findIndex((x) => x.id === s) <= steps.findIndex((x) => x.id === step) && setStep(s)} />
      {/* Next sits top right on every step (the walkthrough puts it in its own top row), and stays in reach while scrolling. */}
      {next && step !== "walkthrough" && (
        <div className="sticky top-0 z-20 bg-paper/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-4 px-4 py-2">
            <TourNext />
            {step === "plans" && p.chosen_option === null && <p className="text-sm text-ink-soft">Choose a plan to continue</p>}
            <button
              onClick={() => setStep(next)}
              disabled={!canLeave(step, p)}
              className="rounded-full bg-btn px-6 py-2.5 text-btn-ink transition hover:opacity-90 disabled:opacity-30"
            >
              Next: {steps.find((s) => s.id === next)?.label}
            </button>
          </div>
        </div>
      )}
      {/* A scan line sweeps down the screen as each step arrives. */}
      <AnimatePresence>
        {!still && (
          <motion.div
            key={`scan-${step}`}
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 z-40 h-24 bg-gradient-to-b from-transparent via-accent/20 to-transparent"
            initial={{ y: "-10vh", opacity: 1 }}
            animate={{ y: "110vh", opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={still ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          // The 3D leaves at once: its room labels are separate React roots and break if kept alive while exiting.
          exit={still || step === "walkthrough" ? undefined : { opacity: 0, y: -12, filter: "blur(6px)" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1"
        >
          {body(step, true)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Ready({ title, onStart }: { title?: string | null; onStart: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <AnimatedMark size={110} growing={false} />
      <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">All set</p>
      <h1 className="mt-3 font-serif text-5xl sm:text-6xl">
        <Decode text={`Ready to see ${title ?? "your space"}?`} />
      </h1>
      <p className="mt-4 max-w-md text-lg text-ink-soft">Arcon turns everything you told it into a style, three plans and a walk through your space.</p>
      <button onClick={onStart} className="mt-10 rounded-full bg-btn px-9 py-4 text-lg text-btn-ink transition hover:opacity-90">
        Design my space
      </button>
    </main>
  );
}

function Processing({ p, done }: { p: View | null; done: boolean }) {
  // The computer-processing sound plays for as long as this screen is up.
  useEffect(() => startProcessing(), []);
  return (
    <main className="arcon-scan flex flex-1 flex-col items-center justify-center px-4 py-12">
      <AnimatedMark size={130} />
      <h1 className="mt-6 text-center font-serif text-4xl sm:text-5xl">
        <Decode text={`Designing ${p?.title ?? "your space"}`} />
      </h1>
      <div className="mt-8 w-full max-w-2xl rounded-2xl border border-line bg-paper-raised/80 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink-soft">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> arcon engine
        </div>
        {p ? <TypeLog lines={processingLog(p)} done={done} /> : <TypeLog lines={["> loading project"]} done={false} />}
      </div>
    </main>
  );
}

function Progress({ steps, step, onJump }: { steps: readonly (typeof STEPS)[number][]; step: StepId; onJump: (s: StepId) => void }) {
  const at = steps.findIndex((s) => s.id === step);
  return (
    <nav aria-label="Progress" className="mx-auto w-full max-w-6xl px-4 pb-2">
      <ol className="flex gap-1.5">
        {steps.map((s, i) => (
          <li key={s.id} className="flex-1">
            <button onClick={() => onJump(s.id)} disabled={i > at} className="w-full text-left disabled:cursor-default" aria-current={i === at ? "step" : undefined}>
              <span className={`block h-1 rounded-full ${i <= at ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 hidden text-xs sm:block ${i === at ? "text-ink" : "text-ink-soft"}`}>{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

function BriefStep({ p, brief: b, whose }: { p: View; brief: Brief; whose: string | null }) {
  const still = useReducedMotion();
  const credit = (names: string[]) => names.map((n) => sayCredit(creditOf(p, n))).join("; ");
  const words = styleWords(p);
  const chosen = p.chosen_option !== null ? p.options?.[p.chosen_option] : null;
  const stagger = (delay: number) => ({ initial: still ? false : "hidden", animate: "show", variants: rise, transition: { duration: 0.6, delay } }) as const;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (hex: string) => {
    tick();
    void navigator.clipboard?.writeText(hex).catch(() => {});
    setCopied(hex);
    setTimeout(() => setCopied((c) => (c === hex ? null : c)), 1400);
  };
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-2">
      <motion.p {...stagger(0)} className="text-sm uppercase tracking-widest text-ink-soft">
        {p.title} · {whose ? `${whose}'s style` : "your style"}
      </motion.p>
      <h1 className="mt-3 break-words font-serif text-5xl sm:text-7xl">
        <Decode text={b.name} delay={0.15} speed={34} />
      </h1>
      <motion.p {...stagger(0.4)} className="mt-5 max-w-2xl text-xl leading-relaxed text-ink-soft">
        {b.summary}
      </motion.p>
      {words.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="The words your style is made of">
          {words.map((w, i) => (
            <motion.li
              key={w.word}
              initial={still ? false : { opacity: 0, scale: 0.6, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.6 + i * 0.08 }}
              whileHover={still ? undefined : { y: -2 }}
              className="rounded-full border border-line bg-paper-raised px-3 py-1 text-sm transition-colors hover:border-accent"
            >
              {w.word} <span className="text-ink-soft">· {w.from[0] ? (w.from[0].loved ? w.from[0].name : sayCredit(w.from[0])) : ""}</span>
            </motion.li>
          ))}
        </ul>
      )}

      <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {b.palette.map((c, i) => (
          <motion.li key={c.hex + c.name} {...stagger(0.8 + i * 0.12)} whileHover={still ? undefined : { y: -6 }} className="overflow-hidden rounded-xl border border-line bg-paper-raised transition-shadow hover:shadow-[0_14px_40px_-20px_var(--accent)]">
            <button type="button" onClick={() => copy(c.hex)} className="group relative block h-28 w-full" aria-label={`Copy ${c.name}, ${c.hex}`}>
              <motion.span className="absolute inset-0 origin-bottom" style={{ background: c.hex }} initial={still ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.8 + i * 0.12, duration: 0.5 }} />
              <span className="absolute bottom-2 left-2 rounded bg-black/45 px-1.5 py-0.5 font-mono text-[11px] uppercase text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {copied === c.hex ? "Copied" : c.hex}
              </span>
            </button>
            <div className="p-3 text-sm">
              <p className="font-medium">{c.name}</p>
              <p className="text-ink-soft">{c.role}</p>
              {c.from.length > 0 && <p className="mt-1 text-xs text-ink-soft">From {credit(c.from)}</p>}
            </div>
          </motion.li>
        ))}
      </ul>

      <Reveal>
        <Moodboard id={p.id} />
      </Reveal>

      {p.space_type && NEAR[p.space_type] && p.site.location && (
        <Reveal>
          <Neighbourhood id={p.id} />
        </Reveal>
      )}

      <Reveal>
        <ArtAndSound id={p.id} />
      </Reveal>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <HudCard className="p-5">
          <h2 className="font-serif text-2xl">Materials</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {b.materials.map((m) => (
              <li key={m.name}>
                <span className="font-medium">{m.name}</span> <span className="text-ink-soft">· {m.where}</span>
                {m.from.length > 0 && <p className="text-xs text-ink-soft">From {credit(m.from)}</p>}
              </li>
            ))}
          </ul>
        </HudCard>
        <HudCard className="p-5" delay={0.08}>
          <h2 className="font-serif text-2xl">Light</h2>
          <p className="mt-3 text-sm">{b.lighting.mood}</p>
          {b.lighting.from.length > 0 && <p className="mt-1 text-xs text-ink-soft">From {credit(b.lighting.from)}</p>}
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">
            {b.lighting.fixtures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </HudCard>
        <HudCard className="p-5" delay={0.16}>
          <h2 className="font-serif text-2xl">Plants in every room</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {b.plants.map((pl) => (
              <li key={pl.name}>
                <span className="font-medium text-leaf">{pl.name}</span> <span className="text-ink-soft">· {pl.where}</span>
              </li>
            ))}
          </ul>
        </HudCard>
      </div>

      {p.taste && p.taste.brands.length > 0 && (
        <Reveal className="mt-10">
          <h2 className="font-serif text-2xl">Brands that match your taste</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.taste.brands.slice(0, 8).map((br) => (
              <li key={br.id} className="rounded-full border border-line bg-paper-raised px-4 py-1.5 text-sm">
                {br.name}
                {creditOf(p, br.name).via.length > 0 && <span className="text-ink-soft"> · matched to {creditOf(p, br.name).via.slice(0, 2).join(" and ")}</span>}
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      <Reveal>
        <TasteTrail trail={tasteTrail(p, b, chosen)} />
      </Reveal>
    </main>
  );
}

function PlansStep({ p, options, choosing, choose }: { p: View; options: Layout[]; choosing: number | null; choose: ((i: number) => void) | null }) {
  const units = p.site.units ?? "imperial";
  const personal = options.some((o) => o.concept);
  // What each plan does best and gives up, measured against the others.
  const trades = compare(options);
  const home = ["house", "apartment", "studio"].includes(p.space_type ?? "house");
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-2">
      <h1 className="font-serif text-5xl">
        <Decode text={personal ? "Plans picked for how you live" : "Three ways to lay it out"} />
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        {personal
          ? "Different layout ideas for the same rooms, best fit first, each with the reasons from what you told us. Pick one; you can change anything later."
          : "The same rooms, arranged differently. Pick the one that fits how you live; you can change anything later."}
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {options.map((layout, i) => (
          <motion.article
            key={i}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`rounded-2xl border bg-paper-raised p-4 ${p.chosen_option === i ? "border-accent ring-2 ring-accent/30" : "border-line"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-widest text-ink-soft">Option {i + 1}</p>
              {layout.concept?.id === "own" ? (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">Your upload</span>
              ) : (
                i === options.findIndex((o) => o.concept?.id !== "own") &&
                layout.concept &&
                layout.concept.why.length > 0 && <span className="rounded-full bg-leaf/15 px-2.5 py-0.5 text-xs font-medium text-leaf">Best fit for you</span>
              )}
            </div>
            <h2 className="mt-1 font-serif text-2xl">{layout.concept?.name ?? `Option ${i + 1}`}</h2>
            {layout.concept?.summary && <p className="mt-1 text-sm text-ink-soft">{layout.concept.summary}</p>}
            {!!layout.concept?.why.length && (
              <ul className="mt-3 space-y-1.5 rounded-xl bg-paper p-3">
                {layout.concept.why.map((w) => (
                  <li key={w} className="flex gap-2 text-sm">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
            {(trades[i].gains.length > 0 || trades[i].gives.length > 0) && (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-widest text-ink-soft">Compared with the others</p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {trades[i].gains.map((c) => (
                    <li key={c.measure} className="flex gap-2">
                      <span className="w-4 shrink-0 text-center font-medium text-leaf">+</span>
                      <span>{sayClaim(c, units, home)}</span>
                    </li>
                  ))}
                  {trades[i].gives.map((c) => (
                    <li key={c.measure} className="flex gap-2 text-ink-soft">
                      <span className="w-4 shrink-0 text-center font-medium">−</span>
                      <span>{sayClaim(c, units, home)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {layout.floors.map((f) => (
              <div key={f.level} className="mt-3">
                {layout.floors.length > 1 && <p className="text-xs uppercase tracking-widest text-ink-soft">{f.level === 0 ? "Ground floor" : "Upstairs"}</p>}
                <PlanSvg layout={layout} level={f.level} units={units} className="w-full" />
              </div>
            ))}
            <button
              onClick={() => choose?.(i)}
              disabled={choosing !== null || !choose}
              className={`mt-4 w-full rounded-full px-4 py-2.5 ${p.chosen_option === i ? "bg-accent text-paper" : "border border-ink text-ink"} disabled:opacity-50`}
            >
              {p.chosen_option === i ? "Chosen" : choosing === i ? "Saving…" : choose ? "Choose this plan" : "Not chosen"}
            </button>
          </motion.article>
        ))}
      </div>
    </main>
  );
}

function Coming({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <AnimatedMark size={90} growing={false} />
      <h1 className="mt-8 font-serif text-5xl">{title}</h1>
      <p className="mt-4 text-lg text-ink-soft">{text}</p>
      <p className="mt-6 rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft">Being built now</p>
    </main>
  );
}
