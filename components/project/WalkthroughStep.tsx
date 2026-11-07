"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Decode } from "@/components/fx/Decode";
import type { Layout } from "@/lib/layout/schema";
import type { Mode, Pose } from "@/components/three/HouseScene";
import { PlanSvg } from "@/components/plan/PlanSvg";
import { look as lookOf } from "@/lib/three/materials";
import { exteriorOf, sayExterior } from "@/lib/three/exterior";
import { moodsFor, type Mood } from "@/lib/three/mood";
import { useArtAndSound } from "./ArtAndSound";
import type { Item } from "@/lib/three/furniture";
import { PIECES } from "@/lib/shop/list";
import type { Shopping } from "@/lib/shop/fetch";
import { marketOf, money } from "@/lib/budget/costs";
import { AnimatePresence, motion } from "motion/react";
import { Scanning } from "@/components/fx/Motion";
import { tick } from "@/components/fx/sfx";
import { stamp } from "@/components/fx/watermark";

type SceneProps = ComponentProps<typeof import("@/components/three/HouseScene").default>;

const WHOLE: Record<string, string> = { house: "house", apartment: "apartment", studio: "studio", cafe: "café", office: "office", shop: "shop", hotel: "floor" };

const STYLE_NAME = { midcentury: "Mid-century", industrial: "Industrial", scandi: "Scandinavian", boho: "Boho", classic: "Classic", modern: "Modern" } as const;

// three.js needs the browser, so the scene loads on the client only.
const HouseScene = dynamic(() => import("@/components/three/HouseScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <Scanning label="Building your 3D model" />
    </div>
  ),
});

export function WalkthroughStep({
  layout, brief, taste, title, option = 0, planName, changePlan, next, extraPlants, projectId, location, tier, spaceType, preview = false, onDiscuss, newBuild = false,
}: {
  layout: Layout; spaceType?: string | null; extraPlants?: Record<string, number>; projectId?: string; location?: string | null; tier?: string | null; brief?: SceneProps["brief"]; taste?: SceneProps["taste"]; title?: string | null;
  /** Which of the three plan options this is, and a way back to pick another. */
  option?: number; planName?: string; changePlan?: () => void;
  next?: { label: string; go: () => void };
  /** Not unlocked yet: the 3D can only be looked at from outside. */
  preview?: boolean;
  /** Open the project thread about the room being looked at. */
  onDiscuss?: (room: string) => void;
  /** A new build: the roof shape comes from taste too. */
  newBuild?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(preview ? "orbit" : "walk");
  // "Whole café", "Whole office": the button that steps back out names what was designed.
  const whole = `Whole ${WHOLE[spaceType ?? ""] ?? "space"}`;
  const [playing, setPlaying] = useState(true);
  const [room, setRoom] = useState("Outside");
  // Click a piece to see where to buy it: the shopping list is fetched on the first click and kept.
  const [picked, setPicked] = useState<Item | null>(null);
  const [shop, setShop] = useState<Shopping | null>(null);
  const pick = (it: Item) => {
    tick();
    setPicked(it);
    if (!shop && projectId)
      fetch(`/api/projects/${projectId}/shopping${tier ? `?tier=${tier}` : ""}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b && setShop(b))
        .catch(() => {});
  };
  const [progress, setProgress] = useState(0);
  // the walk's chapters: each room it stops in, to jump straight to
  const [marks, setMarks] = useState<{ name: string; t: number }[]>([]);
  const [seek, setSeek] = useState<{ t: number; key: number }>();
  const [restart, setRestart] = useState(0);
  // Look around opens on the whole house with its roof on; "Show inside" then cuts it open at the ground floor.
  const [cutaway, setCutaway] = useState(false);
  const [upTo, setUpTo] = useState<number | "all">("all");
  const [finished, setFinished] = useState(false);
  const [guide, setGuide] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [full, setFull] = useState(false);
  const [level, setLevel] = useState(0);
  const [pose, setPose] = useState<Pose | null>(null);
  const [go, setGo] = useState<{ x: number; z: number; key: number }>();
  const box = useRef<HTMLDivElement>(null);
  const style = useMemo(() => lookOf(brief, taste), [brief, taste]);
  const ex = useMemo(() => exteriorOf(layout, style, newBuild), [layout, style, newBuild]);
  // a café opens at night, when its lighting is what people remember; a home opens by day
  const [night, setNight] = useState(() => layout.spaceType === "cafe");
  // The mood and light of the room you're in, from the ambience of the places you love (Q7).
  const moods = useMemo(() => moodsFor(layout, taste?.tags), [layout, taste]);
  const here = layout.floors.flatMap((f) => f.spaces).find((s) => s.name === room);
  const mood = here ? moods[here.id] : undefined;
  // A playlist for the walk, matched to what they love (Q10).
  const sound = useArtAndSound(projectId);

  // Download the walk as a video: the walk starts again from the street and the browser records the 3D canvas
  // until it ends, then saves the file. No server involved.
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const record = () => {
    tick();
    setMode("walk");
    setFinished(false);
    setGuide(false);
    setPlaying(true);
    setRestart((r) => r + 1);
    setTimeout(() => {
      const scene = box.current?.querySelector("canvas");
      if (!scene || typeof MediaRecorder === "undefined") return;
      // The video carries the "Made with Arcon" footer: each frame of the 3D view is copied onto a canvas with it.
      const canvas = document.createElement("canvas");
      canvas.width = scene.width;
      canvas.height = scene.height;
      const ctx = canvas.getContext("2d")!;
      let frame = 0;
      const paint = () => {
        ctx.drawImage(scene, 0, 0, canvas.width, canvas.height);
        stamp(ctx, canvas.width, canvas.height);
        frame = requestAnimationFrame(paint);
      };
      paint();
      const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        cancelAnimationFrame(frame);
        setRecording(false);
        if (!chunks.length || recorder.current !== rec) return;
        const blob = new Blob(chunks, { type: rec.mimeType });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(title ?? "Arcon").replace(/[^\w\s-]+/g, "").trim() || "Arcon"} walkthrough.${rec.mimeType.includes("mp4") ? "mp4" : "webm"}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      };
      recorder.current = rec;
      rec.start(500);
      setRecording(true);
    }, 400);
  };
  const stopRecording = (save: boolean) => {
    const rec = recorder.current;
    if (!rec || rec.state === "inactive") return;
    if (!save) recorder.current = null;
    rec.stop();
  };
  useEffect(() => () => stopRecording(false), []);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())?.catch(() => {});
  const ended = progress >= 1;
  const floors = layout.floors.length;

  // the tour opens the 3D itself (#walk), not the heading above it
  useEffect(() => {
    const h = window.location.hash;
    if (h === "#look" || h === "#inside") setMode("orbit");
    // #inside opens the ground floor cut open, rooms named
    if (h === "#inside") {
      setCutaway(true);
      setUpTo(0);
    }
    // #reveal shows the whole building first (a café's sign and lit windows), then opens it up
    if (h === "#reveal") setMode("orbit");
    if (h !== "#walk" && h !== "#look" && h !== "#inside" && h !== "#reveal") return;
    const t = setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 900);
    const open = h === "#reveal" ? setTimeout(() => (setCutaway(true), setUpTo(0)), 6500) : undefined;
    return () => {
      clearTimeout(t);
      clearTimeout(open);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-ink-soft">
            {title} · {planName ?? `plan option ${option + 1}`}
            {changePlan && (
              <button onClick={changePlan} className="ml-2 normal-case tracking-normal text-accent underline-offset-2 hover:underline">
                Change plan
              </button>
            )}
          </p>
          <h1 className="font-serif text-3xl">
            <Decode text={mode === "walk" ? "Walk through your space" : mode === "explore" ? "Explore inside" : "Look around it"} />
          </h1>
          <p className="text-sm text-ink-soft">
            Furnished in a <span className="font-medium text-ink">{STYLE_NAME[style.style]}</span> style
            {style.because.length > 0 && <> because you love {style.because.join(", ")}</>}
            {style.matched.length > 0 && <>{style.because.length ? ", and" : ", from"} brands that match your taste like {style.matched.join(" and ")}</>}.
          </p>
          {!!sound?.music.length && (
            <p className="text-sm text-ink-soft">
              ♪ A playlist for this walk:{" "}
              {sound.music.slice(0, 4).map((m, i) => (
                <span key={m.name}>
                  {i > 0 && ", "}
                  <a href={m.listen} target="_blank" rel="noreferrer" onClick={() => tick()} className="text-accent underline-offset-2 hover:underline">
                    {m.name}
                  </a>
                </span>
              ))}
            </p>
          )}
          {ex.because.length > 0 && (
            <p className="text-sm text-ink-soft">
              Outside: <span className="font-medium text-ink">{sayExterior(ex).toLowerCase()}</span>, from {ex.because.join(", ")}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            tick();
            setNight((n) => !n);
          }}
          aria-pressed={night}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${night ? "border-accent bg-[#0d1424] text-[#ffd08a]" : "border-line text-ink-soft hover:text-ink"}`}
        >
          <motion.span key={String(night)} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} className="mr-1.5 inline-block">
            {night ? "☾" : "☀"}
          </motion.span>
          {night ? "Night" : "Day"}
        </button>
        <div role="radiogroup" aria-label="View" className="flex gap-1 rounded-full border border-line p-1">
          {(["walk", "explore", "orbit"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              disabled={preview && m !== "orbit"}
              title={preview && m !== "orbit" ? "Unlock the project to walk inside" : undefined}
              onClick={() => {
                setMode(m);
                if (m === "orbit" && !finished) setGuide(true);
              }} className={`rounded-full px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${mode === m ? "bg-btn text-btn-ink" : "text-ink-soft hover:text-ink"}`}>
              {m === "walk" ? "Walk through" : m === "explore" ? "Explore inside" : "Look around"}
              {preview && m !== "orbit" && " 🔒"}
            </button>
          ))}
        </div>
        {preview ? null : recording ? (
          <button onClick={() => stopRecording(false)} className="flex items-center gap-2 rounded-full border border-red-400/60 px-4 py-2 text-sm text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording the walk · {Math.round(progress * 100)}% · Cancel
          </button>
        ) : (
          <button onClick={record} className="rounded-full border border-line px-4 py-2 text-sm transition hover:border-accent hover:text-accent">
            ⬇ Download video
          </button>
        )}
        {next && (
          <button onClick={next.go} className="rounded-full bg-btn px-6 py-2.5 text-btn-ink transition hover:opacity-90">
            {next.label}
          </button>
        )}
        </div>
      </div>

      {/* Fills the screen below the header and this row; the Next button lives in the row above. */}
      <div ref={box} className={`relative mt-3 overflow-hidden border-line bg-paper-raised ${full ? "h-screen" : "h-[calc(100svh-218px-var(--judge-pad,0px))] min-h-[340px] rounded-2xl border"}`}>
        <HouseScene
          layout={layout}
          name={title}
          extraPlants={extraPlants}
          onPick={projectId ? pick : undefined}
          brief={brief}
          taste={taste}
          newBuild={newBuild}
          night={night}
          fitKey={fitKey}
          mode={mode}
          playing={playing}
          restartKey={restart}
          onMarks={setMarks}
          seek={seek}
          onRoom={setRoom}
          onProgress={(p) => setProgress((old) => (Math.abs(old - p) > 0.004 || p === 1 ? p : old))}
          cutaway={cutaway}
          upTo={upTo}
          level={level}
          go={go}
          onPose={setPose}
          onEnd={() => {
            // A recording ends with the walk, and the file downloads.
            if (recorder.current?.state === "recording") {
              stopRecording(true);
              setPlaying(false);
              setFinished(true);
              return;
            }
            // When the walk ends, hand over the controls: look around from any angle.
            setPlaying(false);
            setFinished(true);
            setMode("orbit");
            setGuide(true);
          }}
        />
        <AnimatePresence>
          {picked && (
            <PieceCard
              key={`${picked.room}-${picked.name}-${picked.x}`}
              it={picked}
              room={layout.floors.flatMap((f) => f.spaces).find((s) => s.id === picked.room)?.name ?? ""}
              shop={shop}
              location={location}
              onClose={() => setPicked(null)}
            />
          )}
        </AnimatePresence>
        {mode === "walk" && (
          <>
            <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-paper/85 px-4 py-1.5 font-mono text-sm backdrop-blur">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
              {room}
            </div>
            {onDiscuss && room !== "Outside" && (
              <button
                onClick={() => {
                  setPlaying(false);
                  onDiscuss(room);
                }}
                className="absolute left-4 top-14 rounded-full bg-btn px-4 py-1.5 text-sm text-btn-ink shadow"
              >
                💬 Discuss this room
              </button>
            )}
            <MoodPill room={room} mood={mood} className={`max-sm:hidden ${marks.length > 1 ? "bottom-24 left-4" : "bottom-16 left-4"}`} />
            <div className="absolute right-4 top-4 flex items-center gap-2">
              <p className="pointer-events-none hidden rounded-full bg-paper/85 px-4 py-1.5 text-sm text-ink-soft backdrop-blur sm:block">Hold and drag to look around</p>
              <FullButton full={full} onClick={toggleFull} />
            </div>
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3">
              <button
                onClick={() => {
                  if (ended) {
                    setRestart((r) => r + 1);
                    setProgress(0);
                  }
                  setPlaying((v) => (ended ? true : !v));
                }}
                className="rounded-full bg-btn px-5 py-2 text-sm text-btn-ink"
              >
                {ended ? "Walk again" : playing ? "Pause" : "Play"}
              </button>
              <div className="relative flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-paper/70">
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
                </div>
                {/* a tick on the bar for each room */}
                {marks.map((m) => (
                  <span key={m.name} aria-hidden className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-paper" style={{ left: `${m.t * 100}%` }} />
                ))}
              </div>
            </div>
            {/* the rooms, to jump the walk straight to one */}
            {marks.length > 1 && (
              <div className="absolute inset-x-4 bottom-14 flex gap-1.5 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:justify-center">
                {marks.map((m) => {
                  const here = room === m.name;
                  return (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => {
                        tick();
                        setSeek({ t: m.t, key: Date.now() });
                        setProgress(m.t);
                        setFinished(false);
                        setPlaying(true);
                      }}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs shadow-sm backdrop-blur transition ${here ? "bg-btn text-btn-ink" : "bg-paper/85 text-ink-soft hover:text-ink"}`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        {mode === "explore" && (
          <>
            <MoodPill room={room} mood={mood} className="bottom-4 left-4" />
            <div className="absolute left-4 right-4 top-4 z-30 flex flex-wrap items-center gap-2">
              <div className="pointer-events-none rounded-full bg-paper/85 px-4 py-1.5 font-mono text-sm backdrop-blur">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-leaf" />
                {room}
              </div>
              {onDiscuss && room !== "Outside" && (
                <button onClick={() => onDiscuss(room)} className="rounded-full bg-btn px-4 py-1.5 text-sm text-btn-ink shadow">
                  💬 Discuss this room
                </button>
              )}
              {floors > 1 && (
                <div role="radiogroup" aria-label="Floor" className="flex gap-1 rounded-full bg-paper/85 p-1 backdrop-blur">
                  {layout.floors.map((f) => (
                    <button key={f.level} role="radio" aria-checked={level === f.level} onClick={() => setLevel(f.level)} className={`rounded-full px-3 py-1 text-sm ${level === f.level ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
                      {f.level === 0 ? "Ground" : "Upstairs"}
                    </button>
                  ))}
                </div>
              )}
              <p className="pointer-events-none ml-auto hidden rounded-full bg-paper/85 px-4 py-1.5 text-sm text-ink-soft backdrop-blur md:block">
                W A S D or arrows to move · click the floor to walk there · drag to look
              </p>
              <FullButton full={full} onClick={toggleFull} />
            </div>
            {/* Mini-map: where you are and which way you face; click it to jump there. */}
            <div className="absolute bottom-4 right-4 z-30 w-56 rounded-xl border border-line bg-paper/90 p-2 shadow-lg backdrop-blur">
              <PlanSvg layout={layout} level={level} className="h-auto w-full cursor-pointer" onPick={(x, z) => setGo({ x, z, key: Date.now() })}>
                {pose && pose.level === level && (
                  <g transform={`translate(${pose.x} ${pose.z}) rotate(${(-pose.yaw * 180) / Math.PI})`}>
                    <path d="M0 0 L-0.9 1.6 A1.8 1.8 0 0 0 0.9 1.6 Z" className="fill-accent" opacity={0.25} />
                    <circle r={0.3} className="fill-accent stroke-paper" strokeWidth={0.08} />
                  </g>
                )}
              </PlanSvg>
              <p className="mt-1 text-center text-[11px] text-ink-soft">Click the map to jump</p>
            </div>
          </>
        )}
        {mode === "orbit" && (
          <>
            {guide && <MouseGuide finished={finished} whole={whole} onClose={() => setGuide(false)} />}
            <div className="absolute left-4 right-4 top-4 z-30 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (!cutaway && upTo === "all") setUpTo(0);
                  setCutaway((c) => !c);
                }}
                aria-pressed={cutaway} className={`rounded-full px-4 py-1.5 text-sm ${cutaway ? "bg-btn text-btn-ink" : "bg-paper/85 text-ink backdrop-blur"}`}>
                {cutaway ? "Showing inside" : "Show inside"}
              </button>
              {floors > 1 && (
                <div role="radiogroup" aria-label="Floors" className="flex gap-1 rounded-full bg-paper/85 p-1 backdrop-blur">
                  {[...layout.floors.map((f) => f.level), "all" as const].map((l) => (
                    <button key={String(l)} role="radio" aria-checked={upTo === l} onClick={() => {
                      setUpTo(l);
                      // picking one floor opens it up; All floors puts the roof back
                      setCutaway(l !== "all");
                    }} className={`rounded-full px-3 py-1 text-sm ${upTo === l ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
                      {l === "all" ? "All floors" : l === 0 ? "Ground" : "Upstairs"}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setFitKey((k) => k + 1)} className="rounded-full bg-paper/85 px-4 py-1.5 text-sm text-ink backdrop-blur hover:bg-paper">
                {whole}
              </button>
              <button onClick={() => setGuide(true)} className="ml-auto rounded-full bg-paper/85 px-4 py-1.5 text-sm text-ink-soft backdrop-blur hover:text-ink">
                How to explore
              </button>
              <FullButton full={full} onClick={toggleFull} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// How to move around the 3D model with a mouse, trackpad or touch screen.
function MouseGuide({ finished, whole, onClose }: { finished: boolean; whole: string; onClose: () => void }) {
  // Escape or a click outside the card closes it too.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const rows = [
    { icon: "M8 4h8a4 4 0 0 1 4 4v8a8 8 0 0 1-16 0V8a4 4 0 0 1 4-4zM12 4v6", what: "Turn around", how: "Drag with the left mouse button, or one finger" },
    { icon: "M12 3v18M3 12h18M7 7l-4 5 4 5M17 7l4 5-4 5", what: "Move sideways", how: "Drag with the right button, or two fingers" },
    { icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6M11 8v6", what: "Zoom in and out", how: "Scroll the wheel, or pinch" },
    { icon: "M3 9l9-6 9 6v11H3zM9 20v-6h6v6", what: "See inside", how: "Show inside cuts the walls so every room shows; pick a floor" },
    { icon: "M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", what: "Visit a room", how: `Click a room's name to fly in; ${whole} steps back out` },
    { icon: "M13 4a1.5 1.5 0 1 0 0 .01M10 21l2-6 3 3v3M9 12l3-4 3 3 3 1M12 8l-2 5", what: "Walk inside", how: "Explore inside: W A S D or arrows, or click the floor" },
  ];
  return (
    <div onClick={onClose} className="absolute inset-0 z-40 flex items-center justify-center bg-ink/30 p-3 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-label="How to explore"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl border border-line bg-paper-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink-soft">{finished ? "Walk finished" : "Look around"}</p>
            <h2 className="mt-1 font-serif text-2xl">Explore it your way</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-paper hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {/* Scrolls inside the card when the 3D box is short, so nothing gets cut off. */}
        <ul className="mt-3 grid min-h-0 gap-x-5 gap-y-3 overflow-y-auto px-5 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.what} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper text-accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={r.icon} />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-medium">{r.what}</span>
                <span className="block text-sm text-ink-soft">{r.how}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-4 pt-3">
          <button onClick={onClose} className="w-full rounded-full bg-btn py-2.5 text-btn-ink">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function FullButton({ full, onClick }: { full: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"} className="grid h-9 w-9 place-items-center rounded-full bg-paper/85 text-ink backdrop-blur hover:bg-paper">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={full ? "M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" : "M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"} />
      </svg>
    </button>
  );
}

// What a clicked piece is and where to buy it: the brand in their taste that makes it, why, a rough price, and a
// cheaper and a dearer alternative, from the shopping list.
function PieceCard({ it, room, shop, location, onClose }: { it: Item; room: string; shop: Shopping | null; location?: string | null; onClose: () => void }) {
  const line = shop?.lines.find((l) => l.piece === it.name);
  const m = marketOf(location);
  const why = (b: NonNullable<typeof line>["brand"]) => (!b ? "" : b.loved ? "you love it" : b.via.length ? `matched to ${b.via.slice(0, 2).join(" and ")}` : "matched to your taste");
  return (
    <motion.div
      role="dialog"
      aria-label={PIECES[it.name]?.label}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="absolute bottom-20 left-4 z-10 w-[min(20rem,calc(100%-2rem))] rounded-2xl border border-accent/40 bg-paper/95 p-4 text-sm shadow-[0_18px_50px_-20px_var(--accent)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">{room}</p>
          <p className="font-serif text-xl">{PIECES[it.name]?.label}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full px-2 text-ink-soft hover:bg-line/60">
          ×
        </button>
      </div>
      {!shop ? (
        <div className="mt-2">
          <Scanning label="Finding its brand in your taste" />
        </div>
      ) : line?.brand ? (
        <div className="mt-2 space-y-1">
          <p>
            <span className="font-medium">{line.brand.name}</span> <span className="text-ink-soft">{"$".repeat(line.brand.level ?? 0)}</span>
          </p>
          <p className="text-ink-soft">{why(line.brand)} · about {money(line.each, m)}</p>
          {(line.cheaper || line.dearer) && (
            <p className="text-xs text-ink-soft">
              {line.cheaper && <>Spend less: {line.cheaper.name}. </>}
              {line.dearer && <>Spend more: {line.dearer.name}.</>}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-ink-soft">{it.name.includes("plant") ? "From a plant nursery near you." : "No brand in your taste makes this one."}</p>
      )}
    </motion.div>
  );
}

// The room's mood and light, read from the places they love: "Relaxing · from Ace Hotel · warm and low, 2700K".
function MoodPill({ room, mood, className }: { room: string; mood?: Mood; className: string }) {
  return (
    <AnimatePresence mode="wait">
      {mood && (
        <motion.div
          key={room}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className={`pointer-events-none absolute z-20 max-w-[min(92%,440px)] rounded-2xl bg-paper/90 px-4 py-2 text-sm backdrop-blur ${className}`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Mood, read from your taste</p>
          <p className="mt-0.5">
            <span className="font-medium capitalize">{mood.word}</span>
            <span className="text-ink-soft"> · from {mood.from}</span>
          </p>
          <p className="text-xs text-ink-soft">
            Light: {mood.light.say}, {mood.light.kelvin}K
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
