#!/usr/bin/env python
"""Derive the icon set from the OFFICIAL GDG square mark.

Only two operations are performed on the official artwork: resampling it
down, and placing it unmodified on a white plate. Nothing is redrawn,
traced, recoloured or distorted.

    python shots/gen-brand-assets.py

Input : public/brand/gdg/gdg-mark-square.png   (official, 800x800, alpha)
Output: public/brand/gdg/icons/*.png + favicon.ico
"""

import os
from PIL import Image

# this file lives at <repo>/public/brand/gdg/tools/gen-icons.py
HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
OUT = os.path.join(BRAND, "icons")
SRC = os.path.join(BRAND, "gdg-mark-square.png")

os.makedirs(OUT, exist_ok=True)
mark = Image.open(SRC).convert("RGBA")
print("source", mark.size, mark.mode)


def scaled(size, pad_ratio=0.0, plate=None):
    """Resample the mark to `size`, optionally on a plate with padding."""
    inner = int(round(size * (1 - 2 * pad_ratio)))
    m = mark.resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), plate or (0, 0, 0, 0))
    off = (size - inner) // 2
    canvas.alpha_composite(m, (off, off))
    return canvas


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print("wrote", name, img.size, os.path.getsize(path), "bytes")


# Transparent square icons: resample only.
for s in (16, 32, 48, 192, 512):
    save(scaled(s), f"icon-{s}.png")

# Maskable icon: white plate, art inside the 80% safe zone so a circular
# or squircle mask never clips it.
save(scaled(512, pad_ratio=0.20, plate=(255, 255, 255, 255)), "icon-maskable-512.png")

# Apple touch icon: iOS composites onto white and does not honour alpha.
save(scaled(180, pad_ratio=0.14, plate=(255, 255, 255, 255)), "apple-touch-icon-180.png")

# Multi-size ICO for legacy clients.
ico = scaled(48)
ico.save(os.path.join(BRAND, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote favicon.ico")
