# Official GDG brand assets

These are the **official** Google Developer Groups marks. None of them were
drawn, traced, vectorised, recoloured or reconstructed for this site. Treat
them as read-only: replace a file by dropping in a new official export, never
by editing one.

## Source

Downloaded from Google's own GDG chapter platform asset bucket
(`res.cloudinary.com/startup-grind` → `gcs/platform-data-goog/contentbuilder`),
which is what `gdg.community.dev` serves to chapters. The organizer brand kit at
`https://gdg.community.dev/brand/` is behind an organizer login, so the files
below are the platform-published equivalents rather than a fresh kit export.

| File | What it is | Background it is legal on |
| --- | --- | --- |
| `gdg-lockup-1line-black.svg` | Full lockup, one line, full colour mark + dark wordmark (3003×300, vector) | White / very light only |
| `gdg-lockup-1line-black.png` | Same lockup as a 3003×300 raster | White / very light only |
| `gdg-mark-dark.svg` | Full lockup, **reversed** - full colour mark + white wordmark (3003×300, vector) | Saturated colour blocks and dark backgrounds |
| `gdg-lockup-1line-white.png` | Reversed lockup as a 3098×300 raster | Saturated colour blocks and dark backgrounds |
| `gdg-mark-square.png` | Official square app icon / favicon, 800×800, transparent | Any; it is the mark alone |
| `gdg-social-thumbnail.png` | Official 1200×900 social sharing thumbnail | As published |
| `og-card-1200x630.png` | **Derived** - see below | White plate |

## Derived files (generated, not drawn)

`public/brand/gdg/tools/gen-icons.py` resamples the official square mark and/or places it
unmodified on a white plate. That is the only transformation applied.

- `icons/icon-16.png`, `icon-32.png`, `icon-48.png` - resampled square mark
- `icons/icon-192.png`, `icon-512.png` - resampled square mark
- `icons/icon-maskable-512.png` - mark inside the 80% mask-safe zone on white
- `icons/apple-touch-icon-180.png` - mark on white, iOS ignores alpha
- `favicon.ico` - 16/32/48 multi-size container
- `og-card-1200x630.png` - the site's own layout with the full-colour lockup on
  a white plate; rendered from `public/brand/gdg/tools/og-card.html` at 1200×630

Regenerate the icons with `python public/brand/gdg/tools/gen-icons.py`. The social card
source lives in `shots/` because it is a build-time render, not a shipped page.

## Usage rules enforced by `src/components/GdgLogo.tsx`

- No recolouring, stretching, skewing, rotation, outlines, shadows, glows,
  3D/glossy effects, gradients or animation. A plain focus ring is allowed.
- Clear space of at least 0.25× the lockup height on every side
  (`--gdg-clear`), and a minimum width of 96 px for the lockup / 16 px for the
  mark. Below that use the mark on its own.
- Full colour for light backgrounds; the reversed lockup on saturated blocks.
- Always explicit `width`/`height`, so nothing reflows while the SVG loads.
- Primary logo carries meaningful alt text; purely decorative uses pass `alt=""`.

## Wording note

The site's body copy says **GDGoC**, which is the shortening the chapter uses
in conversation. Google's own lockup spells the full **"Google Developer
Groups"** name and carries no "on Campus" line or institution name in these
files, because that lockup is built per chapter inside the organizer portal.
The chapter name is therefore set in site type next to the official lockup,
never redrawn into it. Flagged in `HERO_V3_REPORT.md` under open items.

## Licence

The marks are Google trademarks used by a Google Developer Group on Campus
chapter under the GDG brand guidelines. They are not covered by this project's
licence, may not be used to imply Google endorsement of anything else, and must
be removed if the chapter stops operating.
