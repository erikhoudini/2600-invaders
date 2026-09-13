# NFTR font format -- worked derivation

This documents the NFTR (Nitro Font Resource) variant used by one real DS
title, reverse engineered field-by-field against actual ROM data rather
than taken from a generic online spec. `scripts/nftr.py` implements
everything here. If you're patching fonts in a *different* game, use this
as a methodology template, not a drop-in spec -- re-verify each point
against that game's actual files first (the confirmation steps below are
usually a few minutes of work each and will save you from a broken patch
built on an assumption that doesn't hold this time).

## Why "verify, don't assume" matters here specifically

A generic NFTR writeup will tell you the block magics are `NFTR`, `FINF`,
`CGLP`, `CWDH`, `CMAP`, and that `CWDH` stores horizontal side-bearing and
ink width. Both of those were **wrong** for the game this was derived
from, in ways that silently produced broken-looking but not
crashing/erroring output -- the worst kind of wrong, because it doesn't
announce itself. Six iterations of visually-plausible-but-actually-broken
output happened before the real structure was pinned down. Don't repeat
that -- confirm each point below against real bytes before trusting it.

## 1. Byte-reversed magic strings

This variant stores every magic string byte-reversed: the file magic is
`RTFN` (not `NFTR`), and block magics are `FNIF`, `PLGC`, `HDWC`, `PAMC`
instead of `FINF`, `CGLP`, `CWDH`, `CMAP`. **Check this first** -- if a
font file in your target ROM starts with plain `NFTR`, none of the struct
offsets below can be assumed to transfer; you're looking at a different
sub-version and need to re-derive from its actual header.

## 2. Container structure

```
offset 0:  magic (4 bytes, e.g. b'RTFN')
offset 4:  BOM (u16, 0xFEFF)
offset 6:  version (u16, e.g. 0x0101)
offset 8:  file size (u32)
offset 12: header size (u16, typically 16)
offset 14: block count (u16)
```
Then `block count` blocks back to back, each:
```
offset 0: magic (4 bytes)
offset 4: block size INCLUDING this 8-byte header (u32)
offset 8: block-specific payload
```
Walk them by just adding each block's size to find the next -- don't
assume a fixed order beyond FINF-equivalent being first (true here, but
verify).

## 3. FINF (here: `FNIF`) -- font-level metadata

```
+0  font_type       (u8)
+1  line_height     (u8)   -- vertical spacing between lines, used as-is
+2  invalid_glyph   (u16)  -- glyph index shown for unmapped codepoints
+4  default_leading (u8)
+5  default_width   (u8)
+6  default_trailing(u8)
+7  encoding        (u8)   -- 3 observed here; treat as "check cp2gi
                               coverage" rather than trusting a specific
                               enum meaning
+8  cglp_ptr        (u32)  -- ABSOLUTE file offset to CGLP payload (past
                               its own 8-byte block header)
+12 cwdh_ptr        (u32)  -- same, for CWDH
+16 cmap_ptr        (u32)  -- same, for the FIRST CMAP block in the chain
```

## 4. CGLP (here: `PLGC`) -- glyph bitmap data

```
+0 cell_w         (u8)
+1 cell_h         (u8)
+2 cell_data_size (u16)  -- bytes per glyph's packed bitmap
+4 baseline/ascent(u8)   -- see point 6, this is NOT simply "ascent in the
                            direction you'd assume"
+5 max_width      (u8)
+6 bpp            (u8)   -- 4 observed (16 grayscale levels, genuinely
                            antialiased -- see point 7)
+7 flags          (u8)   -- 0 observed; per generic spec bit 0 = vertical
                            text flag, but see point 5 before trusting that
+8... glyph bitmaps, `cell_data_size` bytes each, back to back, indexed
      by glyph index (0-based, in CMAP's mapped order)
```

Bitmap packing confirmed here: 4 bits per pixel, two pixels per byte
(high nibble = first pixel), pixels in row-major order (all of row 0,
then row 1, ...) with **no padding to a byte boundary between rows** --
the whole cell is one continuous nibble stream. Confirm the "no padding"
part by checking `cell_data_size` against `ceil(cell_w * cell_h * bpp / 8)`
-- if it doesn't match, there's row padding you need to account for.

## 5. The glyphs are stored ROTATED 90 degrees

This game is designed to be played with the DS physically turned on its
side (its whole gimmick -- "flip your DS like a book"). The glyph bitmaps
are stored pre-rotated to match: decoding a cell literally (row-major, no
rotation) produces letterforms that are each individually, consistently
rotated -- an 'A' decodes as '<', an 'O' still looks like a circle
(rotation-invariant, so it's a bad test letter), a capital 'I' decodes as
a horizontal bar instead of vertical.

**How this was actually confirmed**, since "it looks rotated" is a
judgment call for one glyph but not for a whole alphabet: decode all 26
uppercase letters raw and lay them out in a strip. If they're
individually recognizable but all tipped 90° the same direction, rotate
the whole strip 90° back and confirm it now reads as a normal, correctly
proportioned alphabet -- not just "less weird" but genuinely legible
including asymmetric letters (Q, R, S, G -- letters with no rotational
symmetry, which rules out a coincidence).

If your game's story/mechanics don't involve a sideways orientation
gimmick, don't assume this rotation applies -- decode a few letters raw
first and just look at them.

**Do not assume the rotation direction transfers either** -- confirm
which way (`rotate(90)` vs `rotate(-90)` in PIL terms) by checking which
one produces upright, non-mirrored letters, not just "recognizable ones"
(a 90° rotation and its mirror can both look plausible-ish for some
letters at a glance; check an asymmetric letter like 'R' or 'G'
specifically).

## 6. Ink is flush to a fixed edge -- position lives in CWDH, not the bitmap

Every glyph's bitmap -- 'a', 'b', 'M', 'g' alike -- has its ink packed
flush against offset 0 of the cell in the reading-orientation axis that
carries vertical position. The engine adds vertical placement separately
via the CWDH leading field (below) at draw time.

**Confirmed by:** decoding several original glyphs and checking their raw
`bbox` -- if every glyph's ink starts at the same coordinate along one
axis regardless of the letter's actual shape (an 'a' and a 'b' both start
at row 0 despite an 'a' sitting lower relative to a 'b's ascender), ink
position isn't stored in the bitmap; it's carried by a separate metric.

**Consequence if you get this wrong:** if you both position ink within
the bitmap *and* also write a nonzero leading value, the offset gets
applied twice -- every character (not just some) ends up displaced, which
reads as a generally "broken/mangled font" rather than any single obvious
symptom. This was the single most expensive bug in the case study this
doc is drawn from, because it looked like a rendering-quality problem
(blamed on antialiasing) rather than the positioning bug it actually was.

## 7. Whether to antialias is a separate question from the above

Don't conflate "the font looks broken" with "antialiasing is the
problem" -- confirm which one you're actually looking at before changing
render settings. In the case this doc is drawn from, hard-thresholding to
1-bit black/white was tried as a fix for broken-looking text and changed
*nothing* (the real bug was point 6, positioning, not antialiasing) --
that "nothing changed" result was itself a useful signal that the wrong
variable was being adjusted, once recognized as such rather than
mistaken for "no fix reached the game yet." If the original font's own
bitmap data uses multiple gray levels (check the packed nibble values
across several glyphs -- not just 0 and max), your replacement should
too; keep it antialiased. This game's original font is genuinely
antialiased.

## 8. CWDH (here: `HDWC`) -- per-glyph metrics

```
+0  first_glyph_index (u16)
+2  last_glyph_index  (u16)
+4  next_block_ptr    (u32)  -- CWDH can be a linked list; 0 = last block.
                                Verify there's really only one block before
                                assuming full glyph coverage from a single
                                CWDH -- check numblocks/walk the file rather
                                than hardcoding "one block" from this doc.
+8  per-glyph entries, 3 bytes each, `(last - first + 1)` of them:
      leading (s8)
      width   (u8)
      total   (s8)
```

**The generic-spec reading of these fields (horizontal side-bearing /
ink-width / advance) was wrong here.** What actually held:

- `leading` = distance from a fixed cell edge to where ink starts, on the
  axis that determines *vertical* placement in reading orientation --
  ascenders (b, l) read small (~6), x-height letters (a, c, e) read
  larger (~10), and `leading + width` landed on **the exact same
  constant** for every non-descender letter in the font, with descenders
  (g, p, y) overshooting it. That constant is the baseline.
- `width` = ink extent along that same axis (effectively "how tall is
  this glyph's ink"), not horizontal ink width.
- `total` = **a single fixed constant across the entire font**, verified
  by dumping every basic-ASCII glyph's `total` field and checking they're
  all identical (they were: 18, 21, or 25 depending on font size, never
  varying by glyph). This is genuine monospacing at the layout level --
  almost certainly so the game's pagination math (characters per line,
  lines per page) stays exact and predictable -- even though the
  *rendered* result doesn't look monospaced, because ink width still
  varies per glyph within that fixed advance.

**How this was actually found:** by dumping `(leading, width, total)` for
a wide sample of letters side by side and noticing the *pattern* --
ascenders vs. x-height vs. descenders clustering, and `total` never
changing -- rather than trusting a spec's field names. If you're patching
a different NFTR-using game, do this same dump-and-look-for-patterns pass
before writing any values; don't assume horizontal proportional
side-bearing/width, and don't assume fixed vs. proportional advance --
both need re-confirming.

## 9. CMAP (here: `PAMC`) -- codepoint to glyph index

Chain of blocks (`next_ptr` links them), each either:
- **type 0 (direct)**: `first_codepoint..last_codepoint` map linearly to
  `start_glyph_index..start_glyph_index+n`.
- **type 2 (scan)**: explicit `(codepoint, glyph_index)` pairs, used here
  for the CP1252 0x80-0x9D range (curly quotes, em-dash, ellipsis, etc.)
  that doesn't fit a linear range with the rest of the table.

If you're only changing glyph *shapes* and not adding/removing characters,
you can copy the original CMAP bytes verbatim and just re-link the
`next_ptr` chain to the new absolute offsets after your CGLP/CWDH change
size -- no need to re-derive the mapping itself. `scripts/nftr.py`'s
`build_cmap_bytes()` does exactly this, and the pattern generalizes: don't
regenerate parts of a format you don't need to touch, and assert your
regenerated file's codepoint map is byte-identical to the original's as a
sanity check after every rebuild.

## 10. Character encoding is CP1252, not raw Unicode

The codepoints CMAP maps are **CP1252 byte values**, not Unicode code
points, even though most of them (0x20-0x7E, 0xA0-0xFD) happen to be
numerically identical to Latin-1/Unicode in that range. They are **not**
identical for 0x80-0x9F, and not for a couple of others like 0x9E/0x9F --
CP1252 puts em-dash, curly quotes, ellipsis, etc. there, while raw
Latin-1/Unicode has undefined C1 control characters at those same byte
values.

Calling Python's `chr(codepoint)` directly on these values is a silent
bug: `chr(0x97)` gives an invisible control character, not an em-dash.
Rendering that "character" with a normal font produces a blank/tofu box
-- which will visually look like a missing-glyph problem (and eat a
debugging cycle looking in the wrong place) rather than the
encoding/decoding bug it actually is. Use `bytes([codepoint]).decode('cp1252')`
instead, always, for every codepoint -- not just the ones in the obviously
special 0x80-0x9F range, since a couple of others (0x9E, 0x9F) are
affected too and it's easy to miss them if you only special-case the
range you already know about.

## Quick self-check before trusting a patched file

1. Parse your rebuilt file with the same parser and confirm
   `cp2gi == original's cp2gi` (structure round-trips).
2. Decode several real letters from the *original* file (not your
   rebuild) with your rotation/orientation logic and confirm they read as
   correctly-oriented, recognizable letters -- this validates your
   *reader* against ground truth, which is the only validation that means
   anything (see `pitfalls.md`, "self-consistent preview trap").
3. Dump `(leading, width, total)` for a handful of ascender/x-height/
   descender letters from both the original and your rebuild side by
   side and confirm the same structural pattern holds (same constant
   `total`, same rough clustering by letter type).
4. Simulate the actual draw loop (place each glyph's bitmap at
   `x=cursor, y=leading`, advance `cursor` by `total`) rather than just
   looking at isolated glyph cells -- this is what actually catches
   overlap/positioning bugs, not a per-glyph preview.
