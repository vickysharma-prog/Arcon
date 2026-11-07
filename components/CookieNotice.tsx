"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "arcon_cookie_notice";

// Arcon sets one essential cookie and no tracking cookies, so this is a notice, not a consent form.
export function CookieNotice() {
  const [show, setShow] = useState(false);
  // the interview's answers fill the middle of the screen: there it sits at the top on a phone, in a corner on a wider screen
  const [top, setTop] = useState(false);
  useEffect(() => {
    setTop(/^\/(start|quiz)/.test(location.pathname));
    try {
      // the tour has its own bar at the bottom; the notice would sit under it
      setShow(localStorage.getItem(KEY) !== "seen" && !document.cookie.includes("arcon_demo="));
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div role="region" aria-label="Cookie notice" className={`fixed inset-x-4 z-50 ${top ? "top-16 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:top-auto sm:max-w-sm" : "bottom-4 mx-auto max-w-xl"} flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper-raised px-4 py-3 text-sm shadow-sm sm:flex-nowrap`}>
      <p className="flex-1 text-ink-soft">
        Arcon uses one essential cookie to keep your project. No tracking, no ads.{" "}
        <Link href="/privacy" className="text-ink underline underline-offset-2">
          Privacy
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "seen");
          } catch {}
          setShow(false);
        }}
        className="rounded-full bg-btn px-4 py-1.5 text-btn-ink"
      >
        Got it
      </button>
    </div>
  );
}
