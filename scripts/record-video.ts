// Records the film (under a minute): a real run of the app from every side (homeowner, business, architect, client,
// builder), one short beat each, with a caption naming whose view it is. Each beat is recorded only once its page is
// on screen; the beats are joined into one MP4.
// Run with the app on localhost:3000 (npx next build && npx next start -p 3000):
//   FFMPEG_PATH=<ffmpeg.exe> node --env-file=.env.local --env-file=.env scripts/record-video.ts <designId> <builtId> <clientId> <out.mp4>
// designId: the test owner's house, unlocked, still in design. builtId: the test owner's house, built and moved in.
// clientId: a project the test client is on, with an approved design. The film shows Qloo images, so it never goes in
// the repo: it's uploaded to storage (scripts/upload-video.ts).
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";
import { signUser } from "../lib/auth/guest.ts";

const [designId, builtId, clientId, out = "arcon-30s.mp4"] = process.argv.slice(2);
if (!designId || !builtId || !clientId) throw new Error("usage: record-video.ts <designId> <builtId> <clientId> <out.mp4>");
const BASE = "http://localhost:3000";
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const parts = join(dirname(out), "scenes");
rmSync(parts, { recursive: true, force: true });
mkdirSync(parts, { recursive: true });

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data } = await db.auth.admin.listUsers({ perPage: 200 });
const sessions: Record<string, string> = {};
for (const role of ["owner", "business", "architect", "builder", "client"]) {
  const u = data.users.find((x) => x.email === `arcon.test.${role}@example.com`);
  if (!u) throw new Error(`no test ${role}`);
  sessions[role] = await signUser(u.id, process.env.ARCON_SESSION_SECRET!);
}

// the graphics card draws the 3D (software drawing makes the walkthrough crawl)
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--window-size=1280,720"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
async function as(role: string | null) {
  await page.deleteCookie({ name: "arcon_user", domain: "localhost" });
  if (role) await page.setCookie({ name: "arcon_user", value: sessions[role], domain: "localhost", path: "/" });
}

/** Open a page and wait until `text` is on screen, plus a moment for it to settle. */
async function open(path: string, text: string, settle = 1) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.setItem("arcon_cookie_notice", "seen");
    } catch {}
  });
  await page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: 90_000 }, text);
  await wait(settle);
}

/** A caption at the bottom of the frame: whose view it is, and what it shows. */
async function caption(who: string, text: string) {
  await page.evaluate(
    (w, t) => {
      let el = document.getElementById("film-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "film-caption";
        el.setAttribute("style", "position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483647;display:flex;gap:12px;align-items:center;padding:11px 22px;border-radius:999px;background:rgba(10,14,24,.88);color:#fff;font:500 21px/1.3 ui-sans-serif,system-ui,sans-serif;box-shadow:0 18px 50px -20px rgba(59,130,246,.8);white-space:nowrap");
        document.body.appendChild(el);
      }
      el.innerHTML = "";
      if (w) {
        const tag = document.createElement("span");
        tag.textContent = w;
        tag.setAttribute("style", "font:600 12px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#93c5fd;border:1px solid rgba(147,197,253,.5);border-radius:999px;padding:5px 9px");
        el.appendChild(tag);
      }
      el.appendChild(document.createTextNode(t));
    },
    who,
    text,
  );
}

const scenes: string[] = [];
async function beat(name: string, act: () => Promise<void>) {
  const file = join(parts, `${String(scenes.length).padStart(2, "0")}-${name}.webm`) as `${string}.webm`;
  const rec = await page.screencast({ path: file, ffmpegPath: FFMPEG, fps: 30 });
  await act();
  await rec.stop();
  scenes.push(file);
}
const clickText = async (label: string) => {
  for (const b of await page.$$("button")) if ((await b.evaluate((e) => e.textContent?.trim() ?? "")) === label) return void (await b.click());
};

// 1. the opening
await as(null);
await open("/", "spaces designed");
await page.evaluate(() => sessionStorage.removeItem("arcon-intro"));
await page.goto(BASE + "/", { waitUntil: "networkidle2" });
await wait(0.8);
await beat("opening", async () => {
  await page.mouse.click(640, 360);
  await wait(2.4);
  await caption("", "Your AI architect, built around your taste");
  await wait(1);
});

// homeowner: the interview, one tap at a time
await open("/start", "what are we designing", 1.2);
await beat("interview", async () => {
  await caption("Homeowner", "Tell Arcon about your space: tap, type or talk");
  for (const key of ["1", "1"] as const) {
    await wait(0.9);
    await page.keyboard.press(key);
  }
  await wait(0.9);
  await clickText("Not sure, use a typical size");
  await wait(0.9);
  await page.keyboard.press("2");
  await wait(1.2);
});

// 2. homeowner: three picks, and the style
await open("/quiz", "find my style");
await clickText("Find my style");
await page.waitForSelector("main li button img", { timeout: 60_000 });
await wait(1.2);
await beat("taste", async () => {
  await caption("Homeowner", "Three things you love. Qloo reads your style.");
  for (let round = 0; round < 3; round++) {
    await wait(0.55);
    const tiles = await page.$$("main li button");
    await tiles[[1, 2, 0][round]]?.click();
  }
  await page.waitForFunction(() => !document.body.innerText.toLowerCase().includes("reading your taste"), { timeout: 60_000 });
  await wait(1.3);
});

await as("owner");

// homeowner: the style brief
await open(`/project/${designId}?step=brief`, "your style", 2.5);
await beat("brief", async () => {
  await caption("Homeowner", "A style brief: palette and materials, each from a love");
  await page.mouse.wheel({ deltaY: 380 });
  await wait(2.8);
});

// 3. homeowner: three plans
await open(`/project/${designId}?step=plans`, "option 3", 2.5);
await beat("plans", async () => {
  await caption("Homeowner", "Three plans, each honest about its trade-offs");
  await page.mouse.wheel({ deltaY: 200 });
  await wait(2.4);
});

// 4. homeowner: the 3D
await open(`/project/${designId}?step=walkthrough`, "walk", 5);
await page.evaluate(() => document.querySelector("canvas")?.scrollIntoView({ block: "center" }));
await wait(1.2);
await beat("walk", async () => {
  await caption("Homeowner", "Walk through it in 3D, by day or by night");
  await clickText("Walk through");
  await wait(3);
});

// homeowner: look around inside
await beat("look", async () => {
  await caption("Homeowner", "Look around inside, and tap anything for its brand");
  await clickText("Explore inside");
  await wait(0.6);
  const canvas = await page.$("canvas");
  const box = await canvas?.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 260, cy + 10, { steps: 18 });
    await page.mouse.up();
  }
  await wait(2.2);
});

// 5. homeowner: a change by chat, priced
await open(`/project/${designId}?step=workspace`, "make it yours", 2.5);
await beat("change", async () => {
  await caption("Homeowner", "Change anything by chat; the price follows");
  const box = await page.$('input[aria-label="What to change"]');
  await box?.click();
  await box?.type("make the living room bigger", { delay: 28 });
  await page.keyboard.press("Enter");
  await wait(2);
});
// put the house back as it was, so the next take starts from the same plan
await page.evaluate((id) => fetch(`/api/projects/${id}/edit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ undo: true }) }), designId);

// homeowner: the budget, the shopping list and the drawings
await open(`/project/${designId}?step=budget`, "by trade", 1.5);
await beat("budget", async () => {
  await caption("Homeowner", "Priced room by room, in dollars, with a timeline");
  await page.mouse.wheel({ deltaY: 300 });
  await wait(2.6);
});
await open(`/project/${designId}?step=shop`, "shopping", 0.5);
// until the list itself is in, not its loading line
await page.waitForFunction(() => !document.body.innerText.toLowerCase().includes("matching every piece"), { timeout: 90_000 });
await wait(1.5);
await beat("shop", async () => {
  await caption("Homeowner", "A shopping list at your price, from brands you'd love");
  await page.mouse.wheel({ deltaY: 260 });
  await wait(2.6);
});
await open(`/project/${designId}?step=drawings`, "drawings", 2.5);
await beat("drawings", async () => {
  await caption("Homeowner", "A drawings pack for your builder: PDF and DXF");
  await wait(2.6);
});

// 6. business: their café, the crowd and the opening day
await as("business");
await open("/home", "opening", 2);
await beat("business", async () => {
  await caption("Café owner", "Plans for your crowd, a countdown to opening day");
  await wait(2.8);
});

// 7. architect: the studio
await as("architect");
await open("/home?view=pipeline", "pipeline", 3.5);
await beat("architect", async () => {
  await caption("Architect", "Every client by stage, fees by milestone");
  await wait(2.8);
});

// 8. client: approvals on record
await as("client");
await open(`/project/${clientId}?tab=thread`, "approved version", 1.5);
await beat("client", async () => {
  await caption("Client", "Approve the design, and every change, in the thread");
  await wait(2.8);
});

// 9. builder: the sites
await as("builder");
await open("/home?view=today", "today on site", 2);
await beat("builder", async () => {
  await caption("Builder", "Phases, crew, materials; paid by stage");
  await wait(2.8);
});

// 10. moving in
await as("owner");
await open(`/project/${builtId}?tab=site`, "handed over", 1.2);
await beat("movein", async () => {
  await caption("Everyone", "Snags, handover, warranty, reviews. Moved in.");
  await wait(2.6);
});

// 11. the end card
await as(null);
await page.evaluate(() => sessionStorage.setItem("arcon-intro", "1"));
await open("/", "spaces designed", 1);
await beat("end", async () => {
  await caption("", "Arcon · try it free at arcon-ten.vercel.app");
  await wait(2);
});
await browser.close();

// join the beats into one MP4 that plays everywhere
const list = join(parts, "list.txt");
writeFileSync(list, scenes.map((f) => `file '${f.replaceAll("\\", "/")}'`).join("\n"));
const joined = join(parts, "joined.mp4");
execFileSync(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-r", "30", "-an", joined]);
// at most 59 seconds: the beats play a little faster if they ran long
const length = Number(execFileSync(FFMPEG.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace("ffmpeg", "ffprobe")), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", joined]).toString().trim());
const speed = Math.max(1, length / 59);
const seconds = length / speed;
// a soft pad: A major, slowly breathing, made here (nothing licensed)
const tone = (hz: number, amp: number, lfo: number) => `${amp}*sin(2*PI*${hz}*t)*(0.55+0.45*sin(2*PI*${lfo}*t))`;
const pad = [tone(110, 0.05, 0.05), tone(220, 0.05, 0.11), tone(277.18, 0.035, 0.07), tone(329.63, 0.035, 0.09), tone(440, 0.02, 0.13), tone(554.37, 0.012, 0.06)].join("+");
execFileSync(FFMPEG, [
  "-y", "-v", "error", "-i", joined,
  "-f", "lavfi", "-i", `aevalsrc='${pad}':s=44100:d=${seconds.toFixed(2)}`,
  "-filter_complex", `[0:v]setpts=PTS/${speed.toFixed(4)}[v];[1:a]lowpass=f=1400,aecho=0.8:0.6:120:0.25,afade=t=in:d=2,afade=t=out:st=${(seconds - 3).toFixed(2)}:d=3,volume=4[a]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "22", "-r", "30", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out,
]);
console.log("wrote", out, scenes.length, "beats");
