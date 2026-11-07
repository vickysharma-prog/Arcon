"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tick } from "@/components/fx/sfx";

// A slim band under the hero: two things someone loves, read by Qloo right now into a style, the words behind it
// (each from one of the loves) and the brands it points to. Three examples take turns. If Qloo can't answer, a
// written example shows instead, labelled as an example.

type Read = { space: string; loves: { name: string; image: string | null }[]; style: string; words: { word: string; from: string }[]; brands: string[] };

const EXAMPLE: Read = {
  space: "A home",
  loves: [
    { name: "The Grand Budapest Hotel", image: null },
    { name: "Aman Tokyo", image: null },
  ],
  style: "Modern",
  words: [
    { word: "calm", from: "Aman Tokyo" },
    { word: "symmetry", from: "The Grand Budapest Hotel" },
    { word: "soft colour", from: "The Grand Budapest Hotel" },
    { word: "natural wood", from: "Aman Tokyo" },
  ],
  brands: [],
};

export function QlooStrip() {
  const still = useReducedMotion();
  const [reads, setReads] = useState<Read[] | null>(null);
  const [live, setLive] = useState(false);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    fetch("/api/strip")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.reads?.length) {
          setReads(d.reads);
          setLive(true);
        } else setReads([EXAMPLE]);
      })
      .catch(() => setReads([EXAMPLE]));
  }, []);

  useEffect(() => {
    if (!reads || reads.length < 2 || still || held) return;
    const t = setInterval(() => setI((n) => (n + 1) % reads.length), 5200);
    return () => clearInterval(t);
  }, [reads, still, held]);

  const r = reads?.[i];
  return (
    <section aria-label="Taste, read live" className="relative border-y border-line bg-paper-raised/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex shrink-0 items-center justify-between gap-4 lg:block lg:w-44">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-leaf" : "bg-ink-soft"}`} />
            {live ? "Live" : "Example"}
          </p>
          {reads && reads.length > 1 && (
            <div className="flex gap-1.5 lg:mt-3" role="tablist" aria-label="Examples">
              {reads.map((x, n) => (
                <button
                  key={x.space}
                  role="tab"
                  aria-selected={n === i}
                  aria-label={x.space}
                  onClick={() => {
                    tick();
                    setHeld(true);
                    setI(n);
                  }}
                  className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-accent" : "w-1.5 bg-line hover:bg-ink-soft"}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-h-[7.5rem] min-w-0 flex-1 sm:min-h-[4.5rem]">
          <AnimatePresence mode="wait">
            {r ? (
              <motion.div
                key={r.space}
                initial={still ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.35 }}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
              >
                {/* the loves */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="mr-1 hidden text-xs text-ink-soft sm:inline">{r.space}:</span>
                  {r.loves.map((l, n) => (
                    <span key={l.name} className="flex items-center gap-2">
                      {n > 0 && <span className="text-ink-soft">+</span>}
                      <span className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-sm">
                        {l.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <span className="h-7 w-7 rounded-full bg-accent/15" />
                        )}
                        <span className="max-w-[9rem] truncate sm:max-w-[12rem]">{l.name}</span>
                      </span>
                    </span>
                  ))}
                </div>

                {/* Qloo reading it */}
                <div aria-hidden className="relative hidden h-px w-16 shrink-0 overflow-hidden bg-line sm:block">
                  {!still && <motion.span className="absolute top-0 h-px w-6 bg-accent shadow-[0_0_8px_var(--accent)]" initial={{ left: "-30%" }} animate={{ left: "110%" }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} />}
                </div>

                {/* the style and its words */}
                <div className="min-w-0">
                  <p className="font-serif text-2xl leading-none">{r.style}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {r.words.map((w, n) => (
                      <motion.li
                        key={w.word}
                        initial={still ? false : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25 + n * 0.08 }}
                        title={`from ${w.from}`}
                        className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-0.5 font-mono text-[11px] text-accent"
                      >
                        {w.word}
                        <span className="ml-1 text-ink-soft">· {w.from}</span>
                      </motion.li>
                    ))}
                  </ul>
                  {r.brands.length > 0 && <p className="mt-1.5 truncate text-xs text-ink-soft">Points to {r.brands.join(" · ")}</p>}
                </div>
              </motion.div>
            ) : (
              <p className="py-6 font-mono text-xs text-ink-soft">&gt; reading taste…</p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
