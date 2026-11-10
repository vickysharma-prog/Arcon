"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlanSvg } from "@/components/plan/PlanSvg";
import type { Layout } from "@/lib/layout/schema";
import { Scanning } from "@/components/fx/Motion";
import { ok, tick } from "@/components/fx/sfx";

type Attachment = { path: string; name: string; type: string; size: number; url?: string };
type Message = {
  id: number;
  kind: "message" | "event";
  author_id: string | null;
  author_name: string;
  body: string;
  room_id: string | null;
  room_name: string | null;
  level: number | null;
  version: number | null;
  data: { type?: string };
  attachments: Attachment[];
  created_at: string;
};
type Thread = {
  /** a change to the approved design, waiting for approval */
  change?: { from: number; to: number; notes: string[]; cost: string; canDecide: boolean } | null;
  /** the client isn't on Arcon: the pro records their answer */
  inPerson?: string | null;
  messages: Message[];
  me: string | null;
  canPost: boolean;
  teamChannel: boolean;
  status: string;
  canReview: boolean;
  canDecide: boolean;
  approval: { version: number; by: string; created_at: string } | null;
};
export type Room = { id: string; name: string; level: number };

const ICON: Record<string, string> = { chose: "◧", changed: "✎", joined: "＋", answered: "✎", review: "⧉", approved: "✓", changes: "↺", fee: "¤", change: "Δ", site: "⌂", handover: "→", movein: "⚿", quote: "$", visit: "◉", signoff: "✓" };

const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en", { day: "numeric", month: "short" });
};
const kb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Find a room in the plan by where someone tapped. */
function roomAt(layout: Layout, level: number, x: number, z: number): Room | null {
  const s = layout.floors.find((f) => f.level === level)?.spaces.find((r) => r.zone !== "circulation" && x >= r.rect.x && x <= r.rect.x + r.rect.w && z >= r.rect.y && z <= r.rect.y + r.rect.h);
  return s ? { id: s.id, name: s.name, level } : null;
}

// The project thread: everyone on the project talks here, the project's own events show up as they happen, and
// review happens inside it. Messages can be about a room, picked on the plan or from the 3D.
export function ThreadView({
  projectId,
  layout,
  units,
  room: start,
  onStatus,
}: {
  projectId: string;
  layout: Layout | null;
  units: "imperial" | "metric";
  room?: Room | null;
  onStatus: (status: string) => void;
}) {
  const [channel, setChannel] = useState<"all" | "team">("all");
  const [t, setT] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [room, setRoom] = useState<Room | null>(start ?? null);
  const [picking, setPicking] = useState(false);
  const [level, setLevel] = useState(start?.level ?? 0);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const seen = useRef(0);

  const load = useCallback(
    () =>
      fetch(`/api/projects/${projectId}/thread?channel=${channel}`)
        .then((r) => (r.ok ? (r.json() as Promise<Thread>) : Promise.reject()))
        .then((next) => {
          setT(next);
          onStatus(next.status);
        })
        .catch(() => setError("Couldn't load the thread.")),
    [projectId, channel, onStatus],
  );

  // New messages arrive every 10 seconds while the thread is open. ponytail: polling; realtime later if it matters.
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [load]);

  // Keep the newest message in view when more arrive.
  useEffect(() => {
    const n = t?.messages.length ?? 0;
    if (n !== seen.current) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: seen.current ? "smooth" : "auto" });
    // a link to #latest (the tour) also brings the newest messages into the page's view on the first load
    if (n && !seen.current && window.location.hash === "#latest") setTimeout(() => list.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 300);
    seen.current = n;
  }, [t?.messages.length]);

  const rooms = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const m of t?.messages ?? []) if (m.room_id) counts.set(m.room_id, { name: m.room_name ?? m.room_id, n: (counts.get(m.room_id)?.n ?? 0) + 1 });
    return [...counts.entries()].map(([id, v]) => ({ id, ...v }));
  }, [t?.messages]);

  async function attach(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    setError(null);
    for (const f of [...list].slice(0, 6 - files.length)) {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch(`/api/projects/${projectId}/thread/files`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "Upload failed.");
      else setFiles((x) => [...x, body]);
    }
    setUploading(false);
  }

  async function send() {
    const body = text.trim() || (files.length ? `Shared ${files.length === 1 ? "a file" : `${files.length} files`}` : "");
    if (!body) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/thread`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel, body, room, attachments: files }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't send.");
    tick();
    setText("");
    setFiles([]);
    setRoom(null);
    void load();
  }

  async function review(action: "send" | "approve" | "changes" | "change-approve" | "change-decline") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "send" ? { action } : { action, note: note.trim() || undefined }) });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "That didn't go through.");
    ok();
    setNote("");
    // Hide the buttons at once; the refresh below brings the event and the approval line.
    setT((old) => (old ? { ...old, canDecide: false, canReview: false } : old));
    onStatus(body.status);
    void load();
  }

  const shown = (t?.messages ?? []).filter((m) => !filter || m.room_id === filter);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 lg:grid-cols-[1fr_280px]">
      <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          {t?.teamChannel ? (
            <div role="tablist" aria-label="Channel" className="flex gap-1 rounded-full border border-line p-1 text-sm">
              {(["all", "team"] as const).map((c) => (
                <button key={c} role="tab" aria-selected={channel === c} onClick={() => (setChannel(c), setT(null))} className={`rounded-full px-3 py-1 ${channel === c ? "bg-btn text-btn-ink" : "text-ink-soft hover:text-ink"}`}>
                  {c === "all" ? "Everyone" : "Team only"}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium">Everyone on the project</p>
          )}
          {t?.approval && <p className="text-sm text-leaf">✓ Approved by {t.approval.by.split(" ")[0]} · {time(t.approval.created_at)}</p>}
          {t?.canReview && channel === "all" && (
            <button onClick={() => review("send")} disabled={busy} className="glow-btn rounded-full px-4 py-1.5 text-sm disabled:opacity-60">
              Send for review
            </button>
          )}
        </header>

        {t?.canDecide && channel === "all" && (
          // The review card: the client's answer, on record.
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="border-b border-accent/30 bg-accent/5 px-4 py-3">
            <p className="font-medium">{t.inPerson ? `${t.inPerson} isn't on Arcon: record their answer from your meeting` : "This design is waiting for your review"}</p>
            {/* what's being approved: the plan itself, every floor */}
            {layout && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {layout.floors.map((f) => (
                  <figure key={f.level} className="shrink-0 rounded-xl border border-line bg-paper p-1.5">
                    <PlanSvg layout={layout} level={f.level} units={units} className="h-36 w-auto" />
                    {layout.floors.length > 1 && <figcaption className="text-center text-[11px] text-ink-soft">{f.level === 0 ? "Ground" : "Upstairs"}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="A note (optional): what you love, or what to change" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => review("approve")} disabled={busy} className="rounded-full bg-leaf px-5 py-2 text-sm text-white disabled:opacity-60">
                {t.inPerson ? `✓ ${t.inPerson} approved` : "✓ Approve"}
              </button>
              <button onClick={() => review("changes")} disabled={busy} className="rounded-full border border-line px-5 py-2 text-sm transition hover:border-accent disabled:opacity-60">
                {t.inPerson ? `${t.inPerson} wants changes` : "Ask for changes"}
              </button>
            </div>
          </motion.div>
        )}

        {t?.change && channel === "all" && (
          // A change to the approved design: what changed, what it costs, and the answer, on record.
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="border-b border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <p className="flex flex-wrap items-baseline justify-between gap-2 font-medium">
              <span>Change to the approved design</span>
              <span className="font-mono text-sm text-amber-700">{t.change.cost}</span>
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-ink-soft">
              {t.change.notes.slice(-5).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            {t.change.canDecide ? (
              <>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="A note (optional)" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => review("change-approve")} disabled={busy} className="rounded-full bg-leaf px-5 py-2 text-sm text-white disabled:opacity-60">
                    {t.inPerson ? `✓ ${t.inPerson} approved the change` : "✓ Approve the change"}
                  </button>
                  <button onClick={() => review("change-decline")} disabled={busy} className="rounded-full border border-line px-5 py-2 text-sm transition hover:border-accent disabled:opacity-60">
                    {t.inPerson ? `${t.inPerson} said no` : "Decline, keep it as approved"}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-ink-soft">Waiting for approval. Until then, the approved version (v{t.change.from}) is what gets built.</p>
            )}
          </motion.div>
        )}

        <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {!t && (
            <div className="grid place-items-center py-10">
              <Scanning label="Loading the thread" />
            </div>
          )}
          {t && shown.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">{filter ? "Nothing about this room yet." : "No messages yet. Say hello, ask a question, or share a photo."}</p>}
          {shown.map((m) =>
            m.kind === "event" ? (
              <p key={m.id} className="mx-auto flex max-w-lg items-center justify-center gap-2 text-center text-xs text-ink-soft">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">{ICON[m.data.type ?? ""] ?? "•"}</span>
                <span>{m.body}</span>
                <span className="shrink-0 opacity-70">{time(m.created_at)}</span>
              </p>
            ) : (
              <div key={m.id} className={`flex ${m.author_id === t?.me ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${m.author_id === t?.me ? "bg-btn text-btn-ink" : "bg-paper"}`}>
                  <p className="text-xs opacity-70">
                    {m.author_id === t?.me ? "You" : m.author_name} · {time(m.created_at)}
                  </p>
                  {m.room_name && <p className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs">about: {m.room_name}</p>}
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((a) =>
                        a.type.startsWith("image/") && a.url ? (
                          <a key={a.path} href={a.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url} alt={a.name} className="h-28 w-28 rounded-lg object-cover" />
                          </a>
                        ) : (
                          <a key={a.path} href={a.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line/60 px-2.5 py-1.5 text-xs underline-offset-2 hover:underline">
                            📄 {a.name} · {kb(a.size)}
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </div>

        {t?.canPost ? (
          <footer className="border-t border-line px-3 py-3">
            {(room || files.length > 0) && (
              <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                {room && (
                  <span className="rounded-full bg-accent/15 px-2.5 py-1">
                    about: {room.name}{" "}
                    <button onClick={() => setRoom(null)} aria-label="Remove the room" className="ml-1">
                      ✕
                    </button>
                  </span>
                )}
                {files.map((f) => (
                  <span key={f.path} className="rounded-full border border-line px-2.5 py-1">
                    📎 {f.name}{" "}
                    <button onClick={() => setFiles((x) => x.filter((y) => y.path !== f.path))} aria-label={`Remove ${f.name}`} className="ml-1">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            {picking && layout && (
              <div className="mb-2 rounded-xl border border-line bg-paper p-2">
                <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
                  <span>Tap the room this is about</span>
                  {layout.floors.length > 1 && (
                    <span className="flex gap-1">
                      {layout.floors.map((f) => (
                        <button key={f.level} onClick={() => setLevel(f.level)} className={`rounded-full px-2 py-0.5 ${level === f.level ? "bg-btn text-btn-ink" : ""}`}>
                          {f.level === 0 ? "Ground" : "Upstairs"}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
                <PlanSvg
                  layout={layout}
                  level={level}
                  units={units}
                  className="max-h-64 w-full cursor-pointer"
                  onPick={(x, z) => {
                    const hit = roomAt(layout, level, x, z);
                    if (hit) {
                      tick();
                      setRoom(hit);
                      setPicking(false);
                    }
                  }}
                />
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex gap-1">
                {layout && (
                  <button onClick={() => setPicking((v) => !v)} aria-pressed={picking} title="Tag a room" className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-soft hover:border-accent hover:text-accent">
                    ⌂
                  </button>
                )}
                <label title="Attach photos or files" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-line text-ink-soft hover:border-accent hover:text-accent">
                  {uploading ? "…" : "📎"}
                  <input type="file" multiple className="sr-only" onChange={(e) => void attach(e.target.files)} />
                </label>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder={channel === "team" ? "Message the team (the client doesn't see this)" : "Write a message"}
                aria-label="Message"
                className="max-h-40 min-h-10 flex-1 resize-y rounded-2xl border border-line bg-paper px-3.5 py-2 text-sm outline-none focus:border-accent"
              />
              <button onClick={() => void send()} disabled={busy || uploading || (!text.trim() && !files.length)} className="glow-btn h-10 rounded-full px-5 text-sm disabled:opacity-50">
                Send
              </button>
            </div>
          </footer>
        ) : (
          t && <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">{t.me ? "You can read this thread." : "Sign in to join the conversation."}</p>
        )}
        {error && (
          <p role="alert" className="border-t border-line px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      <aside className="space-y-3">
        {layout && (
          <div className="rounded-2xl border border-line bg-paper-raised p-3">
            <p className="text-sm font-medium">Rooms talked about</p>
            {rooms.length === 0 ? (
              <p className="mt-1 text-xs text-ink-soft">Tag a room (⌂) or use &quot;Discuss this room&quot; in the 3D to talk about one place.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => setFilter(null)} className={`rounded-full px-2.5 py-1 text-xs ${!filter ? "bg-btn text-btn-ink" : "border border-line"}`}>
                  All
                </button>
                {rooms.map((r) => (
                  <button key={r.id} onClick={() => setFilter(r.id)} className={`rounded-full px-2.5 py-1 text-xs ${filter === r.id ? "bg-btn text-btn-ink" : "border border-line"}`}>
                    {r.name} · {r.n}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="px-1 text-xs text-ink-soft">Everything said here stays on the project: who asked for what, and who approved which version.</p>
      </aside>
    </main>
  );
}
