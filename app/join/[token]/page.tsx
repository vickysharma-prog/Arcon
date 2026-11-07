import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { JoinButton } from "@/components/account/JoinButton";
import { currentUser } from "@/lib/auth/server";
import { inviteInfo } from "@/lib/project/team";
import { PageLoading } from "@/components/fx/PageLoading";
import { Decode } from "@/components/fx/Decode";
import { ROLE_CAN, ROLE_NAME } from "@/lib/project/access";

export const metadata: Metadata = { title: "You're invited · Arcon" };

const SPACE: Record<string, string> = { house: "house", apartment: "apartment", office: "office", cafe: "café", hotel: "hotel", shop: "shop", studio: "studio" };

async function Invite({ params }: { params: PageProps<"/join/[token]">["params"] }) {
  const { token } = await params;
  const [info, userId] = await Promise.all([inviteInfo(token), currentUser()]);
  const here = `/join/${token}`;

  if (!info || info.state !== "open")
    return (
      <div className="text-center">
        <p className="font-serif text-4xl">{info?.state === "used" ? "This invite was already used" : info?.state === "expired" ? "This invite has expired" : "This invite isn't valid"}</p>
        <p className="mt-3 text-ink-soft">Ask the person who sent it for a new link.</p>
        {info?.state === "used" && userId && (
          <div className="mt-6">
            <JoinButton token={token} />
          </div>
        )}
      </div>
    );

  const place = info.title ?? `A ${SPACE[info.space_type ?? ""] ?? "project"}${info.location ? ` in ${info.location}` : ""}`;
  const first = info.owner?.split(" ")[0];
  const project = first ? `${first}'s design` : place;
  return (
    <div className="text-center">
      {info.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.logo} alt="" className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-line bg-paper-raised object-contain p-1" />
      )}
      <p className="text-xs uppercase tracking-[0.25em] text-accent">You&apos;re invited</p>
      <h1 className="mt-3 font-serif text-5xl leading-tight">
        <Decode text={project} />
      </h1>
      {first && <p className="mt-2 text-ink-soft">{place} · designed around {first}&apos;s taste</p>}
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        {info.from ?? "Someone"} invited you to join as <span className="text-ink">{ROLE_NAME[info.role].toLowerCase()}</span>. {ROLE_CAN[info.role]}.
      </p>
      {userId ? (
        <JoinButton token={token} />
      ) : (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/login?mode=signup&next=${encodeURIComponent(here)}`} className="glow-btn rounded-full px-7 py-3">
            Create a free account
          </Link>
          <Link href={`/login?next=${encodeURIComponent(here)}`} className="rounded-full border border-line px-7 py-3 transition hover:border-accent hover:text-accent">
            I have an account
          </Link>
        </div>
      )}
      <p className="mt-10 text-xs text-ink-soft">Arcon designs spaces around the taste of the people who use them.</p>
    </div>
  );
}

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-10">
        <Suspense fallback={<PageLoading label="Opening your invite" />}>
          <Invite params={params} />
        </Suspense>
      </main>
    </div>
  );
}
