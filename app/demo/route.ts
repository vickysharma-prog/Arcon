import { NextResponse, type NextRequest } from "next/server";
import { signUser, USER_COOKIE } from "@/lib/auth/guest";
import { DEMO_COOKIE, DEMO_IDS } from "@/lib/demo/ids";
import { DEMO_ROLES, TITLES, type DemoRole } from "@/lib/demo/story";
import { pathOf, stopAt, switchTo, TOUR, type ProjectKey } from "@/lib/demo/tour";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The tour's way in: /demo?step=N signs in as the person whose view that stop is and opens it; ?as=lena&from=…
// switches person on the same page; ?exit leaves (to /start with exit=start). Only the four demo accounts can be
// signed in here, and they are view-only (proxy.ts).
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (q.has("exit")) {
    const start = q.get("exit") === "start";
    const res = go(start ? "/start" : "/?site");
    res.cookies.delete(USER_COOKIE);
    res.cookies.delete(DEMO_COOKIE);
    // a visitor trying it for real designs as anyone would: the preview is free, unlocking is a PayPal payment
    if (start) res.cookies.delete("arcon_judge");
    return res;
  }

  const { data } = await supabaseAdmin().from("projects").select("id, title").in("owner_id", [DEMO_IDS.lena, DEMO_IDS.sam]);
  const ids: Partial<Record<ProjectKey, string>> = {};
  for (const p of data ?? []) {
    const key = (Object.keys(TITLES) as ProjectKey[]).find((k) => TITLES[k] === p.title);
    if (key) ids[key] = p.id;
  }

  const as = q.get("as") as DemoRole | null;
  const was = Number(request.cookies.get(DEMO_COOKIE)?.value.split(".")[0]);
  let step: number, who: DemoRole, to: string;
  if (as && DEMO_ROLES.includes(as)) {
    const from = q.get("from") ?? "/home";
    step = stopAt(was);
    who = as;
    to = switchTo(as, from.startsWith("/") ? from : "/home", ids);
  } else {
    step = stopAt(Number(q.get("step") ?? 1));
    who = TOUR[step - 1].as;
    to = pathOf(TOUR[step - 1], ids);
  }

  const res = go(to);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(USER_COOKIE, await signUser(DEMO_IDS[who], process.env.ARCON_SESSION_SECRET ?? ""), { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  // read by the tour bar: which stop, and whose view
  res.cookies.set(DEMO_COOKIE, `${step}.${who}`, { secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  return res;
}
