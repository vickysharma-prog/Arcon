"use client";

import { sayArea } from "@/lib/export/drawings";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Bar, CountUp, HudCard, Reveal, Scanning } from "@/components/fx/Motion";
import { tick } from "@/components/fx/sfx";
import type { Layout } from "@/lib/layout/schema";
import { CATEGORY_NAMES, estimate, knownMarket, marketOf, MARKETS, money, TIER_NAMES, TIERS, type Category, type Tier, isNewBuild, projectTier } from "@/lib/budget/costs";
import type { PriceSignal } from "@/lib/budget/tier";
import type { Brief } from "@/lib/design/brief";
import type { Profile } from "@/lib/qloo/taste";
import { GreenAndTime } from "./GreenAndTime";
import type { Ticked } from "@/lib/green/improve";

type Props = {
  /** The tier the client picked, shared with the shopping list; null means their taste's tier. */
  tier: Tier | null;
  onTier: (t: Tier) => void;
  id: string;
  layout: Layout;
  location: string | null | undefined;
  interview: Record<string, unknown> | null;
  brief: Brief | null;
  profile: Profile | null;
  lot: { width: number; depth: number } | null;
  ticked: Ticked;
  onTicked: (t: Ticked) => void;
  units: "imperial" | "metric";
};

// What the chosen plan will cost: a range for the whole job, by trade and by room, at a quality tier read from the
// price of what they love. The tier can be changed; the estimate follows at once.
export function BudgetStep({ tier, onTier, id, layout, location, interview, brief, profile, lot, ticked, onTicked, units }: Props) {
  const [taste, setTaste] = useState<{ tier: Tier; signals: PriceSignal[] } | null>(null);
  const setTier = onTier;
  const [marketId, setMarketId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/projects/${id}/budget`)
      .then((r) => (r.ok ? r.json() : { tier: "mid", signals: [] }))
      .then((b) => live && setTaste(b))
      .catch(() => live && setTaste({ tier: "mid", signals: [] }));
    return () => {
      live = false;
    };
  }, [id]);

  const market = MARKETS.find((m) => m.id === marketId) ?? marketOf(location);
  const newBuild = isNewBuild({ interview });
  const said = Object.values((interview?.budget ?? {}) as Record<string, unknown>).filter((v) => typeof v === "string" || typeof v === "number");
  const start = projectTier({ interview }, taste?.tier ?? null);
  const active = tier ?? start;
  // The region (London, Mumbai, the US Northeast) counts only when costing the site's own market.
  const e = useMemo(() => estimate(layout, active, market, newBuild, marketId ? null : location), [layout, active, market, newBuild, marketId, location]);
  const cats = (Object.entries(e.byCategory) as [Category, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = Math.max(...cats.map(([, v]) => v));
  const fmt = (v: number) => money(v, market);
  const still = useReducedMotion();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-2">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">Budget · {e.region ? `${e.region} · ` : ""}{market.name} · {market.currency}</p>
      </Reveal>
      {/* The total waits for the tier read from their taste, so it never shows one figure and jumps to another. */}
      {taste === null && tier === null ? (
        <div className="mt-4 max-w-md">
          <Scanning label="Costing your design" />
        </div>
      ) : (
        <h1 className="mt-3 font-serif text-5xl sm:text-6xl" aria-label={`${fmt(e.total.low)} to ${fmt(e.total.high)}`}>
          <CountUp value={e.total.low} format={fmt} sound /> <span className="text-ink-soft">to</span> <CountUp value={e.total.high} format={fmt} />
        </h1>
      )}
      <p className="mt-3 max-w-2xl text-ink-soft">
        {newBuild ? "Building and fitting out" : "Fitting out"} {sayArea(e.area, units)} at {TIER_NAMES[active].toLowerCase()} quality, in{" "}
        {market.currency}. An early estimate from typical {market.name} costs, not a quote: builders&apos; prices vary by about this range.
        {!location && !marketId ? " We don't know where it is yet: pick the country below." : !knownMarket(location) ? " We don't have costs for this country yet, so these are US costs." : ""}
      </p>
      <label className="mt-3 inline-flex items-center gap-2 text-sm">
        <span className="text-ink-soft">Costs for</span>
        <select value={market.id} onChange={(ev) => setMarketId(ev.target.value)} className="rounded-full border border-line bg-paper-raised px-3 py-1">
          {MARKETS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.currency})
            </option>
          ))}
        </select>
      </label>

      <HudCard className="mt-8 p-5">
      <section aria-labelledby="tier">
        <h2 id="tier" className="font-serif text-2xl">Quality</h2>
        {taste === null ? (
          <div className="mt-2">
            <Scanning label="Reading the price of what you love" />
          </div>
        ) : taste.signals.length ? (
          <p className="mt-2 text-sm">
            Your taste points to <strong>{TIER_NAMES[taste.tier].toLowerCase()}</strong>: you love{" "}
            {taste.signals.map((s, i) => (
              <span key={s.name}>
                {i > 0 && (i === taste.signals.length - 1 ? " and " : ", ")}
                {s.name} ({s.says})
              </span>
            ))}
            .
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Nothing you love tells us a price level, so we started at mid-range.</p>
        )}
        {/* the estimate starts at the quality they told us, when they told us one */}
        {said.length > 0 && start !== taste?.tier && (
          <p className="mt-1 text-sm text-ink-soft">
            You told us <strong>{TIER_NAMES[start].toLowerCase()}</strong>, so the estimate starts there. Pick another quality any time.
          </p>
        )}
        <div role="radiogroup" aria-label="Quality tier" className="mt-4 flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <motion.button
              key={t}
              role="radio"
              aria-checked={active === t}
              onClick={() => {
                tick();
                setTier(t);
              }}
              whileTap={still ? undefined : { scale: 0.94 }}
              className={`relative rounded-full border px-4 py-1.5 text-sm transition-colors ${active === t ? "border-btn text-btn-ink" : "border-line hover:border-accent"}`}
            >
              {/* The highlight slides from tier to tier. */}
              {active === t && <motion.span layoutId="tier-pill" className="absolute inset-0 -z-0 rounded-full bg-btn" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">
                {TIER_NAMES[t]}
                {taste?.tier === t && <span className="opacity-70"> · your taste</span>}
              </span>
            </motion.button>
          ))}
        </div>
      </section>
      </HudCard>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <HudCard className="p-5" delay={0.05}>
        <section aria-labelledby="by-trade">
          <h2 id="by-trade" className="font-serif text-2xl">By trade</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {cats.map(([c, v], i) => (
              <li key={c}>
                <div className="flex justify-between gap-4">
                  <span>{CATEGORY_NAMES[c]}</span>
                  <CountUp value={v} format={fmt} />
                </div>
                <div aria-hidden className="mt-1 h-1.5 rounded-full bg-line">
                  <Bar pct={(v / top) * 100} delay={0.1 + i * 0.07} className="h-1.5 bg-gradient-to-r from-btn to-accent" />
                </div>
              </li>
            ))}
          </ul>
        </section>
        </HudCard>
        <HudCard className="p-5" delay={0.12}>
        <section aria-labelledby="by-room">
          <h2 id="by-room" className="font-serif text-2xl">By room</h2>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Cost of each room</caption>
            <tbody>
              {[...e.rooms].sort((a, b) => b.total - a.total).map((r, i) => (
                <motion.tr
                  key={`${r.id}-${i}`}
                  className="border-t border-line transition-colors first:border-0 hover:bg-accent/5"
                  initial={still ? false : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.04 }}
                >
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-ink-soft">{sayArea(r.area, units)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.total)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-soft">Room figures are before design fees and contingency{newBuild ? " and the building itself" : ""}.</p>
        </section>
        </HudCard>
      </div>

      <GreenAndTime
        id={id}
        layout={layout}
        brief={brief}
        taste={profile}
        lot={lot}
        tier={active}
        newBuild={newBuild}
        ticked={ticked}
        onTicked={onTicked}
        units={units}
        said={Object.values((interview?.timeline ?? {}) as Record<string, unknown>).filter((v): v is string | number => typeof v === "string" || typeof v === "number").map(String)}
      />
    </main>
  );
}
