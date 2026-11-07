"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Reveal } from "@/components/fx/Motion";
import { tick, transition } from "@/components/fx/sfx";

// For pros: an AI design partner and the software to run every project, shown as it works. Each capability says
// whether Arcon's AI does it for you or it's something you run in Arcon, beside a small live screen of it.
// Every name and number on the screens is a sample.

type Kind = "AI" | "Manage";
type Cap = { kind: Kind; title: string; body: string; screen: () => ReactNode };
type Who = "architects" | "builders";

const ARCHITECTS: Cap[] = [
  { kind: "AI", title: "Your client's taste, read before you meet", body: "Send a link: the client answers at home in English, Hindi or Hinglish, and Arcon reads their style from the films, places and brands they love.", screen: () => <Taste /> },
  { kind: "AI", title: "Three plans on day one", body: "The layout engine fits their rooms to the plot three ways, each saying what it does best and what it gives up. A 3D walkthrough by day and night comes with them.", screen: () => <Plans /> },
  { kind: "AI", title: "Changes by chat, priced at once", body: "Type \"make the kitchen bigger\". The plan, the budget and the drawings follow in seconds; the rest of the plan gives way, never past the plot.", screen: () => <Chat /> },
  { kind: "Manage", title: "Approvals and change requests on record", body: "Send for review; the client approves a version, which locks it. Any later change goes to them with what it does to the cost.", screen: () => <Approve /> },
  { kind: "Manage", title: "Fees by milestone", body: "Set out your fee once; Arcon splits it by stage. Bill each one, the client marks it paid, you confirm. Overdue ones come first.", screen: () => <Ledger rows={[["Design", "$6,000"], ["Approval of the final design", "$8,000"], ["Handover", "$6,000"]]} /> },
  { kind: "Manage", title: "Your whole studio, one pipeline", body: "Every client by stage, what's waiting on you, requests from owners who found you by taste match, your logo on every drawing.", screen: () => <Pipeline /> },
];

const BUILDERS: Cap[] = [
  { kind: "AI", title: "A site plan from the approved design", body: "Phases with dates come from the design's timeline, and the materials are taken off the plan with quantities and costs.", screen: () => <Phases /> },
  { kind: "Manage", title: "Crew and wages", body: "Add your crew once, mark who's on which site each day, and see the week's pay across every site.", screen: () => <Crew /> },
  { kind: "Manage", title: "Materials and deliveries", body: "Order, track what's on the way, what's late and what's running low, on every site.", screen: () => <Deliveries /> },
  { kind: "Manage", title: "Updates your client follows", body: "Post photos and progress from your phone. The client sees the build and the budget, never your own costs.", screen: () => <Updates /> },
  { kind: "Manage", title: "Paid by stage of the build", body: "Deposit, structure, services, finishes, handover: each one billed when it's done, every name and amount yours to change.", screen: () => <Ledger rows={[["Deposit", "$12,000"], ["Foundations and structure", "$36,000"], ["Finishes", "$36,000"]]} /> },
  { kind: "Manage", title: "Snags, handover and reviews", body: "The client lists snags, you fix them, they sign off. Hand over the pack and warranty; their review shows on your profile.", screen: () => <Handover /> },
];

const SECONDS = 4.5;

export function ForPros() {
  const still = useReducedMotion();
  const [who, setWho] = useState<Who>("architects");
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(false);
  const caps = who === "architects" ? ARCHITECTS : BUILDERS;
  useEffect(() => {
    if (still || held || !seen) return;
    const t = setTimeout(() => setAt((a) => (a + 1) % caps.length), SECONDS * 1000);
    return () => clearTimeout(t);
  }, [at, still, held, seen, caps.length]);
  const cap = caps[at];

  return (
    <section id="pros" className="relative scroll-mt-24 overflow-hidden border-y border-line bg-paper-raised/40 py-24">
      {/* a quiet blueprint grid behind the section */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">For architects and builders</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">An AI design partner, and the software to run every project.</h2>
          <p className="mt-4 text-lg text-ink-soft">Arcon&apos;s AI does the slow first weeks: reading your client, drawing the options, pricing every change. Then you run the project in one place, from the first link to the handover.</p>
        </Reveal>

        <motion.div className="mt-10 flex justify-center" onViewportEnter={() => setSeen(true)} viewport={{ once: true }}>
          <div role="tablist" aria-label="Who it's for" className="inline-flex rounded-full border border-line bg-paper p-1">
            {(["architects", "builders"] as const).map((w) => (
              <button
                key={w}
                role="tab"
                aria-selected={who === w}
                onClick={() => (tick(), setWho(w), setAt(0), setHeld(false))}
                className={`relative rounded-full px-5 py-2 text-sm transition ${who === w ? "text-btn-ink" : "text-ink-soft hover:text-ink"}`}
              >
                {who === w && <motion.span layoutId="pros-tab" className="absolute inset-0 rounded-full bg-btn" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <span className="relative">{w === "architects" ? "Architects & designers" : "Builders & contractors"}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <ol className="space-y-2">
            {caps.map((c, i) => {
              const on = i === at;
              return (
                <li key={`${who}-${c.title}`}>
                  <button
                    type="button"
                    onClick={() => (tick(), setHeld(true), setAt(i))}
                    aria-pressed={on}
                    className={`relative w-full overflow-hidden rounded-2xl border p-4 text-left transition ${on ? "border-accent bg-paper shadow-[0_18px_44px_-28px_var(--accent)]" : "border-transparent hover:border-line hover:bg-paper/60"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${c.kind === "AI" ? "bg-accent/10 text-accent" : "bg-leaf/10 text-leaf"}`}>{c.kind}</span>
                      <span className={`font-medium ${on ? "text-ink" : "text-ink-soft"}`}>{c.title}</span>
                    </span>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 text-sm text-ink-soft">
                          {c.body}
                        </motion.p>
                      )}
                    </AnimatePresence>
                    {/* how long until the next one */}
                    {on && !held && !still && seen && <motion.span key={`${who}-${at}`} className="absolute bottom-0 left-0 h-0.5 bg-accent" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: SECONDS, ease: "linear" }} />}
                  </button>
                </li>
              );
            })}
          </ol>

          {/* the live screen */}
          <div className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-40px_var(--accent)]">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">{who === "architects" ? "Studio" : "Sites"} · sample</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cap.kind === "AI" ? "bg-accent/10 text-accent" : "bg-leaf/10 text-leaf"}`}>{cap.kind === "AI" ? "Arcon's AI" : "You manage"}</span>
              </div>
              <div className="relative h-[22rem] p-5">
                <AnimatePresence mode="wait">
                  <motion.div key={`${who}-${at}`} initial={still ? false : { opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} className="h-full">
                    {cap.screen()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login?mode=signup" onClick={() => transition()} className="glow-btn rounded-full px-7 py-3">
            Start my 14 days free
          </Link>
          <Link href={`/resources#${who}`} onClick={() => tick()} className="rounded-full border border-line px-7 py-3 transition hover:border-accent hover:text-accent">
            Everything {who === "architects" ? "architects" : "builders"} can do
          </Link>
        </div>
        <p className="mt-3 text-center text-sm text-ink-soft">{who === "architects" ? "Studio: $99 a month, every client project unlocked." : "Build: $299 a month, every site."} Your clients pay nothing.</p>
      </div>
    </section>
  );
}

// ---- the small screens, one per capability ----

const appear = (i: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.25 + i * 0.22 } });
const Label = ({ children }: { children: ReactNode }) => <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">{children}</p>;

function Taste() {
  const loves = ["Mad Men", "Chateau Marmont", "West Elm"];
  const words = ["mid-century", "warm wood", "low light", "brass", "sophisticated"];
  return (
    <div className="flex h-full flex-col">
      <Label>Maya answered at home · 6 min</Label>
      <div className="mt-3 flex flex-wrap gap-2">
        {loves.map((l, i) => (
          <motion.span key={l} {...appear(i)} className="rounded-full border border-line px-3 py-1 text-sm">
            ♥ {l}
          </motion.span>
        ))}
      </div>
      <motion.p {...appear(3)} className="mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Arcon reads</motion.p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {words.map((w, i) => (
          <motion.span key={w} {...appear(4 + i * 0.5)} className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-xs text-accent">
            {w}
          </motion.span>
        ))}
      </div>
      <motion.div {...appear(7)} className="mt-auto rounded-xl border border-accent/40 bg-accent/5 p-4">
        <Label>Maya&apos;s style</Label>
        <p className="mt-1 font-serif text-3xl">Warm Mid-century</p>
      </motion.div>
    </div>
  );
}

function MiniPlan({ variant, delay }: { variant: number; delay: number }) {
  // three simple arrangements of one set of rooms, drawn line by line
  const lines = [
    ["M4 4H96V60H4Z", "M40 4V60", "M40 32H96", "M70 32V60"],
    ["M4 4H96V60H4Z", "M4 30H96", "M50 4V30", "M34 30V60", "M66 30V60"],
    ["M4 4H96V60H4Z", "M60 4V60", "M4 34H60", "M60 22H96", "M60 42H96"],
  ][variant];
  return (
    <svg viewBox="0 0 100 64" className="w-full">
      {lines.map((d, i) => (
        <motion.path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={i === 0 ? 2 : 1.2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: delay + i * 0.12, duration: 0.6 }} />
      ))}
    </svg>
  );
}

function Plans() {
  const names = [
    ["Open great room", "+ the most open living space"],
    ["Central hall", "+ the quietest bedrooms"],
    ["Living to the garden", "+ the biggest kitchen"],
  ];
  return (
    <div className="grid h-full grid-cols-3 gap-3">
      {names.map(([n, gain], i) => (
        <motion.div key={n} {...appear(i)} className={`flex flex-col rounded-xl border p-3 ${i === 0 ? "border-accent" : "border-line"}`}>
          <div className="text-ink">
            <MiniPlan variant={i} delay={0.3 + i * 0.3} />
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-ink-soft">Option {i + 1}</p>
          <p className="mt-0.5 font-serif text-lg leading-tight">{n}</p>
          <p className="mt-2 text-xs text-leaf">{gain}</p>
        </motion.div>
      ))}
    </div>
  );
}

function Typed({ text, delay = 0.3 }: { text: string; delay?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    const start = setTimeout(function step() {
      i++;
      setN(i);
      if (i < text.length) t = setTimeout(step, 45);
    }, delay * 1000);
    let t = start;
    return () => clearTimeout(t);
  }, [text, delay]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="animate-pulse">▍</span>}
    </>
  );
}

function Chat() {
  return (
    <div className="flex h-full flex-col">
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-btn px-4 py-2.5 text-sm text-btn-ink">
        <Typed text="make the kitchen bigger and add a study" />
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }} className="mt-4 max-w-[85%] rounded-2xl rounded-bl-sm border border-line px-4 py-3 text-sm">
        <p>✓ Made the kitchen bigger · ✓ Added a study</p>
        <p className="mt-1 text-ink-soft">The living room gave up 25 sq ft; nothing moved past the plot.</p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8 }} className="mt-auto grid grid-cols-3 gap-2 text-center">
        {[
          ["Budget", "+$4.2K"],
          ["Timeline", "+1 week"],
          ["Drawings", "updated"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line p-3">
            <Label>{k}</Label>
            <p className="mt-1 font-serif text-xl">{v}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function Approve() {
  return (
    <div className="flex h-full flex-col gap-3">
      <motion.div {...appear(0)} className="rounded-xl border border-accent/40 bg-accent/5 p-4">
        <p className="font-medium">Version 2 is waiting for Maya&apos;s review</p>
        <div className="mt-3 h-16 rounded-lg border border-line bg-paper p-1.5 text-ink-soft">
          <MiniPlan variant={0} delay={0.4} />
        </div>
      </motion.div>
      <motion.p {...appear(2)} className="text-sm">
        <span className="rounded-full bg-leaf px-3 py-1 text-white">✓ Maya approved version 2</span> <span className="text-ink-soft">&ldquo;Love the garden room.&rdquo;</span>
      </motion.p>
      <motion.div {...appear(4)} className="mt-auto rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
        <p className="flex justify-between font-medium">
          <span>Change to the approved design</span>
          <span className="font-mono text-sm text-amber-700 dark:text-amber-400">+$3.1K</span>
        </p>
        <p className="mt-1 text-sm text-ink-soft">Added a skylight over the stairs · waiting for Maya</p>
      </motion.div>
    </div>
  );
}

function Ledger({ rows }: { rows: [string, string][] }) {
  const states = ["Received ✓", "Paid, to confirm", "Billed"];
  return (
    <div className="flex h-full flex-col">
      <Label>Fees · Park Slope brownstone</Label>
      <ul className="mt-3 divide-y divide-line">
        {rows.map(([label, amount], i) => (
          <motion.li key={label} {...appear(i)} className="flex items-center justify-between py-3 text-sm">
            <span>
              <span className="block font-medium">{label}</span>
              <span className="text-ink-soft">{amount}</span>
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${i === 0 ? "bg-leaf/10 text-leaf" : i === 1 ? "bg-accent/10 text-accent" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>{states[i]}</span>
          </motion.li>
        ))}
      </ul>
      <motion.div {...appear(4)} className="mt-auto flex items-baseline justify-between rounded-xl border border-line p-4">
        <Label>Received so far</Label>
        <span className="font-serif text-2xl">{rows[0][1]}</span>
      </motion.div>
    </div>
  );
}

function Pipeline() {
  const cols: [string, string[]][] = [
    ["Know you", ["Maya Chen"]],
    ["Design", ["Park Slope", "Echo Park"]],
    ["Review", ["Silver Lake"]],
    ["Building", ["Bedford Ave café"]],
  ];
  return (
    <div className="grid h-full grid-cols-4 gap-2">
      {cols.map(([name, cards], c) => (
        <div key={name} className="rounded-xl bg-paper-raised p-2">
          <p className="px-1 font-mono text-[9px] uppercase tracking-wider text-ink-soft">{name}</p>
          <div className="mt-2 space-y-2">
            {cards.map((card, i) => (
              <motion.div key={card} {...appear(c + i)} className="rounded-lg border border-line bg-paper p-2 text-xs">
                {card}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Phases() {
  const phases: [string, number][] = [
    ["Permits and approvals", 100],
    ["Foundations and structure", 100],
    ["Electrical and plumbing", 65],
    ["Kitchen, bathrooms and joinery", 10],
    ["Floors, walls and ceilings", 0],
  ];
  return (
    <div className="flex h-full flex-col">
      <Label>Silver Lake bungalow · week 14 of 31</Label>
      <div className="mt-4 space-y-3.5">
        {phases.map(([name, pct], i) => (
          <div key={name}>
            <p className="flex justify-between text-sm">
              <span>{name}</span>
              <span className="font-mono text-xs text-ink-soft">{pct}%</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full rounded-full bg-leaf" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.2 + i * 0.15, duration: 0.8 }} />
            </div>
          </div>
        ))}
      </div>
      <motion.p {...appear(5)} className="mt-auto text-sm text-ink-soft">
        42 materials taken off the plan, with quantities and costs.
      </motion.p>
    </div>
  );
}

function Crew() {
  const crew: [string, string, boolean][] = [
    ["Luis · carpenter", "Silver Lake", true],
    ["Dee · electrician", "Silver Lake", true],
    ["Sam · plumber", "Echo Park", true],
    ["Ana · painter", "off today", false],
  ];
  return (
    <div className="flex h-full flex-col">
      <Label>On site today · 3 of 4</Label>
      <ul className="mt-3 divide-y divide-line">
        {crew.map(([name, where, on], i) => (
          <motion.li key={name} {...appear(i)} className="flex items-center justify-between py-2.5 text-sm">
            <span>
              <span className="block">{name}</span>
              <span className="text-xs text-ink-soft">{where}</span>
            </span>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${on ? "bg-leaf text-white" : "border border-line text-ink-soft"}`}>{on ? "✓" : "–"}</span>
          </motion.li>
        ))}
      </ul>
      <motion.div {...appear(5)} className="mt-auto flex items-baseline justify-between rounded-xl border border-line p-4">
        <Label>Wages this week</Label>
        <span className="font-serif text-2xl">$6,840</span>
      </motion.div>
    </div>
  );
}

function Deliveries() {
  const items: [string, string, string][] = [
    ["Oak flooring, 1,240 sq ft", "Delivered", "bg-leaf/10 text-leaf"],
    ["Kitchen cabinets", "On the way · Thu", "bg-accent/10 text-accent"],
    ["Tile adhesive", "Running low", "bg-amber-500/10 text-amber-700 dark:text-amber-400"],
    ["Brass wall lights × 6", "Late by 2 days", "bg-red-500/10 text-red-600"],
  ];
  return (
    <div className="flex h-full flex-col">
      <Label>Materials &amp; deliveries · all sites</Label>
      <ul className="mt-3 space-y-2">
        {items.map(([what, state, tone], i) => (
          <motion.li key={what} {...appear(i)} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm">
            <span>{what}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${tone}`}>{state}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Updates() {
  const posts = [
    ["Framing the garden room", "from-amber-200/60 to-amber-500/30"],
    ["First fix wiring done", "from-sky-200/60 to-sky-500/30"],
    ["Kitchen cabinets in", "from-emerald-200/60 to-emerald-500/30"],
  ];
  return (
    <div className="flex h-full flex-col">
      <Label>Updates · Maya follows from her phone</Label>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {posts.map(([caption, tone], i) => (
          <motion.div key={caption} {...appear(i)} className="overflow-hidden rounded-xl border border-line">
            <div className={`aspect-[4/3] bg-gradient-to-br ${tone}`} />
            <p className="p-2 text-xs">{caption}</p>
          </motion.div>
        ))}
      </div>
      <motion.div {...appear(4)} className="mt-auto rounded-xl border border-line p-4 text-sm">
        <p className="flex justify-between">
          <span>Maya sees</span>
          <span className="text-ink-soft">progress, photos, the budget</span>
        </p>
        <p className="mt-1 flex justify-between">
          <span>Only you see</span>
          <span className="text-ink-soft">your costs, wages and margins</span>
        </p>
      </motion.div>
    </div>
  );
}

function Handover() {
  const steps = ["Every phase finished", "Snags listed and fixed", "Handover pack and 12-month warranty", "Maya accepted the handover"];
  return (
    <div className="flex h-full flex-col">
      <Label>Moving in · Silver Lake bungalow</Label>
      <ul className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <motion.li key={s} {...appear(i)} className="flex items-center gap-3 rounded-xl border border-leaf/40 bg-leaf/5 px-3 py-2.5 text-sm">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-leaf text-[11px] text-white">✓</span>
            {s}
          </motion.li>
        ))}
      </ul>
      <motion.div {...appear(5)} className="mt-auto rounded-xl border border-line p-4">
        <p className="text-amber-500">★★★★★</p>
        <p className="mt-1 text-sm">&ldquo;On time, and every snag fixed in a week.&rdquo;</p>
        <p className="mt-1 text-xs text-ink-soft">Shows on your profile in Find a pro</p>
      </motion.div>
    </div>
  );
}

// What happens to what people tell Arcon, said plainly.
export function Trust() {
  const items = [
    { title: "No tracking, no ads", body: "One essential cookie keeps your project. Nothing follows you around the web." },
    { title: "Your project is yours", body: "Try it without an account; sign in to keep it, and delete it or your account any time." },
    { title: "Every choice explained", body: "Each material, colour and brand says which of your loves it came from." },
    { title: "Costs you can check", body: "Researched rates for eight markets, room by room and trade by trade, in your currency." },
  ];
  return (
    <section className="border-b border-line bg-paper-raised/60">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {items.map((t, i) => (
          <Reveal key={t.title} delay={0.06 * i}>
            <p className="font-serif text-xl">{t.title}</p>
            <p className="mt-1.5 text-sm text-ink-soft">{t.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
