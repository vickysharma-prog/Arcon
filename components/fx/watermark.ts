"use client";

import { seeds, SIZE } from "@/lib/brand/seeds";

// The Arcon watermark on everything people download: a footer with the mark, the name and the tagline. Painted on a
// 2D canvas, so the same code stamps sketches and video frames.

export const TAGLINE = "Spaces designed around who you are";
const SEEDS = seeds();

/** The site's serif, as loaded by the page, for the name. */
const serif = () => getComputedStyle(document.documentElement).getPropertyValue("--font-instrument-serif").trim() || "Georgia, serif";
const sans = () => getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() || "system-ui, sans-serif";

function mark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  const k = size / SIZE;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const s of SEEDS) {
    ctx.fillStyle = s.accent ? "#2f6fed" : "#0e1a2b";
    ctx.beginPath();
    ctx.arc(x + s.x * k, y + s.y * k, s.r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Stamps a w × h canvas with the footer. (No mark behind the picture: its dots read as marks on the drawing.) */
export function stamp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // the footer, bottom left, on a soft white band so it reads on any background
  const u = Math.max(12, Math.round(h * 0.03)); // the unit everything in the footer is sized by
  const pad = u * 0.9;
  const band = u * 2.6;
  ctx.save();
  const g = ctx.createLinearGradient(0, h - band * 1.6, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(255,255,255,0.85)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h - band * 1.6, w, band * 1.6);
  mark(ctx, pad, h - pad - u * 1.7, u * 1.7, 0.9);
  ctx.fillStyle = "rgba(14,26,43,0.9)";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${Math.round(u * 1.25)}px ${serif()}`;
  const x = pad + u * 2.2;
  ctx.fillText("Made with Arcon", x, h - pad - u * 0.75);
  ctx.font = `${Math.round(u * 0.62)}px ${sans()}`;
  ctx.fillStyle = "rgba(14,26,43,0.6)";
  ctx.fillText(`${TAGLINE} · AI architect`, x, h - pad + u * 0.05);
  ctx.restore();
}

/** A PNG (data URL) with the watermark painted on. */
export async function stampPng(png: string): Promise<string> {
  const img = new Image();
  img.src = png;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  stamp(ctx, c.width, c.height);
  return c.toDataURL("image/png");
}
