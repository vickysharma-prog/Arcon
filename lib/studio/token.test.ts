import { test } from "node:test";
import assert from "node:assert/strict";
import { bearerOf, expiryFrom, hashToken, hintOf, isLive, newToken, TOKEN_PREFIX } from "./token.ts";

test("a new token has the prefix, 43 base64url characters, and is different every time", () => {
  const a = newToken();
  const b = newToken();
  assert.match(a, /^arc_st_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

test("the hash is a stable 64-character hex string, and differs per token", () => {
  const t = newToken();
  assert.equal(hashToken(t), hashToken(t));
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(t), hashToken(newToken()));
});

test("the hint shows only the start of the token", () => {
  const t = newToken();
  const h = hintOf(t);
  assert.ok(h.startsWith(TOKEN_PREFIX));
  assert.ok(h.length < 15);
  assert.ok(!h.includes(t.slice(-10)));
});

test("bearerOf reads a Studio token and ignores anything else", () => {
  const t = newToken();
  assert.equal(bearerOf(`Bearer ${t}`), t);
  assert.equal(bearerOf(`bearer   ${t}`), t);
  assert.equal(bearerOf(t), null);
  assert.equal(bearerOf("Bearer abc"), null);
  assert.equal(bearerOf(`Bearer ${t}x`), null);
  assert.equal(bearerOf(null), null);
});

test("a connection is live until it expires or is revoked", () => {
  const now = new Date("2026-11-08T00:00:00Z");
  assert.equal(isLive({ revoked_at: null, expires_at: "2026-11-09T00:00:00Z" }, now), true);
  assert.equal(isLive({ revoked_at: null, expires_at: "2026-11-07T00:00:00Z" }, now), false);
  assert.equal(isLive({ revoked_at: "2026-11-07T12:00:00Z", expires_at: "2026-12-01T00:00:00Z" }, now), false);
});

test("expiry is the given number of days ahead", () => {
  assert.equal(expiryFrom(new Date("2026-11-08T00:00:00Z"), 90), "2027-02-06T00:00:00.000Z");
});
