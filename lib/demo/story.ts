import type { Answers, TastePick } from "../interview/script.ts";

// The demo: one Los Angeles studio and the people around it, and the interview answers that made each
// project. scripts/demo-world.ts builds the world from these through the real app; the interview replays Maya's.
// Synthetic people only. The taste picks are the quiz's own pictures (their Qloo ids are public entity ids).

export const DEMO_EMAIL = (role: DemoRole) => `arcon.demo.${role}@example.com`;
export const DEMO_ROLES = ["maya", "lena", "mike", "sam"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const PEOPLE: Record<DemoRole, { role: "owner" | "architect" | "builder"; name: string; company: string | null; city: string; label: string }> = {
  maya: { role: "owner", name: "Maya Reyes", company: null, city: "Los Angeles, CA", label: "Homeowner" },
  lena: { role: "architect", name: "Lena Ortiz", company: "Ortiz Studio", city: "Los Angeles, CA", label: "Architect" },
  mike: { role: "builder", name: "Mike Dawson", company: "Dawson Build Co.", city: "Los Angeles, CA", label: "Builder" },
  sam: { role: "owner", name: "Sam Okafor", company: null, city: "Brooklyn, NY", label: "Café owner" },
};

const pick = (slot: TastePick["slot"], id: string, name: string): TastePick => ({ slot, id, name });

/** Maya's house in Silver Lake: the story the tour follows, from the interview to the building site. */
export const MAYA: Answers = {
  type: "house",
  build: "new",
  size: { width: 45, depth: 70, unit: "ft" },
  floors: "2",
  city: "Los Angeles, CA",
  who: ["me", "partner", "kids"],
  kids: ["3", "8"],
  wfh: "yes",
  bedrooms: "3",
  extras: ["office", "guest"],
  kitchen: "open",
  entertaining: "often",
  bedroomsPlace: "apart",
  workVisitors: "no",
  outlook: "garden",
  dislikes: "Our kitchen is dark and closed off, so I can't see the kids while I cook",
  budget: "premium",
  place: pick("place", "ACD6AB9D-654E-42F1-BDA2-6315CFE1259B", "Chateau Marmont"),
  brand: pick("brand", "18D4B0BC-4E4F-4563-809C-1A4B0AC9D39C", "West Elm"),
  media: pick("media", "78CE7AC6-AE59-4EAA-BDAD-A63120B15F7F", "Mad Men"),
};

/** The Parks' single-floor house in Pasadena, with Lena, waiting for their approval. */
export const PARKS: Answers = {
  type: "house",
  build: "new",
  size: { width: 60, depth: 80, unit: "ft" },
  floors: "1",
  city: "Pasadena, CA",
  who: ["me", "partner", "elders"],
  wfh: "no",
  bedrooms: "4",
  extras: ["guest"],
  kitchen: "semi",
  entertaining: "sometimes",
  bedroomsPlace: "apart",
  outlook: "garden",
  dislikes: "",
  budget: "luxury",
  place: pick("place", "4B028C98-18A5-4553-B27A-1A8798A6A383", "Parker Palm Springs"),
  brand: pick("brand", "F9AF49AF-B267-445C-BE2D-1248ACCF28CB", "Design Within Reach"),
  media: pick("media", "DF788007-B5EA-4F29-872B-96BCB8EEC42F", "The Grand Budapest Hotel"),
};

/** Ana's apartment in Santa Monica, with Lena and Mike: in its last week, snags and the handover. */
export const ANA: Answers = {
  type: "apartment",
  build: "reno",
  size: { width: 32, depth: 40, unit: "ft" },
  city: "Santa Monica, CA",
  who: ["me", "pets"],
  wfh: "yes",
  bedrooms: "1",
  extras: ["office"],
  kitchen: "open",
  entertaining: "rarely",
  workVisitors: "no",
  outlook: "either",
  dislikes: "",
  budget: "mid",
  place: pick("place", "15CFD0A3-CBAD-4B7E-9CCA-EE559FB0FAC6", "Aman Tokyo"),
  brand: pick("brand", "E12201A5-CC50-40AF-97AE-C54A2CA303F7", "Muji"),
  media: pick("media", "9B33A620-68CA-49B3-BFCF-F09CCF8AD595", "Spirited Away"),
};

/** Sam's café in Brooklyn, designed by Sam alone, with the neighbourhood read. */
export const SAM: Answers = {
  type: "cafe",
  build: "reno",
  size: { width: 25, depth: 60, unit: "ft" },
  city: "Brooklyn, NY",
  guests: ["locals", "professionals"],
  service: "both",
  cafeKitchen: "prep",
  seats: "24",
  outdoor: "yes",
  budget: "mid",
  place: pick("place", "1056259E-367F-4323-B396-189624FED9CC", "Blue Bottle Coffee"),
  brand: pick("brand", "E12201A5-CC50-40AF-97AE-C54A2CA303F7", "Muji"),
  media: pick("media", "CFB97CDA-1B2D-4F1A-B707-415E76AFC016", "Norah Jones"),
};

export const TITLES = { maya: "Maya's house", parks: "The Parks' house", ana: "Ana's apartment", sam: "The Brooklyn café" } as const;
