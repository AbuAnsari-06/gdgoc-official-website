import type { GColor } from "./content";

/**
 * ────────────────────────────────────────────────────────────────────
 *  THE CREW ROSTER
 *
 *  Add members by pushing a new object into the `members` array below.
 *  That's it — the grid, avatars and hover effects pick them up
 *  automatically.
 *
 *    name  : full name shown on the card
 *    role  : role / title (keep it short)
 *    tag   : one short line — what they're into
 *    color : "gblue" | "gred" | "gyellow" | "ggreen"  (avatar ring)
 *    since : year they joined (shown as "since 'YY")
 *
 *  Ghost "reserved" slots auto-fill the grid up to 8 cards, so an
 *  empty roster never looks broken.
 * ────────────────────────────────────────────────────────────────────
 */

export interface Member {
  name: string;
  role: string;
  tag: string;
  color: GColor;
  since: string;
}

export const members: Member[] = [
  // ── sample roster · replace these with your actual crew ──────────
  { name: "Aarav Malhotra", role: "Chapter Lead", tag: "Keeps the whole board running", color: "gblue", since: "'23" },
  { name: "Sanya Verma", role: "Technical Lead", tag: "Reviews every PR, kindly-ish", color: "gred", since: "'23" },
  { name: "Kabir Anand", role: "Open Source Lead", tag: "Good-first-issue hunter", color: "ggreen", since: "'24" },
  { name: "Ishita Rao", role: "Events & Community", tag: "Turns ideas into packed rooms", color: "gyellow", since: "'24" },
  { name: "Dev Patel", role: "Web Lead", tag: "Ships URLs, not slide decks", color: "gblue", since: "'24" },
  { name: "Mira Joshi", role: "Design Lead", tag: "Figma files with feelings", color: "gred", since: "'25" },
];

/** Number of cards the grid shows before it wraps — ghost slots fill the rest. */
export const GRID_SLOTS = 8;

export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
