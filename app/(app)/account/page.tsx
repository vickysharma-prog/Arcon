import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ProfileForm } from "@/components/account/ProfileForm";
import { DeleteAccount } from "@/components/account/DeleteAccount";
import { StudioConnections } from "@/components/account/StudioConnections";
import { currentUser } from "@/lib/auth/server";
import { PageLoading } from "@/components/fx/PageLoading";
import { emailOf, getProfile } from "@/lib/account/profile";

export const metadata: Metadata = { title: "Your account · Arcon" };

const PLAN_NAME = { free: "Free", owner: "Owner", pro: "Pro", build: "Build" } as const;

async function AccountPageBody() {
  const userId = await currentUser();
  if (!userId) redirect(`/login?next=${encodeURIComponent("/account")}`);
  const [profile, email] = await Promise.all([getProfile(userId), emailOf(userId)]);
  if (!profile) redirect("/welcome?next=/account");
  return (
    <main className="flex-1 px-4 py-10 sm:px-8">
      <ProfileForm initial={profile} email={email} next="/home" editing />
      <section className="mx-auto mt-12 w-full max-w-2xl rounded-2xl border border-line bg-paper-raised p-5">
        <p className="text-xs uppercase tracking-widest text-ink-soft">Plan</p>
        <p className="mt-1 font-serif text-2xl">{PLAN_NAME[profile.plan]}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Signed in as {email}.{" "}
          <Link href="/?site#pricing" className="text-accent hover:underline">
            See plans
          </Link>
        </p>
      </section>
      <StudioConnections />
      <DeleteAccount />
    </main>
  );
}

// The header shows at once; the part that needs the signed-in user streams in behind it.
export default function AccountPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<PageLoading label="Loading your account" />}>
        <AccountPageBody  />
      </Suspense>
    </div>
  );
}
