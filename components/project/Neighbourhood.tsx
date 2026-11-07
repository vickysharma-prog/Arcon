"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HudCard, Scanning, Bar } from "@/components/fx/Motion";
import { Decode } from "@/components/fx/Decode";
import { tick } from "@/components/fx/sfx";
import { CROWDS, hintLine, rankLine, saidLine, type Crowd } from "@/lib/neighbourhood/read";
import type { Neighbourhood as Read } from "@/lib/neighbourhood/fetch";

// The neighbourhood read for a business: the same kind of places around the site, ranked by Qloo for the owner's
// taste and the crowd they pick, what those favourites look like, and how strongly the area shares the taste.
export function Neighbourhood({ id }: { id: string }) {
  // a link to #neighbourhood (the tour) lands here once the section is on the page
  useEffect(() => {
    if (location.hash !== "#neighbourhood") return;
    // a little above the heading, so it isn't tucked under the top bar; pictures above it still loading push it down,
    // so it is kept in place for a few seconds, until the visitor scrolls themselves
    const to = (behavior: ScrollBehavior) => {
      const el = document.getElementById("neighbourhood");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior });
    };
    let mine = true;
    const theirs = () => (mine = false);
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    events.forEach((e) => window.addEventListener(e, theirs, { once: true, passive: true }));
    const first = setTimeout(() => to("smooth"), 600);
    const keep = setInterval(() => mine && to("auto"), 500);
    const stop = setTimeout(() => clearInterval(keep), 6000);
    return () => {
      [first, stop].forEach(clearTimeout);
      clearInterval(keep);
      events.forEach((e) => window.removeEventListener(e, theirs));
    };
  }, []);
  const [crowd, setCrowd] = useState<Crowd>("all");
  const [read, setRead] = useState<Read | null | undefined>(undefined);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const still = useReducedMotion();

  useEffect(() => {
    let live = true;
    setRead(undefined);
    fetch(`/api/projects/${id}/neighbourhood?crowd=${crowd}`)
      .then((r) => (r.ok ? r.json() : { read: null }))
      .then((b: { read: Read | null }) => live && setRead(b.read))
      .catch(() => live && setRead(null));
    return () => {
      live = false;
    };
  }, [id, crowd]);

  if (read === null) return null;
  const rank = read?.rank != null ? rankLine(read.rank, read.city) : null;
  const scored = (read?.places ?? []).flatMap((p) => (p.match === null ? [] : [p.match]));
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  return (
    <section className="mt-12" aria-labelledby="neighbourhood" aria-busy={!read}>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Read from the street</p>
      <h2 id="neighbourhood" className="mt-1 font-serif text-3xl">
        <Decode text="Your neighbourhood" />
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {read
          ? `The ${read.what} ${read.near ? "around" : "across"} ${read.where}, ranked for your taste${crowd === "all" ? "" : ` and a crowd ${CROWDS[crowd].label.toLowerCase()}`}.`
          : "Reading the places around your site…"}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Who it's for">
        <span className="mr-1 text-sm text-ink-soft">Who it&apos;s for</span>
        {(Object.keys(CROWDS) as Crowd[]).map((c) => (
          <button
            key={c}
            onClick={() => {
              tick();
              setCrowd(c);
            }}
            aria-pressed={crowd === c}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${crowd === c ? "bg-btn text-btn-ink" : "border border-line text-ink-soft hover:text-ink"}`}
          >
            {CROWDS[c].label}
          </button>
        ))}
      </div>

      {!read ? (
        <div className="grid place-items-center py-12">
          <Scanning label="Reading the neighbourhood" />
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <HudCard className="p-5">
              <h3 className="text-xs uppercase tracking-widest text-ink-soft">The area and your taste</h3>
              {rank ? (
                <>
                  <p className={`mt-2 font-serif text-2xl ${rank.strength === "strong" ? "text-leaf" : ""}`}>{rank.strength === "strong" ? `Top ${read.rank}%` : rank.strength === "average" ? "About average" : "Room to stand out"}</p>
                  <p className="mt-1 text-sm text-ink-soft">{rank.text}</p>
                  <Bar pct={101 - (read.rank ?? 100)} className="mt-3 h-1.5 bg-accent" />
                </>
              ) : avg !== null ? (
                <>
                  <p className="mt-2 font-serif text-2xl">{avg}% match</p>
                  <p className="mt-1 text-sm text-ink-soft">How closely the favourites around here match your taste, on average.</p>
                  <Bar pct={avg} className="mt-3 h-1.5 bg-accent" />
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Arcon reads the places below one by one.</p>
              )}
            </HudCard>
            <HudCard className="p-5" delay={0.08}>
              <h3 className="text-xs uppercase tracking-widest text-ink-soft">What local favourites look like</h3>
              <p className="mt-2 text-sm">
                <span className="font-serif text-2xl">
                  {read.look.sharing} of {read.look.of}
                </span>{" "}
                share your look
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {read.look.words.map((w) => (
                  <li key={w.word} className={`rounded-full px-2.5 py-0.5 text-xs ${w.yours ? "bg-accent/15 text-accent" : "border border-line text-ink-soft"}`} title={`${w.n} of ${read.look.of} places`}>
                    {w.word}
                    {w.yours && " · yours"}
                  </li>
                ))}
              </ul>
            </HudCard>
            <HudCard className="p-5" delay={0.16}>
              <h3 className="text-xs uppercase tracking-widest text-ink-soft">How it could run</h3>
              {read.hint ? (
                <>
                  <p className="mt-2 text-sm">{hintLine(read.hint)}</p>
                  {(() => {
                    const s = saidLine(read.said, read.hint);
                    return s && <p className={`mt-2 text-sm ${s.same ? "text-leaf" : "text-ink-soft"}`}>{s.same ? `✓ ${s.text} Your plan follows it.` : `${s.text} Your plan follows your answer.`}</p>;
                  })()}
                  <p className="mt-1 text-xs text-ink-soft">From the café you love.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Your plan follows how you said it runs in the interview.</p>
              )}
            </HudCard>
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {read.places.map((pl, i) => (
              <motion.li
                key={pl.id}
                initial={still ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                className="group overflow-hidden rounded-2xl border border-line bg-paper-raised transition-shadow hover:shadow-[0_18px_44px_-22px_var(--accent)]"
              >
                {pl.image && !broken.has(pl.id) && (
                  // eslint-disable-next-line @next/next/no-img-element -- Qloo's own image host, sized by CSS
                  <img src={pl.image} alt={pl.name} loading="lazy" className="aspect-[16/9] w-full object-cover transition-transform duration-700 group-hover:scale-105" onError={() => setBroken((b) => new Set(b).add(pl.id))} />
                )}
                <div className="p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium">{pl.name}</p>
                    {pl.match !== null && <span className="shrink-0 font-mono text-xs text-accent">{pl.match}% match</span>}
                  </div>
                  {pl.look.length > 0 && <p className="text-ink-soft">{pl.look.join(", ")}</p>}
                  {pl.address && <p className="mt-1 truncate text-xs text-ink-soft">{pl.address}</p>}
                </div>
              </motion.li>
            ))}
          </ul>
          {read.places.length === 0 && <p className="mt-4 text-sm text-ink-soft">Arcon knows few {read.what} around here yet.</p>}
        </>
      )}
    </section>
  );
}
