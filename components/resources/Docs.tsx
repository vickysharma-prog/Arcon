"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Decode } from "@/components/fx/Decode";
import { tick } from "@/components/fx/sfx";
import { FAQ } from "@/lib/content/faq";

// Resources: everything to understand Arcon, in one page with a contents list that follows the reading. Guides for
// each kind of person, how Arcon works inside, questions people ask, and a guide for developers.

type Section = { id: string; group: string; title: string; body: ReactNode };

const Steps = ({ items }: { items: string[] }) => (
  <ol className="mt-4 space-y-2">
    {items.map((s, i) => (
      <li key={i} className="flex gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/40 font-mono text-[11px] text-accent">{i + 1}</span>
        <span>{s}</span>
      </li>
    ))}
  </ol>
);

const Sub = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mt-8">
    <h3 className="font-serif text-2xl">{title}</h3>
    {children}
  </div>
);

const Code = ({ children }: { children: string }) => (
  <pre className="mt-4 overflow-x-auto rounded-2xl border border-line bg-paper p-4 font-mono text-[13px] leading-relaxed">
    <code>{children}</code>
  </pre>
);

const SECTIONS: Section[] = [
  {
    id: "start",
    group: "Get started",
    title: "Arcon in two minutes",
    body: (
      <>
        <p>
          Arcon is an AI architect. You talk to it about who you are and what you love; it reads your taste through a taste graph and designs your space from it: a floor plan, a 3D walkthrough by day and night, a budget in your currency, a shopping list and a timeline. Then it stays with the project through review, approval and building.
        </p>
        <Steps
          items={[
            "Tell Arcon about the space: what it is, where, how big, who uses it, your budget.",
            "Find your style: pick a few places, brands, films or music you love. Arcon reads what they have in common.",
            "Choose one of three plans, each with what it does best and what it gives up, or upload your own.",
            "Walk through it in 3D, change anything by chat, and see the budget follow.",
            "Share it with your architect, client or builder, approve it, follow the build and move in.",
          ]}
        />
        <p className="mt-4">
          <Link href="/start" className="text-accent hover:underline">Start a design</Link> · <Link href="/quiz" className="text-accent hover:underline">Find your style in three taps</Link>
        </p>
      </>
    ),
  },
  {
    id: "home",
    group: "Get started",
    title: "Your home page",
    body: (
      <>
        <p>Once you sign in, Arcon works like an app: a sidebar on the left with your tools and every project, and the page on the right.</p>
        <Steps
          items={[
            "The sidebar: your tools first (home, Waiting on you, Inbox), then your projects. The project in front of you opens out into its parts: overview, style, plans, 3D, changes, thread, site, budget, shopping, drawings and team, one click each. Your profile is at the bottom; Ctrl+B folds the sidebar to icons, and on a phone it slides in from the menu button.",
            "Your home opens on the project you last had open: its plan drawing itself, View in 3D, where it stands, what's next and an estimate, and below it everything waiting on you.",
            "Waiting on you: a design to review, changes asked, a fee to pay or confirm, work running late on site, a plan to choose, new messages. The most urgent comes first; tap one to go straight there.",
            "The bell: what happened on your projects. Each one is marked read when you open it, and takes you to the right place.",
          ]}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["My spaces", "Owners, of a home or a business. Your newest project in focus: its plan drawing itself, View in 3D, where it stands, what's next and an estimate; for a café, office, shop or hotel, a countdown to opening day too."],
            ["Studio", "Architects and designers. Pipeline (every client in columns by stage), requests from owners, and the fee ledger: billed, to confirm, received and overdue."],
            ["Sites", "Builders. Today on every site, Crew & wages (who's where, days and pay this week), Materials & deliveries (on the way, late, running low), Site money (budget against spend) and fees."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-paper p-4">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "shortcuts",
    group: "Get started",
    title: "Search, shortcuts and the app",
    body: (
      <>
        <Steps
          items={[
            "Press Ctrl+K (⌘K on a Mac), or the search box at the top right, to jump anywhere: a project, or one part of it such as its budget, thread, site or 3D. Type any words in any order, like \"austin budget\".",
            "Get the app, at the top of every page: on a phone it installs Arcon to your home screen; on a computer it shows a code to scan for your phone, and in Chrome or Edge installs Arcon in its own window.",
            "The landing page plays Arcon's opening once a visit; a link someone sends you (an invite, a shared project) goes straight to what it points at. Your theme and sound settings are in the profile menu.",
          ]}
        />
      </>
    ),
  },
  {
    id: "account",
    group: "Get started",
    title: "Deleting a project or your account",
    body: (
      <>
        <p>Everything you make in Arcon is yours to remove, at any time.</p>
        <Steps
          items={[
            "A project: the bin on its card in your home page, or Delete this project at the bottom of its overview. Only its owner can, and it goes for everyone on it, with its thread, files and site.",
            "Your account: Delete my account at the bottom of your account page, after typing DELETE. Every project you own goes with it; projects others shared with you stay with them.",
          ]}
        />
      </>
    ),
  },
  {
    id: "homeowners",
    group: "Guides",
    title: "For homeowners",
    body: (
      <>
        <p>My spaces puts your newest project in focus, with where it stands and what happens next.</p>
        <Steps
          items={[
            "Try it free as a guest: the interview, your style, three plans and the 3D from outside. Sign in to keep the project; it moves to your account with everything in it.",
            "Unlock the project once (signed in) to open the walkthrough, budget, shopping list, changes by chat and the drawings pack.",
            "Invite your architect or builder from Team, by link or QR code. Everyone talks in the project's thread.",
            "When your architect sends the design for review, the plan is right there in the thread: approve it or ask for changes. On your own, you approve it in one step. A change after approval comes to you with what it does to the cost.",
            "Once building starts, follow progress, photos and spending in the Site tab, or run the build yourself.",
            "When the build is finished, walk through it and list anything to fix in Move in; the builder fixes each one and you sign it off. Accept the handover to move in: the warranty starts that day, and you can review your architect and builder.",
          ]}
        />
      </>
    ),
  },
  {
    id: "business",
    group: "Guides",
    title: "For business owners",
    body: (
      <>
        <p>Cafés, offices, shops and hotels get everything a home does, plus two things a business needs.</p>
        <Steps
          items={[
            "How you run it: tell Arcon how the place works (takeaway or table service, the kitchen, how many seats and people) or name a place you love, and the plans are ranked for it.",
            "The neighbourhood read: the local favourites around your site, the crowd they draw and their decor, so your space fits the street and stands out on it.",
          ]}
        />
      </>
    ),
  },
  {
    id: "architects",
    group: "Guides",
    title: "For architects and designers",
    body: (
      <>
        <p>Studio is two things in one: an AI design partner that does the slow first weeks of a project, and the software to run every client from the first link to the handover. Studio is your home: Pipeline lays every client out by stage, Requests holds owners asking for you, and the fee ledger shows every milestone across projects, with what&apos;s overdue.</p>
        <Sub title="What Arcon's AI does for you">
          <Steps
            items={[
              "Reads your client before you meet: send a link and they answer at home (typed, tapped or spoken, in English, Hindi or Hinglish), or answer together in your meeting. Arcon reads their style from the films, places and brands they love, and every choice in the design says which love it came from.",
              "Draws three plans on day one: the layout engine fits their rooms to the plot three ways and checks each against building rules. Each option says what it does best and what it gives up. Or upload the plan you already have and Arcon reads it into an editable layout.",
              "Builds the rest of a first presentation: the 3D walkthrough by day and night, the outside from their taste, a style brief with palette and materials, a budget in their currency, a timeline, a green score and a shopping list at their price level.",
              "Takes changes by chat: type \"make the kitchen bigger\" or \"add a study\" and the plan, budget and drawings follow in seconds. A room that needs space takes it from the rooms around it, and the building can grow into the garden, never past the plot.",
              "Exports the drawings pack: dimensioned plans, all four elevations, door and window schedules, as PDF and DXF for CAD, with your studio's name and logo.",
            ]}
          />
        </Sub>
        <Sub title="What you run in Arcon">
          <Steps
            items={[
              "Pipeline: every client by stage (getting to know them, design, review, approved, building, moved in), and Waiting on you with what needs you first.",
              "Review and approval: send a version for review; the client approves it or asks for changes in the thread, with the plan in front of them. An approved version is locked: any later change goes to the client as a change request, with what it does to the cost, and is only built once approved. A client who isn't on Arcon? Record their answer from your meeting.",
              "The thread: everyone on the project talks in one place, room by room, with every approval and change on record. A team-only channel opens when a builder joins.",
              "Fees by milestone: set out your fee once and Arcon splits it into design, approval and handover; change any name or amount. Bill each one, the client marks it paid, you confirm. The fee ledger shows every milestone across projects.",
              "Your team: invite the builder by link or QR (Team opens on Builder), or let the owner find one through Find a pro.",
              "Your studio: your name and logo on client links, the thread and every drawing; owners find you in Find a pro by how close your past work is to their taste, and your reviews show there after each handover.",
            ]}
          />
        </Sub>
        <Sub title="A client project, start to finish">
          <Steps
            items={[
              "New client: their name, the kind of space and the city. Fill it in together now, or send them a link.",
              "They answer; you're told when they've finished. The design starts on its own and they see their style revealed.",
              "Pick a plan, make it yours by chat, and send it for review.",
              "They approve; set out your fees; invite the builder.",
              "The builder runs the site; you follow phases, photos and the budget, and approve any change.",
              "Snags, the handover pack and the warranty; the client accepts the handover and reviews you.",
            ]}
          />
        </Sub>
        <Sub title="What it costs">
          <p className="mt-2">Studio is $99 a month, or $990 a year (two months free), with 14 days free to start. Every client project is unlocked; your clients pay nothing.</p>
        </Sub>
      </>
    ),
  },
  {
    id: "builders",
    group: "Guides",
    title: "For builders",
    body: (
      <>
        <p>Build is the software to run your sites, with the design and its numbers already done. Sites is your home: today on every site, your crew&apos;s week and wages across sites, every delivery on the way, and each site&apos;s budget against what it has cost.</p>
        <Sub title="What Arcon does for you">
          <Steps
            items={[
              "A site plan from the approved design: phases with dates from the design's timeline, and materials taken off the plan with quantities and costs.",
              "Design-and-build: start a client yourself (New client), and Arcon gives you the interview, their style, three plans, the 3D and a budget, the same as an architect gets.",
              "Alerts when a phase runs late, for you and the client.",
            ]}
          />
        </Sub>
        <Sub title="What you run in Arcon">
          <Steps
            items={[
              "Today: who's on site, what's due and what needs attention, on every site.",
              "Crew and wages: add your crew once, mark attendance on each site each day, and see days and pay for the week across sites.",
              "Materials and deliveries: order, track what's on the way and what's late, and see stock running low.",
              "Site money: each site's budget against what it has cost in labour and materials. Your own costs, wages and margins are never shown to the client.",
              "Updates: post photos and progress from your phone; the client follows the build and the budget.",
              "Paid by stage of the build: deposit, foundations and structure, electrical and plumbing, finishes and handover, each one editable. Bill each one when it's done; the client marks it paid and you confirm.",
              "Moving in: the client lists snags room by room, you fix them, they sign each off. Hand over the pack (warranty, notes and drawings); the client accepts the handover and the warranty starts that day. Their review shows on your profile in Find a pro.",
              "Requests: owners who find you through Find a pro ask you to join. You see their design first, then accept or decline right on the project.",
            ]}
          />
        </Sub>
        <Sub title="What it costs">
          <p className="mt-2">Build is $299 a month, or $2,990 a year, with 14 days free to start. Every site; your clients pay nothing.</p>
        </Sub>
      </>
    ),
  },
  {
    id: "how",
    group: "How it works",
    title: "From taste to a design",
    body: (
      <>
        <p>
          Every design decision in Arcon can be traced back to something you said you love. The strip under the top of the{" "}
          <Link href="/?site" className="text-accent hover:underline">home page</Link> shows it live: two loves, and what Arcon reads from them right now.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["The interview", "Arcon asks about the space and about you, one question at a time, in English, Hindi or Hinglish, typed, tapped or spoken."],
            ["The taste graph", "The things you name are matched in a taste graph of places, brands, films and music, which returns what they share: decor, ambience, price level, and brands and places that match."],
            ["The brief", "A style name and its words, a palette, materials and a moodboard, each linked to the taste behind it."],
            ["The plans", "A layout engine fits your rooms to the site three ways and checks each one against building rules."],
            ["3D and moods", "Each room gets a mood and light from the ambience of the places you love, by day and by night."],
            ["Budget and shopping", "Real cost tables for your market, in your currency, and brands at your price level, a tier up and a tier down."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-paper p-4">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "faq",
    group: "How it works",
    title: "Questions",
    body: (
      <dl className="divide-y divide-line">
        {FAQ.map((f) => (
          <div key={f.q} className="py-4 first:pt-0">
            <dt className="font-medium">{f.q}</dt>
            <dd className="mt-1 text-ink-soft">{f.a}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    id: "developers",
    group: "Developers",
    title: "Developer guide",
    body: (
      <>
        <p>
          Arcon is a Next.js app (App Router, React, Tailwind) with three.js for the 3D, Supabase for accounts, data and files, a taste graph API for taste, and an AI model for the brief, the room list and changes by chat. The interview is a script that asks one question at a time and never waits on a model; an interviewer agent built with eve (agents/interviewer, with its own tools, instructions and evals) is mounted at /eve/interviewer.
        </p>
        <Code>{`app/          pages and API routes
components/   screens; components/fx holds the shared sounds and motion
lib/          the logic, each part with its tests beside it (*.test.ts)
agents/       the interviewer agent: instructions, tools, evals
db/migrations the database tables, applied in order
scripts/      tools for checking against the real services`}</Code>
        <p className="mt-6 font-medium">Run it</p>
        <Code>{`npm install
cp .env.example .env.local   # Supabase, taste and model keys
npm run migrate               # creates the tables
npm run dev                   # http://localhost:3000
npm test                      # unit tests`}</Code>
        <p className="mt-6 font-medium">The API</p>
        <p className="mt-1 text-sm text-ink-soft">Every route checks who is asking and their role on the project before it answers.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-line">
              {[
                ["POST /api/interview", "every answer of the interview: checked, the taste picks confirmed, the project created"],
                ["POST /api/taste", "names you love → taste entities and tags"],
                ["GET /api/projects/:id", "a project and your role on it"],
                ["POST /api/projects/:id/design", "brief, three plans and their trade-offs"],
                ["POST /api/projects/:id/choose", "pick a plan"],
                ["POST /api/projects/:id/edit", "a change by chat; saves a new version"],
                ["GET /api/projects/:id/budget", "the budget by room, in local currency"],
                ["GET /api/projects/:id/shopping", "taste-matched brands and local stores"],
                ["GET /api/projects/:id/neighbourhood", "the business neighbourhood read"],
                ["GET|POST /api/projects/:id/thread", "the project thread"],
                ["GET|POST /api/projects/:id/site", "phases, crew, materials, updates"],
                ["GET|POST /api/projects/:id/team", "who is on it, and invite links by role"],
                ["POST /api/projects/:id/review", "send for review, approve, ask for changes, answer a change request"],
                ["GET|POST /api/projects/:id/fees", "fee milestones: set out, bill, paid, received"],
                ["GET|POST /api/projects/:id/movein", "snags, the handover pack, accepting the handover, reviews"],
                ["POST /api/projects/:id/unlock", "unlock a project (its owner, signed in)"],
                ["GET /api/shell", "the sidebar: your tools, counts and projects"],
                ["GET /api/pros", "find an architect or builder by taste match"],
                ["POST /api/projects/:id/opening", "set a business's opening day (owner only)"],
                ["DELETE /api/projects/:id", "delete a project (owner only)"],
                ["DELETE /api/account", "delete your account"],
                ["GET /api/palette", "your projects, for Ctrl+K"],
                ["GET /api/strip", "the landing page's live taste reads"],
                ["GET /api/quiz", "the style quiz: three picks → your style"],
                ["POST /api/email-check", "can this address receive mail?"],
              ].map(([r, d]) => (
                <tr key={r}>
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-[13px] text-accent">{r}</td>
                  <td className="py-2 text-ink-soft">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "privacy",
    group: "Developers",
    title: "Data and privacy",
    body: (
      <p>
        What Arcon stores, why, and how to delete it is in the <Link href="/privacy" className="text-accent hover:underline">privacy page</Link>. Taste data from our taste-data provider is used to design your project and cached only to keep it fast.
      </p>
    ),
  },
];

export function Docs() {
  const [active, setActive] = useState(SECTIONS[0].id);

  // the contents list follows the section being read
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">&gt; resources</p>
      <h1 className="mt-3 font-serif text-5xl sm:text-6xl">
        <Decode text="Understand Arcon" />
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">Guides for each way of using Arcon, how it turns taste into a design, answers to common questions, and a guide for developers.</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start">
          {/* on a phone the contents scroll sideways above the text */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-6 lg:overflow-visible lg:px-0">
            {groups.map((g) => (
              <div key={g} className="contents lg:block">
                <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft lg:block">{g}</p>
                <ul className="contents lg:mt-2 lg:block lg:space-y-0.5 lg:border-l lg:border-line">
                  {SECTIONS.filter((s) => s.group === g).map((s) => (
                    <li key={s.id} className="relative shrink-0">
                      <a
                        href={`#${s.id}`}
                        onClick={() => tick()}
                        className={`block whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition lg:rounded-none lg:border-0 lg:py-1 lg:pl-4 ${active === s.id ? "border-accent text-accent" : "border-line text-ink-soft hover:text-ink"}`}
                      >
                        {active === s.id && <motion.span layoutId="docs-mark" className="absolute -left-px top-0 hidden h-full w-0.5 bg-accent lg:block" />}
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-16">
          {SECTIONS.map((s) => (
            <motion.section
              key={s.id}
              id={s.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="scroll-mt-24"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">{s.group}</p>
              <h2 className="mt-1 font-serif text-3xl sm:text-4xl">{s.title}</h2>
              <div className="mt-4 leading-relaxed">{s.body}</div>
            </motion.section>
          ))}
        </div>
      </div>
    </main>
  );
}
