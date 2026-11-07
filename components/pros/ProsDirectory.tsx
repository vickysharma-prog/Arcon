"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Scanning } from "@/components/fx/Motion";
import { Decode } from "@/components/fx/Decode";
import { ok, tick } from "@/components/fx/sfx";

type Pro = {
  user_id: string;
  name: string;
  company: string | null;
  city: string | null;
  logo_url: string | null;
  about: string | null;
  fee_note: string | null;
  role: "architect" | "builder";
  fit: { score: number; shared: string[]; sameCity: boolean; hasWork: boolean };
  projects: number;
  styles: string[];
  requested: boolean;
  rating: string | null;
};

const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

// "Suggest someone": architects or builders on Arcon, ranked by how well their past work fits this client's
// Qloo taste, with the style words they share. Asking one sends them a request; they see the design read only.
export function ProsDirectory() {
  const [project, setProject] = useState<string | null>(null);
  const [role, setRole] = useState<"architect" | "builder">("architect");
  const [data, setData] = useState<{ pros: Pro[]; title: string | null; city: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const r = q.get("role");
    queueMicrotask(() => {
      setProject(q.get("project"));
      if (r === "builder") setRole("builder");
    });
  }, []);

  useEffect(() => {
    if (!project) return;
    let live = true;
    fetch(`/api/pros?project=${project}&role=${role}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => live && setData(d))
      .catch(() => live && setError("Couldn't load the list. Only the project's owner can look for pros."));
    return () => {
      live = false;
    };
  }, [project, role]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Who will build this?</p>
      <h1 className="mt-2 font-serif text-5xl">
        <Decode text={role === "architect" ? "Architects who fit your taste" : "Builders who fit your taste"} />
      </h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Ranked by how close their past work on Arcon is to your taste{data?.city ? `, with pros near ${data.city.split(",")[0]} a little higher` : ""}. Ask one and they see your design before saying yes.
      </p>
      <div role="tablist" aria-label="Kind of pro" className="mt-6 inline-flex gap-1 rounded-full border border-line p-1 text-sm">
        {(["architect", "builder"] as const).map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={role === r}
            onClick={() => {
              tick();
              setRole(r);
              setData(null);
            }}
            className={`rounded-full px-4 py-1.5 transition ${role === r ? "bg-btn text-btn-ink" : "text-ink-soft hover:text-ink"}`}
          >
            {r === "architect" ? "Architects & designers" : "Builders"}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-10 text-ink-soft">{error}</p>
      ) : !data ? (
        <div className="mt-16 grid place-items-center">
          <Scanning label="Matching pros to your taste" />
        </div>
      ) : data.pros.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line p-8 text-center text-ink-soft">No {role}s are taking new clients here yet. Invite your own from Team on this project.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {data.pros.map((p, i) => (
            <motion.li key={p.user_id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * Math.min(i, 8) }}>
              <Card pro={p} project={project!} />
            </motion.li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Card({ pro: p, project }: { pro: Pro; project: string }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(p.requested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pros/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project, proId: p.user_id, role: p.role, message: note.trim() || undefined }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't send.");
    ok();
    setSent(true);
    setAsking(false);
  }

  return (
    <article className="h-full rounded-2xl border border-line bg-paper-raised p-5 transition hover:border-accent/60">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-paper text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-contain" /> : initials(p.company ?? p.name)}
        </div>
        <div className="min-w-0 flex-1">
          <a href={`/pros/${p.user_id}`} className="font-serif text-2xl leading-tight hover:text-accent">
            {p.company ?? p.name}
          </a>
          <p className="text-sm text-ink-soft">
            {p.company ? `${p.name} · ` : ""}
            {p.city}
            {p.fit.sameCity && <span className="ml-1 text-leaf">· near you</span>}
          </p>
          {p.rating && <p className="text-sm text-amber-600">{p.rating}</p>}
        </div>
        <div className="text-right">
          <p className="font-serif text-3xl text-accent">{p.fit.score}%</p>
          <p className="text-xs text-ink-soft">taste match</p>
        </div>
      </div>
      {p.fit.shared.length > 0 ? (
        <p className="mt-3 text-sm">
          You both love{" "}
          {p.fit.shared.map((w, i) => (
            <span key={w}>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">{w}</span>
              {i < p.fit.shared.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">{p.fit.hasWork ? "A different style from yours, which can be a good thing." : "New on Arcon: no projects to compare yet."}</p>
      )}
      {p.styles.length > 0 && <p className="mt-2 text-xs text-ink-soft">Past styles: {p.styles.join(" · ")}</p>}
      {p.about && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{p.about}</p>}
      <p className="mt-2 text-xs text-ink-soft">
        {p.projects} project{p.projects === 1 ? "" : "s"} on Arcon{p.fee_note ? ` · ${p.fee_note}` : ""}
      </p>
      {sent ? (
        <p className="mt-4 rounded-full bg-leaf/10 px-4 py-2 text-center text-sm text-leaf">✓ Asked. You&apos;ll hear back in your notifications.</p>
      ) : asking ? (
        <div className="mt-4">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="A short note (optional): your timeline, budget, anything important" className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="mt-2 flex gap-2">
            <button onClick={ask} disabled={busy} className="glow-btn flex-1 rounded-full px-4 py-2 text-sm disabled:opacity-60">
              {busy ? "Sending…" : `Ask ${p.name.split(" ")[0]} to join`}
            </button>
            <button onClick={() => setAsking(false)} className="rounded-full px-4 py-2 text-sm text-ink-soft hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            tick();
            setAsking(true);
          }}
          className="mt-4 w-full rounded-full border border-line px-4 py-2 text-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
        >
          Ask to join this project
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}
