#!/usr/bin/env python3
"""Palettize the gallery posters to the game's own colour palette.

Reads art/source/spaceN.* and src/core.js (for the palette), and writes indexed PNGs to
assets/gallery/ in four sizes per poster:

    thumb  grid thumbnail on the touch screen
    card   art window of the trading card on the top screen
    wall   framed "museum wall" view on the top screen
    fit    zoom view, overview: the whole poster across both screens
    hi     zoom view, zoomed in: twice that size, panned with the stylus

Each poster keeps only its K most used palette colours, which gives flat, 2600-style colour
areas instead of noise. Run from the repo root:  python3 tools/make_gallery.py
"""
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'source')
OUT = os.path.join(ROOT, 'assets', 'gallery')

VIEW = (256, 384)            # both screens as one tall viewport
SIZES = {'thumb': (56, 40), 'card': (124, 120), 'wall': (224, 148)}
K = 14                       # colours kept per poster
SPREAD = 46                  # dither strength, in 0..255 colour units


def load_palette():
    text = open(os.path.join(ROOT, 'src', 'core.js')).read()
    block = re.search(r"const P = \{(.*?)\n\};", text, re.S).group(1)
    cols = re.findall(r"'#([0-9a-fA-F]{6})'", block)
    return np.array([[int(c[i:i + 2], 16) for i in (0, 2, 4)] for c in cols], dtype=np.float64)


def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def bayer(n):
    m = np.array([[0, 2], [3, 1]])
    while m.shape[0] < n:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return (m + 0.5) / (n * n)


BAYER = bayer(8)


def nearest(img, pal_lab):
    """Palette index for every pixel of an (H, W, 3) float array, with ordered dithering."""
    h, w, _ = img.shape
    ys, xs = np.mgrid[0:h, 0:w]
    a = np.clip(img + (BAYER[ys % 8, xs % 8][..., None] - 0.5) * SPREAD, 0, 255)
    out = np.empty((h, w), dtype=np.int32)
    for y0 in range(0, h, 64):                       # chunked to keep memory modest
        lab = srgb_to_lab(a[y0:y0 + 64])
        d = ((lab[:, :, None, :] - pal_lab[None, None, :, :]) ** 2).sum(-1)
        out[y0:y0 + 64] = d.argmin(-1)
    return out


def contain(w, h, bw, bh):
    s = min(bw / w, bh / h)
    return max(1, round(w * s)), max(1, round(h * s))


def save_indexed(idx, pal, path):
    used = np.unique(idx)
    remap = np.zeros(len(pal), dtype=np.uint8)
    remap[used] = np.arange(len(used))
    im = Image.fromarray(remap[idx].astype(np.uint8), 'P')
    flat = []
    for u in used:
        flat += [int(v) for v in pal[u]]
    im.putpalette(flat + [0] * (768 - len(flat)))
    im.save(path, optimize=True)
    return os.path.getsize(path)


def main():
    pal = load_palette()
    pal_lab = srgb_to_lab(pal)
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for n in range(1, 13):
        name = next(f for f in os.listdir(SRC) if f.split('.')[0] == 'space%d' % n and f.lower().endswith(('.jpg', '.png', '.webp')))
        im = Image.open(os.path.join(SRC, name)).convert('RGB')
        fit = contain(*im.size, *VIEW)
        sizes = dict(SIZES, fit=fit, hi=(fit[0] * 2, fit[1] * 2))
        # choose this poster's colours from its largest version
        hi = np.asarray(im.resize(sizes['hi'], Image.LANCZOS), dtype=np.float64)
        counts = np.bincount(nearest(hi, pal_lab).ravel(), minlength=len(pal))
        keep = np.argsort(counts)[::-1][:K]
        sub, sub_lab = pal[keep], pal_lab[keep]
        for label, size in sizes.items():
            arr = np.asarray(im.resize(size, Image.LANCZOS), dtype=np.float64)
            idx = keep[nearest(arr, sub_lab)]
            total += save_indexed(idx, pal, os.path.join(OUT, 'p%02d-%s.png' % (n, label)))
        print('p%02d  %s  hi=%dx%d' % (n, name, *sizes['hi']))
    print('wrote assets/gallery (%.0f KB)' % (total / 1024))


if __name__ == '__main__':
    sys.exit(main())
