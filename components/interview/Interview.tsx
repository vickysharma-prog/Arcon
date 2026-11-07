"use client";

import { QUIZ_KEY } from "@/lib/quiz/picks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mark } from "@/components/Logo";
import { AnimatedMark } from "@/components/AnimatedMark";
import { chime, tick, transition } from "@/components/fx/sfx";
import { Decode, TypeLog } from "@/components/fx/Decode";
import { STAGES, type TasteView } from "@/lib/interview/view";
import { LANGS, langOf, voiceFor, type LangId } from "@/lib/interview/lang";
import { asked, labelOf, matchChoices, next, picksOf, type Answer, type Answers, type Question, type TastePick } from "@/lib/interview/script";
import { sizeFrom } from "@/lib/interview/logic";
import type { Candidate } from "@/lib/interview/logic";
import { useListen, useMicLevel, useSpeak } from "./useVoice";
import { MAYA } from "@/lib/demo/story";
import { tourGo } from "@/components/demo/TourBar";
import { VoiceMode, type VoiceState } from "./VoiceMode";

const LANG_KEY = "arcon-lang";
type Look = { matches: Candidate[]; hint: string | null } | { error: string };

// Small words the screen says, in the three languages.
const SAY = {
  havePlan: { en: "Have a floor plan? Upload it", hi: "फ़्लोर प्लान है? अपलोड करें", hinglish: "Floor plan hai? Upload karo" },
  title: { en: "Let's get to know you", hi: "आइए आपको जानें", hinglish: "Chalo aapko jaante hain" },
  keys: { en: "Press 1–9 to pick", hi: "चुनने के लिए 1–9 दबाएँ", hinglish: "Chunne ke liye 1–9 dabao" },
  building: { en: "Reading your taste", hi: "आपकी पसंद समझ रहे हैं", hinglish: "Aapki pasand samajh rahe hain" },
  ready: { en: "Your profile is ready", hi: "आपकी प्रोफ़ाइल तैयार है", hinglish: "Aapki profile ready hai" },
  typeOwn: { en: "Something else? Type it", hi: "कुछ और? लिखिए", hinglish: "Kuch aur? Type karo" },
  pictures: { en: "Pick one, or type your own", hi: "एक चुनिए, या अपना लिखिए", hinglish: "Ek chuno, ya apna type karo" },
  yourStyle: { en: "Your space style", hi: "आपकी स्पेस स्टाइल", hinglish: "Aapka space style" },
  styleFrom: { en: "Read from", hi: "इनसे पढ़ा", hinglish: "Inse padha" },
  designNow: { en: "Now design my space", hi: "अब मेरा स्पेस डिज़ाइन करें", hinglish: "Ab mera space design karo" },
  designing: { en: "Now designing your space", hi: "अब आपका स्पेस डिज़ाइन हो रहा है", hinglish: "Ab aapka space design ho raha hai" },
  done: { en: "Done", hi: "हो गया", hinglish: "Ho gaya" },
  skip: { en: "Skip", hi: "छोड़ें", hinglish: "Skip" },
  back: { en: "Change last answer", hi: "पिछला जवाब बदलें", hinglish: "Pichla jawab badlo" },
  tapOne: { en: "Tap one of the answers above, or say it another way.", hi: "ऊपर किसी जवाब पर टैप करें, या दूसरे तरीके से कहें।", hinglish: "Upar koi jawab tap karo, ya alag tarah se bolo." },
  type: { en: "Type, or press the mic and talk", hi: "लिखें, या माइक दबाकर बोलें", hinglish: "Likho, ya mic dabake bolo" },
  orType: { en: "Or type your answer below", hi: "या नीचे अपना जवाब लिखें", hinglish: "Ya neeche apna jawab likho" },
  notSure: { en: "Not sure, use a typical size", hi: "पता नहीं, आम साइज़ लें", hinglish: "Pata nahi, typical size le lo" },
  width: { en: "Width", hi: "चौड़ाई", hinglish: "Width" },
  depth: { en: "Depth", hi: "गहराई", hinglish: "Depth" },
  looking: { en: "Looking it up…", hi: "ढूँढ रहे हैं…", hinglish: "Dhoondh rahe hain…" },
  found: { en: "We found", hi: "हमें मिला", hinglish: "Humein mila" },
  thatsIt: { en: "Yes, that's it", hi: "हाँ, यही", hinglish: "Haan, yehi" },
  notIt: { en: "Not it?", hi: "यह नहीं?", hinglish: "Yeh nahi?" },
  see: { en: "See your design", hi: "अपना डिज़ाइन देखें", hinglish: "Apna design dekho" },
  retry: { en: "Try again", hi: "फिर से कोशिश करें", hinglish: "Phir try karo" },
} satisfies Record<string, Record<LangId, string>>;

// "Let's get to know you": the first thing a visitor does. One question at a time sits in the middle of the
// screen; each answer is a tap, a few typed words or a sentence spoken aloud, and the next question appears at
// once, since nothing waits on a model. The taste questions are matched in Qloo as they type, and the taste card
// fills in beside them. The design itself runs after, on the project page.
export function Interview() {
  const still = useReducedMotion();
  const [lang, setLang] = useState<LangId>("en");
  const [answers, setAnswers] = useState<Answers>({});
  const [draft, setDraft] = useState("");
  const [nudge, setNudge] = useState(false);
  const [talking, setTalking] = useState(false);
  const [finishing, setFinishing] = useState<"idle" | "working" | "failed">("idle");
  const [failure, setFailure] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const router = useRouter();
  // Once the project is saved, straight on to its design: "Now design my space" already asked for it.
  useEffect(() => {
    if (!projectId) return;
    const go = setTimeout(() => {
      transition();
      router.push(`/project/${projectId}?design=1`);
    }, 1400);
    return () => clearTimeout(go);
  }, [projectId, router]);
  const [taste, setTaste] = useState<TasteView | null>(null);
  // The tour's replay (/start?demo=1): Maya's answers play themselves, at 2x unless slowed to 1x; nothing is saved.
  const [replay, setReplay] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [ghost, setGhost] = useState<Answer | null>(null);
  const spoken = useRef(new Set<string>());
  // Answering for a project a pro set up ("New client"): its id, and whose it is.
  const [into, setInto] = useState<{ id: string; whose: string | null } | null>(null);
  const q = next(answers);
  // each question starts at the top: a long page of pictures shouldn't leave the next one scrolled away
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [q?.id]);
  // The pictures for the three style picks (the same ones as the quiz), fetched once.
  const [pictures, setPictures] = useState<Record<string, Picture[]>>({});
  const [own, setOwn] = useState(false);
  useEffect(() => {
    // "v=2": the list with Qloo ids (a copy cached before they were added has none, and those can't be picked).
    fetch("/api/quiz?v=2")
      .then((r) => (r.ok ? r.json() : { rounds: [] }))
      .then((b: { rounds: { slot: string; options: Picture[] }[] }) => setPictures(Object.fromEntries(b.rounds.map((r) => [r.slot, r.options.filter((o) => o.id)]))))
      .catch(() => {});
  }, []);
  useEffect(() => setOwn(false), [q?.id]);
  const say = (k: keyof typeof SAY) => SAY[k][lang];

  // Answers so far live in this browser tab, so a reload (or a phone that drops the page) picks up where it was.
  const keep = `arcon-answers-${typeof location === "undefined" ? "" : (new URLSearchParams(location.search).get("project") ?? "new")}`;
  useEffect(() => {
    if (new URLSearchParams(location.search).get("demo") === "1") return setReplay(true);
    try {
      const was = JSON.parse(sessionStorage.getItem(keep) ?? "null") as Answers | null;
      if (was && typeof was === "object") setAnswers((a) => ({ ...was, ...a }));
    } catch {}
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved) setLang(langOf(saved).id);
    } catch {}
    // Coming from the taste quiz: its three picks answer the taste questions (the place, the brand, the film or music).
    try {
      const quiz = JSON.parse(sessionStorage.getItem(QUIZ_KEY) ?? "null") as { slot: string; id: string; name: string }[] | null;
      sessionStorage.removeItem(QUIZ_KEY);
      if (Array.isArray(quiz)) {
        const from = Object.fromEntries(quiz.filter((p) => p && typeof p.id === "string").map((p) => [p.slot, { slot: p.slot, id: p.id, name: String(p.name) }]));
        setAnswers((a) => ({ ...from, ...a }) as Answers);
      }
    } catch {}
    // /start?project=… fills that project; the type and city the pro already gave are answered.
    const id = new URLSearchParams(location.search).get("project");
    if (!id) return;
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p || p.status !== "interview") return;
        setInto({ id, whose: p.whose ?? p.designed_for ?? null });
        setAnswers((a) => ({ ...(p.space_type ? { type: p.space_type } : {}), ...(p.site?.location ? { city: p.site.location } : {}), ...a }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (Object.keys(answers).length && !replay) sessionStorage.setItem(keep, JSON.stringify(answers));
    } catch {}
  }, [answers, keep, replay]);
  // once the project is saved, the answers are in it
  useEffect(() => {
    try {
      if (projectId) sessionStorage.removeItem(keep);
    } catch {}
  }, [projectId, keep]);

  const answer = useCallback(
    (id: string, value: Answer) => {
      tick();
      setNudge(false);
      setDraft("");
      setAnswers((a) => ({ ...a, [id]: value }));
    },
    [],
  );

  // The interview waits (no replay, no voice) while the quick guide or the tour's screen between stops is up (they mark
  // the page with data-guide and data-veil), so nothing is missed and nothing talks over them.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const look = () => setHeld(!!html.dataset.guide || !!html.dataset.veil);
    look();
    const watch = new MutationObserver(look);
    watch.observe(html, { attributes: true, attributeFilter: ["data-guide", "data-veil"] });
    return () => watch.disconnect();
  }, []);

  // The replay: each answer is shown being picked (or typed), then given, so it reads like Maya doing it.
  useEffect(() => {
    if (!replay || held || !q || MAYA[q.id] === undefined) return;
    const want = MAYA[q.id];
    const timers: ReturnType<typeof setTimeout>[] = [];
    // the greeting is said in full first ("Hi, I'm Arcon…"), then the answers come quickly
    const intro = q.lead ? 5200 : 0;
    const later = (ms: number, f: () => void) => timers.push(setTimeout(f, intro + ms / speed));
    setGhost(null);
    if (q.kind === "text") {
      // the city is typed as people type it, and taken from the map's own list
      const text = q.id === "city" ? "Los Angeles" : String(want);
      [...text].forEach((_, i) => later(1100 + i * 45, () => setDraft(text.slice(0, i + 1))));
      later(1100 + text.length * 45 + (q.id === "city" ? 1800 : 600), () => answer(q.id, want));
    } else {
      // the pictures sit below the question: bring them into view so the pick is seen
      if (q.kind === "taste") later(500, () => document.querySelector("[data-picks]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      // a picture pick stays a moment longer, so the chosen picture is seen
      const pic = q.kind === "taste";
      later(pic ? 1800 : 1300, () => setGhost(want));
      later(pic ? 3400 : 2200, () => answer(q.id, want));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, held, q?.id, speed]);

  // A typed or spoken answer: matched to a choice, read as a size, or taken as it is.
  const submit = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!q || !t) return;
      if (q.kind === "choice" || q.kind === "multi") {
        const hit = matchChoices(t, q);
        if (hit.length) answer(q.id, q.kind === "choice" ? hit[0] : hit);
        else setNudge(true);
      } else if (q.kind === "size") {
        if (/not sure|pata nahi|पता नहीं|typical|don.?t know/i.test(t)) return answer(q.id, { typical: true });
        const s = sizeFrom(t);
        if (s.width && s.depth) answer(q.id, { width: s.width, depth: s.depth, unit: s.unit ?? "ft" });
        else setNudge(true);
      } else if (q.kind === "text") {
        answer(q.id, t.slice(0, 200));
      } else {
        setDraft(t); // taste: the lookup below runs on the draft
      }
    },
    [q, answer],
  );

  const listen = useListen(submit, langOf(lang).listen);
  const voice = useSpeak(() => {
    if (talking) listen.start();
  });

  // Each question is read aloud once, in the chosen language.
  const askText = q ? [q.lead?.[lang], q.ask[lang]].filter(Boolean).join(" ") : "";
  useEffect(() => {
    if (!q || held || spoken.current.has(`${q.id}-${lang}`)) return;
    // a moment's wait, so a guide or the tour's screen that opens with the page is seen first and holds it
    const t = setTimeout(() => {
      const html = document.documentElement;
      if (html.dataset.guide || html.dataset.veil) return;
      spoken.current.add(`${q.id}-${lang}`);
      if (!voice.speak(askText, voiceFor(askText, lang)) && talking) listen.start();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id, lang, held]);

  // The live taste card: each new pick is read through Qloo while the next question is already on screen.
  const picks = picksOf(answers);
  const pickKey = picks.map((p) => p.id).join("|");
  useEffect(() => {
    if (!picks.length) return setTaste(null);
    let live = true;
    void fetch("/api/interview/taste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picks }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => live && t && setTaste(t))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey]);

  // All answered: confirm the picks with Qloo and create the project. The design itself runs on the next page.
  const finish = useCallback(async () => {
    setFinishing("working");
    transition();
    try {
      const res = await fetch("/api/interview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, lang, projectId: into?.id }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.id) throw new Error(body.error ?? "We couldn't start your design.");
      setProjectId(body.id);
      setFinishing("idle");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "We couldn't start your design.");
      setFinishing("failed");
    }
  }, [answers, lang, into]);
  // All answered: the style is revealed and read aloud; the design starts when they ask for it.
  const revealing = !q && !projectId && finishing === "idle";
  useEffect(() => {
    if (!revealing || !taste?.family) return;
    const line = `${say("yourStyle")}: ${taste.family}.`;
    if (!spoken.current.has(line)) {
      spoken.current.add(line);
      chime();
      voice.speak(line, voiceFor(line, lang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealing, taste?.family]);
  // The replay, once the style is shown: a moment to read it, then on to Maya's design (the tour's veil covers the move).
  useEffect(() => {
    if (!replay || !revealing || !taste?.family) return;
    const t = setTimeout(() => {
      tourGo("/demo?step=2");
    }, 5000 / speed);
    return () => clearTimeout(t);
  }, [replay, revealing, taste?.family, speed]);

  const designNow = () => {
    tick();
    voice.speak(say("designing"), voiceFor(say("designing"), lang));
    void finish();
  };

  const back = () => {
    tick();
    const done = asked(answers).filter((x) => answers[x.id] !== undefined);
    const last = done.at(-1);
    if (!last) return;
    setAnswers((a) => {
      const { [last.id]: _, ...rest } = a;
      return rest;
    });
    setFinishing("idle");
    setProjectId(null);
  };

  const rewind = (id: string) => {
    tick();
    const order = asked(answers).map((x) => x.id);
    const from = order.indexOf(id);
    setAnswers((a) => Object.fromEntries(Object.entries(a).filter(([k]) => !order.includes(k) || order.indexOf(k) < from)));
    setFinishing("idle");
    setProjectId(null);
  };

  const pickLang = (id: LangId) => {
    tick();
    setLang(id);
    try {
      localStorage.setItem(LANG_KEY, id);
    } catch {}
  };

  const level = useMicLevel(talking && listen.listening);
  const stage = projectId ? 5 : q ? q.stage : 4;
  const voiceState: VoiceState = listen.listening ? "listening" : finishing === "working" ? "thinking" : voice.speaking ? "speaking" : "idle";
  const history = useMemo(() => asked(answers).filter((x) => answers[x.id] !== undefined), [answers]);

  const total = asked(answers).length;
  const number = Math.min(history.length + 1, total);
  const typing = q && (q.kind === "text" || (q.kind === "taste" && own));

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* blueprint grid with a soft light behind the question */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at center, black 35%, transparent 80%)" }}
      />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_12%,transparent),transparent)]" />
      {into?.whose && (
        <p className="relative mx-auto mt-2 w-fit rounded-full border border-accent/40 bg-accent/5 px-4 py-1 font-mono text-xs uppercase tracking-widest text-accent">
          For {into.whose.split(" ")[0]}&apos;s design
        </p>
      )}

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8">
        {/* the strip: what this is, voice, language */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {say("title")}
          </p>
          <div className="flex items-center gap-2">
            {!into && (
              <Link href="/start/plan" className="hidden rounded-full border border-accent/40 bg-paper-raised px-3 py-1.5 text-sm text-accent transition hover:border-accent sm:inline-block">
                {say("havePlan")}
              </Link>
            )}
            <button type="button" onClick={voice.toggle} aria-pressed={voice.on} aria-label={voice.on ? "Voice on" : "Voice off"} className="rounded-full border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-ink">
              {voice.on ? "🔊" : "🔇"}
            </button>
            <div role="radiogroup" aria-label="Language" className="flex gap-1 rounded-full border border-line bg-paper-raised p-1">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={lang === l.id}
                  onClick={() => pickLang(l.id)}
                  className={`relative rounded-full px-3 py-1 text-sm transition-colors ${lang === l.id ? "text-btn-ink" : "text-ink-soft hover:text-ink"}`}
                >
                  {lang === l.id && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-full bg-btn" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{l.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {replay && (
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Replaying Maya&apos;s interview</span>
            <div role="radiogroup" aria-label="Speed" className="flex rounded-full border border-line bg-paper-raised p-0.5">
              {[1, 2].map((x) => (
                <button key={x} type="button" role="radio" aria-checked={speed === x} onClick={() => setSpeed(x)} className={`rounded-full px-3 py-0.5 ${speed === x ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
                  {x}x
                </button>
              ))}
            </div>
            <a href="/demo?step=2" className="rounded-full px-3 py-1 text-ink-soft transition hover:text-accent">
              Skip to her design →
            </a>
          </div>
        )}
        <ol className="grid grid-cols-5 gap-2" aria-label={`Progress: ${stage} of ${STAGES.length}`}>
          {STAGES.map((s, i) => (
            <li key={s}>
              <div className="h-1 overflow-hidden rounded-full bg-line">
                <motion.div className="h-1 rounded-full bg-gradient-to-r from-btn to-accent" initial={false} animate={{ width: i < stage ? "100%" : i === stage ? "35%" : "0%" }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
              </div>
              <p className={`mt-1.5 hidden text-[11px] uppercase tracking-wider sm:block ${i <= stage ? "text-ink" : "text-ink-soft"}`}>{s}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          {/* the stage: one question at a time, in the middle of the page */}
          <section className="relative mx-auto flex min-h-[460px] w-full max-w-3xl flex-col items-center justify-center text-center" aria-live="polite">
            <AnimatePresence mode="wait">
              {q ? (
                <motion.div
                  key={q.id}
                  initial={still ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={still ? undefined : { opacity: 0, y: -18, filter: "blur(6px)" }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-2xl"
                >
                  {q.lead && (
                    <div className="mx-auto mb-6 flex w-fit flex-col items-center">
                      <div className="drop-shadow-[0_0_24px_var(--accent)]">
                        <AnimatedMark size={64} growing={false} />
                      </div>
                      <motion.p initial={still ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-4 max-w-md text-lg text-ink-soft">
                        {q.lead[lang]}
                      </motion.p>
                    </div>
                  )}
                  <p className="mx-auto flex w-fit items-center gap-1 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
                    <span className="text-ink-soft">&gt;</span>
                    <span>{`${String(number).padStart(2, "0")} · ${STAGES[q.stage]}`}</span>
                    <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-accent motion-reduce:animate-none" />
                  </p>
                  <h1 className="mx-auto mt-4 max-w-xl font-serif text-3xl leading-tight sm:text-4xl">
                    <Decode text={q.ask[lang]} speed={12} />
                  </h1>

                  <div className="mt-8">
                    {(q.kind === "choice" || q.kind === "multi") && <Choices q={q} lang={lang} start={q.preset?.(answers) ?? []} shown={typeof ghost === "string" || Array.isArray(ghost) ? ([] as string[]).concat(ghost) : []} onAnswer={(v) => answer(q.id, v)} doneLabel={say("done")} />}
                    {q.kind === "size" && <SizeInput lang={lang} say={say} shown={ghost && typeof ghost === "object" && "width" in ghost ? ghost : undefined} onAnswer={(v) => answer(q.id, v)} />}
                    {typing && (
                      <form
                        className="mx-auto flex max-w-lg items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          submit(draft);
                        }}
                      >
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.currentTarget.value);
                            setNudge(false);
                          }}
                          placeholder={q.hint?.[lang] ?? say("type")}
                          aria-label="Your answer"
                          className="h-12 min-w-0 flex-1 rounded-full border border-line bg-paper-raised px-5 text-lg outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
                        />
                        {q.kind === "text" && (
                          <button type="submit" disabled={!draft.trim()} className="glow-btn h-12 shrink-0 px-5 disabled:opacity-40">
                            {say("done")}
                          </button>
                        )}
                      </form>
                    )}
                    {q.kind === "taste" && !own && (
                      <Pictures
                        options={pictures[q.slot!] ?? []}
                        chosen={ghost && typeof ghost === "object" && "id" in ghost ? ghost.id : null}
                        hint={say("pictures")}
                        typeOwn={say("typeOwn")}
                        onPick={(o) => answer(q.id, { slot: q.slot!, id: o.id, name: o.name })}
                        onOwn={() => {
                          tick();
                          setOwn(true);
                        }}
                      />
                    )}
                    {q.id === "city" && <CityLookup text={draft} onPick={(label) => answer(q.id, label)} />}
                    {q.kind === "taste" && own && (
                      <div className="mx-auto mt-4 max-w-lg">
                        <TasteLookup near={typeof answers.city === "string" ? answers.city : undefined} q={q} text={draft} say={say} onAnswer={(v) => answer(q.id, v)} />
                      </div>
                    )}
                    {q.optional && (
                      <button type="button" onClick={() => answer(q.id, "")} className="mt-4 rounded-full px-4 py-1.5 text-sm text-ink-soft transition hover:text-accent">
                        {say("skip")}
                      </button>
                    )}
                    {nudge && <p className="mt-4 text-sm text-accent">{say("tapOne")}</p>}
                  </div>

                  <div className="mt-10 flex items-center justify-center gap-4">
                    {history.length > 0 && (
                      <button type="button" onClick={back} className="rounded-full px-3 py-1.5 text-sm text-ink-soft transition hover:text-ink">
                        {say("back")}
                      </button>
                    )}
                    {listen.supported && (
                      <motion.button
                        type="button"
                        onClick={() => {
                          tick();
                          voice.stop();
                          setTalking(true);
                          listen.start();
                        }}
                        whileTap={still ? undefined : { scale: 0.92 }}
                        aria-label="Answer by voice"
                        className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-accent to-btn text-btn-ink shadow-[0_8px_30px_-10px_var(--accent)]"
                      >
                        <span className="absolute inset-0 animate-ping rounded-full bg-accent/25 motion-reduce:hidden" />
                        <MicIcon />
                      </motion.button>
                    )}
                    {(q.kind === "choice" || q.kind === "multi") && <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft sm:block">{say("keys")}</p>}
                  </div>
                </motion.div>
              ) : revealing ? (
                <motion.div key="reveal" initial={still ? false : { opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={still ? undefined : { opacity: 0, y: -18 }} className="w-full max-w-xl">
                  <div className="mx-auto w-fit drop-shadow-[0_0_30px_var(--accent)]">
                    <AnimatedMark size={72} growing={!taste?.family} />
                  </div>
                  <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">{say("yourStyle")}</p>
                  {taste?.family ? (
                    <>
                      <h1 className="mt-2 font-serif text-5xl sm:text-6xl">
                        <Decode text={taste.family} />
                      </h1>
                      <p className="mt-3 text-ink-soft">
                        {say("styleFrom")} {picks.map((p) => p.name).join(", ")}
                      </p>
                      <ul className="mt-5 flex flex-wrap justify-center gap-2">
                        {(taste.words ?? []).map((s, i) => (
                          <motion.li
                            key={s.word}
                            initial={still ? false : { opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.3 + i * 0.07 }}
                            className="rounded-full border border-line bg-paper-raised px-3 py-1 text-sm capitalize"
                          >
                            {s.word}
                            {s.from && <span className="normal-case text-ink-soft"> · {s.from}</span>}
                          </motion.li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="mx-auto mt-6 w-fit text-left text-sm">
                      <TypeLog lines={["Reading your picks", "Finding the words your style is made of", "Matching brands to your taste"]} done={false} />
                    </div>
                  )}
                  {replay ? (
                    <a href="/demo?step=2" className="glow-btn mt-8 px-8 py-3.5 text-lg">
                      See Maya&apos;s design
                    </a>
                  ) : (
                    <button type="button" onClick={designNow} disabled={!taste?.family} className="glow-btn mt-8 px-8 py-3.5 text-lg disabled:opacity-50">
                      {say("designNow")}
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div key="finish" initial={still ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
                  <div className="mx-auto w-fit drop-shadow-[0_0_30px_var(--accent)]">
                    <AnimatedMark size={96} growing={!projectId} />
                  </div>
                  <h1 className="mt-6 font-serif text-3xl sm:text-4xl">{projectId ? say("ready") : say("building")}</h1>
                  <div className="mx-auto mt-6 w-fit text-left text-sm">
                    <TypeLog lines={["Confirming what you love", "Reading your taste into style words", "Saving your project", "Handing over to the designer"]} done={!!projectId} />
                  </div>
                  {finishing === "failed" && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
                      <span className="text-ink-soft">{failure}</span>
                      <button type="button" onClick={() => void finish()} className="rounded-full border border-accent px-4 py-1.5 text-accent transition hover:bg-accent hover:text-btn-ink">
                        {say("retry")}
                      </button>
                      <button type="button" onClick={back} className="rounded-full px-3 py-1.5 text-ink-soft hover:text-ink">
                        {say("back")}
                      </button>
                    </div>
                  )}
                  {projectId && (
                    <Link href={`/project/${projectId}?design=1`} onClick={() => transition()} className="glow-btn mt-8 px-8 py-3.5 text-lg">
                      {say("see")}
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* what they've said so far, as a trail; tap one to go back to it */}
            {history.length > 0 && !projectId && (
              <div className="mt-12 flex max-w-2xl flex-wrap justify-center gap-1.5">
                {history.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    title={h.ask[lang]}
                    onClick={() => rewind(h.id)}
                    className="rounded-full border border-line bg-paper-raised/70 px-3 py-1 text-xs text-ink-soft backdrop-blur transition hover:border-accent hover:text-ink"
                  >
                    {labelOf(h, answers[h.id], lang)}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence>
              {talking && q && (
                <div className="absolute inset-0 z-20">
                  <VoiceMode
                    state={voiceState}
                    level={level}
                    heard={listen.interim}
                    reply={askText}
                    onOrb={listen.listening ? listen.stop : () => { voice.stop(); listen.start(); }}
                    onClose={() => {
                      setTalking(false);
                      listen.stop();
                    }}
                  />
                </div>
              )}
            </AnimatePresence>
          </section>

        </div>
      </div>
    </div>
  );
}

type Picture = { key: string; id: string; name: string; image: string };

// A style pick from pictures (the quiz's), one tap each, or "Something else? Type it" to name your own.
function Pictures({ options, chosen, hint, typeOwn, onPick, onOwn }: { options: Picture[]; chosen?: string | null; hint: string; typeOwn: string; onPick: (o: Picture) => void; onOwn: () => void }) {
  const still = useReducedMotion();
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-soft">{hint}</p>
      {!options.length ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-paper-raised" />
          ))}
        </div>
      ) : (
        <ul data-picks className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {options.map((o, i) => (
            <motion.li key={o.key} initial={still ? false : { opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.04 }}>
              <button
                type="button"
                onClick={() => onPick(o)}
                className={`group block w-full overflow-hidden rounded-2xl border bg-paper-raised text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_18px_44px_-22px_var(--accent)] ${chosen === o.id ? "-translate-y-1 border-accent ring-4 ring-accent/30" : "border-line"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Qloo's own image host, sized by CSS */}
                <img src={o.image} alt="" onError={(e) => e.currentTarget.closest("li")?.setAttribute("hidden", "")} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="block truncate p-2 text-sm font-medium">{o.name}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onOwn} className="mt-4 rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent">
        {typeOwn}
      </button>
    </div>
  );
}

// Answers to tap. One tap answers a single choice; several can be ticked, then Done.
function Choices({ q, lang, start, shown = [], onAnswer, doneLabel }: { q: Question; lang: LangId; start: string[]; shown?: string[]; onAnswer: (v: string | string[]) => void; doneLabel: string }) {
  const still = useReducedMotion();
  const [picked, setPicked] = useState<string[]>(start);
  const multi = q.kind === "multi";
  const toggle = (value: string) => {
    tick();
    // "None" stands alone; anything else clears it.
    setPicked((p) => (p.includes(value) ? p.filter((x) => x !== value) : value === "none" ? ["none"] : [...p.filter((x) => x !== "none"), value]));
  };
  // Keys 1 to 9 pick a choice, and Enter finishes a multiple pick, unless they're typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const ch = q.choices![Number(e.key) - 1];
      if (ch) {
        if (multi) toggle(ch.value);
        else onAnswer(ch.value);
      } else if (e.key === "Enter" && multi && picked.length) onAnswer(picked);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {q.choices!.map((ch, i) => {
        const on = picked.includes(ch.value) || shown.includes(ch.value);
        return (
          <motion.button
            key={ch.value}
            type="button"
            aria-pressed={multi ? on : undefined}
            onClick={() => (multi ? toggle(ch.value) : onAnswer(ch.value))}
            initial={still ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 420, damping: 24 }}
            whileHover={still ? undefined : { y: -2 }}
            className={`rounded-full border px-5 py-2.5 text-base transition-colors ${on ? "border-accent bg-accent text-btn-ink shadow-[0_8px_24px_-10px_var(--accent)]" : "border-line bg-paper-raised hover:border-accent hover:text-accent hover:shadow-[0_8px_24px_-14px_var(--accent)]"}`}
          >
            <span className={`mr-2 font-mono text-[10px] ${on ? "opacity-80" : "text-ink-soft"}`}>{i + 1}</span>
            {multi && <span className="mr-1">{on ? "✓" : "+"}</span>}
            {ch.label[lang]}
          </motion.button>
        );
      })}
      {multi && (
        <button type="button" disabled={!picked.length} onClick={() => onAnswer(picked)} className="rounded-full bg-btn px-4 py-1.5 text-sm text-btn-ink transition hover:opacity-90 disabled:opacity-40">
          {doneLabel}
        </button>
      )}
    </div>
  );
}

function SizeInput({ lang, say, shown, onAnswer }: { lang: LangId; say: (k: keyof typeof SAY) => string; shown?: { width: number; depth: number }; onAnswer: (v: Answer) => void }) {
  const [typedW, setW] = useState("");
  const [typedD, setD] = useState("");
  // the replay shows Maya's size in the boxes before it answers
  const w = shown ? String(shown.width) : typedW;
  const d = shown ? String(shown.depth) : typedD;
  const [unit, setUnit] = useState<"ft" | "m">(lang === "en" ? "ft" : "ft");
  const ok = Number(w) > 0 && Number(d) > 0;
  const field = "w-24 rounded-xl border border-line bg-paper px-3 py-2 outline-none focus:border-accent";
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex flex-wrap items-end justify-center gap-2">
        <label className="text-xs text-ink-soft">
          {say("width")}
          <input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value.replace(/[^\d.]/g, ""))} className={`mt-1 block ${field}`} aria-label={say("width")} />
        </label>
        <span className="pb-2 text-ink-soft">×</span>
        <label className="text-xs text-ink-soft">
          {say("depth")}
          <input inputMode="decimal" value={d} onChange={(e) => setD(e.target.value.replace(/[^\d.]/g, ""))} className={`mt-1 block ${field}`} aria-label={say("depth")} />
        </label>
        <div className="flex rounded-full border border-line p-0.5" role="radiogroup" aria-label="Unit">
          {(["ft", "m"] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => setUnit(u)} className={`rounded-full px-3 py-1 text-sm ${unit === u ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
              {u}
            </button>
          ))}
        </div>
        <button type="button" disabled={!ok} onClick={() => onAnswer({ width: Number(w), depth: Number(d), unit })} className="rounded-full bg-btn px-4 py-2 text-sm text-btn-ink transition hover:opacity-90 disabled:opacity-40">
          {say("done")}
        </button>
      </div>
      <button type="button" onClick={() => onAnswer({ typical: true })} className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent">
        {say("notSure")}
      </button>
    </div>
  );
}

// A taste answer: what they type is matched in Qloo as they type, and they confirm the match with a tap.
function TasteLookup({ q, text, near, say, onAnswer }: { q: Question; text: string; near?: string; say: (k: keyof typeof SAY) => string; onAnswer: (v: TastePick) => void }) {
  const [look, setLook] = useState<Look | null>(null);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const query = text.trim();
  useEffect(() => {
    setLook(null);
    setChosen(null);
    if (query.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/taste?slot=${q.slot}&q=${encodeURIComponent(query)}${near ? `&near=${encodeURIComponent(near)}` : ""}`).catch(() => null);
      const body: Look = res ? await res.json().catch(() => ({ error: "Couldn't look that up." })) : { error: "Couldn't look that up. Check your connection." };
      if (!live) return;
      setLook(body);
      if ("matches" in body && body.matches[0]) setChosen(body.matches[0]);
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, q.slot, near]);

  const describe = (c: Candidate) => [c.kind, c.detail].filter(Boolean).join(" · ");
  if (query.length < 2) return null;
  return (
    <div aria-live="polite" className="text-sm">
      {!look && <p className="animate-pulse font-mono text-xs text-ink-soft">› {say("looking")}</p>}
      {look && "error" in look && <p className="text-accent">{look.error}</p>}
      {look && "matches" in look && !look.matches.length && <p className="text-accent">{look.hint}</p>}
      {chosen && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-soft">{say("found")}:</span>
          <strong>{chosen.name}</strong>
          <span className="text-ink-soft">({describe(chosen)})</span>
          <button type="button" onClick={() => onAnswer({ slot: q.slot!, id: chosen.entityId, name: chosen.name })} className="rounded-full bg-btn px-4 py-1.5 text-btn-ink transition hover:opacity-90">
            {say("thatsIt")}
          </button>
        </div>
      )}
      {look && "matches" in look && look.matches.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-ink-soft">{say("notIt")}</span>
          {look.matches
            .filter((m) => m.entityId !== chosen?.entityId)
            .map((m) => (
              <button key={m.entityId} type="button" onClick={() => setChosen(m)} className="rounded-full border border-line px-3 py-1 transition hover:border-accent">
                {m.name} <span className="text-ink-soft">({describe(m)})</span>
              </button>
            ))}
        </div>
      )}
      {chosen && (
        <button type="button" onClick={() => (setChosen(null), setLook({ matches: [], hint: "Add the city or street to the name, then it can find the right one." } as Look))} className="mt-2 text-xs text-ink-soft underline-offset-2 hover:text-accent hover:underline">
          None of these
        </button>
      )}
    </div>
  );
}

// Arcon's mark, on its own: no circle or box behind it. Its seeds grow while Arcon works.
function Avatar({ busy }: { busy: boolean }) {
  return <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center">{busy ? <AnimatedMark size={28} /> : <Mark size={26} />}</span>;
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="relative">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

// The city as the map knows it, with its country, as they type: one tap takes it, and a typo ("Delih") shows up as
// somewhere else before the design is drawn for the wrong place.
function CityLookup({ text, onPick }: { text: string; onPick: (label: string) => void }) {
  const [places, setPlaces] = useState<string[] | null>(null);
  const query = text.trim();
  useEffect(() => {
    setPlaces(null);
    if (query.length < 3) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/city?q=${encodeURIComponent(query)}`).catch(() => null);
      const body = res?.ok ? ((await res.json()) as { places: string[] }) : { places: [] };
      if (live) setPlaces(body.places);
    }, 500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);
  if (query.length < 3 || !places) return null;
  return (
    <div aria-live="polite" className="mx-auto mt-4 max-w-lg text-sm">
      {places.length ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-ink-soft">On the map:</span>
          {places.map((p) => (
            <button key={p} type="button" onClick={() => (tick(), onPick(p))} className="rounded-full border border-line px-3 py-1 transition hover:border-accent hover:text-accent">
              {p}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-ink-soft">That isn&apos;t on the map. Check the spelling, or add the state or country.</p>
      )}
    </div>
  );
}
