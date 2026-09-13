---
name: nds-development
description: >-
  Nintendo DS development in two forms: (1) patching retail or homebrew .nds
  ROMs -- editing gameplay values (health, damage, drop rates, timers),
  replacing or resizing assets (fonts, text, graphics, tables), or otherwise
  changing how an existing DS game behaves or looks; (2) building a new NDS
  homebrew app or game from scratch with devkitARM/libnds or BlocksDS, from
  toolchain setup through C code, UI, save/load, and export. Use whenever the
  user uploads or references an .nds file and wants something changed, even
  without words like "ROM hack" or "patch" -- e.g. "make the zombies weaker
  in this DS game", "make the font smaller", "give the player infinite
  ammo", "translate the text in this ROM". Also covers general NDS
  file-format questions (NFTR fonts, the filesystem, ARM9 overlays) without a
  specific patch request, and from-scratch builds -- "let's build a DS app
  that does X", "make a homebrew NDS game", "write an NDS applet using the
  microphone/touch screen", or continuing an existing homebrew project.
---

# NDS Development

Two different tasks share this skill, and the first thing to do is figure
out which one the user actually wants -- they often won't use the words
"patch" or "homebrew", so read the intent, not the vocabulary.

**Patching an existing ROM** is reverse engineering under real
constraints: no source, no debug symbols, and usually no way for *you* to
run the emulator and see the result. **Building new homebrew from scratch**
has real source and a real toolchain, but shares a related constraint: you
often can't run the emulator or touch real hardware yourself either, so a
person testing on their end is still the only one who can observe ground
truth. Both domains are covered by "How to work under these constraints"
below -- read it before writing any code either way. It matters more than
any specific technical section that follows.

## Three different kinds of request, three different workflows

**A. Asset / data patch** (existing ROM) -- "make the font smaller", "swap
this sprite", "translate this game's text", "change the title screen
image". The target is a specific file (or family of files) in the ROM's
filesystem, in some documented or reverse-engineerable format. Workflow:
extract → identify format → understand the format's *actual* rules by
reading real data, not assumed rules from a spec → regenerate → repack →
validate as well as you can offline → hand it to the user to test.

**B. Gameplay / logic patch** (existing ROM) -- "zombies should have less
health", "give the player more starting ammo", "make XP scale faster",
"unlock everything from the start". The target is almost always either a
constant sitting in compiled ARM9 code/data, or actual game logic (a
formula, a branch) that needs its *instructions* changed, not just a data
value. Workflow: extract → locate the value or code via static search and
cross-referencing → disassemble the surrounding code to confirm it's real
and understand what it does → patch (constant tweak, or instruction-level
edit) → reassemble → repack → hand it to the user to test.

Some requests are both (e.g. "reduce enemy health AND show it as a number
on screen" touches code and possibly a UI asset). Split the request and
tackle each half with the right workflow.

**C. From-scratch homebrew** -- "build a DS app that does X", "make a
homebrew game/applet", anything with no existing ROM to modify, including
continued work on a project from an earlier session. Different toolchain
entirely (devkitARM/libnds, not ndspy) -- see Workflow C below. **Two
distinct toolchains exist for this** -- devkitARM/libnds (the default
assumed below) and BlocksDS (a separate, more actively-developed
toolchain built on the Wonderful Toolchain, with its own environment
setup, Makefile templates, and some real API differences). Check which
one an existing project already uses (look for `wf-env`,
`/opt/wonderful/...` paths, or a Makefile referencing `$(BLOCKSDS)`) and
stay consistent with it -- see `references/blocksds-toolchain.md` if so,
**before** assuming devkitARM knowledge transfers wholesale.

## Setup

```python
import ndspy.rom
rom = ndspy.rom.NintendoDSRom.fromFile("game.nds")
```
`pip install ndspy --break-system-packages` if not already present. Run
`python3 scripts/rom_info.py game.nds` first, always -- it gives you the
filesystem listing, ARM9/ARM7/overlay sizes, and flags likely font files.
Orient yourself before writing a single line of patching code.

For workflow B you'll also want `capstone` (disassembler) and
`keystone-engine` (assembler) -- both are pure pip installs, no ARM
toolchain needed: `pip install capstone keystone-engine --break-system-packages`.

## Workflow A: asset / data patches

1. **Identify the format.** Extension and magic bytes first. `.NFTR` /
   `NFTR` or `RTFN` magic → font, see `scripts/nftr.py` and
   `references/nftr-format.md`. Other common ones: `NCGR`/`NCLR`/`NCER`
   (tile graphics + palette + cell data), `NARC` (an archive-within-the-archive,
   unpack it the same way you unpacked the ROM), raw `.bin` files with no
   magic (could be anything -- check whether size/structure suggests a
   table of fixed-size records). If a format looks undocumented or your
   assumptions about a "standard" version don't match the bytes you're
   seeing, don't force it -- treat it as reverse engineering from scratch
   (see "How to work under these constraints").

2. **Read real data before writing any.** Whatever you're about to
   generate, first parse and print out several *real* examples from the
   original file. If you're about to write a width table, dump the
   original width table for ten different characters and look for
   patterns (constant? varies with something? sums to a fixed number?)
   before deciding what your version should contain. This single habit
   would have saved a lot of wasted iteration in the font-patching case
   this skill grew out of (see `references/pitfalls.md`).

3. **Regenerate, preserving the pointer/index structure exactly.** For
   fonts, structured graphics, or lookup tables: don't renumber, resize,
   or reorder anything the original didn't move, because those indices
   are often referenced from *outside* the file too (code, other assets).
   `scripts/nftr.py`'s pattern -- read `orig["cp2gi"]` and assert your
   rebuilt file's map is identical -- generalizes: whatever mapping the
   original file defines, preserve it exactly unless you have a specific
   reason and a way to update every reference to it.

4. **Repack with ndspy, same file slot:**
   ```python
   idx = rom.filenames.idOf("font/font_body_14.NFTR")
   rom.files[idx] = new_bytes
   rom.saveToFile("game_patched.nds")
   ```
   Same path → same FAT index → nothing else in the ROM needs to change.

5. **Validate as well as you can WITHOUT trusting your own decoder** --
   see "How to work under these constraints".

## Workflow B: gameplay / logic patches

1. **Try the free intel first.** Community cheat databases (Action
   Replay / CodeBreaker codes) exist for a huge number of retail DS
   games and are often exactly this kind of edit, already reverse
   engineered by someone else. An AR code for "infinite health" or "max
   ammo" directly names a RAM address and a value -- decoding the code
   format (varies by game/region, search for it) can hand you the target
   address for free instead of searching blind. Worth 5 minutes of
   searching before writing any search code.

2. **Static value search.** If there's no shortcut, use
   `scripts/search_constants.py` to find where a known value (e.g. a
   default health of 100) appears as raw bytes in ARM9 or an overlay.
   This alone is noisy -- compiled binaries are full of coincidental byte
   patterns. The single best way to cut false positives: search for TWO
   values that the same location should hold at two different points
   (e.g. health before and after taking damage) and keep only offsets
   where both hit at the same address. The `--also` flag does this.

3. **Narrow to the right region.** ARM9 overlays are usually loaded for
   specific game states/screens (a boss fight, a shop, a level) --
   `rom.loadArm9Overlays()` gets you each one separately. Searching a
   single relevant overlay instead of the whole ARM9+all-overlays
   haystack cuts false positives enormously. If you don't know which
   overlay is relevant yet, search everything first, then use hit
   density and which overlay makes contextual sense (a "zombies" overlay
   for a zombie-health patch) to prioritize.

4. **Disassemble around every real candidate before touching it.**
   ```python
   import capstone
   md = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)  # or CS_MODE_THUMB
   for insn in md.disasm(data[offset-32:offset+32], base_addr):
       print(f"{insn.address:#x}: {insn.mnemonic} {insn.op_str}")
   ```
   A raw hit offset from the search is NOT necessarily code, and even if
   it is, it's not necessarily instruction-aligned, and ARM9 code on DS
   commonly mixes ARM and THUMB mode by region -- try both modes if the
   disassembly looks like nonsense (repeated weird mnemonics, operands
   that don't make sense together). See `references/binary-patching.md`
   for how to tell real disassembly from noise, and for ARM vs THUMB
   detection tips.

5. **Prefer the smallest correct edit.** If the value is a plain
   immediate constant loaded into a register or stored to a struct field,
   changing just that constant is far lower-risk than altering control
   flow. Only resort to changing branches/comparisons (e.g. NOPing a
   damage-scaling call, flipping a conditional) when the thing you want
   genuinely isn't a constant -- e.g. a scaling *formula*, not a fixed
   number. Reassemble a changed instruction with `keystone` and write the
   bytes back at the exact same offset (same length -- ARM instructions
   are fixed 4 bytes, THUMB fixed 2 bytes, so a same-mode edit never
   needs to shift anything else in the file).

6. **Repack and hand off to test**, same as workflow A.

## Workflow C: from-scratch homebrew

This is a different task from A/B: no existing ROM, no ndspy. The
toolchain is devkitARM + libnds, the output is a fresh `.nds` built from
C source. See `references/homebrew-setup.md` for the exact toolchain
bootstrap (installing devkitARM/libnds in an environment that doesn't
already have it, including two non-obvious network gotchas). The rest of
this section is judgment that setup instructions won't tell you -- gotchas
that either don't fail loudly (silently-wrong data) or only fail on real
hardware and not in an emulator, plus practices that keep a project
healthy across many sessions.

### Toolchain and hardware gotchas

**If this project uses BlocksDS rather than devkitARM/libnds, read
`references/blocksds-toolchain.md` now** -- environment setup, project
templates, and several of the API details below differ in ways that
aren't safe to assume transfer between the two toolchains.

1. **Read a real example before writing from memory.**
   `$DEVKITPRO/examples/nds/` ships current, buildable examples covering
   audio, graphics, input, filesystem, card, wifi, etc. -- read the one
   closest to the task before writing equivalent code. libnds's API
   surface has moved on from a lot of tutorials/StackOverflow answers
   still floating around online, and a mismatch usually doesn't fail to
   compile -- see the next point for what that looks like.

2. **Modern libnds (2.x, the "calico" backend) has quietly changed some
   long-standing assumptions.** Two that bit during real development:
   - The ARM7 side no longer needs a custom binary for standard hardware
     (mic, sound, keys, touch): `ndstool` links a prebuilt `ds7_maine.elf`
     automatically (see `_ARM7_ELF` in `$(DEVKITARM)/ds_rules`). A simple
     app can be pure ARM9 C with no `arm7/` source tree at all. Don't
     assume this transfers to every peripheral -- verify per-feature.
   - `MicFmt_Pcm8` (mic recording) is **signed** 8-bit PCM centered on 0,
     not the older unsigned-centered-on-128 format many examples assume.
     Getting this wrong doesn't crash or fail to compile -- it silently
     produces plausible-looking-but-wrong data (specifically: the sign
     flips at every zero-crossing, which reads as random noise/glitching,
     not an obviously-wrong value). When a hardware format has a
     "signed vs unsigned" or "centered how" question, check the current
     header/enum comment for that exact symbol rather than trusting
     cached knowledge of "how the DS mic works" -- the driver
     implementation underneath can change even when the public function
     name (`soundMicRecord`) stays the same.

3. **Prefer overriding one output of a known-good high-level call over
   reimplementing its internals.** `soundMicRecord()` hardcodes the mic
   amp gain as one of its last internal steps; getting a different gain
   only requires calling `pmMicSetAmp(true, <preset>)` again right after
   it returns. Hand-rolling the underlying `micInit`/`micSetCpuTimer`/
   `micSetCallback`/`micStart` sequence just to reach that one parameter
   is easy to get subtly wrong -- it did, once, and silently broke
   recording entirely (on both hardware and emulator) until reverted.
   This generalizes: when a high-level libnds call almost does what's
   needed, look for a way to adjust its result afterward before
   reimplementing its setup sequence from lower-level primitives.

4. **Any buffer a hardware/DMA-driven API writes into (mic, card, wifi)
   needs `__attribute__((aligned(32)))` and a `DC_InvalidateRange()` call
   before the ARM9 reads it.** The ARM9 data cache can otherwise return a
   stale cached copy of memory that hardware just overwrote out from
   under it. **This class of bug is real-hardware-only** -- melonDS (and
   most NDS emulators) doesn't model cache staleness, so code missing
   this invalidate will work perfectly in the emulator and glitch,
   freeze, or show frozen/ping-ponging content on real hardware. Treat
   "clean on melonDS, broken on hardware" as a specific signal to check
   cache handling on any buffer hardware writes into -- not a reason to
   start tuning rendering logic or unrelated parameters.

4a. **A video-mode/BG-layer capability mismatch produces a specific,
    easy-to-misdiagnose visual symptom that looks like a VRAM-content
    bug but isn't one.** Setting a bitmap-type background on a layer/
    mode combination that doesn't actually support bitmaps there
    doesn't fail loudly -- the hardware silently reinterprets the same
    bytes as tile-map data, rendering as a faint, regular pattern across
    the screen, easily mistaken for uncleared VRAM (a real, separate,
    similarly-symptomed bug -- `vramSetBank*` calls only repoint a
    control register, they never clear the memory they map). Before
    debugging either symptom, check the actual mode against the real
    per-engine capability table for every layer involved, not just the
    one being actively worked on -- full table and worked examples in
    `references/blocksds-toolchain.md`.

5. **Full-screen redraws every frame cause visible tearing on real
   hardware if they aren't synced to vblank** -- and separately, even
   when they *are* synced to vblank, a full-screen redraw on every frame
   of a continuous touch-drag can still be a straight performance
   problem, not just a tearing one. Redrawing a whole ~40000-pixel
   canvas on every drag-move event was measured at close to an entire
   frame's time budget by itself; the fix is the same dirty-region
   tracking as the tearing case (erase exactly the previous frame's
   drawn extent -- a line's pixels, a rect's outline, a moved object's
   old bounding box -- then draw the new one) but worth checking for
   even when tearing was never the symptom you started from. Any code
   path that fires once per touch-move frame during a drag is worth this
   scrutiny by default.

6. **A full-screen modal overlay (on-screen keyboard, a picker grid, any
   UI that temporarily owns all touch input) needs to suppress the next
   touch after it closes**, or the same physical touch that closed it can
   immediately register as a fresh tap on whatever's now visible
   underneath -- a stray draw action or button press right as the overlay
   dismisses, easy to misdiagnose as an unrelated rendering glitch since
   the symptom shows up on the screen *behind* the thing that actually
   closed. Fix: a `suppressTouchUntilRelease`-style flag set whenever an
   overlay closes, checked before normal touch dispatch resumes, cleared
   only once the touch reader reports no contact at all.

7. **When laying out a fixed-size touch UI (a toolbar with N icon slots,
   a grid of M buttons), verify the arithmetic explicitly** rather than
   eyeballing it -- compute the actual pixel extent (`icon_top + n_slots *
   (icon_size + gap)`) against the real screen dimension before
   committing, the same way you'd verify any other numeric claim. This
   also catches a specific, easy-to-miss class of bug: two
   independently-computed dimensions that are *supposed* to sum to a
   shared total (e.g. a side panel's width + a canvas's width = screen
   width) silently drifting apart when one changes without the other
   being re-derived -- the gap doesn't render as anything and doesn't
   handle touch correctly either, so it can sit unnoticed until someone
   touches exactly that strip. Either derive one dimension from the other
   directly instead of hardcoding both, or add an explicit check.

### Design and interaction patterns

8. **Undo/redo snapshots belong at the moment something is actually
   about to change, not at the moment a gesture starts.** Taking a
   snapshot on touch-down and committing on release means starting a
   drag and then cancelling it (sliding onto a toolbar, say) silently
   burns the undo slot on a change that never happened. Move the
   snapshot to immediately before the actual mutation, and for an
   edit-in-place action (retyping text, nudging a value), compare old vs
   new before deciding whether to snapshot at all -- a no-op edit
   shouldn't cost the undo slot either.

9. **Draw transient/overlay UI (a selection marquee, resize handles, a
   text cursor) by inverting the pixels underneath rather than in a
   fixed colour.** On a 1-bit canvas with any dither patterns or dark
   fills available, something drawn in flat black is guaranteed to
   disappear the moment it lands on black content -- inverting is
   defined relative to whatever's actually there, so it can never
   collide with it. For body text specifically (not overlay chrome), a
   fixed alternate colour selected per-object (e.g. a stored "show
   inverted" flag on a text field) reads more cleanly than a per-pixel
   invert, since text needs consistent colour to stay legible rather
   than a background-dependent flicker.

10. **Extending a from-scratch app over many sessions needs its own
    small discipline, separate from getting any one feature right:**
    - **Renaming/rebranding touches more places than the obvious one.**
      Beyond in-app text: the Makefile's `TARGET` (the actual output
      filename), `GAME_TITLE`/`GAME_SUBTITLE*` (the ROM banner shown on
      the real DS system menu, not just in-app), and any header comments
      that name the project. Grep for the old name across the whole tree
      rather than trusting memory of where it appears.
    - **Adding a menu item or app state means re-checking every existing
      index-based reference**, not just adding the new one. `grep` every
      `menuSelected ==`-style comparison after inserting into the middle
      of an ordered list -- easy to add a new entry and forget every
      later index shifted by one.
    - **A small persisted-settings blob deserves the same rigor as a
      save file, at smaller scale**: a magic number, a version field,
      and -- critically -- clamping loaded values into their valid range
      rather than trusting them, even though it's "just settings". A
      hand-edited or version-mismatched file can still have an in-range
      magic/version but an out-of-range field value.
    - **A design/status doc (a help file, a feature-status table) goes
      stale the moment a feature ships that it doesn't mention yet.**
      Re-verify every "Built/Stub/Planned"-style status against the
      actual current code before editing such a doc, not just the
      specific rows the latest change obviously touches.
    - **Before "porting an asset from another project" is treated as
      routine, check whether that project actually stores the asset as
      something extractable** (a plain array, a documented file format)
      or as an opaque application-specific resource meant to be edited
      through its own tooling. Icons and small bitmaps are often the
      former; fonts, especially in editor-style creative tools, are
      frequently the latter (bespoke binary blocks inside a document
      format, editable only via a dedicated in-app editor, not a
      readable array in the source). Checking first costs one search and
      avoids either overclaiming a "port" that didn't happen or
      reverse-engineering a binary format with no way to verify the
      result. When direct porting isn't practical, hand-authoring a
      replacement with the render-and-verify pipeline below is usually
      the more honest and more reliably-correct path.
    - **When hand-authoring a bitmap font, design the glyphs most likely
      to collide with each other or with existing ones, then render them
      side by side before finalizing anything** -- not in isolation. A
      no-descender lowercase p/q, drawn full-height the same way
      ascenders were, rendered indistinguishable from an existing
      uppercase P and the digit 9: correct-looking alone, wrong in
      context. The fix (x-height positioning matching the other
      non-ascender lowercase letters) only became obvious once they were
      seen next to a/c/e/o. Worth a dedicated comparison render for any
      glyphs an app specifically depends on staying distinct (e.g.
      lowercase l vs. digit 1 vs. uppercase I).

11. **The debugging-blindness discipline in "How to work under these
    constraints" below applies here too, unchanged** -- you can't run
    melonDS or touch real hardware yourself, so every fix is a hypothesis
    until the person reports back. One addition specific to from-scratch
    work: if a fix regresses in a *new* way -- something that partially
    worked now doesn't work *at all*, especially across platforms/paths
    that were previously fine -- that pattern change is itself evidence.
    It points at the most recent structural code change, not at
    parameters within it. Revert the structural change first and confirm
    the prior working behavior returns before reapplying anything.

### Verifying without hardware access

12. **A surprising amount of a DS app's correctness is checkable without
    ever touching a device**, and this is worth treating as a default
    practice, not a fallback for when testing is unavailable: pure logic
    (hit-testing, wrapping, serialization) can be compiled with the
    host's own gcc against a tiny type shim and exercised with a real
    test harness; the *actual* production drawing code can be rendered
    to a real framebuffer array and converted to a viewable PNG, giving
    genuine visual verification with no emulator; a real PNG can be
    written for export with no zlib/libpng dependency, verified against
    an independent decoder rather than your own. Each of these caught
    real, non-obvious bugs that reading the code did not surface (an
    integer-division sign bug in two hit-test functions; a
    nested-double-border from a highlight drawn around the wrong box's
    bounds). **See `references/homebrew-testing.md` for the full
    technique, the exact bugs each one caught, and a standing `tests/`
    directory shape worth reusing wholesale in the next project.**

13. **Autosave and other "keep memory and disk in sync" logic mostly
    lives in the interactive main loop, which the above techniques can't
    test directly** -- get correctness by construction instead: piggyback
    a "dirty" flag on existing undo-snapshot call sites rather than
    tracking mutations separately, gate the actual write on genuine
    input-idle time rather than a fixed interval, and specifically audit
    every place that *also* needs to clear the flag (export-that-saves-
    internally, load-from-disk), not just the obvious manual-save path.
    Full detail and a real gap this caught in `references/homebrew-testing.md`.

## How to work under these constraints

This is the part that actually matters, more than any specific format or
API detail above. In both patching and from-scratch work, you are very
likely working blind: you usually can't run the DS emulator yourself, so
every change you produce is a hypothesis until the user reports back.
Several real failure modes came out of forgetting this mid-session:

- **Your own decoder validating your own encoder proves nothing.** If you
  write a parser and a writer using the same assumptions, of course they
  agree with each other -- that's not evidence either is correct. The one
  piece of real ground truth available offline is the *original,
  untouched* file (or, for homebrew, an independent decoder you didn't
  write -- see `references/homebrew-testing.md`). Validate against that
  before trusting any preview your own code generates for its own output.

- **"Nothing changed" is data, not a stall.** If you change several
  things about a patch and the observed result is identical across
  attempts, that's strong evidence none of the things you varied are the
  actual cause -- stop varying them and go look at what's *common* across
  every attempt instead. Chasing the same wrong hypothesis with bigger or
  smaller numbers wastes the user's test cycles.

- **When you're truly stuck, stop guessing and go measure.** Dump the
  original file's actual fields across several known-good real examples
  and look for patterns (a field that's always identical, a pair of
  fields that always sum to a constant, etc.) rather than continuing to
  iterate on parameters. This is slower per-step but converges; blind
  parameter iteration can run in circles indefinitely, particularly once
  you've built a self-consistent-but-wrong mental model.

- **A written spec (or a spec for a similar-sounding format from a
  different game) is a hypothesis, not ground truth.** Formats drift
  between SDK versions and between developers' in-house tooling. Treat
  any spec you find online as a starting guess to check against the
  actual bytes in front of you, not an authority to defer to when they
  disagree.

- **State your confidence honestly, every round.** "I fixed a concrete
  bug I can point to in the data" and "I have a plausible theory but
  can't verify it without your test" are different claims -- say which
  one you're making. Overclaiming confidence after an unverified change
  is what makes repeated failed iterations frustrating; it reads as not
  listening rather than as genuinely new information each time.

- **When the user says "you're not thinking hard enough, slow down"** --
  that's a signal to stop changing code and start reading/measuring
  instead. Don't respond with another quick parameter tweak.

- **Extracting a tileable pattern (a dither swatch, a repeating texture)
  from a reference image is a different problem from drawing one from
  scratch, and the obvious period-detection test is wrong.** The
  tempting check -- "does a copy of the image shifted by p pixels mostly
  match the original?" -- passes for the *wrong*, too-small period
  whenever the source is sparse, because most pixels agree with their
  neighbor trivially regardless of the pattern's real structure. The
  correct test is reconstruction error: build the candidate tile via
  majority vote, *tile it back out* across the full source region, and
  measure the fraction of pixels that disagree with the original -- only
  accept a period once that error is genuinely low, trying candidate
  periods smallest-first. Also worth budgeting time for: cell/grid-
  boundary detection on a scanned or exported reference sheet is rarely
  perfectly uniform, so a fixed crop-margin constant tuned against one
  boundary can clip real content at another -- spot-check a few
  boundaries individually.

- **Hand-authored pixel art (fonts, icons, any bitmap baked into source)
  doesn't have to be authored blind, even when the emulator/hardware
  path is unavailable.** Render candidate bitmaps to PNG with a
  throwaway Python+PIL script (a bit array scaled up 12-16x with
  gridlines) and view the PNG before transcribing anything into source.
  For icons/logos, draw at high oversample with vector primitives (PIL's
  ImageDraw: polygons, rotated rects, lines with width) then threshold
  down to the target resolution -- cleaner diagonal edges than a
  hand-typed grid manages, with threshold and shape parameters tunable
  by actually looking at the result across a few iterations. A
  from-scratch pencil icon once went through 5+ rounds of visible,
  corrected mistakes that blind authoring would have shipped without
  anyone knowing until real hardware testing caught it, if it caught it
  at all. Worth spending five minutes running this same render-and-
  inspect pass retroactively over anything upstream that WAS authored
  blind (a font table typed as raw hex, say) -- cheap insurance once the
  pipeline exists, and it can turn a standing "unverified" flag into a
  confirmed-correct one.

See `references/pitfalls.md` for the specific, detailed war story this
guidance was distilled from (a DS font-shrinking patch that went through
nine iterations before the real bugs were found) -- worth reading in full
if you want the concrete texture behind the bullet points above.

## Reference files

- `references/rom-structure.md` -- NDS ROM layout: header, filesystem
  (FNT/FAT), ARM9/ARM7, overlays. Read this if you need more than
  `rom_info.py` gives you, or ndspy's abstractions aren't covering
  something you need (raw header fields, overlay table details).
- `references/nftr-format.md` -- full worked derivation of the NFTR font
  format used by `scripts/nftr.py`, including every reverse-engineered
  quirk and how each was confirmed against real data. Read before
  patching fonts in a *different* game -- re-verify each quirk rather
  than assuming it transfers.
- `references/binary-patching.md` -- static value search methodology,
  ARM vs THUMB disassembly, recognizing real code vs. noise, common safe
  edit patterns (constant swap, NOP, branch flip).
- `references/pitfalls.md` -- the detailed war story behind "How to work
  under these constraints" above (ROM patching side).
- `references/homebrew-setup.md` -- exact toolchain bootstrap for
  Workflow C: installing devkitARM/libnds from scratch in an environment
  that doesn't already have it, including the network-level gotchas that
  make the standard installer fail silently-confusingly.
- `references/blocksds-toolchain.md` -- BlocksDS, a second, distinct
  from-scratch toolchain (Wonderful Toolchain-based, not devkitPro pacman-
  based). Environment setup, project templates, and a set of real,
  hard-won hardware/API gotchas specific to this toolchain: the DS's
  per-engine BG-mode capability tables (and the specific misleading
  visual symptom a mismatch produces), display priority vs. transparency
  as independent axes, palette-index-0/bit-15 transparency conventions
  confirmed from Nintendo's own documentation, VRAM bank-mapping vs.
  clearing, `mapBase`/`tileBase` byte-offset arithmetic, and a real
  upside-down-rendering bug caused by trusting a misleadingly-named
  coordinate field. Read this before assuming devkitARM/libnds knowledge
  transfers to a BlocksDS project.
- `references/homebrew-testing.md` -- the full technique behind Workflow
  C items 12-13: host-side unit testing, rendering production drawing
  code to a PNG for visual verification, writing PNGs without zlib, and
  the autosave/dirty-flag pattern -- including the real bugs each one
  caught and a standing `tests/` directory shape worth reusing.

## Scripts

- `scripts/rom_info.py` -- orientation dump, run first on any ROM.
- `scripts/nftr.py` -- NFTR font parser/writer (see its module docstring
  for the specific format quirks it encodes -- re-verify each one against
  a new ROM before assuming it applies).
- `scripts/search_constants.py` -- static byte-pattern search across
  ARM9 + overlays, with cross-referencing to cut false positives.
