# BlocksDS: a second homebrew toolchain, distinct from devkitARM/libnds

Workflow C's main instructions and `homebrew-setup.md` describe the
devkitARM/libnds/devkitPro toolchain. **BlocksDS is a different, more
actively-developed toolchain for the same target (NDS/DSi homebrew in C),
built on the Wonderful Toolchain rather than devkitPro's pacman-based
distribution.** It is not a thin variant of devkitARM -- the environment
setup, Makefile structure, and a meaningful slice of the libnds API differ
enough that assuming devkitARM knowledge transfers wholesale is a real
source of bugs (see the mode/layer table mistake below, which cost a whole
session to root-cause). If a project's toolchain is already BlocksDS
(check for `wf-env`, a Makefile including
`$(BLOCKSDS)/sys/default_makefiles/.../Makefile`, or `arm-none-eabi-gcc`
resolving under `/opt/wonderful/toolchain`), stay in this toolchain rather
than reaching for devkitARM patterns from memory.

## Environment and build

```sh
. /opt/wonderful/bin/wf-env
export PATH=/opt/wonderful/toolchain/gcc-arm-none-eabi/bin:$PATH
export BLOCKSDS=/opt/wonderful/thirdparty/blocksds/core
export BLOCKSDSEXT=/opt/wonderful/thirdparty/blocksds/external
export WONDERFUL_TOOLCHAIN=/opt/wonderful
make
```
Run this `. /opt/wonderful/bin/wf-env` + exports sequence in **every**
bash invocation that needs the toolchain -- environment doesn't persist
between separate tool calls in this working setup, and a build that
mysteriously can't find `arm-none-eabi-gcc` almost always means this step
was skipped for that specific shell invocation, not a real installation
problem.

Two ARM9-only project templates exist under
`$(BLOCKSDS)/sys/default_makefiles/`:
- `rom_arm9` -- links a **pre-built** ARM7 core (`arm7_minimal.elf`,
  `arm7_maxmod.elf`, etc. under `$(BLOCKSDS)/sys/arm7/main_core/`) via the
  `ARM7ELF` Makefile variable. No ARM7 source or build step at all.
- `rom_arm9arm7` -- compiles a **custom** ARM7 source tree, for projects
  that genuinely need custom ARM7 behavior (rare).

**Default to `rom_arm9` unless the project has a specific, identified need
for custom ARM7 code.** A real project in this session started on
`rom_arm9arm7` with a from-scratch, minimal ARM7 `main.c` (idle loop +
`installSystemFIFO()` for power/SD/firmware access) that looked complete
and built cleanly -- and silently never forwarded X/Y button or touchscreen
state to the ARM9 at all, because that forwarding is a real ARM7-side
service the prebuilt cores provide and a hand-rolled minimal ARM7 doesn't
get for free. Confirmed via BlocksDS's own docs: **the ARM9 CPU has no
direct hardware access to the X/Y buttons or the touchscreen** -- only the
ARM7 does, and getting that state onto the ARM9 requires either the
prebuilt core's forwarding or hand-writing it yourself. Every other
button (D-pad, A/B/L/R/Start/Select) is wired to an ARM9-readable register
directly, which is exactly why a custom-ARM7 setup missing this can look
completely fine for most input testing and then have two specific buttons
that just never register, with no other symptom. Switching from
`rom_arm9arm7` to `rom_arm9` (pre-built `arm7_minimal.elf`) fixed it
outright, with zero ARM9-side code changes needed -- the IPC/FIFO
abstraction is exactly what makes the ARM9 side agnostic to which ARM7
binary is actually running.

## VRAM/BG-mode capability tables are NOT the same on both screens, and a
## misread here produces a specific, misleading visual symptom

The DS's two 2D engines (main/top screen, sub/bottom screen) have
*different* per-mode background-layer capability tables. Concretely
(T=tiled/text, R=rotation, E=extended/bitmap-capable):

```
Main 2D engine                    Sub 2D engine
Mode | BG0 | BG1 | BG2 | BG3       Mode | BG0 | BG1 | BG2 | BG3
  0  |  T  |  T  |  T  |  T          0  |  T  |  T  |  T  |  T
  1  |  T  |  T  |  T  |  R          1  |  T  |  T  |  T  |  R
  2  |  T  |  T  |  R  |  R          2  |  T  |  T  |  R  |  R
  3  |  T  |  T  |  T  |  E          3  |  T  |  T  |  T  |  E
  4  |  T  |  T  |  R  |  E          4  |  T  |  T  |  R  |  E
  5  |  T  |  T  |  E  |  E          5  |  T  |  T  |  E  |  E
  6  |     |  L  |     |             (mode 6 doesn't exist on sub engine)
```
`L` = large bitmap background, main-engine-only, a distinct special case
from ordinary Extended bitmap backgrounds -- don't conflate the two.

**Mode 0 has ZERO bitmap-capable layers on either engine.** If a project
sets a bitmap-type background (`BgType_Bmp8`/`BgType_Bmp16`, via
`bgInit`/`bgInitSub`) on a layer while the corresponding engine is running
in Mode 0, the hardware cannot render it as a bitmap at all -- it
necessarily reinterprets the same raw bytes as tiled/text data instead.
**The resulting symptom is a faint, low-value, roughly-regular pattern
covering the whole screen** (the bitmap's mostly-zero/near-zero pixel
bytes, read back as small tile-map indices), easy to mistake for a
VRAM-content/clearing bug (leftover garbage, a missing `memset`) rather
than a mode/capability mismatch -- confirmed the hard way in this exact
session: the first hypothesis (uncleared VRAM) produced a fix that
compiled clean and changed nothing visible, which was the correct signal
to stop and re-derive from the actual mode table rather than layer a
second guess on top. **Before debugging a mystery low-level visual
pattern on either screen, check the actual video mode against this table
for every layer in use, not just the one being actively worked on.**

A further, non-obvious consequence: **there is no single mode where BG3
is Text and BG2 is Extended at the same time** (or the reverse) on either
engine -- every mode's Extended-capable layer, if any, is BG2, BG3, or
both, never "BG3 only, with BG2 staying Text." If two layers need
different capabilities (e.g. a text console and a bitmap chrome/border
layer) and the current mode doesn't offer that specific combination on
the layer numbers already chosen, the fix is not a one-line mode swap --
**which physical BG NUMBER each piece of content occupies has to change
too**, not just the `videoSetMode`/`videoSetModeSub` call.

## Display priority is a separate axis from mode/capability, and defaults
## matter for whether one layer is visible through another

`bgSetPriority(id, n)` -- lower `n` draws on top. Two real, non-obvious
consequences from this session:

- **Priority determines occlusion, but never determines *transparency*.**
  A layer showing through a higher-priority layer's blank areas depends
  on that higher layer's blank pixels actually being palette/direct-color
  index/bit 0 (see the transparency section below) -- getting priority
  right with the wrong transparency convention still results in one
  layer fully hiding the other.
- **A layer's "natural" priority (frame/chrome lines drawn ABOVE body
  content, so they're never occluded by a character cell) is often the
  wrong priority for a *different* one-off use of that same layer.** A
  project reused a chrome/border bitmap layer to occasionally show a
  full decorative image behind menu text -- correct for that specific
  purpose only with priorities *swapped* (text layer on top) from the
  border's normal arrangement (border lines on top, so they're visible
  over text). Reusing one physical layer for two different visual roles
  at different times needs an explicit priority swap paired with a
  restore, not a fixed priority chosen once at init and assumed to suit
  every future use of that layer.

## Palette index / direct-color bit 0 is *universally* the transparent
## value across every BG type on this hardware -- confirmed from
## Nintendo's own official documentation, not inferred per-type

For a **paletted** background (4bpp/8bpp, tiled or bitmap), palette entry
**index 0** is always transparent -- confirmed directly from Nintendo's
own official (if informally circulated) developer documentation: "the
color with index number 0 in each palette is always used as a transparent
color." This holds for **every** paletted BG type, not just bitmap ones --
including an ordinary 4bpp text/console background, where it's easy to
assume (wrongly, as a special case) that "blank"/background pixels behind
glyphs might work some other way. They don't; it's the same rule.

For a **direct-color 16bpp bitmap** background, the equivalent role is
played by **bit 15** of each pixel's raw 16-bit value (not part of the
RGB555 color itself) -- a pixel with that bit clear is not drawn at all,
regardless of what its RGB bits contain. This is a related but
*mechanically different* convention (a bit flag on the color value, vs.
which index a palette lookup resolves to) -- treat "index/bit 0 (or bit
15, for direct color) means empty" as one *conceptual* rule with two
different concrete mechanisms depending on the BG type actually in use,
and re-verify which mechanism applies before writing new blit/clear code
against a BG type not already covered by existing, working code in the
same project.

## `vramSetBank*` only writes a control register -- it does not clear
## the memory it maps

`vramSetBankA`/`vramSetBankC`/etc. are one `COMPILER_MEMORY_BARRIER()` +
one register write each (confirmed by reading the actual inline
implementation, not assumed) -- they select *which* physical memory a
bank's address range refers to, and do nothing to its *contents*. Memory
behind a freshly-mapped bank can hold anything: whatever was there before
a previous mapping, or genuinely uninitialized power-on content.
**Anything that reads a VRAM-backed structure before writing it (a
console's tile map, in particular) needs an explicit clear of its own,
separate from whichever init call sets up the bank/layer** -- don't
assume a higher-level helper (`consoleInit`, `bgInit`) clears the memory
region it configures just because it configures it. This produced a real,
visually confusing bug: an uncleared console tile map rendered as a
uniform pattern across every not-yet-printed-to cell, indistinguishable
at a glance from the mode/capability-mismatch symptom above -- worth
ruling both out explicitly rather than assuming which one applies from
the visual symptom alone, since (in this exact session) they looked
similar enough to cause one wrong fix before the real cause was found.

## `swiWaitForVBlank`/interrupts don't need manual ARM9-side setup

`irqInit()` is called internally by libnds *before* `main()` runs, as part
of normal program startup on the ARM9 -- a project does not need to call
it itself, and its absence from application code is not evidence of a
missing setup step. (This differs from the ARM7 side of a *custom*-ARM7
project, which does need its own explicit `irqInit()`/`irqEnable(IRQ_VBLANK)`
-- but that's a non-issue if using a pre-built ARM7 core per the
`rom_arm9` guidance above.) Calling `swiWaitForVBlank()` in a tight loop
(e.g. to time a fixed real-world duration -- ~59.8Hz refresh rate, so
`~60 * seconds` iterations) is safe without calling `scanKeys()` on every
one of those iterations too; `keysDown()`'s edge-detection is a diff
against whatever the *previous* `scanKeys()` call observed, so skipping
scans during a timed pause just means the next real scan establishes a
fresh baseline, not a burst of spurious "just pressed" events for
whatever happened to be held during the pause.

## Byte-offset arithmetic for `bgInit`/`bgInitSub`'s `mapBase`/`tileBase`

- For **tiled/text** backgrounds: `mapBase` is a **2KB**-unit offset,
  `tileBase` is a separate **16KB**-unit offset -- two different regions,
  two different unit sizes, both within the same VRAM bank.
- For **bitmap** backgrounds: `tileBase` is ignored entirely; `mapBase`
  is reinterpreted as a **16KB**-unit offset for the bitmap's pixel data
  itself (there's no separate tile region for a bitmap type at all).
- `bgGetGfxPtr(id)` already resolves the correct absolute VRAM address
  from these values internally -- it returns a pointer to the actual
  configured region, not the start of the whole bank, so pointer
  arithmetic on its result should treat it as already-correctly-offset.

When placing more than one logical thing (a console's font+map, a
border/chrome bitmap, etc.) in the same physical VRAM bank via different
`mapBase`/`tileBase` values, compute every region's actual byte range
explicitly (`mapBase_units * unit_size` through `+ region_byte_size`) and
check for overlap numerically -- don't eyeball small-looking offset
numbers as obviously safe. A real project in this session placed a
console's font at byte 0, its map at byte 63488 (`mapBase=31 * 2KB`), and
a border bitmap immediately after at byte 65536 (`mapBase=4 * 16KB`) --
correct, but only because it was checked with exact arithmetic; the same
kind of placement decision without that check is exactly where a
one-region-into-another VRAM collision would hide until it visually
manifested as corrupted graphics somewhere seemingly unrelated.

## A misleadingly-named field is still worth checking against its actual
## numeric usage, not its name

A real rectangle-computing function in this session assigned the
**numerically larger** Y value to a field named `top` and the smaller to
`bottom` -- the opposite of normal screen-space naming intuition (where
"top" suggests a smaller Y, closer to the screen's top edge). Combined
with a separately-confirmed drawing convention where larger Y draws lower
on screen, code written *trusting the field names* ended up drawing a
UI element (a door/archway shape) upside down relative to its intended
orientation -- a real, shipped-and-reported bug, not a hypothetical one.
**When a coordinate/rectangle field's name implies a screen-space
direction, verify what numeric relationship it actually has to the
drawing function's real Y convention (increasing = up, or increasing =
down?) before trusting the name** -- especially when the field was
computed by different code than what consumes it, since that's exactly
where a naming assumption and an actual convention can silently diverge.

## Verifying rendering geometry natively, beyond bounds-checking

`references/homebrew-testing.md` already covers rendering production
drawing code to a framebuffer and converting to a viewable PNG. Two
narrower techniques from this session's real bug hunts, worth adding to
that toolbox specifically for **line-based/vector wireframe rendering**
(not filled bitmap rendering, which the PNG technique already covers
well):

- **When a shape's *orientation* (not just its coordinate bounds) is in
  question, render its actual line endpoints to a small text-character
  grid** (map each virtual coordinate down to a fixed small grid, plot a
  `#` at each pixel a Bresenham-style line touches) and print it. This is
  faster to build than a full PNG pipeline for a quick orientation check,
  and was what actually caught an upside-down door shape and a sideways-
  instead-of-upright monster figure in this session -- bounds-checking
  alone (confirming every coordinate stays on-canvas) had already passed
  for both bugs, because being in-bounds and being correctly *oriented*
  are independent properties.
- **When a calling convention for a coordinate-pair-generating helper
  function is genuinely ambiguous from reading it once** (e.g. "does the
  first number in each pair mean horizontal or vertical, when the
  function's own formal parameter names don't obviously correspond to
  the order they're passed in at each call site") -- stop trying to
  re-derive the rule abstractly a second or third time if the first
  attempt already produced a contradiction. Instead, render the SAME
  coordinate data both as-given and with the ambiguous pairing swapped,
  and compare the two actual results. Trust whichever one visibly
  matches the intended shape; that's a directly-checkable fact, where
  restating the abstract rule from memory again is not. This exact
  technique resolved a case where re-deriving the convention symbolically
  gave two different, contradictory answers on two separate attempts.

## Full-screen static images sharing VRAM with an existing renderer

A project needed to show full-screen reference art (title/menu/location
splash images) on both screens, but every VRAM bank on both engines was
already fully committed to existing content (a 256x256 16bpp wireframe
bitmap on the main engine, a text console + bitmap chrome layer on the
sub engine) -- there was no room for a genuinely new, separate bitmap
layer on either screen without a larger restructure. The pattern that
worked: **write the new image directly into the SAME buffer an existing
renderer already owns**, showing the static image and that renderer's
normal output as mutually-exclusive moments in time rather than
simultaneous layers. This is a reasonable fit whenever the two things
genuinely never need to be visible at once (a splash screen vs. gameplay
rendering) -- for the sub-engine bitmap-chrome-layer case specifically,
this also required the priority swap described above, since the chrome
layer's normal priority (above the console) is backwards for a full
image that needs to sit *behind* readable text instead of covering it.
The general lesson: before concluding a new visual needs new VRAM/a new
layer, check whether an existing buffer is a legitimate, non-conflicting
place to draw it first -- confirm by computing byte ranges as above, not
by assuming "there's no room" from bank sizes alone without checking what
each existing occupant is actually using at the moment the new content
would need to appear.
