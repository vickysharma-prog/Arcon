import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_IDS, refuseDemo } from "./ids.ts";

test("a demo account can read and see the taste card, but can't change anything", () => {
  const lena = DEMO_IDS.lena;
  assert.equal(refuseDemo(lena, "GET", "/api/projects/x/site"), false);
  assert.equal(refuseDemo(lena, "POST", "/api/interview/taste"), false);
  assert.equal(refuseDemo(lena, "DELETE", "/api/session"), false);
  // Arcon drafting a fee note saves nothing; sending the bill or paying stays refused
  assert.equal(refuseDemo(lena, "POST", "/api/projects/53815dca-b4f2-447e-8d78-4e6bffe36c24/fees/77/note"), false);
  assert.equal(refuseDemo(lena, "POST", "/api/projects/53815dca-b4f2-447e-8d78-4e6bffe36c24/fees/77"), true);
  assert.equal(refuseDemo(lena, "POST", "/api/projects/53815dca-b4f2-447e-8d78-4e6bffe36c24/fees/77/note/x"), true);
  assert.equal(refuseDemo(lena, "POST", "/api/paypal/orders"), true);
  for (const [m, p] of [["POST", "/api/projects/x/site"], ["POST", "/api/projects/x/design"], ["DELETE", "/api/account"], ["POST", "/api/projects/x/team"], ["PATCH", "/api/profile"], ["POST", "/api/interview"]])
    assert.equal(refuseDemo(lena, m, p), true, `${m} ${p}`);
});

test("real people are never stopped", () => {
  assert.equal(refuseDemo("7d993e9e-2480-4d6f-802d-12b5b3ae3364", "POST", "/api/projects/x/site"), false);
  assert.equal(refuseDemo(null, "POST", "/api/interview"), false);
});
