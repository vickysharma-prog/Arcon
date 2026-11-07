"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DEMO_COOKIE } from "@/lib/demo/ids";
import { DEMO_ROLES, PEOPLE, type DemoRole } from "@/lib/demo/story";
import { CHAPTERS, TOUR } from "@/lib/demo/tour";
import { AnimatedMark } from "@/components/AnimatedMark";

// The tour, kept out of the way: a small glass pill at the bottom (which chapter and stop, back and next).
// Pointing at it (or a tap) opens what this stop shows, whose view it is (switch in one click), every stop to jump
// to, and the way out. Between stops one screen covers the page until the next one is ready, and says whose view
// comes next. Shown only in a demo session.
const GO = "arcon-tour-go";
const INTRO = "arcon-tour-intro";
const IN_APP = /^\/(project|home|start|pros|account)(\/|$)/;
const DONE = "/demo/done";

/** Which stop of the tour this is, and whose view, from the /demo route's cookie; null outside the demo. */
export function useStop() {
  const path = usePathname();
  const [at, setAt] = useState<{ step: number; who: DemoRole } | null>(null);
  useEffect(() => {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${DEMO_COOKIE}=`))?.split("=")[1];
    const [s, who] = decodeURIComponent(raw ?? "").split(".");
    // only inside the app the tour is showing, never on the landing page or other public pages
    const on = !!raw && IN_APP.test(path) && DEMO_ROLES.includes(who as DemoRole);
    setAt(on ? { step: Number(s) || 1, who: who as DemoRole } : null);
    // left the tour (the end, Try it yourself): nothing is left covering the page
    if (!on) {
      delete document.documentElement.dataset.veil;
      try {
        sessionStorage.removeItem(GO);
        sessionStorage.removeItem(INTRO);
        ["tour-start", "tour-app"].forEach((g) => sessionStorage.removeItem(`arcon-guide-${g}`));
      } catch {}
    }
  }, [path]);
  return at;
}
const step = (n: number) => (n > TOUR.length ? DONE : `/demo?step=${n}`);
const nextTitle = (n: number) => (n >= TOUR.length ? "The end" : TOUR[n].title.split(" ").slice(0, 4).join(" "));

/** "Lena Ortiz, the architect" */
const whoIs = (r: DemoRole) => `${PEOPLE[r].name}, the ${PEOPLE[r].label === "Homeowner" ? "homeowner" : PEOPLE[r].label.toLowerCase()}`;

type Veil = { chapter: string; title: string; who: string | null };

/** What the screen between stops says, from the link being followed. */
function veilFor(href: string, now: { step: number; who: DemoRole }): Veil {
  const u = new URL(href, location.origin);
  if (u.pathname === DONE) return { chapter: "The end of the tour", title: "Thank you", who: null };
  if (u.searchParams.has("exit")) return { chapter: "Your turn", title: "Design your own space", who: null };
  const as = u.searchParams.get("as") as DemoRole | null;
  const n = Number(u.searchParams.get("step")) || now.step;
  const stop = TOUR[Math.min(TOUR.length, Math.max(1, n)) - 1];
  const who = as ?? stop.as;
  return {
    chapter: `Chapter ${stop.chapter + 1} · ${CHAPTERS[stop.chapter]}`,
    title: as ? `${PEOPLE[as].name.split(" ")[0]}'s view` : stop.title,
    who: who !== now.who || n === 1 ? `Now you're seeing it as ${whoIs(who)}${as ? "" : ` · ${stop.project}`}` : null,
  };
}

/** Leaves for a tour link from code (the interview's replay moving on by itself), with the screen between stops. */
export function tourGo(href: string) {
  try {
    sessionStorage.setItem(GO, JSON.stringify(veilFor(href, { step: 1, who: "maya" })));
  } catch {}
  document.documentElement.dataset.veil = "1";
  location.href = href;
}

/** Back and next in the page's own title row, beside the title, where people look for the way on. */
export function TourNext() {
  const at = useStop();
  if (!at) return null;
  return (
    <nav aria-label="Tour" className="flex items-center gap-1 rounded-full border border-accent/40 bg-paper-raised p-1 shadow-[0_10px_30px_-18px_var(--accent)]">
      {at.step > 1 && (
        <a href={step(at.step - 1)} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink">
          ‹
        </a>
      )}
      <span className="px-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-accent">
        Tour {at.step}/{TOUR.length}
      </span>
      <a href={step(at.step + 1)} className="whitespace-nowrap rounded-full bg-btn px-4 py-1.5 text-sm text-btn-ink transition hover:opacity-90">
        {at.step === TOUR.length ? "Finish the tour ›" : `Next: ${nextTitle(at.step)} ›`}
      </a>
    </nav>
  );
}

/** True once the page under the veil has something to show: no whole-page loading screen left, and a heading. */
const ready = () => !document.querySelector("[data-page-loading]") && !!document.querySelector("main h1, h1");

export function TourBar() {
  const path = usePathname();
  const still = useReducedMotion();
  const at = useStop();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Between stops: one screen over the page, from the click until the next page is ready, then a fade into it.
  const [veil, setVeil] = useState<Veil | null>(null);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!at) return;
    let saved: Veil | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(GO) ?? "null");
      sessionStorage.removeItem(GO);
    } catch {}
    const html = document.documentElement;
    // The tour's first stop, coming from the landing page: the same screen opens it, saying whose view it starts in.
    if (!saved && at.step === 1) {
      try {
        if (!sessionStorage.getItem(INTRO)) {
          sessionStorage.setItem(INTRO, "1");
          saved = { chapter: `Chapter 1 · ${CHAPTERS[0]}`, title: TOUR[0].title, who: `You're seeing it as ${whoIs(TOUR[0].as)} · ${TOUR[0].project}` };
          html.dataset.veil = "1";
        }
      } catch {}
    }
    if (!saved) {
      delete html.dataset.veil;
      return;
    }
    setVeil(saved);
    setFading(false);
    const begun = Date.now();
    // long enough to read who's next when the person changes; never longer than the page needs, or 7 s at most
    const least = at.step === 1 ? 2600 : saved.who ? 1700 : 700;
    let t: ReturnType<typeof setTimeout>;
    const check = () => {
      const waited = Date.now() - begun;
      if ((waited >= least && ready()) || waited > 7000) {
        delete html.dataset.veil;
        setFading(true);
        t = setTimeout(() => setVeil(null), 650);
      } else t = setTimeout(check, 120);
    };
    check();
    return () => clearTimeout(t);
  }, [at]);
  useEffect(() => {
    if (!at) return;
    // any tour link (next, back, a stop, another person's view, the end) shows the screen as it leaves
    const go = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a[href^='/demo']") as HTMLAnchorElement | null;
      if (!a || e.metaKey || e.ctrlKey) return;
      const v = veilFor(a.getAttribute("href") ?? "", at);
      try {
        sessionStorage.setItem(GO, JSON.stringify(v));
      } catch {}
      setFading(false);
      setVeil(v);
    };
    document.addEventListener("click", go, true);
    return () => document.removeEventListener("click", go, true);
  }, [at]);
  // The arrow keys move through the tour, except while typing or on a page with 3D (where they walk).
  useEffect(() => {
    if (!at) return;
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable=true]") || document.querySelector("canvas")) return;
      const n = e.key === "ArrowRight" ? at.step + 1 : at.step - 1;
      if (n < 1) return;
      const href = step(n);
      try {
        sessionStorage.setItem(GO, JSON.stringify(veilFor(href, at)));
      } catch {}
      setFading(false);
      setVeil(veilFor(href, at));
      location.href = href;
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at]);
  // Room under the page for the pill, so nothing at the bottom hides behind it.
  useEffect(() => {
    if (!at) return;
    document.body.style.paddingBottom = "84px";
    // and for screens that fill the window (the 3D), the same room as a measure they can take off their height
    document.documentElement.style.setProperty("--judge-pad", "84px");
    return () => {
      document.body.style.paddingBottom = "";
      document.documentElement.style.removeProperty("--judge-pad");
    };
  }, [at]);
  // On a long page, a soft wash over the bottom of the screen asks to scroll; it goes at the first scroll.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!at || veil) return;
    setHint(false);
    const show = setTimeout(() => {
      // not while the quick guide is up: one thing at a time
      if (!document.documentElement.dataset.guide && window.scrollY < 40 && document.documentElement.scrollHeight > window.innerHeight * 1.35) setHint(true);
    }, 1500);
    const hide = () => setHint(false);
    window.addEventListener("scroll", hide, { once: true });
    const stop = setTimeout(hide, 7000);
    return () => {
      clearTimeout(show);
      clearTimeout(stop);
      window.removeEventListener("scroll", hide);
    };
  }, [at, path, veil]);
  useEffect(() => setOpen(false), [path]);
  // A button a visitor presses that would change the demo is refused by the server (proxy.ts); some screens keep quiet
  // about a failed request, so the bar says it once, for all of them.
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!at) return;
    const real = window.fetch;
    let hide: ReturnType<typeof setTimeout>;
    window.fetch = async (...args) => {
      const res = await real(...args);
      if (res.status === 403 && res.headers.get("x-arcon-demo") === "view-only") {
        setRefused(true);
        clearTimeout(hide);
        hide = setTimeout(() => setRefused(false), 4000);
      }
      return res;
    };
    return () => {
      window.fetch = real;
      clearTimeout(hide);
    };
  }, [at]);
  // a tap anywhere else, or Escape, closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!at) return null;

  const stop = TOUR[at.step - 1];
  const last = at.step === TOUR.length;
  const here = typeof location === "undefined" ? "/home" : location.pathname + location.search;

  return (
    <>
      <AnimatePresence>
        {veil && (
          <motion.div
            key="veil"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: fading ? 0 : 1 }}
            transition={{ duration: fading ? 0.6 : 0.25, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-paper/[0.93] px-6 backdrop-blur-3xl"
          >
            <div className="flex max-w-xl flex-col items-center text-center">
              <AnimatedMark size={56} />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Arcon · Spaces designed around who you are</p>
              <motion.div initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="mt-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">{veil.chapter}</p>
                <p className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">{veil.title}</p>
                {veil.who && (
                  <p className="mx-auto mt-4 w-fit rounded-full border border-accent/40 bg-paper-raised/80 px-4 py-1.5 text-sm text-accent">{veil.who}</p>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
        {hint && !veil && (
          <motion.div
            key="hint"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex h-[26vh] max-sm:hidden flex-col items-center justify-end gap-1.5 bg-gradient-to-b from-transparent to-paper/85 pb-[5.5rem] text-ink-soft"
          >
            <span className="relative h-11 w-7 rounded-full border-2 border-current">
              <span className="absolute left-1/2 top-2 h-2 w-1 -translate-x-1/2 animate-bounce rounded-full bg-current motion-reduce:animate-none" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.25em]">Scroll for more</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* the pill: opens as the pointer reaches it (a tap on a phone), closes a moment after it leaves */}
      <div
        ref={box}
        id="judge-pill"
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          clearTimeout(leave.current);
          setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") leave.current = setTimeout(() => setOpen(false), 250);
        }}
        className="fixed bottom-3 left-1/2 z-[60] w-[min(38rem,calc(100vw-1rem))] -translate-x-1/2"
      >
        <AnimatePresence>
          {refused && !open && (
            <motion.p
              role="status"
              initial={still ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={still ? undefined : { opacity: 0, y: 6 }}
              className="mb-2 rounded-xl border border-accent/40 bg-paper-raised/95 px-4 py-2.5 text-center text-sm shadow-lg backdrop-blur-xl"
            >
              The demo is view only, so nothing changes.{" "}
              <a href="/demo?exit=start" className="text-accent underline-offset-2 hover:underline">
                Try it on your own project
              </a>
            </motion.p>
          )}
          {open && (
            <motion.div
              id="judge-more"
              initial={still ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={still ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="mb-2 max-h-[min(34rem,calc(100dvh-6rem))] overflow-y-auto rounded-2xl border border-line/70 bg-paper-raised/95 p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                {PEOPLE[at.who].label}&apos;s view · {stop.project}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{stop.what}</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">See it as</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DEMO_ROLES.map((r) => (
                  <a
                    key={r}
                    href={`/demo?as=${r}&from=${encodeURIComponent(here)}`}
                    aria-current={r === at.who ? "true" : undefined}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${r === at.who ? "border-accent bg-accent text-btn-ink" : "border-line hover:border-accent hover:text-accent"}`}
                  >
                    {PEOPLE[r].label} <span className="opacity-70">· {PEOPLE[r].name.split(" ")[0]}</span>
                  </a>
                ))}
              </div>
              {/* every stop by chapter, to jump straight to one */}
              <div className="mt-3 grid gap-3 border-t border-line/70 pt-3 sm:grid-cols-3">
                {CHAPTERS.map((c, ci) => (
                  <div key={c}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                      {ci + 1} · {c}
                    </p>
                    <ol className="mt-1 space-y-0.5">
                      {TOUR.map((t, i) =>
                        t.chapter !== ci ? null : (
                          <li key={i}>
                            <a
                              href={step(i + 1)}
                              aria-current={i + 1 === at.step ? "step" : undefined}
                              className={`flex gap-1.5 rounded-md px-1.5 py-0.5 text-xs leading-snug transition ${i + 1 === at.step ? "bg-accent/10 text-accent" : "text-ink-soft hover:bg-paper hover:text-ink"}`}
                            >
                              <span className="w-4 shrink-0 font-mono tabular-nums opacity-70">{i + 1}</span>
                              {t.title}
                            </a>
                          </li>
                        ),
                      )}
                    </ol>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-line/70 pt-2.5 text-xs text-ink-soft">
                <span>← → move through the tour</span>
                <a href="/demo?exit" className="ml-auto transition hover:text-ink">
                  Exit the tour
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* the pill */}
        <div className="rounded-full border border-line/70 bg-paper-raised/70 py-1 pl-1.5 pr-1 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              // a mouse already opened it by pointing; a tap toggles it
              onClick={(e) => ((e.nativeEvent as PointerEvent).pointerType === "mouse" ? setOpen(true) : setOpen((o) => !o))}
              aria-expanded={open}
              aria-controls="judge-more"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-2 py-1 text-left transition hover:bg-paper/60"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-soft">
                {at.step}/{TOUR.length}
              </span>
              <span className="min-w-0 truncate text-sm">{stop.title}</span>
              <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className={`shrink-0 text-ink-soft transition-transform ${open ? "" : "rotate-180"}`}>
                <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {at.step > 1 && (
              <a href={step(at.step - 1)} aria-label="Back" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-paper/60 hover:text-ink">
                ‹
              </a>
            )}
            <a href={step(at.step + 1)} className="shrink-0 rounded-full bg-btn px-3.5 py-1.5 text-sm text-btn-ink transition hover:opacity-90">
              {last ? "Finish ›" : "Next ›"}
            </a>
          </div>
          {/* where the tour is: a segment per stop, grouped by chapter */}
          <div className="mx-3 mb-0.5 mt-0.5 flex gap-1.5" aria-hidden>
            {CHAPTERS.map((_, ci) => (
              <div key={ci} className="flex flex-1 gap-0.5">
                {TOUR.map((t, i) =>
                  t.chapter !== ci ? null : <span key={i} className={`h-[3px] flex-1 rounded-full ${i + 1 <= at.step ? "bg-accent" : "bg-line"}`} />,
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
