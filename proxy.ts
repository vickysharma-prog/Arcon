import { NextResponse, type NextRequest } from "next/server";
import { ensureGuest, GUEST_COOKIE, USER_COOKIE, verifyUser } from "./lib/auth/guest.ts";
import { DEMO_COOKIE, refuseDemo, VIEW_ONLY } from "./lib/demo/ids.ts";

// Every browser gets a signed guest id on its first visit. The agents only answer requests that carry it.
export async function proxy(request: NextRequest) {
  const secret = process.env.ARCON_SESSION_SECRET ?? "";
  const user = await verifyUser(request.cookies.get(USER_COOKIE)?.value, secret);
  // The tour's demo accounts only read: no model calls, deletes or invites, so one visitor can't change the next one's tour.
  // (a local server started with ARCON_DEMO_SEED=1 lets scripts/demo-world.ts build the demo through the app)
  if (process.env.ARCON_DEMO_SEED !== "1" && refuseDemo(user, request.method, request.nextUrl.pathname)) return NextResponse.json({ error: VIEW_ONLY }, { status: 403, headers: { "x-arcon-demo": "view-only" } });
  // Starting a design of their own after the tour (a plain /start, not the tour's replay) leaves the tour, the same way
  // its Try it yourself does: out of the demo account, and no tour bar over their own design.
  // Only a real visit counts: the app prefetches /start (the sidebar's New design) on every page, and following that
  // prefetch out of the tour would sign the visitor out mid-tour.
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.has("next-router-segment-prefetch") || /prefetch/i.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "");
  if (!prefetch && request.nextUrl.pathname === "/start" && request.nextUrl.searchParams.get("demo") !== "1" && request.cookies.has(DEMO_COOKIE))
    return NextResponse.redirect(new URL("/demo?exit=start", request.url));
  // Someone signed in opens the app, not the landing page: their projects.
  if (request.nextUrl.pathname === "/" && !request.nextUrl.search && user) return NextResponse.redirect(new URL("/home", request.url));
  const { set } = await ensureGuest(request.cookies.get(GUEST_COOKIE)?.value, secret);
  // A new guest id also rides on this very request: a cached page drops the cookie set here, so the first call from a
  // page opened by a direct link (an invite, /start, /quiz) would otherwise arrive without one and be refused.
  const headers = new Headers(request.headers);
  if (set) headers.set("cookie", [request.headers.get("cookie"), `${GUEST_COOKIE}=${set}`].filter(Boolean).join("; "));
  const response = NextResponse.next({ request: { headers } });
  if (set)
    response.cookies.set(GUEST_COOKIE, set, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  return response;
}

export const config = {
  // Pages only: skip Next internals, static files and the agent routes themselves.
  // (the backslash is doubled: in a JS string a single one vanishes and the pattern then skipped every path but "/")
  matcher: ["/((?!_next/|eve/|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
