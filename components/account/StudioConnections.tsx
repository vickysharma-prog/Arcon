"use client";

import { useEffect, useState } from "react";
import { tick } from "@/components/fx/sfx";

// Arcon Studio on the account page: connect it to this account (the token shows once, to paste into Studio),
// see which connections exist and when each was last used, and disconnect any of them at once.

type Connection = { id: string; name: string; hint: string; created_at: string; last_used_at: string | null; expires_at: string; revoked_at: string | null };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const live = (c: Connection) => !c.revoked_at && new Date(c.expires_at).getTime() > Date.now();

export function StudioConnections() {
  const [list, setList] = useState<Connection[] | null>(null);
  const [name, setName] = useState("Arcon Studio");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/studio/connections")
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((d: { connections: Connection[] }) => setList(d.connections))
      .catch(() => setList([]));
  useEffect(() => {
    void load();
  }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/studio/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setError(data?.error ?? "Couldn't connect just now. Please try again.");
    setToken(data.token);
    setCopied(false);
    void load();
  }

  async function disconnect(id: string) {
    tick();
    setList((l) => l?.map((c) => (c.id === id ? { ...c, revoked_at: new Date().toISOString() } : c)) ?? l);
    const res = await fetch(`/api/studio/connections/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setError("Couldn't disconnect just now. Please try again.");
    void load();
  }

  const shown = (list ?? []).filter(live);

  return (
    <section className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-line bg-paper-raised p-5" aria-labelledby="studio-heading">
      <p className="text-xs uppercase tracking-widest text-ink-soft">Arcon Studio</p>
      <p id="studio-heading" className="mt-1 font-serif text-2xl">
        Work on your designs with an agent
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        Arcon Studio is a workspace where you and an agent change a design together. The agent proposes, you see the new plan and what it does to the cost, and nothing changes until you approve. A
        connection acts as you, with your role on each project, for 90 days.
      </p>

      {token ? (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4" role="status">
          <p className="text-sm font-medium">Paste this into Arcon Studio. It won&apos;t be shown again.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-paper px-3 py-2 font-mono text-xs">{token}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(token).then(() => setCopied(true));
              }}
              className="rounded-full border border-accent px-4 py-2 text-sm text-accent transition hover:bg-accent hover:text-paper"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={() => setToken(null)} className="rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink">
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            tick();
            void connect();
          }}
        >
          <label className="sr-only" htmlFor="studio-name">
            Name this connection
          </label>
          <input
            id="studio-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="w-56 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || !name.trim()} className="rounded-full bg-accent px-5 py-2 text-sm text-paper transition hover:opacity-90 disabled:opacity-50">
            {busy ? "Connecting…" : "Connect Arcon Studio"}
          </button>
        </form>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {list === null ? (
        <div className="mt-4 h-10 animate-pulse rounded-xl bg-line/40" aria-hidden />
      ) : shown.length > 0 ? (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">
                  {c.name} <span className="font-mono text-xs text-ink-soft">{c.hint}</span>
                </p>
                <p className="text-xs text-ink-soft">
                  Connected {day(c.created_at)} · {c.last_used_at ? `last used ${day(c.last_used_at)}` : "not used yet"} · until {day(c.expires_at)}
                </p>
              </div>
              <button type="button" onClick={() => void disconnect(c.id)} className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft transition hover:border-red-600 hover:text-red-600">
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
