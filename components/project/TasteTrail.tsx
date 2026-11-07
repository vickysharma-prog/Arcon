import { sayCredit, type Credit, type Trail } from "@/lib/design/trail";
import { Bar as Grow, HudCard } from "@/components/fx/Motion";

// Where the design came from: each thing the user loves and what it gave, the brands Qloo matched to them,
// and every choice with its source. Built only from evidence, so an empty part is simply left out.

const Bar = ({ value, max }: { value: number; max: number }) => (
  <span aria-hidden className="ml-2 inline-block h-1.5 w-16 rounded-full bg-line align-middle">
    <Grow pct={Math.max(8, Math.round((value / (max || 1)) * 100))} className="h-1.5 bg-gradient-to-r from-btn to-accent" />
  </span>
);

export const Credits = ({ from }: { from: Credit[] }) => <>{from.map(sayCredit).join("; ")}</>;

export function TasteTrail({ trail }: { trail: Trail }) {
  const max = Math.max(0, ...trail.loves.flatMap((l) => l.led.map((b) => b.strength)), ...trail.matched.flatMap((m) => m.to.map((t) => t.strength)));
  if (!trail.loves.length) return null;
  return (
    <section className="mt-14" aria-labelledby="trail">
      <h2 id="trail" className="font-serif text-3xl">Where your style came from</h2>
      <p className="mt-1 text-sm text-ink-soft">What each thing you love gave this design, read through its taste graph.</p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trail.loves.map((l, i) => (
          <li key={l.name}>
          <HudCard className="h-full p-4 text-sm" delay={i * 0.08}>
            <p className="font-medium">{l.name}</p>
            <p className="text-xs uppercase tracking-wider text-ink-soft">{l.kind}</p>
            {l.gave.length > 0 && <p className="mt-2">Gave: {l.gave.join(", ")}</p>}
            {l.led.length > 0 && (
              <ul className="mt-2 space-y-1 text-ink-soft">
                {l.led.map((b) => (
                  <li key={b.name}>
                    Led to {b.name}
                    <Bar value={b.strength} max={max} />
                  </li>
                ))}
              </ul>
            )}
            {!l.gave.length && !l.led.length && <p className="mt-2 text-ink-soft">Shaped the overall match.</p>}
          </HudCard>
          </li>
        ))}
      </ul>

      {trail.choices.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Every choice and where it came from</caption>
            <thead className="text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-2 font-normal">Choice</th>
                <th className="px-4 py-2 font-normal">What</th>
                <th className="px-4 py-2 font-normal">Because of</th>
              </tr>
            </thead>
            <tbody>
              {trail.choices.map((c, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="px-4 py-2 text-ink-soft">{c.what}</td>
                  <td className="px-4 py-2">{c.choice}</td>
                  <td className="px-4 py-2 text-ink-soft">
                    <Credits from={c.from} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
