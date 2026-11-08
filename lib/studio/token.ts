import { createHash, randomBytes } from "node:crypto";

// Arcon Studio connection tokens: random, shown once, stored only as a sha256. Pure, so it is tested without a database.

export const TOKEN_PREFIX = "arc_st_";
/** How long a connection lasts unless it is revoked first. */
export const TOKEN_DAYS = 90;
const SHAPE = /^arc_st_[A-Za-z0-9_-]{43}$/;

/** A new token: the prefix and 32 random bytes in base64url. */
export const newToken = () => TOKEN_PREFIX + randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** What a person sees in the list afterwards to tell connections apart: "arc_st_Ab3d…". */
export const hintOf = (token: string) => `${token.slice(0, TOKEN_PREFIX.length + 4)}…`;

/** The token from an `Authorization: Bearer …` header, or null when there is none or it is not a Studio token. */
export function bearerOf(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return m && SHAPE.test(m[1]) ? m[1] : null;
}

export type TokenRow = { revoked_at: string | null; expires_at: string };

/** A connection still works: not revoked and not past its expiry. */
export const isLive = (row: TokenRow, now = new Date()) => !row.revoked_at && new Date(row.expires_at).getTime() > now.getTime();

export const expiryFrom = (now = new Date(), days = TOKEN_DAYS) => new Date(now.getTime() + days * 86_400_000).toISOString();
