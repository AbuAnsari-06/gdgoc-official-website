import type { GColor } from "./content";
import { DEMO_PERSON } from "../lib/identity";

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
 *  Open "this slot could be you" cards fill the grid up to GRID_SLOTS,
 *  so a short or empty roster never looks broken.
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
  { name: DEMO_PERSON.fullName, role: "Chapter Lead", tag: "Keeps the whole board running", color: "gblue", since: "'23" },
];

/** Number of cards the grid shows before it wraps — ghost slots fill the rest. */
export const GRID_SLOTS = 4;

export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
