"""
nftr.py -- read/write NFTR (Nitro Font Resource) glyph data used by many DS
games, including this specific 'RTFN' byte-swapped variant.

Reverse-engineered against a real retail ROM ("100 Classic Books", a
Genius Sonority DS title played with the console turned sideways) rather
than assumed from a generic spec. Confirmed quirks baked into this module
that a generic NFTR writeup will NOT tell you, and that cost real iteration
to find:

  1. Magic strings are byte-reversed: file magic is "RTFN" not "NFTR",
     and block magics are "FNIF"/"PLGC"/"HDWC"/"PAMC" instead of the usual
     "FINF"/"CGLP"/"CWDH"/"CMAP". Confirm this on any new ROM before
     assuming the rest of this module applies -- if a font file in your
     target ROM starts with "NFTR" (not "RTFN"), the byte order is
     different and these struct formats will need re-deriving the same way
     this file was: dump the header, and check against a font you can
     already read correctly (see references/pitfalls.md, "validate against
     ground truth").

  2. Glyphs are stored ROTATED 90 degrees relative to reading orientation.
     This particular game is read with the DS turned on its side, and the
     glyph bitmaps are stored pre-rotated to match. A "storage cell" of
     w=15,h=17 is actually a 17-wide x 15-tall glyph once you rotate it
     upright. Do not assume this rotation applies to every NFTR font in
     every game -- it was discovered here specifically because decoding
     bytes literally produced recognizably-rotated letterforms (an 'A'
     came out as '<'). Check for this the same way: decode raw and look at
     whether letters read as consistently rotated.

  3. Ink is stored FLUSH to a fixed edge of the cell, not positioned within
     it. Vertical (or, pre-rotation, "horizontal" in storage terms)
     placement is carried entirely by the CWDH leading field, added by the
     engine at draw time. Baking position into the bitmap AND writing a
     leading value applies the offset twice.

  4. CWDH 'leading' and 'width' fields are metrics along the axis that
     matters for THIS engine's reading direction -- for this game that
     turned out to be vertical (leading = line-top to ink-top, width =
     ink height), not the horizontal side-bearing/ink-width a generic spec
     describes. Verify against the original: measure leading+width across
     several known glyphs and see what they consistently sum to (that
     constant is your baseline/cell-edge value).

  5. 'total' (per-glyph advance) is a FIXED CONSTANT across the entire
     font in this game -- true monospacing for predictable pagination --
     not derived from each glyph's actual ink width. Confirm this before
     writing proportional advances: dump every glyph's 'total' field from
     the original and check whether they're all identical.

  6. Character data is CP1252, not raw Unicode code points. chr(byte) is
     WRONG for byte values in in 0x80-0x9F (and a few others like 0x9E) --
     use bytes([byte]).decode('cp1252') or you'll silently ask your font
     renderer for the wrong character (typically invisible control
     characters instead of curly quotes/em-dashes/etc, which shows up as
     blank tofu boxes in the patched font).

None of points 2-6 are safe to assume for a *different* game's NFTR files
without re-verifying against that game's original data first. Point 1
(byte-reversed magic) is the tell for whether this exact variant applies at
all. See references/nftr-format.md for the full worked derivation and
references/pitfalls.md for the general methodology used to find all of
this (self-consistent-preview trap, "nothing changed" as a diagnostic
signal, etc.) -- that methodology matters more than these specific
findings, since the next format you reverse-engineer won't be NFTR.
"""

import struct
from PIL import Image, ImageDraw, ImageFont

def parse_nftr(data):
    bom, version, filesize, headersize, numblocks = struct.unpack_from("<HHIHH", data, 4)
    off = headersize
    blocks = []
    for i in range(numblocks):
        magic = data[off:off+4]
        size = struct.unpack_from("<I", data, off+4)[0]
        blocks.append({"magic": magic, "off": off, "size": size})
        off += size

    finf_block = next(b for b in blocks if b["magic"] == b'FNIF')
    fo = finf_block["off"] + 8
    font_type, line_height = data[fo], data[fo+1]
    invalid_glyph = struct.unpack_from("<H", data, fo+2)[0]
    default_leading, default_width, default_trailing, encoding = data[fo+4], data[fo+5], data[fo+6], data[fo+7]

    cglp_block = next(b for b in blocks if b["magic"] == b'PLGC')
    co = cglp_block["off"] + 8
    cell_w, cell_h = data[co], data[co+1]
    cell_data_size = struct.unpack_from("<H", data, co+2)[0]
    ascent, max_width, bpp, flags = data[co+4], data[co+5], data[co+6], data[co+7]
    num_glyphs = (cglp_block["size"] - 8 - 8) // cell_data_size

    # decode CMAP chain -> codepoint -> glyph index
    cp2gi = {}
    for b in blocks:
        if b["magic"] != b'PAMC':
            continue
        s = b["off"] + 8
        first_cp, last_cp, maptype = struct.unpack_from("<HHH", data, s)
        payload = s + 12
        if maptype == 0:
            start_glyph = struct.unpack_from("<H", data, payload)[0]
            for cp in range(first_cp, last_cp + 1):
                cp2gi[cp] = start_glyph + (cp - first_cp)
        elif maptype == 1:
            n = last_cp - first_cp + 1
            arr = struct.unpack_from(f"<{n}H", data, payload)
            for i, gi in enumerate(arr):
                if gi != 0xFFFF:
                    cp2gi[first_cp + i] = gi
        elif maptype == 2:
            count = struct.unpack_from("<H", data, payload)[0]
            p = payload + 2
            for i in range(count):
                cp, gi = struct.unpack_from("<HH", data, p)
                cp2gi[cp] = gi
                p += 4

    gi2cp = {}
    for cp, gi in cp2gi.items():
        gi2cp.setdefault(gi, cp)

    cmap_meta = []
    for b in blocks:
        if b["magic"] == b'PAMC':
            cmap_meta.append({
                "size": b["size"],
                "raw_bytes": data[b["off"]: b["off"] + b["size"]],
            })

    return {
        "version": version, "encoding": encoding, "invalid_glyph": invalid_glyph,
        "line_height": line_height, "default_leading": default_leading,
        "default_width": default_width, "default_trailing": default_trailing,
        "cell_w": cell_w, "cell_h": cell_h, "ascent": ascent, "bpp": bpp,
        "num_glyphs": num_glyphs, "cp2gi": cp2gi, "gi2cp": gi2cp,
        "cmap_meta": cmap_meta,
        "raw": data,
    }


def find_best_pixel_size(font_path, target_ascent, target_descent, target_width,
                          sample_chars, max_size=40, stroke_width=1):
    """Search descending pixel sizes; return the largest that keeps every sample
    glyph's ink (including the stroke embolden used at render time) within
    [-target_descent, target_ascent] of the baseline AND within target_width
    horizontally (checks both axes -- clipping either one silently truncates
    strokes and makes the font look broken)."""
    best = None
    for size in range(max_size, 4, -1):
        font = ImageFont.truetype(font_path, size)
        ok = True
        for ch in sample_chars:
            img = Image.new("L", (size * 3, size * 3), 0)
            d = ImageDraw.Draw(img)
            baseline_y = size * 2
            origin_x = size
            d.text((origin_x, baseline_y), ch, font=font, fill=255, anchor="ls", stroke_width=stroke_width)
            bbox = img.getbbox()
            if bbox is None:
                continue
            top = bbox[1] - baseline_y
            bottom = bbox[3] - baseline_y
            left = bbox[0] - origin_x
            right = bbox[2] - origin_x
            if top < -target_ascent or bottom > target_descent:
                ok = False
                break
            if right > target_width:
                ok = False
                break
        if ok:
            best = size
            break
    return best


def render_glyphs(font_path, chars_by_gi, reading_w, reading_h, baseline,
                  pixel_size, threshold=None):
    """Render glyphs matching THIS ENGINE's actual storage convention, which was
    reverse-engineered from the original font files rather than assumed:

      * The bitmap is stored ROTATED: reading orientation is (reading_w x
        reading_h), and storage is that image rotated +90, giving a stored cell
        of (cell_w=reading_h, cell_h=reading_w).

      * Ink is stored FLUSH TO THE TOP of the reading image. Every glyph in the
        original -- a, b, M, g alike -- has its ink packed against offset 0.
        Vertical placement is NOT baked into the bitmap; it is carried entirely
        by the CWDH 'leading' field and added by the engine at draw time.
        Baking position into the bitmap AND writing a leading value applies the
        offset twice, which damages every character.

      * CWDH 'leading' and 'width' are VERTICAL metrics in reading space:
        leading = distance from line top to ink top, width = ink height.
        Verified against the original: ascenders (b, l) -> leading 6, x-height
        (a, c, e) -> leading 10, and leading+width == baseline for every
        non-descender, with descenders (g, p) overshooting it.

      * Glyphs are horizontally centred within reading_w; the advance is a
        constant for the whole font.

    threshold: if None (default), keep antialiased grayscale (matches the
    original, which is itself antialiased at 4bpp). Pass an int 0-255 to
    hard-threshold instead -- kept as an option, not the default, since the
    earlier breakage turned out to be the double-offset bug, not partial
    pixel coverage.

    Returns gi -> (storage_img, leading, ink_height, ink_width).
    """
    font = ImageFont.truetype(font_path, pixel_size)
    PAD = pixel_size * 2
    scratch_h = baseline + PAD
    out = {}
    for gi, ch in chars_by_gi.items():
        scratch = Image.new("L", (reading_w + 2 * PAD, scratch_h), 0)
        d = ImageDraw.Draw(scratch)
        if ch != ' ':
            # draw at the true baseline so vertical metrics come out right,
            # horizontally centred to match the original's centring
            try:
                adv = font.getlength(ch)
            except Exception:
                adv = reading_w
            x = PAD + max(0, (reading_w - adv) / 2.0)
            d.text((x, baseline), ch, font=font, fill=255, anchor="ls")

        if threshold is not None:
            px = scratch.load()
            for yy in range(scratch.height):
                for xx in range(scratch.width):
                    px[xx, yy] = 255 if px[xx, yy] >= threshold else 0

        bbox = scratch.getbbox()
        if bbox is None:
            # blank glyph (space): no ink, no offset
            storage = Image.new("L", (reading_h, reading_w), 0)
            out[gi] = (storage, 0, 0, 0)
            continue

        x0, y0, x1, y1 = bbox
        leading = y0                     # line top -> ink top
        ink_h = y1 - y0                  # CWDH 'width' == ink height
        ink_w = x1 - x0

        # Build the reading image with ink FLUSH TO TOP, preserving the
        # glyph's horizontal position within the cell.
        reading = Image.new("L", (reading_w, reading_h), 0)
        band = scratch.crop((PAD, y0, PAD + reading_w, y0 + reading_h))
        reading.paste(band, (0, 0))

        storage = reading.rotate(90, expand=True)
        out[gi] = (storage, leading, ink_h, ink_w)
    return out


def pack_4bpp(img, cell_w, cell_h):
    """Pack an L-mode image into 4bpp rows, MSB-first, matching NFTR CGLP layout."""
    px = img.load()
    bits = []
    for y in range(cell_h):
        for x in range(cell_w):
            v = px[x, y] >> 4  # 0-15
            bits.append(v)
    out = bytearray()
    for i in range(0, len(bits), 2):
        hi = bits[i]
        lo = bits[i+1] if i + 1 < len(bits) else 0
        out.append((hi << 4) | lo)
    return bytes(out)


def build_cmap_bytes(cmap_blocks_meta, base_off):
    """Rebuild the CMAP chain unchanged in content, just re-linked at new absolute offsets."""
    out = bytearray()
    offsets = []
    running = base_off
    for b in cmap_blocks_meta:
        offsets.append(running)
        running += b["size"]
    for i, b in enumerate(cmap_blocks_meta):
        data = b["raw_bytes"]
        next_ptr = offsets[i+1] if i + 1 < len(cmap_blocks_meta) else 0
        chunk = bytearray(data)
        struct.unpack_from("<I", chunk, 8 + 12 - 4)  # sanity
        struct.pack_into("<I", chunk, 8 + 8, next_ptr)
        out += chunk
    return bytes(out), offsets[0] if offsets else 0


def build_nftr(orig, font_path, reading_w, reading_h, baseline, line_height,
               total_advance, pixel_size, threshold=None):
    """reading_w/reading_h are in READING orientation. Stored cell is
    (cell_w=reading_h, cell_h=reading_w) because glyphs are stored rotated."""
    num_glyphs = orig["num_glyphs"]
    # CP1252, NOT plain Unicode: 0x80-0x9F (and a couple of bytes elsewhere,
    # e.g. 0x9E/0x9F) diverge from raw Latin-1/chr(). Using chr(cp) directly
    # asked DejaVu for the wrong character entirely for punctuation like the
    # em-dash (byte 0x97 -> chr() gives an invisible control character
    # instead of '-'), which rendered as a blank tofu box but still consumed
    # its advance width -- that's the blank squares and the odd gaps around
    # them.
    chars_by_gi = {gi: bytes([cp]).decode('cp1252') for gi, cp in orig["gi2cp"].items()}
    rendered = render_glyphs(font_path, chars_by_gi, reading_w, reading_h,
                             baseline, pixel_size, threshold=threshold)

    cell_w, cell_h = reading_h, reading_w

    cell_data_size = (cell_w * cell_h * 4 + 7) // 8
    cglp_body = bytearray()
    cglp_body += struct.pack("<BBHBBBB", cell_w, cell_h, cell_data_size,
                             baseline, total_advance, 4, 0)
    cwdh_entries = bytearray()
    blank = Image.new("L", (cell_w, cell_h), 0)
    for gi in range(num_glyphs):
        img, leading, ink_h, ink_w = rendered.get(gi, (blank, 0, 0, 0))
        cglp_body += pack_4bpp(img, cell_w, cell_h)
        cwdh_entries += struct.pack("<bBb",
                                    max(-128, min(127, leading)),
                                    max(0, min(255, ink_h)),
                                    max(-128, min(127, total_advance)))

    HEADER_SIZE = 16
    finf_size = 8 + 20
    cglp_size = 8 + len(cglp_body)
    cwdh_size = 8 + 8 + len(cwdh_entries)

    finf_off = HEADER_SIZE
    cglp_off = finf_off + finf_size
    cwdh_off = cglp_off + cglp_size
    cmap_start = cwdh_off + cwdh_size

    cmap_bytes, first_cmap_off = build_cmap_bytes(orig["cmap_meta"], cmap_start)

    finf = bytearray()
    finf += b'FNIF'
    finf += struct.pack("<I", finf_size)
    finf += struct.pack("<BBH", 0, line_height, orig["invalid_glyph"])
    finf += struct.pack("<BBBB", 0, total_advance, total_advance, orig["encoding"])
    finf += struct.pack("<III", cglp_off + 8, cwdh_off + 8, first_cmap_off)
    assert len(finf) == finf_size

    cglp = bytearray()
    cglp += b'PLGC'
    cglp += struct.pack("<I", cglp_size)
    cglp += cglp_body

    cwdh = bytearray()
    cwdh += b'HDWC'
    cwdh += struct.pack("<I", cwdh_size)
    cwdh += struct.pack("<HHI", 0, num_glyphs - 1, 0)
    cwdh += cwdh_entries

    total_size = cmap_start + len(cmap_bytes)
    out = bytearray()
    out += b'RTFN'
    out += struct.pack("<HHIHH", 0xFEFF, orig["version"], total_size, HEADER_SIZE, 6)
    out += finf
    out += cglp
    out += cwdh
    out += cmap_bytes
    assert len(out) == total_size, (len(out), total_size)
    return bytes(out)
