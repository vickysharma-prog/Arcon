import { test } from "node:test";
import assert from "node:assert/strict";
import { designView } from "./view.ts";
import type { Layout } from "../layout/schema.ts";
import type { Project } from "../project/store.ts";

const layout: Layout = {
  spaceType: "house",
  shell: { width: 10, depth: 8 },
  floors: [
    {
      level: 0,
      spaces: [
        { id: "living", name: "Living room", kind: "living", zone: "public", rect: { x: 0, y: 0, w: 6, h: 4 } },
        { id: "hall", name: "Hall", kind: "corridor", zone: "circulation", rect: { x: 6, y: 0, w: 1.2, h: 8 } },
        { id: "kitchen", name: "Kitchen", kind: "kitchen", zone: "service", rect: { x: 0, y: 4, w: 3.33, h: 3 }, open: false },
      ],
      openings: [],
    },
  ],
  concept: { id: "courtyard", name: "Around a courtyard", why: ["Quiet bedrooms at the back, as you asked"] },
};

const project = { id: "p1", title: "Asha's home", space_type: "house", status: "ready", site: { location: "Pune, India", units: "metric" } } as unknown as Project;

test("rooms leave out corridors and stairs, but every space is kept for drawing", () => {
  const v = designView(project, layout, "owner", true, 3, false, "https://arcon.example");
  assert.deepEqual(v.rooms.map((r) => r.id), ["living", "kitchen"]);
  assert.equal(v.spaces.length, 3);
});

test("areas are in square metres to one decimal, and a closed kitchen says so", () => {
  const v = designView(project, layout, "owner", true, 3, false, "https://arcon.example");
  assert.equal(v.rooms.find((r) => r.id === "living")!.area, 24);
  assert.equal(v.rooms.find((r) => r.id === "kitchen")!.area, 10);
  assert.equal(v.rooms.find((r) => r.id === "kitchen")!.open, false);
  assert.equal("open" in v.rooms.find((r) => r.id === "living")!, false);
});

test("the view carries the version, role, concept and a link back to Arcon", () => {
  const v = designView(project, layout, "architect", true, 7, true, "https://arcon.example");
  assert.equal(v.version, 7);
  assert.equal(v.role, "architect");
  assert.equal(v.locked, true);
  assert.equal(v.concept?.name, "Around a courtyard");
  assert.equal(v.url, "https://arcon.example/project/p1");
  assert.equal(v.location, "Pune, India");
});
