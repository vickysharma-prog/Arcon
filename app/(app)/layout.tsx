import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { USER_COOKIE, verifyUser } from "@/lib/auth/guest";
import { AppShell } from "@/components/shell/AppShell";
import { PageLoading } from "@/components/fx/PageLoading";

// The signed-in app: home, projects, account and the pros directory sit inside the sidebar, which stays put while
// the page on the right changes. Guests (a shared project, a visitor with no account) get the pages as before, with
// the site header. The check is the signed cookie alone, so nothing waits on the database here.

async function Gate({ children }: { children: ReactNode }) {
  const signedIn = !!(await verifyUser((await cookies()).get(USER_COOKIE)?.value, process.env.ARCON_SESSION_SECRET ?? ""));
  return signedIn ? <AppShell>{children}</AppShell> : children;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading label="Opening Arcon" />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
