import { supabaseAdmin } from "../supabase/admin.ts";
import { expiryFrom, hashToken, hintOf, isLive, newToken } from "./token.ts";

// Arcon Studio connections in the database. Only the hash of a token is stored; the token is returned once, on create.

const db = () => supabaseAdmin();

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export type Connection = { id: string; name: string; hint: string; created_at: string; last_used_at: string | null; expires_at: string; revoked_at: string | null };
const COLUMNS = "id, name, hint, created_at, last_used_at, expires_at, revoked_at";
/** A person can't pile up connections without limit. */
export const MAX_LIVE = 5;

export const listConnections = (userId: string) =>
  must<Connection[]>(db().from("studio_tokens").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(20));

/** A new connection for this person: the row, and the token itself (never stored, never shown again). */
export async function createConnection(userId: string, name: string): Promise<{ connection: Connection; token: string }> {
  const live = (await listConnections(userId)).filter((c) => isLive(c));
  if (live.length >= MAX_LIVE) throw new Error(`You already have ${MAX_LIVE} live connections. Disconnect one first.`);
  const token = newToken();
  const connection = await must<Connection>(
    db().from("studio_tokens").insert({ user_id: userId, name, token_hash: hashToken(token), hint: hintOf(token), expires_at: expiryFrom() }).select(COLUMNS).single(),
  );
  return { connection, token };
}

/** Revokes one of this person's connections. Someone else's id changes nothing. */
export const revokeConnection = (userId: string, id: string) =>
  must(db().from("studio_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).is("revoked_at", null));

/** The person a live token acts for, or null. Marks the connection as used (at most once a minute). */
export async function userForToken(token: string): Promise<string | null> {
  const row = await must<{ id: string; user_id: string; revoked_at: string | null; expires_at: string; last_used_at: string | null } | null>(
    db().from("studio_tokens").select("id, user_id, revoked_at, expires_at, last_used_at").eq("token_hash", hashToken(token)).maybeSingle(),
  );
  if (!row || !isLive(row)) return null;
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    await db().from("studio_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  }
  return row.user_id;
}
