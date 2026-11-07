"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { seeds, SIZE } from "@/lib/brand/seeds";
import { burst, chime, transition } from "@/components/fx/sfx";

const SEEDS = seeds();
const SEEN = "arcon-intro";
const REPLAY = "arcon:intro-replay";
/** Fired as the intro leaves, so the page can start its own animations in view of the visitor. */
export const INTRO_DONE = "arcon:intro-done";

// Runs before the overlay is painted: a visitor who saw the intro this session, or asks for less motion, skips it,
// and so does anyone arriving by a direct link (an invite, a shared project): the opening belongs to the landing page.
const SKIP = `try{if(location.pathname!=="/"||sessionStorage.getItem("${SEEN}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("intro-seen")}catch(e){}`;

/** The boot sound, timed to the animation: a data burst as the seeds start, a sweep as they fill, a chord on the name. */
function boot() {
  burst();
  setTimeout(transition, 700);
  setTimeout(chime, 1300);
}

const clicked = () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? false;

/** Plays the intro again, from any page: the logo in every header uses this. */
export function replayIntro() {
  try {
    sessionStorage.removeItem(SEEN);
  } catch {}
  document.documentElement.classList.remove("intro-seen");
  window.scrollTo({ top: 0 });
  window.dispatchEvent(new Event(REPLAY));
}

/** A link home that replays the intro on the way. */
export function HomeLink({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Link href="/" aria-label="Arcon home" onClick={replayIntro} className={className}>
      {children}
    </Link>
  );
}

type Phase = "gate" | "play" | "leaving" | "gone";

// The opening. The seed mark grows from the centre out with the boot sound, the name resolves under it, a scan line
// runs, and the page shows through. Browsers allow sound only after a click, so a first-time visitor sees a faint
// mark and "Tap to enter", and the tap starts the animation and the sound together. Anyone who has already clicked
// (the logo, or a link inside the app) gets it straight away. Without scripts it fades out on its own.
export function Intro() {
  const [phase, setPhase] = useState<Phase>("gate");
  const [run, setRun] = useState(0);
  // Set once scripts are running: the intro then waits for the tap instead of fading out on its own.
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLive(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const clear = () => timers.splice(0).forEach(clearTimeout);
    const done = () => window.dispatchEvent(new Event(INTRO_DONE));
    const unlisten = () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
    };

    function play() {
      unlisten();
      clear();
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {}
      setRun((n) => n + 1);
      setPhase("play");
      boot();
      timers.push(
        setTimeout(() => {
          setPhase("leaving");
          done();
        }, 2500),
        setTimeout(() => setPhase("gone"), 3100),
      );
    }
    window.addEventListener(REPLAY, play);

    if (document.documentElement.classList.contains("intro-seen")) {
      setPhase("gone");
      done();
    } else if (clicked()) {
      play();
    } else {
      window.addEventListener("pointerdown", play);
      window.addEventListener("keydown", play);
    }
    return () => {
      clear();
      unlisten();
      window.removeEventListener(REPLAY, play);
    };
  }, []);

  if (phase === "gone") return null;
  const playing = phase !== "gate";
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />
      <div
        key={run}
        className={`intro fixed inset-0 z-50 grid cursor-pointer place-items-center bg-paper ${live ? "intro-live" : ""} ${playing ? "intro-play" : "intro-waiting"} ${phase === "leaving" ? "intro-leaving" : ""}`}
        aria-hidden
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)", backgroundSize: "36px 36px" }}
        />
        {playing && <div className="intro-scan pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-accent/15 to-transparent" />}
        <div className="relative flex flex-col items-center">
          <svg width="132" height="132" viewBox={`0 0 ${SIZE} ${SIZE}`} className="intro-mark">
            {SEEDS.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r}
                className={`intro-seed ${s.accent ? "fill-accent" : "fill-ink"}`}
                style={{ transformOrigin: `${s.x}px ${s.y}px`, animationDelay: `${i * 14}ms` }}
              />
            ))}
          </svg>
          <p className="mt-6 flex font-serif text-5xl leading-none">
            {"Arcon".split("").map((ch, i) => (
              <span key={i} className="intro-letter" style={{ animationDelay: `${900 + i * 70}ms` }}>
                {ch}
              </span>
            ))}
          </p>
          <p className="intro-letter mt-4 font-mono text-[11px] uppercase tracking-[0.4em] text-ink-soft" style={{ animationDelay: "1300ms" }}>
            AI architect · Built around your taste
          </p>
          <div className="mt-6 h-px w-48 overflow-hidden bg-line">
            <div className="intro-bar h-px bg-gradient-to-r from-btn to-accent" />
          </div>
          {!playing && (
            <p className="intro-gate absolute top-full mt-10 flex items-center gap-3 whitespace-nowrap rounded-full border border-accent/50 px-5 py-2 font-mono text-xs uppercase tracking-[0.3em] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Tap to enter
            </p>
          )}
        </div>
      </div>
    </>
  );
}
