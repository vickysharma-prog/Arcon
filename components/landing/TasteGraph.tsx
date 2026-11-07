"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tick } from "@/components/fx/sfx";

// The taste graph: what someone loves (left) is read by Qloo into taste words (the hub), which become design
// choices (right). The love in focus lights its words and the choices they lead to, with pulses running along the
// links. Drawn in one 1000 × 560 frame: nodes are HTML placed by percentage, the links one SVG over them.

export type Love = { text: string; kind: string };
export type Make = { text: string; swatch: string };
export type Link = { tags: number[]; makes: number[] };

const W = 1000;
const H = 560;
const LOVE_X = 250; // the right edge of the love nodes
const MAKE_X = 750; // the left edge of the choice nodes
const HUB = { x: 500, y: 280 };
const rowY = (i: number, n: number) => 95 + (i * (H - 190)) / Math.max(1, n - 1);
// the words orbit the hub on an ellipse, starting at the top
const tagAt = (i: number, n: number) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: HUB.x + Math.cos(a) * 150, y: HUB.y + Math.sin(a) * 175 };
};
const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = (x2 - x1) * 0.55;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
};
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function TasteGraph({ loves, tags, makes, links, on, onPick }: { loves: Love[]; tags: string[]; makes: Make[]; links: Link[]; on: number; onPick: (i: number) => void }) {
  const still = useReducedMotion();
  const link = links[on];
  const tagPos = tags.map((_, i) => tagAt(i, tags.length));
  // every possible link drawn faint, the ones from the love in focus drawn bright
  const inEdges = loves.flatMap((_, li) => links[li].tags.map((ti) => ({ li, ti, d: curve(LOVE_X, rowY(li, loves.length), tagPos[ti].x, tagPos[ti].y) })));
  const outEdges = makes.flatMap((_, mi) => tags.map((_, ti) => ({ mi, ti })).filter(({ ti }) => links.some((l) => l.tags.includes(ti) && l.makes.includes(mi)))).map(({ mi, ti }) => ({ mi, ti, d: curve(tagPos[ti].x, tagPos[ti].y, MAKE_X, rowY(mi, makes.length)) }));
  const hotIn = inEdges.filter((e) => e.li === on);
  const hotOut = outEdges.filter((e) => link.tags.includes(e.ti) && link.makes.includes(e.mi));
  // a believable strength for each lit word, steady for each love
  const weight = (ti: number) => 72 + ((ti * 37 + on * 13) % 25);

  return (
    <div className="relative mx-auto w-full max-w-6xl" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="tg-in" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="tg-out" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--leaf)" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="tg-hub">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* the hub's glow and its orbit */}
        <circle cx={HUB.x} cy={HUB.y} r={210} fill="url(#tg-hub)" />
        <ellipse cx={HUB.x} cy={HUB.y} rx={150} ry={175} fill="none" stroke="var(--line)" strokeDasharray="2 6" />
        {[...inEdges, ...outEdges].map((e, i) => (
          <path key={`f${i}`} d={e.d} fill="none" stroke="var(--line)" strokeWidth={1} opacity={0.6} />
        ))}
        {/* bright links for the love in focus, drawn in as it changes */}
        <AnimatePresence>
          {hotIn.map((e) => (
            <motion.path key={`in-${on}-${e.ti}`} d={e.d} fill="none" stroke="url(#tg-in)" strokeWidth={2} initial={{ pathLength: still ? 1 : 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} />
          ))}
          {hotOut.map((e) => (
            <motion.path key={`out-${on}-${e.ti}-${e.mi}`} d={e.d} fill="none" stroke="url(#tg-out)" strokeWidth={2} initial={{ pathLength: still ? 1 : 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }} />
          ))}
        </AnimatePresence>
        {/* pulses travelling along the bright links */}
        {!still &&
          [...hotIn, ...hotOut].map((e, i) => (
            <circle key={`p-${on}-${i}`} r={3.2} fill={i < hotIn.length ? "var(--accent)" : "var(--leaf)"} style={{ filter: "drop-shadow(0 0 4px var(--accent))" }}>
              <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${(i % 3) * 0.5 + (i < hotIn.length ? 0 : 0.6)}s`} path={e.d} />
            </circle>
          ))}
      </svg>

      {/* the hub */}
      <div className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center" style={{ left: pct(HUB.x, W), top: pct(HUB.y, H) }}>
        {!still && <span aria-hidden className="absolute h-28 w-28 animate-ping rounded-full border border-accent/30" style={{ animationDuration: "2.6s" }} />}
        <div className="relative grid h-24 w-24 place-items-center rounded-full border border-accent/50 bg-paper text-center shadow-[0_0_60px_-10px_var(--accent)]">
          <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.2em] text-accent">
            Arcon
            <br />
            taste AI
          </span>
        </div>
      </div>

      {/* what they love */}
      {loves.map((l, i) => (
        <button
          key={l.text}
          type="button"
          onMouseEnter={() => onPick(i)}
          onClick={() => (tick(), onPick(i))}
          className={`absolute w-[23%] -translate-y-1/2 rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${i === on ? "border-accent bg-paper shadow-[0_18px_44px_-18px_var(--accent)]" : "border-line bg-paper/70 hover:border-accent/50"}`}
          style={{ right: pct(W - LOVE_X, W), top: pct(rowY(i, loves.length), H) }}
        >
          <span className={`font-mono text-[9px] uppercase tracking-[0.2em] ${i === on ? "text-accent" : "text-ink-soft"}`}>{l.kind}</span>
          <span className={`mt-0.5 block text-sm leading-snug lg:text-base ${i === on ? "text-ink" : "text-ink-soft"}`}>&ldquo;{l.text}&rdquo;</span>
        </button>
      ))}

      {/* the taste words, orbiting the hub */}
      {tags.map((t, i) => {
        const lit = link.tags.includes(i);
        return (
          <motion.span
            key={t}
            className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider lg:text-xs ${lit ? "border-accent bg-paper text-accent shadow-[0_0_24px_-6px_var(--accent)]" : "border-line bg-paper/80 text-ink-soft"}`}
            style={{ left: pct(tagPos[i].x, W), top: pct(tagPos[i].y, H) }}
            animate={{ scale: lit ? 1.08 : 0.94, opacity: lit ? 1 : 0.55 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {t}
            <AnimatePresence>
              {lit && (
                <motion.span key={on} initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="ml-1.5 inline-block overflow-hidden align-bottom text-ink-soft">
                  {weight(i)}%
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
        );
      })}

      {/* what Arcon designs */}
      {makes.map((m, i) => {
        const lit = link.makes.includes(i);
        return (
          <motion.div
            key={m.text}
            className={`absolute flex w-[23%] -translate-y-1/2 items-center gap-3 rounded-2xl border px-3 py-3 ${lit ? "border-leaf/60 bg-paper shadow-[0_18px_44px_-20px_var(--leaf)]" : "border-line bg-paper/70"}`}
            style={{ left: pct(MAKE_X, W), top: pct(rowY(i, makes.length), H) }}
            animate={{ opacity: lit ? 1 : 0.5, x: lit ? 0 : 6 }}
            transition={{ duration: 0.4, delay: lit ? 0.5 : 0 }}
          >
            <span aria-hidden className="h-9 w-9 shrink-0 rounded-lg border border-line shadow-inner" style={{ background: m.swatch }} />
            <span className="text-sm leading-snug lg:text-base">{m.text}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
