# Verifying homebrew without hardware access

The common thread across everything below: when you can't run the DS
yourself (no emulator, no hardware, testing loop paused for a while, or
just want more confidence before handing something off), a surprising
amount of a DS homebrew app's correctness is still checkable directly,
without ever touching a device. This file is the detailed version of the
"host-testable development practices" pointer in Workflow C of SKILL.md --
read that first for the condensed version and when each technique applies;
come here for the full technique and the bugs each one actually caught.

## 1. Host-side unit testing for "pure" logic

A lot of what feels like "DS code" doesn't actually touch DS hardware --
it just computes coordinates, wraps text, parses/writes bytes, or manages
a data structure. That logic can be compiled with the *host's* regular
gcc and exercised with a real test harness, rather than shipped on faith.

**The technique:** write a tiny shim header (typedef `u8`/`u16`/`s16`/etc.
to the matching `stdint.h` types, plus any trivial macros the code touches
like `RGB15`/`BIT`) and compile the *actual* production `.c` files against
it with host gcc, `#include`-swapping `<nds.h>` for the shim via `sed`.
If a file compiles cleanly against the shim, its logic is very likely pure
enough to test this way -- anything that fails to compile is exactly the
DS-specific part worth being suspicious of anyway (and can be `#ifdef
ARM9`-gated so the same file still builds for the real target).

**What turned out to be testable this way, broader than expected:**
- Save/load serialization. For libfat-based storage specifically, the
  DS-only part is genuinely just the mount step (`fatInitDefault`, gated
  behind `#ifdef ARM9`), because libfat implements the standard
  POSIX-ish file API (`fopen`/`fread`/`fwrite`/`fclose`, `mkdir`,
  `rename`) via newlib -- once mounted, it's ordinary C file I/O.
- An entire UI file: hit-testing, text wrapping, coordinate transforms,
  pattern tiling, flood fill. None of that logic touches a framebuffer
  or hardware register, it just computes coordinates and array indices.

**What to actually test, and how:**
- Round-trip a full data structure through save-then-load and diff it
  field-by-field.
- Write deliberately corrupt/truncated files and confirm they're
  rejected instead of overrunning a buffer.
- Save twice and confirm the second save fully replaces rather than
  merges with the first.
- For coordinate/hit-test logic, sweep a full range of inputs (not just
  a few hand-picked ones) and check against independently-derived
  expected values.

**Real bugs this caught, not hypothetical ones:**
- C's integer division truncates toward zero rather than flooring, so a
  small *negative* coordinate (e.g. `-5 / 19`) divided to `0` instead of
  a negative column, silently matching column 0 as a real hit instead of
  correctly reporting "no hit" -- present in two different hit-test
  functions written in the same style, both found by sweeping negative
  inputs a hand-picked test suite hadn't happened to include. The
  general lesson: any hit-test that does `coord / cellSize` before
  checking bounds needs the bounds check *first*, since
  divide-then-check-sign is wrong for the whole negative-and-close-to-
  zero range.
- A `panelsEqual()` comparison helper used across many storage tests
  didn't check a newly-added struct field at all -- a bug in that field's
  save/load round-trip would have silently passed every test. Caught by
  noticing the helper's field list hadn't grown when the struct did, not
  by a failing test (there wasn't one, that was the problem). Worth
  specifically re-checking any shared comparison/equality helper
  whenever the struct it compares gains a field.

This is the same file compiled into the real `.nds` afterward, not a
rewritten approximation of it -- so a clean host test run is real
evidence about the shipped binary's correctness, not a vibes-only
parallel exercise.

## 2. Rendering the actual production drawing code to a PNG

Beyond asserting on a drawing function's pure-logic *output* (hit-test
results, wrap points), you can call the *actual* production drawing
functions against a real framebuffer array and convert the result to a
viewable image. A `u16[NATIVE_W*NATIVE_H]` array plus the same
`plotLogical`-style rotation math (inverted, in a small Python script) to
convert it to a PNG is enough -- no emulator, no rendering
reimplementation, genuinely the shipped pixels.

**Set this up once, early, as a small standing tool:**
- One C file that links the real UI source (`ui.c`/equivalent) against
  the host shim from technique 1, with a `main()` that populates some
  sample state and calls the real draw functions.
- A `raw_to_png.py` using PIL that reads the raw `u16` framebuffer dump
  and writes a PNG, applying the inverse of whatever rotation transform
  the app uses so the image appears the way a person actually sees it.
- Add a new `else if (strcmp(screen, "...") == 0)` branch for each new
  screen/state worth checking, so the tool grows with the app instead of
  being rebuilt from scratch each time.

**This is not a nice-to-have.** It caught a real, non-obvious bug that
reading the code did not surface. A "selected" state's highlight border
was drawn around a fitted-content box's *un-fitted container* bounds,
which are only ever equal when the content's aspect ratio happens to
exactly match the container's -- true in quick mental review, but false
the moment real proportions come into play (a tall narrow panel
thumbnail letterboxed into a wider grid cell, here), producing a
visibly wrong nested-double-border that the code's logic looked
completely reasonable while writing.

**Once something looks visually wrong, bisect, don't stare:**
- Render the same scenario with the questionable code path disabled
  (e.g. selection off vs. on) and diff by eye.
- Or dump the exact coordinates a suspect call site computes and check
  them by hand against an isolated minimal repro of just that call.
- Both are much faster than re-reading the original code harder, and
  both generalize: a "dashed border where a solid one was expected"
  turned out, once, to be a completely different bug than it looked
  like -- the *test harness* was drawing into a panel the sample-data
  setup had already populated with unrelated content, not a rendering
  defect at all. Isolating with a minimal, from-scratch repro (a blank
  panel, nothing else drawn) is what told the difference.

**Reach for this by default** whenever a change touches layout,
positioning, or anything selection/highlight-related -- this is exactly
the class of bug that "looks right" in code but not in pixels, and it's
cheap to actually look at once the harness exists. Also render realistic
*non-empty* content, not just the blank/default state, before considering
a layout change finished -- a status label placed in a corner that looks
fine against an empty preview can still turn out to sit at the exact same
position real content starts at, silently overlapping it. That exact bug
happened once: a keyboard-mode label and the first line of typed text
shared one (x, y).

## 3. Writing a real PNG without zlib or libpng

devkitPro ships neither. That doesn't mean a DS homebrew app can't write
a real PNG for export: the PNG spec permits *stored* (uncompressed)
deflate blocks, so a fully valid, universally-readable PNG needs only
CRC32, Adler32, and correct chunk framing -- roughly 150 lines, no
dependencies.

**Verify it against genuine ground truth, not your own decoder.** Write
the output to a file and open it with an independent decoder you did NOT
write (Python's PIL is right there in most sandboxes), checking both
`verify()` and actual per-pixel content. Unlike the usual your-decoder-
validates-your-encoder trap, a foreign decoder agreeing is real evidence.

**Prefer streaming the PNG straight to the open `FILE*` over building it
in a buffer.** CRC32 and Adler32 are both incremental, so the only buffer
needed is a single scanline. On one real export this took static RAM
from ~600KB (a byte-per-pixel sheet buffer plus a whole-file PNG buffer)
down to ~1.3KB *while quadrupling the output resolution*, because the
memory cost stopped scaling with image size at all.

**Two related details worth getting right the first time:**
- When exporting 1-bit pixel art for print, scale it up with
  nearest-neighbour on the way out rather than leaving it to whatever
  opens the file, which will usually smooth it into mush.
- PNG greyscale uses 0 = black, which is likely the opposite of an
  app's internal 1 = black convention -- invert at the encoder, not in
  the drawing code, so the drawing code's convention stays the one
  that's actually used everywhere else in the app.

## 4. A standing test-suite shape worth reusing

A project's `tests/` directory (a shell script plus a shim header and a
handful of `test_*.c` files) is a template worth copying wholesale into
the next DS homebrew project rather than rebuilding from scratch:

```
tests/
  nds_shim.h          -- host-compatible type/macro shim
  test_ui.c            -- hit-testing, wrapping, rendering logic
  test_storage.c        -- save/load round-trip, corruption handling
  run_host_tests.sh     -- copies current production source into a
                            scratch dir, patches the nds.h include,
                            compiles against the shim, runs everything
  render/
    render_harness.c    -- links real ui.c, renders named screens
    raw_to_png.py        -- framebuffer dump -> viewable PNG
    README.md            -- usage + lessons (like the sample-data
                             collision bug above)
```

The key property of `run_host_tests.sh`: it always copies the *current*
production source into its scratch dir before compiling, rather than
maintaining a hand-copied duplicate that could quietly drift out of sync
with the real files. This means a clean run is always evidence about the
code as it currently stands, not about a snapshot from whenever the test
was last updated.

Extend the test files as new pure logic gets added, rather than leaving
new functions unverified next to old ones that are -- an untested new
function sitting beside a well-tested one is easy to overlook precisely
*because* the file around it looks rigorously covered.

## 5. Autosave / dirty-tracking, verified by construction rather than by test

Autosave logic lives entirely in an app's interactive main loop, which
generally isn't the kind of thing techniques 1-2 can test (it's driven by
simulated time and input sequences, not a fixed input->output mapping).
Where you can't get a passing test suite, get correctness by
construction and a systematic audit instead:

- **Piggyback the "dirty" flag on existing undo-snapshot call sites**
  rather than tracking mutations separately. Any app with undo already
  has a clearly-identified set of "a real mutation is about to happen"
  moments -- exactly the same condition autosave cares about. Adding
  `dirty = true` next to every existing `undoValid = true` (or
  equivalent) is far less error-prone than re-deriving the mutation-point
  list from scratch, and it's mechanical enough to `grep` for and verify
  none were missed.
- **Gate the actual write on genuine input-idle time** (reset a countdown
  on any touch or button, save only once it elapses), not a fixed
  interval -- that's what keeps it from ever landing mid-gesture.
- **Audit every place that also brings memory and disk into agreement**,
  not just the obvious manual-save path: anything that saves as a side
  effect (an export feature that saves a project file before exporting,
  for instance) needs the same flag cleared afterward, and anything that
  replaces the in-memory state wholesale from disk (a load) should clear
  the flag rather than leave it however it was. A real gap found this
  way: an export feature's internal save wasn't clearing the dirty flag,
  so a successful export would still trigger a redundant autosave ten
  seconds later.
- After writing the logic, do a complete `grep`-based audit of every
  reference to the flag (every place it's set true, every place it's
  cleared) and manually trace that the set covers exactly the mutation
  points and the clear covers exactly the memory-disk-agreement points --
  this is the verification technique when a real automated test isn't
  practical for this class of logic.

## 6. Verifying vector/wireframe line geometry, not just filled bitmaps

Technique 2 above (render to a framebuffer, convert to PNG) is the right
tool for filled/bitmap rendering. A first-person wireframe-style renderer
(line segments computed from game-state coordinates, not a filled
bitmap) has a narrower, faster-to-build equivalent that's worth reaching
for specifically when a shape's *orientation* -- not just whether its
coordinates stay on-canvas -- is what's actually in question:

**Render line endpoints to a small text-character grid.** Map each
virtual/game coordinate down to a small fixed grid (e.g. 80x60 chars),
walk each line with an ordinary Bresenham integer-line algorithm, and
plot a `#` at every touched cell. This is a few dozen lines of host C or
even Python, no framebuffer/PNG pipeline needed, and it's fast enough to
regenerate for a quick side-by-side comparison. In one real session this
technique -- not bounds-checking, which had already separately passed --
is what caught an upside-down door shape and a monster figure rendered
lying on its side instead of standing upright: both bugs kept every
coordinate safely on-canvas, so a pure bounds/overflow check gave no
signal at all. Being in-bounds and being correctly *oriented* are
independent properties, and only rendering the actual shape (even
crudely, as ASCII) checks the second one.

**When a coordinate-pair-generating helper's calling convention is
genuinely ambiguous** (which of two numbers in a pair means "horizontal"
vs. "vertical", especially when a function's own parameter names don't
obviously line up with the order values are passed at real call sites) --
**stop re-deriving the rule symbolically after the first attempt produces
a contradiction.** Re-reading the same code again and reasoning about it
harder is not new evidence; it produced two different, mutually
contradictory answers on two separate tries in one real case. Instead,
render the identical coordinate data BOTH as literally given AND with the
ambiguous pairing swapped, using the technique above, and compare the two
actual rendered shapes side by side. Whichever one visibly matches the
intended shape is directly-checkable ground truth; a symbolic re-
derivation is not, no matter how carefully it's redone. This is a
specific instance of the broader "when you're truly stuck, stop guessing
and go measure" principle in the main SKILL.md's constraints section --
concrete enough here to spell out as its own worked technique.

**More generally: when a fix produces literally no observable change,
that is itself informative, not a reason to try a bigger or smaller
version of the same guess.** A real invisible-graphics bug went through
one plausible-sounding, code-level-correct fix (an uncleared-VRAM theory)
that changed nothing when tested -- the right response was to treat "zero
change" as evidence the theory was wrong (not "the fix needs to be
stronger") and re-derive from the actual hardware capability tables
instead, which found the real cause (a video-mode/layer mismatch, a
structurally different kind of bug than the one first suspected). When a
report comes back with "no change" after a fix, resist writing a second,
similarly-shaped guess before checking whether the first guess's
*category* of explanation was even the right one.
