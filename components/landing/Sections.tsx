"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatedMark } from "@/components/AnimatedMark";
import { Logo } from "@/components/Logo";
import { HomeLink } from "./Intro";
import { CountUp, HudCard, Reveal, Ring } from "@/components/fx/Motion";
import { tick, transition } from "@/components/fx/sfx";
import { FAQ } from "@/lib/content/faq";
import { TasteGraph } from "./TasteGraph";

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">{children}</p>;
}

function Heading({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-ink-soft">{sub}</p>}
    </Reveal>
  );
}

const STEPS = [
  { n: "01", title: "Tell Arcon about it", body: "The space, who uses it, how it's used and your budget. Tap, type or just talk." },
  { n: "02", title: "Find your style", body: "Three quick picks: a place, a brand, a film or music. Arcon reads your taste and names your style." },
  { n: "03", title: "Choose a plan", body: "Three floor plans for your plot, each clear about what it does best and what it gives up." },
  { n: "04", title: "Walk through it", body: "Step inside in 3D, by day or by night, with the outside designed from your taste too." },
  { n: "05", title: "Build it", body: "Budget, drawings, a shopping list, your team and the building site, all in one place." },
  { n: "06", title: "Move in", body: "Check it room by room, list anything to fix, get the handover pack and warranty, then review your team." },
];

export function HowItWorks() {
  const still = useReducedMotion();
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (still || held || !seen) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 2400);
    return () => clearInterval(t);
  }, [still, held, seen]);
  const pct = (active / (STEPS.length - 1)) * 100;
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-8">
      <Heading eyebrow="How it works" title="From a conversation to a space you can walk through." />
      <motion.div className="relative mt-16" onViewportEnter={() => setSeen(true)} viewport={{ once: true, margin: "-120px" }}>
        {/* the line joining the steps: a quiet track, the part done so far, and a light moving along it */}
        <div aria-hidden className="absolute bottom-6 left-6 top-6 w-px bg-line md:bottom-auto md:left-6 md:right-[calc(16.667%-1.5rem)] md:top-6 md:h-px md:w-auto">
          <motion.div
            className="absolute left-0 top-0 w-px bg-gradient-to-b from-btn via-accent to-leaf md:hidden"
            animate={{ height: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            className="absolute left-0 top-0 hidden h-px bg-gradient-to-r from-btn via-accent to-leaf md:block"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          {!still && (
            <motion.span
              className="absolute hidden h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_14px_4px_var(--accent)] md:block"
              animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
        <ol className="relative grid gap-8 md:grid-cols-6 md:gap-5">
          {STEPS.map((s, i) => {
            const on = i === active;
            const done = i < active;
            return (
              <Reveal key={s.n} delay={0.12 * i}>
                <li className="flex gap-5 md:block">
                  <button
                    type="button"
                    onClick={() => {
                      tick();
                      setHeld(true);
                      setActive(i);
                    }}
                    aria-pressed={on}
                    aria-label={`Step ${s.n}: ${s.title}`}
                    className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full border font-mono text-sm transition-colors duration-500 ${on ? "border-accent bg-accent text-white" : done ? "border-accent bg-paper text-accent" : "border-line bg-paper text-ink-soft"}`}
                  >
                    {on && !still && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-accent/60" />}
                    {s.n}
                  </button>
                  <div>
                    <h3 className={`font-serif text-2xl transition-colors duration-500 md:mt-5 ${on ? "text-ink" : "text-ink-soft"}`}>{s.title}</h3>
                    <p className={`mt-2 transition-colors duration-500 ${on ? "text-ink" : "text-ink-soft"}`}>{s.body}</p>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </motion.div>
    </section>
  );
}

// Invented examples of what someone loves, the taste words found in them, and what the design does with them.
const LOVES = ["A slow film you rewatch every winter", "The corner café with the long wooden bar", "Linen sheets, always", "Old jazz while you cook"];
const KINDS = ["Film", "Café", "Home", "Music"];
const SWATCHES = [
  "radial-gradient(circle at 50% 30%, #ffe2a8, #e0a243 55%, #6b4a1c)", // warm lamp light
  "linear-gradient(135deg, #6b3f1f, #a8693a 45%, #5a3218)", // a walnut bar
  "linear-gradient(135deg, #c9a27a 0 50%, #ece4d6 50% 100%)", // oak and linen
  "linear-gradient(135deg, #20392d, #345a45)", // a deep green study
];
const TAGS = ["Low light", "Vintage", "Warm", "Natural materials", "Understated", "Cosy", "Earthy", "Handmade"];
const MAKES = ["Warm lamps, no glare from above", "A wooden bar between kitchen and living", "Oak floors and linen curtains", "A record shelf in a deep green study"];
// Which taste words each love carries, and which design choices each love leads to.
const LINKS: { tags: number[]; makes: number[] }[] = [
  { tags: [0, 1, 5], makes: [0, 3] },
  { tags: [2, 3, 7], makes: [1, 2] },
  { tags: [3, 4, 6], makes: [2] },
  { tags: [1, 2, 5], makes: [3, 1] },
];

export function TasteFlow() {
  const still = useReducedMotion();
  const [on, setOn] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (still || held) return;
    const t = setInterval(() => setOn((i) => (i + 1) % LOVES.length), 2800);
    return () => clearInterval(t);
  }, [still, held]);
  const link = LINKS[on];

  return (
    <section id="taste" className="relative scroll-mt-24 overflow-hidden border-y border-line bg-paper-raised/50 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
        <Heading
          eyebrow="Taste becomes space"
          title="Your films, cafés and brands, read by Arcon's taste AI."
          sub="Most design tools ask you to describe a style. Arcon finds it in the things you already love, then shows you why every choice was made."
        />
        <Reveal className="mt-14 hidden md:block">
          <div onMouseLeave={() => setHeld(false)}>
            <TasteGraph
              loves={LOVES.map((text, i) => ({ text, kind: KINDS[i] }))}
              tags={TAGS}
              makes={MAKES.map((text, i) => ({ text, swatch: SWATCHES[i] }))}
              links={LINKS}
              on={on}
              onPick={(i) => {
                setHeld(true);
                setOn(i);
              }}
            />
          </div>
        </Reveal>
        <div className="mt-12 grid gap-8 md:hidden">
          <Column title="You say">
            {LOVES.map((l, i) => (
              <button
                key={l}
                type="button"
                onMouseEnter={() => {
                  setHeld(true);
                  setOn(i);
                }}
                onClick={() => {
                  tick();
                  setHeld(true);
                  setOn(i);
                }}
                className={`w-full rounded-2xl border px-5 py-4 text-left text-base transition-all duration-300 sm:text-lg ${i === on ? "translate-x-1 border-accent bg-paper shadow-[0_14px_40px_-16px_var(--accent)]" : "border-line bg-paper/60 text-ink-soft"}`}
              >
                “{l}”
              </button>
            ))}
          </Column>
          <Column title="Arcon reads">
            <div className="relative flex flex-wrap justify-center gap-2.5 rounded-3xl border border-accent/30 bg-paper/70 px-5 py-8 shadow-[0_0_80px_-30px_var(--accent)]">
              {/* the taste engine at the centre, pulsing */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_70%)] animate-pulse motion-reduce:animate-none" />
              {TAGS.map((t, i) => (
                <motion.span
                  key={t}
                  animate={{ scale: link.tags.includes(i) ? 1.08 : 1, opacity: link.tags.includes(i) ? 1 : 0.45 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`relative rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-wider sm:text-sm ${link.tags.includes(i) ? "border-accent bg-accent/10 text-accent shadow-[0_0_24px_-6px_var(--accent)]" : "border-line"}`}
                >
                  {t}
                </motion.span>
              ))}
            </div>
          </Column>
          <Column title="Arcon designs">
            {MAKES.map((m, i) => (
              <motion.p
                key={m}
                animate={{ opacity: link.makes.includes(i) ? 1 : 0.4, x: link.makes.includes(i) ? 0 : 6 }}
                className={`flex items-start gap-2 rounded-2xl border px-5 py-4 text-base transition-colors sm:text-lg ${link.makes.includes(i) ? "border-leaf/60 bg-paper shadow-[0_14px_40px_-20px_var(--leaf)]" : "border-line bg-paper/60"}`}
              >
                <span className="mt-0.5 text-leaf">✓</span>
                {m}
              </motion.p>
            ))}
          </Column>
        </div>
        <Reveal className="mt-10 text-center text-sm text-ink-soft">
          Every room, material and brand in your design carries a note on which of your loves it came from.
        </Reveal>
      </div>
    </section>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Reveal>
      <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink-soft">{title}</p>
      <div className="space-y-2">{children}</div>
    </Reveal>
  );
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-8">
      <Heading eyebrow="What you get" title="Everything a first meeting with an architect gives you, in minutes." />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Feature delay={0} title="Talk in your language" body="Speak or type in English, हिंदी or Hinglish. Tap answers when you'd rather not type.">
          <Bars />
        </Feature>
        <Feature delay={0.08} title="Your style, read from your taste" body="Three picks become your style, and every material, colour and piece says which of your loves it came from.">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            <span className="rounded border border-line px-1.5 py-0.5">film</span>→<span className="rounded border border-accent px-1.5 py-0.5 text-accent">low light</span>→
            <span className="rounded border border-leaf px-1.5 py-0.5 text-leaf">lamps</span>
          </div>
        </Feature>
        <Feature delay={0.16} title="Three plans, honest trade-offs" body="Each option says what it does best and what it gives up. Or upload the plan you already have.">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-12 flex-1 rounded-md border ${i === 1 ? "border-accent bg-accent/10" : "border-line"}`} />
            ))}
          </div>
        </Feature>
        <Feature delay={0.24} title="3D, inside and out" body="Walk room to room by day or night. The roof and walls outside follow your taste; click any piece for its brand.">
          <Cube />
        </Feature>
        <Feature delay={0} title="A budget in your currency" body="Researched rates for 8 markets, room by room, with a timeline, a green score and a shopping list near you.">
          <p className="font-serif text-4xl text-ink">
            $<CountUp value={48200} format={(v) => Math.round(v).toLocaleString("en-US")} />
          </p>
        </Feature>
        <Feature delay={0.08} title="A drawings pack" body="Dimensioned plans, all four elevations and door and window schedules, as a PDF and a DXF for CAD.">
          <MiniPlan />
        </Feature>
        <Feature delay={0.16} title="Your team in one place" body="Invite your architect and builder by link or QR. Talk room by room, approve versions, track fees.">
          <div className="flex -space-x-2">
            {["bg-btn", "bg-accent", "bg-leaf"].map((c, i) => (
              <span key={c} className={`h-9 w-9 rounded-full border-2 border-paper ${c}`} style={{ zIndex: 3 - i }} />
            ))}
          </div>
        </Feature>
        <Feature delay={0.24} title="Follow the build" body="Phases, crew, materials and photo updates from the site, on your phone. Install Arcon like an app.">
          <Ring value={64} size={64} stroke={6} />
        </Feature>
      </div>
    </section>
  );
}

function Feature({ title, body, children, delay }: { title: string; body: string; children: ReactNode; delay: number }) {
  return (
    <HudCard delay={delay} className="flex flex-col p-5">
      <div className="flex h-16 items-center">{children}</div>
      <h3 className="mt-4 font-serif text-xl">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
    </HudCard>
  );
}

function Bars() {
  const still = useReducedMotion();
  return (
    <div className="flex h-10 items-center gap-1">
      {Array.from({ length: 14 }, (_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-accent"
          animate={still ? { height: 14 } : { height: [6, 10 + ((i * 7) % 26), 6] }}
          transition={{ duration: 0.9 + (i % 4) * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }}
        />
      ))}
    </div>
  );
}

function MiniPlan() {
  return (
    <svg width="84" height="56" viewBox="0 0 84 56" fill="none" stroke="var(--accent)" strokeWidth="1.6" aria-hidden>
      <motion.path d="M2 2h80v52H2zM40 2v26H2M40 28h42M58 28v26" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.8, ease: "easeInOut" }} />
    </svg>
  );
}

function Cube() {
  const still = useReducedMotion();
  return (
    <motion.svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="var(--ink)" strokeWidth="1.4" aria-hidden animate={still ? {} : { rotate: [0, 8, 0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
      <path d="M28 4 50 16v24L28 52 6 40V16z" />
      <path d="M6 16l22 12 22-12M28 28v24" stroke="var(--accent)" />
    </motion.svg>
  );
}

const AUDIENCE = [
  { title: "Homeowners", body: "Planning a new build or a big renovation: see it, change it and price it before anyone builds it, then follow the build." },
  { title: "Cafés, hotels, shops and offices", body: "Arcon asks how you run the place, reads your neighbourhood and plans for the crowd you want." },
  { title: "Architects and designers", body: "Studio tools: new clients in person or by link, three options on day one, your branding on every drawing, fees by milestone." },
  { title: "Builders", body: "Run the site in Arcon: phases, crew, materials and photo updates your client can follow, while your costs stay yours." },
];

export function Audience() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
      <Heading eyebrow="Who it's for" title="Any space, for the people who will use it." />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {AUDIENCE.map((a, i) => (
          <HudCard key={a.title} delay={i * 0.08} className="p-6">
            <h3 className="font-serif text-2xl">{a.title}</h3>
            <p className="mt-2 text-ink-soft">{a.body}</p>
          </HudCard>
        ))}
      </div>
    </section>
  );
}

// The size of what Arcon is for, each number with where it comes from.
const MARKET = [
  { value: 518, prefix: "$", suffix: "B", what: "Americans' spending on improving their homes in 2026", source: "Harvard Joint Center for Housing Studies, LIRA, April 2026", href: "https://www.jchs.harvard.edu/press-releases/remodeling-growth-set-downshift-late-2026" },
  { value: 26, prefix: "", suffix: "M", what: "US homeowner households spent on improving their homes in 2023, almost 3 in 10 owners", source: "Harvard Joint Center for Housing Studies, Improving America's Housing 2025", href: "https://www.jchs.harvard.edu/improving-americas-housing-2025" },
];

export function Market() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
      <div className="grid gap-4 rounded-3xl border border-line bg-paper-raised/60 p-6 sm:p-8 md:grid-cols-[1.2fr_1fr_1fr] md:items-center">
        <Reveal>
          <Eyebrow>Why it matters</Eyebrow>
          <p className="mt-3 font-serif text-3xl leading-tight">Every dollar goes into a space someone lives or works in. Arcon designs it around who they are.</p>
        </Reveal>
        {MARKET.map((m, i) => (
          <Reveal key={m.what} delay={0.1 + i * 0.08} className="border-line md:border-l md:pl-6">
            <p className="font-serif text-6xl leading-none text-accent">
              {m.prefix}
              <CountUp value={m.value} />
              {m.suffix}
            </p>
            <p className="mt-2">{m.what}</p>
            <a href={m.href} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-ink-soft hover:text-accent">
              Source: {m.source}
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// Common questions, one open at a time: the questions as cards beside a short note and a way to ask anything else.
const CONTACT = { email: "raghunathsharma296@gmail.com", linkedin: "https://www.linkedin.com/in/vickysharmasynap/" };

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Questions</p>
          <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Before you start</h2>
          <p className="mt-4 max-w-sm text-ink-soft">What it costs, how it reads your taste, what happens to your data, and who it is for.</p>
          <div className="mt-8 max-w-sm rounded-2xl border border-line bg-paper-raised/70 p-5 backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Something else?</p>
            <p className="mt-2">Write to us and a person answers.</p>
            <a href={`mailto:${CONTACT.email}`} className="mt-3 inline-block break-all text-accent underline-offset-2 hover:underline">
              {CONTACT.email}
            </a>
            <p className="mt-4 text-sm text-ink-soft">
              Or read the guides in{" "}
              <Link href="/resources" className="text-accent underline-offset-2 hover:underline">
                Resources
              </Link>
            </p>
          </div>
        </Reveal>
        <ul className="space-y-3">
          {FAQ.map((f, i) => {
            const on = open === i;
            return (
              <li key={f.q} className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${on ? "border-accent/50 bg-paper-raised shadow-[0_18px_50px_-28px_var(--accent)]" : "border-line bg-paper-raised/50 hover:border-accent/40"}`}>
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => {
                    tick();
                    setOpen(on ? null : i);
                  }}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className={`text-base transition-colors sm:text-lg ${on ? "text-ink" : "text-ink/90"}`}>{f.q}</span>
                  <motion.span aria-hidden animate={{ rotate: on ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-lg transition-colors ${on ? "border-accent bg-accent text-btn-ink" : "border-line text-accent"}`}>
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                      <p className="px-5 pb-5 leading-relaxed text-ink-soft sm:px-6">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Free", price: "$0", per: "", for: "Anyone, to try it", cta: "Start free", href: "/start", features: ["Your style, read from your taste", "Three floor plans", "The 3D from outside", "The style quiz"] },
  { name: "Project", price: "$149", per: "one time", alt: "$299 for a café, shop, office or hotel", for: "Homeowners and business owners", cta: "Design my space", href: "/start", featured: true, features: ["Walk inside, by day and night", "Budget, timeline and shopping list", "Make changes by chat", "Drawings pack, PDF and DXF", "Your architect and builder on the project", "Follow the building site"] },
  { name: "Studio", price: "$99", per: "/month", alt: "or $990 a year, two months free", for: "Architects and interior designers", cta: "Start 14-day trial", href: "/login?mode=signup", features: ["Every client project unlocked", "New clients in person or by link", "Your branding on exports", "Fees by milestone", "Clients find you by taste match"] },
  { name: "Build", price: "$299", per: "/month", alt: "or $2,990 a year", for: "Builders and contractors", cta: "Start 14-day trial", href: "/login?mode=signup", features: ["Site tracking: phases, crew, materials", "Photo updates for clients", "Your costs stay yours", "Design-and-build projects"] },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-24 border-t border-line bg-paper-raised/50 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <Heading eyebrow="Pricing" title="Start free. Pay when you're ready to build." sub="Try it free, pay once per project, or work on every project as a pro. Pro plans start with 14 days free." />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 ${p.featured ? "border-accent bg-paper shadow-[0_30px_80px_-40px_var(--accent)]" : "border-line bg-paper"}`}
              >
                {p.featured && <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-px w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent animate-[edge_2.4s_linear_infinite] motion-reduce:animate-none" />}
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-2xl">{p.name}</h3>
                  {p.featured && <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">Most chosen</span>}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{p.for}</p>
                <p className="mt-5 font-serif text-5xl leading-none">
                  {p.price}
                  <span className="ml-1 font-sans text-sm text-ink-soft">{p.per}</span>
                </p>
                {p.alt && <p className="mt-1 text-sm text-ink-soft">{p.alt}</p>}
                <ul className="mt-6 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-leaf">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  onClick={() => transition()}
                  className={`mt-6 rounded-full px-5 py-2.5 text-center transition ${p.featured ? "glow-btn" : "border border-line hover:border-accent hover:text-accent hover:shadow-[0_10px_30px_-14px_var(--accent)]"}`}
                >
                  {p.cta}
                </Link>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCall() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-8">
        <Reveal>
          <div className="drop-shadow-[0_0_40px_var(--accent)]">
            <AnimatedMark size={96} />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-8 font-serif text-4xl leading-tight sm:text-6xl">Your next space starts with a conversation.</h2>
        </Reveal>
        <Reveal delay={0.2}>
          <Link
            href="/start"
            onClick={() => transition()}
            className="glow-btn group mt-10 px-8 py-4 text-lg"
          >
            Start designing free
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <HomeLink>
            <Logo size={24} />
          </HomeLink>
          <p className="mt-3 max-w-xs text-sm text-ink-soft">An AI architect that designs any space around the taste of the people who use it.</p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Spaces designed around who you are</p>
        </div>
        <nav aria-label="Arcon" className="grid content-start gap-2 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Arcon</p>
          <Link href="/start" className="w-fit hover:text-accent">Start designing</Link>
          <a href="/demo" className="w-fit hover:text-accent">Take the tour</a>
          <Link href="/resources" className="w-fit hover:text-accent">Resources</Link>
          <Link href="/privacy" className="w-fit hover:text-accent">Privacy</Link>
        </nav>
        <div className="grid content-start gap-2 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Made by Vicky Sharma</p>
          <a href={`mailto:${CONTACT.email}`} className="flex w-fit items-center gap-2 break-all hover:text-accent">
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            {CONTACT.email}
          </a>
          <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-2 hover:text-accent">
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
              <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm7 0h3.8v1.5h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13v5.43h-4v-4.81c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.89h-4v-11Z" />
            </svg>
            LinkedIn
          </a>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-soft sm:px-8">© 2026 Arcon</p>
      </div>
    </footer>
  );
}
