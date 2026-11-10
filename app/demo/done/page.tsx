import type { Metadata } from "next";
import { AnimatedMark } from "@/components/AnimatedMark";
import { Decode } from "@/components/fx/Decode";
import { Reveal } from "@/components/fx/Motion";
import { TOUR } from "@/lib/demo/tour";

export const metadata: Metadata = { title: "Thank you · Arcon" };

// The end of the tour: the story in five lines, then the way to try it on a space of their own.
const STORY = [
  ["Taste", "Maya talked about her family and tapped three things she loves. Arcon turned them into a style: words, materials, brands, art and a playlist, each with its source."],
  ["Design", "Arcon drew three plans that fit how she lives, then the 3D, a budget in dollars, a shopping list and the drawings for her builder."],
  ["Team", "Lena the architect and Mike the builder worked from the same project: one thread, the quote, the site, every sign-off. Maya paid each fee with PayPal straight to them, and Arcon drafted the note on every bill."],
  ["Keys", "Ana's apartment went from snag list to handover, and Sam's café was read against the people already on its street."],
];

export default function Done() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* a faint blueprint grid behind it */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(var(--accent)_1px,transparent_1px),linear-gradient(90deg,var(--accent)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="w-full max-w-3xl text-center">
        <div className="flex justify-center">
          <AnimatedMark size={44} />
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">The end of the tour</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
          <Decode text="Thank you for taking the tour." speed={30} />
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">In {TOUR.length} stops you saw one home go from a conversation to its keys, and a café read against its street.</p>
      </div>

      <div className="mt-8 grid w-full max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STORY.map(([k, line], i) => (
          <Reveal key={k} delay={0.15 + i * 0.1}>
            <div className="h-full rounded-2xl border border-line bg-paper-raised/80 p-4 text-left backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                {String(i + 1).padStart(2, "0")} · {k}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{line}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.6}>
        <div className="mt-9 flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-serif text-3xl">Now design your own.</h2>
          <p className="mt-3 text-ink-soft">Any home or business, in any language. Your style, three plans and the 3D from outside are free with no sign-in; sign in and unlock the rest with one PayPal payment. Every answer, plan, change and payment stays on one record that everyone on the project can follow.</p>
          <p className="mt-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-ink-soft">
            PayPal runs in its sandbox here, so no real money moves. Pay with <span className="text-ink">Debit or Credit Card</span> using{" "}
            <span className="font-mono text-ink">4111 1111 1111 1111</span>, any future expiry and any 3-digit code, ZIP <span className="font-mono text-ink">94105</span>, phone <span className="font-mono text-ink">415 555 0100</span>.
          </p>
          <a href="/demo?exit=start" className="glow-btn mt-6 px-9 py-4 text-lg">
            Try it yourself
          </a>
          <div className="mt-5 flex gap-5 text-sm text-ink-soft">
            <a href={`/demo?step=${TOUR.length}`} className="transition hover:text-accent">
              ‹ Back to the tour
            </a>
            <a href="/demo?step=1" className="transition hover:text-accent">
              Watch from the start
            </a>
            <a href="/?site" className="transition hover:text-accent">
              Arcon&apos;s home page
            </a>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
