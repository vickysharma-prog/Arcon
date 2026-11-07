"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { PlanSvg } from "@/components/plan/PlanSvg";
import { Scanning } from "@/components/fx/Motion";
import { ok as okSound, tick } from "@/components/fx/sfx";
import type { Layout } from "@/lib/layout/schema";
import { estimate, marketOf, money, CATEGORY_NAMES, TIER_NAMES, type Tier, isNewBuild, projectTier } from "@/lib/budget/costs";
import { toDxf } from "@/lib/export/dxf";
import { elevation, schedule, sayLength, SIDES, type Tagged } from "@/lib/export/drawings";
import { ElevationSvg, PlanMarks } from "@/components/plan/Drawings";
import { look as lookOf } from "@/lib/three/materials";
import { exteriorOf } from "@/lib/three/exterior";
import { SHOTS, type Shot } from "@/components/three/HouseScene";
import { stampPng, TAGLINE } from "@/components/fx/watermark";
import { Mark } from "@/components/Logo";

const HouseScene = dynamic(() => import("@/components/three/HouseScene"), { ssr: false });

type Project = {
  id: string;
  title: string | null;
  space_type: string | null;
  site: { location?: string };
  interview: Record<string, unknown>;
  brief: unknown;
  taste: { tags?: { value: string }[] } | null;
  options?: Layout[] | null;
  chosen_option: number | null;
};
type View = { name: string; shot: Shot; cutaway: boolean; upTo: number | "all" };

const save = (href: string, name: string) => {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
};
const fileName = (s: string) => s.replace(/[^\w\s-]+/g, "").trim() || "Arcon";

// The last step: everything to hand to an architect or builder, or to send to family. Hand-drawn sketches of the
// design from a few angles (drawn here, in the browser, as pictures to save), the floor plans, a PDF pack with the
// sketches, plans, room list, budget and style, a DXF drawing for CAD, and a link to the walkthrough video.
export function ExportStep({ p, tier, onWalkthrough }: { p: Project; tier: Tier | null; onWalkthrough: () => void }) {
  const still = useReducedMotion();
  const layout = p.options?.[p.chosen_option ?? 0];
  const title = p.title ?? "Your design";
  // The studio behind the design goes on the pack its clients take away.
  const studio = (p as Project & { studio?: { name: string; logo_url: string | null } | null }).studio ?? null;
  // The design, not the box: each floor from above with the walls cut, the same from the other side, close-ups of
  // the two biggest rooms with their furniture, and the building from the street.
  const views = useMemo<View[]>(() => {
    if (!layout) return [];
    const two = layout.floors.length > 1;
    const v: View[] = [];
    for (const f of layout.floors) v.push({ name: two ? (f.level ? "Upstairs, from above" : "Ground floor, from above") : "From above", shot: { ...SHOTS.above, level: f.level }, cutaway: true, upTo: f.level });
    v.push({ name: "From the other side", shot: { ...SHOTS.aboveBack, level: 0 }, cutaway: true, upTo: 0 });
    const rooms = layout.floors
      .flatMap((f) => f.spaces.filter((s) => s.zone !== "circulation" && s.kind !== "bath" && s.kind !== "storage").map((s) => ({ s, level: f.level })))
      .sort((a, b) => b.s.rect.w * b.s.rect.h - a.s.rect.w * a.s.rect.h)
      .slice(0, 2);
    for (const { s, level } of rooms) v.push({ name: s.name, shot: { turn: -2.05, tilt: 0.8, level, room: s.rect }, cutaway: true, upTo: level });
    v.push({ name: "From the street", shot: SHOTS.street, cutaway: false, upTo: "all" });
    return v;
  }, [layout]);
  const [shots, setShots] = useState<string[]>([]);
  const drawing = shots.length < views.length ? shots.length : -1;
  const onShot = useCallback((png: string) => {
    okSound();
    // Every sketch carries the Arcon watermark, in the downloads, the share sheet and the PDF.
    void stampPng(png)
      .catch(() => png)
      .then((stamped) => setShots((s) => [...s, stamped]));
  }, []);

  if (!layout) return <p className="p-10 text-center text-ink-soft">Choose a plan first.</p>;
  const units = p.site.location && /\b(US|USA|TX|CA|NY|FL|WA|IL|MA)\b/.test(p.site.location) ? "imperial" : "metric";
  const brief = p.brief as { name?: string; summary?: string } | null;
  const market = marketOf(p.site.location);
  const newBuild = isNewBuild(p);
  const active: Tier = tier ?? projectTier(p);
  const cost = estimate(layout, active, market, newBuild, p.site.location);
  const rooms = layout.floors.flatMap((f) => f.spaces.filter((s) => s.zone !== "circulation").map((s) => ({ ...s, level: f.level })));
  const words = [...new Set((p.taste?.tags ?? []).map((t) => t.value.replaceAll("_", " ")))].slice(0, 6);
  const tags = schedule(layout);
  // The same exterior the 3D draws (roof and cladding from taste), so the drawings match the walkthrough.
  const ex = exteriorOf(layout, lookOf(p.brief as Parameters<typeof lookOf>[0], p.taste as Parameters<typeof lookOf>[1]), newBuild);
  const elevations = SIDES.map((s) => ({ ...s, e: elevation(layout, s.side, tags, ex) }));

  const dxf = () => {
    tick();
    save(URL.createObjectURL(new Blob([toDxf(layout, title, ex)], { type: "application/dxf" })), `${fileName(title)} plan.dxf`);
  };
  const all = () => shots.forEach((s, i) => setTimeout(() => save(s, `${fileName(title)} sketch ${i + 1}.png`), i * 300));
  const share = async () => {
    tick();
    const files = await Promise.all(shots.map(async (s, i) => new File([await (await fetch(s)).blob()], `sketch-${i + 1}.png`, { type: "image/png" })));
    const text = `${title}: designed with Arcon${brief?.name ? `, in a ${brief.name} style` : ""}.`;
    if (navigator.canShare?.({ files })) await navigator.share({ title, text, files }).catch(() => {});
    else if (navigator.share) await navigator.share({ title, text }).catch(() => {});
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Share &amp; export</p>
      <h1 className="mt-1 font-serif text-4xl">Take your design with you</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">Hand-drawn sketches to share, a drawings pack for your architect or builder (dimensioned plans, the four elevations, door and window schedules) as a PDF and a DXF for CAD, and the walkthrough as a video.</p>

      {/* what the design is, as the PDF opens with it */}
      <section className="mt-6 rounded-2xl border border-line bg-paper-raised p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">{[p.site.location, brief?.name && `${brief.name} style`, area(cost.area, units)].filter(Boolean).join(" · ")}</p>
        <h2 className="mt-1 font-serif text-3xl">{title}</h2>
        {brief?.summary && <p className="mt-2 max-w-3xl text-ink-soft">{brief.summary}</p>}
        {words.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-soft">Your taste, in words:</span>
            {words.map((w) => (
              <span key={w} className="rounded-full bg-paper px-3 py-0.5 text-sm capitalize">
                {w}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => { tick(); window.print(); }} className="glow-btn px-5 py-2.5">
          ⬇ PDF pack
        </button>
        <button type="button" onClick={dxf} className="rounded-full border border-line px-5 py-2.5 transition hover:border-accent hover:text-accent">
          ⬇ DXF for CAD
        </button>
        <button type="button" onClick={onWalkthrough} className="rounded-full border border-line px-5 py-2.5 transition hover:border-accent hover:text-accent">
          ▶ Walkthrough video
        </button>
        <button type="button" disabled={drawing !== -1} onClick={() => void share()} className="rounded-full border border-line px-5 py-2.5 transition hover:border-accent hover:text-accent disabled:opacity-40">
          ↗ Share sketches
        </button>
      </div>

      {/* the sketches, drawn one after another, each kept as a picture */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl">Sketches</h2>
          {drawing === -1 ? (
            <button type="button" onClick={all} className="text-sm text-accent hover:underline">
              Download all
            </button>
          ) : (
            <p className="font-mono text-xs text-ink-soft">
              &gt; drawing sketch {drawing + 1} of {views.length}: {views[drawing].name.toLowerCase()}
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {views.map((v, i) => (
            <figure key={v.name} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-[4/3]">
                {shots[i] ? (
                  <motion.img initial={still ? false : { opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} src={shots[i]} alt={`${title}, ${v.name.toLowerCase()}, hand-drawn sketch`} className="h-full w-full object-cover" />
                ) : i === drawing ? (
                  <HouseScene key={i} layout={layout} brief={p.brief as never} taste={p.taste as never} newBuild={newBuild} mode="shot" sketch="print" shot={v.shot} cutaway={v.cutaway} upTo={v.upTo} playing={false} onShot={onShot} />
                ) : (
                  <div className="grid h-full place-items-center">
                    <Scanning label="Waiting to draw" />
                  </div>
                )}
              </div>
              <figcaption className="flex items-center justify-between border-t border-line px-4 py-2 text-sm text-ink">
                {v.name}
                {shots[i] && (
                  <button type="button" onClick={() => save(shots[i], `${fileName(title)} ${v.name.toLowerCase()}.png`)} className="text-accent hover:underline">
                    ⬇ PNG
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Floor plans</h2>
        <div className={`mt-4 grid gap-4 ${layout.floors.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {layout.floors.map((f) => (
            <figure key={f.level} className="rounded-2xl border border-line bg-paper-raised p-4">
              <PlanSvg layout={layout} level={f.level} units={units} className="h-auto w-full">
                <PlanMarks layout={layout} level={f.level} units={units} />
              </PlanSvg>
              <figcaption className="mt-2 text-sm text-ink-soft">{f.level === 0 ? "Ground floor" : "Upstairs"}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Elevations</h2>
        <p className="mt-1 text-sm text-ink-soft">Each side of the building from outside, with its doors and windows tagged as in the schedule below.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {elevations.map(({ side, name, e }, i) => (
            <motion.figure
              key={side}
              initial={still ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-line bg-paper-raised p-4"
            >
              <ElevationSvg e={e} units={units} className="h-auto w-full" />
              <figcaption className="mt-2 text-sm text-ink-soft">{name}</figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Door and window schedule</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-paper-raised p-5">
            <h3 className="text-xs uppercase tracking-widest text-ink-soft">Doors</h3>
            <ScheduleTable rows={tags.doors} units={units} />
          </div>
          <div className="rounded-2xl border border-line bg-paper-raised p-5">
            <h3 className="text-xs uppercase tracking-widest text-ink-soft">Windows</h3>
            <ScheduleTable rows={tags.windows} units={units} />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">The details</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Floor area", area(cost.area, units)],
            ["Rooms", String(rooms.length)],
            ["Floors", String(layout.floors.length)],
            ["Budget", `${money(cost.total.low, market)} to ${money(cost.total.high, market)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-paper-raised p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">{label}</p>
              <p className="mt-1 font-serif text-2xl leading-tight">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="rounded-2xl border border-line bg-paper-raised p-5">
            <h3 className="text-xs uppercase tracking-widest text-ink-soft">Rooms and areas</h3>
            <RoomTable rooms={rooms} units={units} />
          </div>
          <div className="rounded-2xl border border-line bg-paper-raised p-5">
            <h3 className="text-xs uppercase tracking-widest text-ink-soft">Budget by trade</h3>
            <BudgetTable cost={cost} market={market} tier={active} />
          </div>
        </div>
      </section>

      {/* the PDF: printed on white whatever the theme, one section per page */}
      <div className="print-sheet" aria-hidden>
        <div className="print-watermark">
          <Mark size={420} />
        </div>
        <div className="print-footer">
          <Mark size={18} />
          <span className="font-serif text-base">{studio ? `Designed by ${studio.name} · Made with Arcon` : "Made with Arcon"}</span>
          <span>· {TAGLINE} · AI architect</span>
        </div>
        <section className="print-page">
          {studio?.logo_url && <img src={studio.logo_url} alt="" className="mb-3 h-14 w-14 object-contain" />}
          <p className="text-xs uppercase tracking-[0.3em]">{studio ? `${studio.name} · design pack` : "Arcon · design pack"}</p>
          <h1 className="mt-2 font-serif text-5xl">{title}</h1>
          <p className="mt-2">
            {[p.site.location, brief?.name && `${brief.name} style`, area(cost.area, units), new Date().toLocaleDateString()].filter(Boolean).join(" · ")}
          </p>
          {brief?.summary && <p className="mt-4 max-w-2xl">{brief.summary}</p>}
          {words.length > 0 && <p className="mt-2 text-sm">Taste words: {words.join(", ")}</p>}
          {shots[0] && <img src={shots[0]} alt="" className="mt-6 w-full" />}
        </section>
        {shots.length > 1 && (
          <section className="print-page grid grid-cols-2 gap-3">
            {shots.slice(1).map((s, i) => (
              <figure key={i}>
                <img src={s} alt="" className="w-full border" />
                <figcaption className="text-xs">{views[i + 1]?.name}</figcaption>
              </figure>
            ))}
          </section>
        )}
        {layout.floors.map((f) => (
          <section key={f.level} className="print-page">
            <h2 className="font-serif text-3xl">{f.level === 0 ? "Ground floor plan" : "Upstairs plan"}</h2>
            <PlanSvg layout={layout} level={f.level} units={units} className="mt-4 h-auto w-full">
              <PlanMarks layout={layout} level={f.level} units={units} />
            </PlanSvg>
          </section>
        ))}
        {[elevations.slice(0, 2), elevations.slice(2)].map((pair, i) => (
          <section key={`el-${i}`} className="print-page">
            <h2 className="font-serif text-3xl">Elevations</h2>
            {pair.map(({ side, name, e }) => (
              <figure key={side} className="mt-4">
                <ElevationSvg e={e} units={units} className="h-auto w-full" />
                <figcaption className="text-xs">{name}</figcaption>
              </figure>
            ))}
          </section>
        ))}
        <section className="print-page">
          <h2 className="font-serif text-3xl">Door schedule</h2>
          <ScheduleTable rows={tags.doors} units={units} />
          <h2 className="mt-10 font-serif text-3xl">Window schedule</h2>
          <ScheduleTable rows={tags.windows} units={units} />
        </section>
        <section className="print-page">
          <h2 className="font-serif text-3xl">Rooms</h2>
          <RoomTable rooms={rooms} units={units} />
          <h2 className="mt-10 font-serif text-3xl">Budget</h2>
          <BudgetTable cost={cost} market={market} tier={active} />
        </section>
      </div>
    </main>
  );
}

const FT = 3.28084;
/** An area in the plan's units: "306 sq ft" or "28.4 m²". */
const area = (m2: number, units: "imperial" | "metric") => (units === "imperial" ? `${Math.round(m2 * FT * FT).toLocaleString()} sq ft` : `${m2.toFixed(1)} m²`);
const length = (m: number, units: "imperial" | "metric") => (units === "imperial" ? `${(m * FT).toFixed(1)} ft` : `${m.toFixed(1)} m`);

type Room = { id: string; name: string; level: number; rect: { w: number; h: number } };

// Each door or window with its tag, floor, the rooms it joins, size and sill; the same on screen and in the PDF.
function ScheduleTable({ rows, units }: { rows: Tagged[]; units: "imperial" | "metric" }) {
  if (!rows.length) return <p className="mt-3 text-sm text-ink-soft">None.</p>;
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-ink-soft">
          <th className="py-1.5 font-normal">Tag</th>
          <th className="font-normal">Floor</th>
          <th className="font-normal">Between</th>
          <th className="font-normal">Width × height</th>
          <th className="text-right font-normal">Sill</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tag} className="border-b border-line">
            <td className="py-1.5 font-mono">{r.tag}</td>
            <td>{r.level ? "Upstairs" : "Ground"}</td>
            <td>{r.between.join(" / ")}</td>
            <td>
              {sayLength(r.width, units)} × {sayLength(r.height, units)}
            </td>
            <td className="text-right">{r.sill ? sayLength(r.sill, units) : "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Every room with its floor, size and area, and the total; the same table on screen and in the PDF.
function RoomTable({ rooms, units }: { rooms: Room[]; units: "imperial" | "metric" }) {
  const total = rooms.reduce((t, r) => t + r.rect.w * r.rect.h, 0);
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-ink-soft">
          <th className="py-1.5 font-normal">Room</th>
          <th className="font-normal">Floor</th>
          <th className="font-normal">Size</th>
          <th className="text-right font-normal">Area</th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((r, i) => (
          <tr key={`${r.id}-${i}`} className="border-b border-line">
            <td className="py-1.5">{r.name}</td>
            <td>{r.level ? "Upstairs" : "Ground"}</td>
            <td>
              {length(r.rect.w, units)} × {length(r.rect.h, units)}
            </td>
            <td className="text-right tabular-nums">{area(r.rect.w * r.rect.h, units)}</td>
          </tr>
        ))}
        <tr className="font-medium">
          <td className="py-1.5" colSpan={3}>
            Rooms in total
          </td>
          <td className="text-right tabular-nums">{area(total, units)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function BudgetTable({ cost, market, tier }: { cost: ReturnType<typeof estimate>; market: ReturnType<typeof marketOf>; tier: Tier }) {
  return (
    <>
      <p className="mt-3 text-sm">
        {TIER_NAMES[tier]} finish:{" "}
        <strong>
          {money(cost.total.low, market)} to {money(cost.total.high, market)}
        </strong>
        , including fees. An early estimate, not a quote.
      </p>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {Object.entries(cost.byCategory)
            .filter(([, v]) => (v ?? 0) > 0)
            .map(([k, v]) => (
              <tr key={k} className="border-b border-line">
                <td className="py-1.5">{CATEGORY_NAMES[k as keyof typeof CATEGORY_NAMES]}</td>
                <td className="text-right tabular-nums">{money(v ?? 0, market)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}
