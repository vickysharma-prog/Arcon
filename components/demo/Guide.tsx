"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tick } from "@/components/fx/sfx";

// A short guide, shown once, at two moments only: on the interview (what's about to happen, and in the tour, the tour
// pill) and the first time a design opens (where the controls are). Each tip lights up the control it's about.
// Seen guides are remembered (see `store`), so they never come back within the same visit.

type Tip = { at?: string; title: string; body: string };
const SEEN = "arcon-guide-";
// The tour's guides are remembered for this visit to the tour only (leaving it clears them, see TourBar), so every
// visitor who starts the tour gets them; a person's own guides are remembered in this browser for good.
const store = (id: string) => (id.startsWith("tour-") ? sessionStorage : localStorage);

const GUIDES: Record<string, Tip[]> = {
  "tour-start": [
    { at: "#judge-pill", title: "Welcome to Arcon", body: "A three-minute tour of Arcon: 14 stops in three chapters. Maya's interview plays by itself, then the tour moves on." },
    { at: "#judge-pill", title: "This pill is your remote", body: "Point at it, or tap it on a phone, to see what each stop shows, whose view it is, and every stop to jump to. Next moves on, and so do the arrow keys." },
  ],
  "tour-app": [
    { at: 'button[aria-label="Open the sidebar"], button[aria-label="Open the menu"]', title: "The sidebar is folded", body: "So the design gets the whole screen. Open it here (Ctrl+B on a computer) for every tool and every project." },
    { at: 'nav[aria-label="Progress"], nav[aria-label="Project"]', title: "Every part of the project", body: "The design, the thread, the site, the budget and the files, one click each. The tour stops at the ones that matter most." },
    { at: 'button[aria-label="Search and jump"]', title: "Search everything", body: "Ctrl+K jumps to any project, plan or message." },
    { at: 'nav[aria-label="Tour"]', title: "Back and Next", body: "Beside every page's title, and in the pill at the bottom." },
    { at: "#judge-pill", title: "See it through other eyes", body: "Point at the pill, or tap it, to switch between Maya, Lena the architect, Mike the builder and Sam the café owner." },
  ],
  start: [{ title: "Tell Arcon about your space", body: "Type or talk, in any language. About three minutes of questions, then three pictures for your taste, and your design follows." }],
  project: [
    { at: 'nav[aria-label="Progress"]', title: "Your design, step by step", body: "Your style, three plans, the 3D, budget, shopping list and files. Next, top right, moves on; Make changes lets you ask for anything in words." },
  ],
};

/** Which guide this page gets, if any. */
function guideFor(path: string, search: string, demo: boolean): string | null {
  if (demo) return path === "/start" && search.includes("demo=1") ? "tour-start" : /^\/(project|home)/.test(path) ? "tour-app" : null;
  if (path === "/start" && !search.includes("demo=1")) return "start";
  return /^\/project\/[0-9a-f-]{36}$/.test(path) ? "project" : null;
}

const visible = (sel?: string) => {
  if (!sel) return null;
  for (const el of document.querySelectorAll<HTMLElement>(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
};

export function Guide() {
  const path = usePathname();
  const still = useReducedMotion();
  const [id, setId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const demo = /(^|; )arcon_demo=/.test(document.cookie);
    const g = guideFor(path, location.search, demo);
    let seen = true;
    try {
      seen = !g || store(g).getItem(SEEN + g) === "1";
    } catch {}
    setId(seen ? null : g);
    setI(0);
    setLive(false);
  }, [path]);

  // While a guide is waiting or open the page is marked, so the interview's replay holds until it's closed.
  useEffect(() => {
    const html = document.documentElement;
    if (id) html.dataset.guide = "1";
    else delete html.dataset.guide;
    return () => {
      delete html.dataset.guide;
    };
  }, [id]);

  const tips = id ? GUIDES[id] : [];
  const tip = tips[i];

  // Wait for the page (and the tour's screen between stops) to settle, then follow the tip's control as it moves.
  useEffect(() => {
    if (!tip) return;
    let t: ReturnType<typeof setTimeout>;
    const begun = Date.now();
    const track = () => {
      const settled = !document.documentElement.dataset.veil && !document.querySelector("[data-page-loading]") && Date.now() - begun > (i ? 0 : 1200);
      const el = visible(tip.at);
      // the tour's tips give up waiting for their control after a few seconds; a person's own design waits for it, so
      // the guide never opens over the screen that's still making the design
      if (settled && (el || !tip.at || (id?.startsWith("tour-") && Date.now() - begun > 6000))) {
        if (el && !live) el.scrollIntoView({ block: "nearest" });
        setBox(el ? el.getBoundingClientRect() : null);
        setLive(true);
      }
      t = setTimeout(track, 250);
    };
    track();
    return () => clearTimeout(t);
  }, [tip, live, i, id]);

  const close = () => {
    try {
      if (id) store(id).setItem(SEEN + id, "1");
    } catch {}
    setId(null);
  };
  const next = () => {
    tick();
    if (i + 1 < tips.length) {
      setLive(false);
      setI(i + 1);
    } else close();
  };

  if (!tip || !live || typeof document === "undefined") return null;
  // the card sits beside the control: below it when there's room, otherwise above; centred when there's no control
  const W = Math.min(340, window.innerWidth - 24);
  const pad = 8;
  const below = box ? box.bottom + 180 < window.innerHeight : false;
  const left = box ? Math.min(Math.max(12, box.left + box.width / 2 - W / 2), window.innerWidth - W - 12) : (window.innerWidth - W) / 2;
  const top = box ? (below ? box.bottom + pad + 10 : undefined) : undefined;
  const bottom = box ? (below ? undefined : window.innerHeight - box.top + pad + 10) : undefined;

  return createPortal(
    <AnimatePresence>
      <motion.div key={`${id}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80]">
        {/* the page dims around the control the tip is about */}
        {box ? (
          <div
            aria-hidden
            className="pointer-events-none fixed rounded-2xl ring-2 ring-accent transition-all duration-300"
            style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2, boxShadow: "0 0 0 9999px rgba(8,14,26,0.45), 0 0 24px var(--accent)" }}
          />
        ) : (
          <div aria-hidden className="pointer-events-none fixed inset-0 bg-[rgba(8,14,26,0.45)]" />
        )}
        <motion.div
          role="dialog"
          aria-label={tip.title}
          initial={still ? false : { opacity: 0, y: below ? -6 : 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="fixed rounded-2xl border border-accent/40 bg-paper-raised p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]"
          style={{ left, width: W, ...(box ? { top, bottom } : { top: "50%", transform: "translateY(-50%)" }) }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Quick guide{tips.length > 1 ? ` · ${i + 1} of ${tips.length}` : ""}
          </p>
          <p className="mt-1.5 font-serif text-xl leading-snug">{tip.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{tip.body}</p>
          <div className="mt-4 flex items-center gap-2">
            {i + 1 < tips.length && (
              <button type="button" onClick={close} className="text-sm text-ink-soft transition hover:text-ink">
                Skip
              </button>
            )}
            <button type="button" onClick={next} autoFocus className="ml-auto rounded-full bg-btn px-4 py-1.5 text-sm text-btn-ink transition hover:opacity-90">
              {i + 1 < tips.length ? "Next tip" : "Got it"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
