/* ==================================================================
   IDENTITY — the single place the mascot's name and the demo person's
   name live. Nothing else in src/ may hard-code either string; every
   user-visible mention interpolates from here so a rename is one edit.

   Demo person: this is placeholder roster data, not a real chapter
   member. See the DEMO DATA markers on each demo block and the
   "replace before launch" list in HERO_V3_REPORT.md.
   ================================================================== */

/** The mascot. Spoken by the robot, printed on its label, read by AT. */
export const ROBOT_NAME = "Ruru";

/* Plain text only - never rendered as a link, never an email address.
   The brief forbids inventing contact details, roles, bios or photos
   for the demo person, so this object stops at name parts. */
export const DEMO_PERSON = {
  fullName: "Rudransh Singh",
  firstName: "Rudransh",
  initials: "RS",
  handle: "rudransh-singh",
} as const;

/** Comment string stamped on every block that renders demo data. */
export const DEMO_MARKER = "DEMO DATA: replace before launch";

/** Alt text for a portrait slot, built from the name so it cannot drift. */
export function portraitAlt(name: string = DEMO_PERSON.fullName): string {
  return `Portrait of ${name}`;
}
