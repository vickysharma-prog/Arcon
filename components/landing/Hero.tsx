"use client";

import { InstallApp } from "@/components/InstallApp";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ProfileMenu } from "@/components/ProfileMenu";
import { tick, transition } from "@/components/fx/sfx";
import { HomeLink } from "./Intro";
import { Showcase } from "./Showcase";

// The header for the landing page: the logo on its own at the left, the sections in a floating glass bar in the
// middle, and the way in at the right. A highlight slides under whichever link the pointer is on.
const LINKS = [
  ["How it works", "#how"],
  ["Taste", "#taste"],
  ["Plans", "#plans"],
  ["For pros", "#pros"],
  ["Pricing", "#pricing"],
  ["Resources", "/resources"],
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  // someone signed in gets their projects here instead of "Sign up free"
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setSignedIn(!!m?.user))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`sticky top-0 z-40 transition-colors duration-300 ${scrolled ? "border-b border-line/60 bg-paper/85 backdrop-blur-md" : "border-b border-transparent"}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 md:grid md:grid-cols-[1fr_auto_1fr]">
        <HomeLink className="justify-self-start">
          <Logo size={28} />
        </HomeLink>
        <nav
          onMouseLeave={() => setHover(null)}
          className={`hidden items-center gap-1 rounded-full border p-1 text-sm backdrop-blur-md transition-all duration-300 md:flex ${scrolled ? "border-line bg-paper-raised/80 shadow-[0_10px_40px_-20px_var(--accent)]" : "border-line/70 bg-paper-raised/50"}`}
        >
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} onMouseEnter={() => setHover(href)} onClick={() => tick()} className="relative whitespace-nowrap rounded-full px-4 py-1.5 text-ink-soft transition-colors hover:text-ink">
              {hover === href && <motion.span layoutId="nav-hover" className="absolute inset-0 rounded-full bg-accent/10 ring-1 ring-accent/30" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{label}</span>
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 justify-self-end sm:gap-2.5">
          {/* the tour: one click, nothing to sign up for */}
          <a href="/demo" onClick={() => tick()} className="flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-accent/50 bg-accent/5 px-3 text-sm text-accent transition hover:-translate-y-0.5 hover:bg-accent/10 hover:shadow-[0_10px_30px_-12px_var(--accent)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Tour
          </a>
          <InstallApp />
          <Link href={signedIn ? "/home" : "/login?mode=signup"} onClick={() => transition()} className="glow-btn flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm sm:px-5">
            {signedIn ? "My projects" : "Sign up free"}
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

const WORDS = ["who you are", "what you love", "how you live", "how you work"];

// The first screen: what Arcon does in one line, the way in, and a plan that designs itself from taste.
export function Hero() {
  const still = useReducedMotion();
  const [word, setWord] = useState(0);

  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2600);
    return () => clearInterval(t);
  }, [still]);

  return (
    <section className="relative overflow-hidden">
      {/* blueprint grid, fading out toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-20 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-16">
        <div>
          <motion.p
            initial={still ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent sm:text-xs sm:tracking-[0.3em]"
          >
            AI architect, built around your taste
          </motion.p>
          <h1 className="mt-6 font-serif text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            Spaces designed around
            <span className="relative block h-[1.15em] overflow-hidden text-accent">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={WORDS[word]}
                  className="absolute left-0 top-0 whitespace-nowrap"
                  initial={{ y: "100%", opacity: 0, filter: "blur(8px)" }}
                  animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: "-100%", opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  {WORDS[word]}.
                </motion.span>
              </AnimatePresence>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Talk to Arcon about the films, places and things you love. It turns your taste into a floor plan, a 3D walkthrough, a budget in your currency and a shopping list, for a home, café, office, hotel, shop or studio.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-2.5">
            <a href="/demo" onClick={() => tick()} className="group flex items-center gap-2.5 rounded-full border border-accent/50 bg-accent/5 px-5 py-3.5 text-base text-accent backdrop-blur transition hover:-translate-y-0.5 hover:bg-accent/10 hover:shadow-[0_12px_36px_-14px_var(--accent)]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              Take the tour
            </a>
            <Link
              href="/start"
              onClick={() => transition()}
              className="glow-btn group px-6 py-3.5 text-base"
            >
              Start designing free
            </Link>
            <Link href="/start/plan" onClick={() => tick()} className="rounded-full border border-line bg-paper-raised/70 px-5 py-3.5 text-base backdrop-blur transition hover:-translate-y-0.5 hover:border-accent hover:text-accent hover:shadow-[0_12px_36px_-14px_var(--accent)]">
              I have a floor plan
            </Link>
          </div>
          <p className="mt-5 text-sm text-ink-soft">
            Type or talk · no account needed to try ·{" "}
            <Link href="/quiz" onClick={() => tick()} className="text-accent underline-offset-2 hover:underline">
              Find your space style in three taps
            </Link>
          </p>

        </div>

        <motion.div initial={still ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <Showcase />
        </motion.div>
      </div>
    </section>
  );
}
