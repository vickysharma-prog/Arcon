"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HudCard, Scanning } from "@/components/fx/Motion";
import { Decode } from "@/components/fx/Decode";
import { tick } from "@/components/fx/sfx";
import type { ArtAndSound as Data } from "@/lib/art/fetch";

/** The art and sound for a design, fetched once per project and shared by the style page and the walkthrough. */
export function useArtAndSound(id: string | undefined) {
  const [data, setData] = useState<Data | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let live = true;
    fetch(`/api/projects/${id}/art`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => live && setData(d))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [id]);
  return data;
}

// Art for the walls from galleries near the site, and a playlist for the home, both read by Qloo from what they love.
export function ArtAndSound({ id }: { id: string }) {
  const data = useArtAndSound(id);
  const still = useReducedMotion();
  if (data === null || (data && !data.art.length && !data.music.length)) return null;
  return (
    <section className="mt-12" aria-labelledby="art-sound" aria-busy={!data}>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Read from your taste</p>
      <h2 id="art-sound" className="mt-1 font-serif text-3xl">
        <Decode text="Art and sound" />
      </h2>
      {!data ? (
        <div className="grid place-items-center py-10">
          <Scanning label="Finding art and music for you" />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {data.art.length > 0 && (
            <HudCard className="p-5">
              <h3 className="text-xs uppercase tracking-widest text-ink-soft">For your art wall</h3>
              <p className="mt-1 text-sm text-ink-soft">Galleries and museums near {data.near}, ranked for your taste.</p>
              <ul className="mt-4 space-y-3">
                {data.art.map((a, i) => (
                  <motion.li key={a.name} initial={still ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{a.name}</span>
                      {a.match !== null && <span className="shrink-0 font-mono text-xs text-accent">{a.match}% match</span>}
                    </div>
                    <p className="text-xs text-ink-soft">
                      {a.kind === "gallery" ? "Gallery: work you can buy" : "Museum: prints and ideas"}
                      {a.address && ` · ${a.address}`}
                    </p>
                  </motion.li>
                ))}
              </ul>
            </HudCard>
          )}
          {data.music.length > 0 && (
            <HudCard className="p-5" delay={0.08}>
              <h3 className="text-xs uppercase tracking-widest text-ink-soft">A playlist for this home</h3>
              <p className="mt-1 text-sm text-ink-soft">Matched to {data.because.slice(0, 3).join(", ")}.</p>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {data.music.map((m, i) => (
                  <motion.li key={m.name} initial={still ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}>
                    <a
                      href={m.listen}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => tick()}
                      className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm transition hover:border-accent hover:text-accent"
                    >
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Qloo's own image host, sized by CSS
                        <img src={m.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-line">♪</span>
                      )}
                      <span className="truncate">{m.name}</span>
                    </a>
                  </motion.li>
                ))}
              </ul>
            </HudCard>
          )}
        </div>
      )}
    </section>
  );
}
