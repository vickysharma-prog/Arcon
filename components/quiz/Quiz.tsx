"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Decode } from "@/components/fx/Decode";
import { Scanning } from "@/components/fx/Motion";
import { chime, ok, tick, whoosh } from "@/components/fx/sfx";
import { parsePicks, QUIZ_KEY, ROUNDS, type Slot } from "@/lib/quiz/picks";

type Round = { slot: Slot; ask: string; options: { key: string; name: string; image: string }[] };
type Card = { style: string; because: string[]; words: { word: string; from: string | null }[]; brands: string[]; picks: { slot: Slot; id: string; name: string; image: string | null }[] };

// What's your space style: three rounds of pictures, one tap each, then a style card read from Qloo that can be
// shared as a link, and a button that carries the three picks into the full interview.
export function Quiz() {
  const still = useReducedMotion();
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [step, setStep] = useState(-1); // -1 the start, 0..2 the rounds, 3 the card
  const [keys, setKeys] = useState<string[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const read = (p: string) => {
    setStep(ROUNDS.length);
    setCard(null);
    setError(null);
    fetch(`/api/quiz?p=${encodeURIComponent(p)}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error)))
      .then((c: Card) => {
        setCard(c);
        chime();
      })
      .catch((e) => setError(typeof e === "string" ? e : "Couldn't read your taste. Try again."));
  };

  useEffect(() => {
    // A shared link opens straight on its card.
    const p = new URLSearchParams(location.search).get("p");
    if (p && parsePicks(p)) {
      setKeys(p.split("."));
      read(p);
    }
    fetch("/api/quiz")
      .then((r) => r.json())
      .then((b: { rounds: Round[] }) => setRounds(b.rounds))
      .catch(() => setError("Couldn't load the quiz. Try again."));
  }, []);

  const pick = (key: string) => {
    tick();
    const next = [...keys.slice(0, step), key];
    setKeys(next);
    if (next.length < ROUNDS.length) return setStep(step + 1);
    const p = next.join(".");
    history.replaceState(null, "", `/quiz?p=${p}`);
    whoosh();
    read(p);
  };

  const share = async () => {
    tick();
    const url = location.href;
    const text = card ? `My space style is ${card.style}, read by Arcon from what I love.` : "What's your space style?";
    if (navigator.share) return navigator.share({ title: "My space style", text, url }).catch(() => {});
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    ok();
    setTimeout(() => setCopied(false), 1600);
  };

  const design = () => {
    tick();
    try {
      if (card) sessionStorage.setItem(QUIZ_KEY, JSON.stringify(card.picks.map(({ slot, id, name }) => ({ slot, id, name }))));
    } catch {}
    location.assign("/start");
  };

  const again = () => {
    tick();
    setKeys([]);
    setCard(null);
    setStep(0);
    history.replaceState(null, "", "/quiz");
  };

  // Each round and the card start at the top of the page (on a phone the next pictures are otherwise off screen).
  useEffect(() => {
    if (step >= 0) window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }, [step, still]);

  const round = rounds?.[step];
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <AnimatePresence mode="wait">
        {step === -1 && (
          <motion.section key="start" initial={still ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="py-10 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Read from your taste</p>
            <h1 className="mt-3 font-serif text-5xl sm:text-6xl">
              <Decode text="What's your space style?" />
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft">Three taps: a place, a brand and something you love to watch or play. Arcon reads your taste from them.</p>
            <button
              onClick={() => {
                tick();
                setStep(0);
              }}
              className="glow-btn mt-8 px-8 py-3"
            >
              Find my style
            </button>
          </motion.section>
        )}

        {step >= 0 && step < ROUNDS.length && (
          <motion.section key={`round-${step}`} initial={still ? false : { opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <div className="flex items-center gap-2">
              {ROUNDS.map((r, i) => (
                <span key={r.slot} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
              ))}
            </div>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">
              {step + 1} of {ROUNDS.length}
            </p>
            <h2 className="mt-1 font-serif text-3xl sm:text-4xl">
              <Decode key={step} text={ROUNDS[step].ask} />
            </h2>
            {!round ? (
              <div className="grid place-items-center py-16">
                <Scanning label="Finding the pictures" />
              </div>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {round.options.map((o, i) => (
                  <motion.li key={o.key} initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <button
                      onClick={() => pick(o.key)}
                      aria-pressed={keys[step] === o.key}
                      className="group block w-full overflow-hidden rounded-2xl border border-line bg-paper-raised text-left transition hover:border-accent hover:shadow-[0_18px_44px_-22px_var(--accent)] focus-visible:border-accent"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- Qloo's own image host, sized by CSS */}
                      <img src={o.image} alt="" onError={(e) => e.currentTarget.closest("li")?.setAttribute("hidden", "")} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <span className="block p-2.5 text-sm font-medium">{o.name}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
            {step > 0 && (
              <button
                onClick={() => {
                  tick();
                  setStep(step - 1);
                }}
                className="mt-5 text-sm text-ink-soft hover:text-ink"
              >
                Back
              </button>
            )}
          </motion.section>
        )}

        {step === ROUNDS.length && (
          <motion.section key="card" initial={still ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
            {!card ? (
              <div className="grid place-items-center py-24">{error ? <p className="text-red-600">{error}</p> : <Scanning label="Reading your taste" />}</div>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl border border-line bg-paper-raised shadow-[0_30px_80px_-40px_var(--accent)]">
                  <div className="grid grid-cols-3">
                    {card.picks.map((pk) =>
                      pk.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Qloo's own image host, sized by CSS
                        <img key={pk.slot} src={pk.image} alt={pk.name} className="aspect-square w-full object-cover" />
                      ) : (
                        <div key={pk.slot} className="aspect-square bg-line" />
                      ),
                    )}
                  </div>
                  <div className="p-6">
                    <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Your space style</p>
                    <h2 className="mt-2 font-serif text-5xl">
                      <Decode text={card.style} />
                    </h2>
                    <p className="mt-2 text-ink-soft">
                      Read from {card.picks.map((p) => p.name).join(", ")}.
                    </p>
                    {card.words.length > 0 && (
                      <ul className="mt-5 flex flex-wrap gap-2" aria-label="The words your style is made of">
                        {card.words.map((w, i) => (
                          <motion.li
                            key={w.word}
                            initial={still ? false : { opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.3 + i * 0.07 }}
                            className="rounded-full border border-line bg-paper px-3 py-1 text-sm capitalize"
                          >
                            {w.word}
                            {w.from && <span className="normal-case text-ink-soft"> · {w.from}</span>}
                          </motion.li>
                        ))}
                      </ul>
                    )}
                    {card.brands.length > 0 && <p className="mt-5 text-sm text-ink-soft">Brands that match your taste: {card.brands.join(", ")}.</p>}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button onClick={design} className="glow-btn px-6 py-2.5">
                    Design your space
                  </button>
                  <button onClick={() => void share()} className="rounded-full border border-line px-5 py-2.5 transition hover:border-accent hover:text-accent">
                    {copied ? "Link copied" : "Share my style"}
                  </button>
                  <button onClick={again} className="rounded-full px-5 py-2.5 text-ink-soft hover:text-ink">
                    Take it again
                  </button>
                </div>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
      {error && step !== ROUNDS.length && <p className="mt-6 text-center text-red-600">{error}</p>}
    </main>
  );
}
