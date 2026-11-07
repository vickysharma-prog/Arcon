import { search, type Entity } from "@/lib/qloo/api";
import { layerOf } from "@/lib/qloo/taste";
import { profileFor } from "@/lib/qloo/profile";
import { cardWords } from "@/lib/interview/logic";
import { styleOf } from "@/lib/three/materials";
import { parsePicks, ROUNDS, sameName, STYLE_NAME, keyOf, type Slot } from "@/lib/quiz/picks";

// The taste quiz, public and with no model call: without ?p= it returns the pictures for the three rounds; with
// ?p=key.key.key (one pick per round, only from the fixed list) it returns the style card, read from Qloo's tags.

async function find(name: string, types: string): Promise<Entity | null> {
  const hit = (await search(name, 1, types).catch(() => []))[0];
  return hit && sameName(name, hit.name) ? hit : null;
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams.get("p");
  if (!p) {
    const rounds = await Promise.all(
      ROUNDS.map(async (r) => ({
        slot: r.slot,
        ask: r.ask,
        options: (await Promise.all(r.names.map(async (n) => ({ n, e: await find(n, r.types) }))))
          .filter((x) => x.e?.properties?.image?.url)
          .map(({ n, e }) => ({ key: keyOf(n), id: e!.entity_id, name: e!.name, image: e!.properties!.image!.url! })),
      })),
    );
    return Response.json({ rounds }, { headers: { "Cache-Control": "public, max-age=3600" } });
  }

  const picks = parsePicks(p);
  if (!picks) return Response.json({ error: "That link isn't a quiz result." }, { status: 400 });
  const found = await Promise.all(ROUNDS.map(async (r) => ({ slot: r.slot as Slot, e: await find(picks[r.slot], r.types) })));
  const known = found.flatMap((f) => (f.e ? [f.e] : []));
  if (known.length < ROUNDS.length) return Response.json({ error: "We couldn't find one of those just now. Try again." }, { status: 502 });
  const signals = known.map((e) => ({ entityId: e.entity_id, name: e.name, layer: layerOf(e) }));
  const taste = await profileFor(signals, new Map(known.map((e) => [e.entity_id, e])));
  const style = styleOf(taste, "");
  return Response.json({
    style: STYLE_NAME[style.style],
    because: style.because,
    words: cardWords(taste),
    brands: taste.brands.slice(0, 4).map((b) => b.name),
    picks: found.map((f) => ({ slot: f.slot, id: f.e!.entity_id, name: f.e!.name, image: f.e!.properties?.image?.url ?? null })),
  });
}
