#!/usr/bin/env python3
"""Converts a 256x192 PNG to a raw RGB15 (ABGR1555, alpha bit set)
binary blob matching the NDS Bmp16 bitmap-background format, for
direct framebuffer loading via NitroFS."""
import sys
from PIL import Image

def convert(src, dst):
    im = Image.open(src).convert("RGB")
    assert im.size == (256, 192), f"{src} is {im.size}, expected 256x192"
    out = bytearray()
    px = im.load()
    for y in range(192):
        for x in range(256):
            r, g, b = px[x, y]
            r5 = round(r / 255 * 31)
            g5 = round(g / 255 * 31)
            b5 = round(b / 255 * 31)
            val = (1 << 15) | r5 | (g5 << 5) | (b5 << 10)
            out += val.to_bytes(2, "little")
    with open(dst, "wb") as f:
        f.write(out)
    print(f"{src} -> {dst} ({len(out)} bytes)")

if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2])
