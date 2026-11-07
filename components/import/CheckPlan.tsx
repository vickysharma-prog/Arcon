"use client";

import { useEffect, useMemo, useState } from "react";
import type { Candidate } from "@/lib/interview/logic";
import { Decode } from "@/components/fx/Decode";
import { PlanSvg } from "@/components/plan/PlanSvg";
import { validate } from "@/lib/layout/validate";
import { applyEdits, plainProblem, rescale, type Imported } from "@/lib/plan-import/edits";
import { blocking, snapPlan } from "@/lib/plan-import/snap";
import { SLOTS, type Pick, type SlotId } from "@/lib/plan-import/taste";

const KINDS: [string, string][] = [
  ["living", "Living room"], ["kitchen", "Kitchen"], ["dining", "Dining"], ["bedroom", "Bedroom"], ["bath", "Bathroom"],
  ["office", "Study or office"], ["lounge", "Family room"], ["guest-room", "Guest room"], ["laundry", "Laundry"],
  ["storage", "Storage"], ["closet", "Closet"], ["pantry", "Pantry"], ["workspace", "Open workspace"], ["meeting", "Meeting room"],
  ["reception", "Reception"], ["counter", "Counter"], ["retail", "Shop floor"], ["fitting", "Fitting room"],
];
const FT = 0.3048;

type Props = { id: string; imported: Imported; units: "imperial" | "metric"; onDone: (project: unknown) => void };

// After an upload: show what Arcon read, let the user fix names and types (and the size), answer anything the
// reader wasn't sure of, and name a few things they love so the design can be styled to their taste.
export function CheckPlan({ id, imported, units, onDone }: Props) {
  const toUser = (m: number) => Math.round((units === "imperial" ? m / FT : m) * 10) / 10;
  const [edits, setEdits] = useState<Record<string, { name?: string; kind?: string }>>({});
  const [width, setWidth] = useState(String(toUser(imported.read.width)));
  const [depth, setDepth] = useState(String(toUser(imported.read.depth)));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [location, setLocation] = useState("");
  const [picks, setPicks] = useState<Partial<Record<SlotId, Pick>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const size = { width: Number(width), depth: Number(depth) };
  const resized = size.width > 0 && size.depth > 0 && (Math.abs(size.width - toUser(imported.read.width)) > 0.05 || Math.abs(size.depth - toUser(imported.read.depth)) > 0.05);
  // The plan as it will be used, with every correction applied, checked again as the user types.
  const layout = useMemo(() => {
    const toM = (v: number) => (units === "imperial" ? v * FT : v);
    const base = resized ? snapPlan(rescale(imported.read, toM(size.width), toM(size.depth))).layout : imported.layout;
    return applyEdits(base, Object.entries(edits).map(([rid, e]) => ({ id: rid, ...e })));
  }, [imported, edits, resized, size.width, size.depth, units]);
  const all = validate(layout);
  const problems = blocking(all);
  const advice = all.filter((e) => !problems.includes(e));
  const rooms = layout.floors.flatMap((f) => f.spaces.filter((s) => s.zone !== "circulation").map((s) => ({ ...s, level: f.level })));
  const picked = SLOTS.filter((s) => picks[s.id]).length;
  const ready = problems.length === 0 && picked === SLOTS.length && location.trim().length >= 2;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/import`, {
        method: "POST",
        body: JSON.stringify({
          edits: Object.entries(edits).map(([rid, e]) => ({ id: rid, ...e })),
          answers,
          size: resized ? size : undefined,
          picks: SLOTS.map((s) => picks[s.id]),
          location: location.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't use this plan.");
      onDone(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use this plan.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-4">
      <p className="text-sm uppercase tracking-widest text-ink-soft">Your plan · check it</p>
      <h1 className="mt-1 font-serif text-5xl">
        <Decode text="Is this your plan?" />
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Here&apos;s what we read off your drawing. Fix any room name or type, then tell us a few things you love so we can style it.{" "}
        <a href="/start/plan" className="text-accent underline-offset-2 hover:underline">
          Upload a different plan
        </a>
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          {layout.floors.map((f) => (
            <div key={f.level} className="rounded-2xl border border-line bg-paper-raised p-4">
              {layout.floors.length > 1 && <p className="text-xs uppercase tracking-widest text-ink-soft">{f.level === 0 ? "Ground floor" : "Upstairs"}</p>}
              <PlanSvg layout={layout} level={f.level} units={units} className="w-full" />
            </div>
          ))}
          {problems.length > 0 && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-medium">We need to fix this before we can model it:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {problems.map((m) => (
                  <li key={m}>{plainProblem(m, layout)}</li>
                ))}
              </ul>
              <p className="mt-2">Check the size, or upload a clearer drawing with the room names on it.</p>
            </div>
          )}
          {advice.length > 0 && (
            <div className="rounded-2xl border border-line bg-paper p-4 text-sm">
              <p className="font-medium">Worth knowing (it won&apos;t stop us):</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
                {advice.map((m) => (
                  <li key={m}>{plainProblem(m, layout)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="font-serif text-2xl">Rooms</h2>
            <ul className="mt-3 space-y-2">
              {rooms.map((r) => (
                <li key={`${r.level}-${r.id}`} className="flex gap-2">
                  <input
                    aria-label="Room name"
                    value={edits[r.id]?.name ?? r.name}
                    onChange={(e) => setEdits((all) => ({ ...all, [r.id]: { ...all[r.id], name: e.target.value } }))}
                    className="min-w-0 flex-1 rounded-xl border border-line bg-paper-raised px-3 py-2"
                  />
                  <select
                    aria-label="Room type"
                    value={edits[r.id]?.kind ?? r.kind}
                    onChange={(e) => setEdits((all) => ({ ...all, [r.id]: { ...all[r.id], kind: e.target.value } }))}
                    className="w-40 rounded-xl border border-line bg-paper-raised px-2 py-2"
                  >
                    {KINDS.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl">Size</h2>
            <div className="mt-2 flex items-center gap-2">
              <input aria-label="Width" inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} className="w-24 rounded-xl border border-line bg-paper-raised px-3 py-2" />
              <span className="text-ink-soft">×</span>
              <input aria-label="Depth" inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} className="w-24 rounded-xl border border-line bg-paper-raised px-3 py-2" />
              <span className="text-ink-soft">{units === "imperial" ? "ft" : "m"}, width across the front by depth</span>
            </div>
            <label className="mt-4 block">
              <span className="text-sm">Where is it? Costs, stores and the local taste come from here.</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, e.g. Austin, TX or Brooklyn, NY" autoComplete="address-level2" className="mt-1 w-full rounded-xl border border-line bg-paper-raised px-3 py-2" />
            </label>
          </section>

          {imported.questions.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl">A few things we weren&apos;t sure of</h2>
              {imported.questions.map((q) => (
                <label key={q} className="mt-3 block">
                  <span className="text-sm">{q}</span>
                  <input value={answers[q] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))} className="mt-1 w-full rounded-xl border border-line bg-paper-raised px-3 py-2" />
                </label>
              ))}
            </section>
          )}

          <section>
            <h2 className="font-serif text-2xl">What do you love?</h2>
            <p className="mt-1 text-sm text-ink-soft">We style your plan from these, through your taste.</p>
            {SLOTS.map((slot) => (
              <TasteQuestion key={slot.id} slot={slot} onPick={(p) => setPicks((all) => ({ ...all, [slot.id]: p ?? undefined }))} />
            ))}
          </section>

          {error && <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
          <button onClick={() => void send()} disabled={!ready || busy} className="w-full rounded-full bg-btn px-8 py-3 text-lg text-btn-ink transition hover:opacity-90 disabled:opacity-40">
            {busy ? "Getting your design ready…" : "Design with my plan"}
          </button>
          {!ready && !busy && <p className="text-center text-sm text-ink-soft">{problems.length ? "Fix the plan first." : !location.trim() ? "Say where the building is." : `Answer all three, and check each match (${picked} of 3 done).`}</p>}
        </div>
      </div>
    </main>
  );
}

type Look = { matches: Candidate[]; hint: string | null } | { error: string };

// One taste question: what the user types is looked up in Qloo as they pause, and they see what it matched.
// The closest match of the right kind is used unless they pick another; a vague answer is asked again.
function TasteQuestion({ slot, onPick }: { slot: (typeof SLOTS)[number]; onPick: (p: Pick | null) => void }) {
  const [text, setText] = useState("");
  const [look, setLook] = useState<Look | null>(null);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const q = text.trim();

  useEffect(() => {
    setLook(null);
    setChosen(null);
    onPick(null);
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/taste?slot=${slot.id}&q=${encodeURIComponent(q)}`).catch(() => null);
      const body: Look = res ? await res.json().catch(() => ({ error: "Couldn't look that up." })) : { error: "Couldn't look that up. Check your connection." };
      if (!live) return;
      setLook(body);
      if ("matches" in body && body.matches[0]) choose(body.matches[0]);
    }, 600);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, slot.id]);

  const choose = (c: Candidate) => {
    setChosen(c);
    onPick({ slot: slot.id, id: c.entityId, name: c.name });
  };
  const describe = (c: Candidate) => [c.kind, c.detail].filter(Boolean).join(" · ");

  return (
    <div className="mt-3">
      <label className="block">
        <span className="text-sm">{slot.label}</span>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`e.g. ${slot.example}`} aria-label={slot.label} className="mt-1 w-full rounded-xl border border-line bg-paper-raised px-3 py-2" />
      </label>
      <div aria-live="polite" className="mt-1 text-sm">
        {q.length >= 2 && !look && <p className="text-ink-soft">Looking it up…</p>}
        {look && "error" in look && <p className="text-red-800">{look.error}</p>}
        {look && "matches" in look && !look.matches.length && <p className="text-red-800">{look.hint}</p>}
        {chosen && (
          <p>
            <span className="text-ink-soft">We found: </span>
            <strong>{chosen.name}</strong> <span className="text-ink-soft">({describe(chosen)})</span>
          </p>
        )}
        {look && "matches" in look && look.matches.length > 1 && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-ink-soft">Not it?</span>
            {look.matches
              .filter((m) => m.entityId !== chosen?.entityId)
              .map((m) => (
                <button key={m.entityId} type="button" onClick={() => choose(m)} className="rounded-full border border-line px-3 py-1 hover:bg-paper-raised">
                  {m.name} <span className="text-ink-soft">({describe(m)})</span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
