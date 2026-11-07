import { createHash } from "node:crypto";
import { supabaseAdmin } from "../supabase/admin.ts";

// Key limits: 5 requests per second, 10,000 per month. Every response is cached in Supabase,
// so local development and the live app share one cache and a repeat question never spends quota.

const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const GAP_MS = 220; // just under 5 per second
// ponytail: spacing is per server instance; a shared limiter is needed only if 429s show up under load.

let next = 0;
async function slot() {
  const now = Date.now();
  const wait = Math.max(0, next - now);
  next = Math.max(now, next) + GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

export type Params = Record<string, string | number | boolean | undefined>;

function cacheKey(path: string, params: Params) {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(path + JSON.stringify(sorted)).digest("hex");
}

async function fetchQloo(path: string, params: Params): Promise<unknown> {
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
  );
  for (let attempt = 0; ; attempt++) {
    await slot();
    const res = await fetch(`${BASE}${path}?${query}`, { headers: { "X-Api-Key": process.env.QLOO_API_KEY! } });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`Qloo ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

export async function qloo<T = unknown>(path: string, params: Params): Promise<T> {
  const key = cacheKey(path, params);
  const db = supabaseAdmin();
  const { data } = await db.from("qloo_cache").select("body").eq("key", key).maybeSingle();
  if (data) return data.body as T;
  const body = await fetchQloo(path, params);
  await db.from("qloo_cache").upsert({ key, path, body });
  return body as T;
}
