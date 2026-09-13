# Static binary patching (gameplay values, formulas, logic)

For workflow B in SKILL.md: finding and changing compiled behavior (health,
damage, drop rates, scaling formulas) rather than a data/asset file. This
is inherently harder to fully verify offline than an asset patch, since
the "correct" answer is defined by runtime behavior you can't observe
yourself -- lean even harder on the "how to work under these constraints"
guidance in SKILL.md for this workflow than for asset patching.

## Step 0: check for existing community reverse engineering first

Action Replay / CodeBreaker cheat codes for a retail game are frequently
exactly this kind of edit, already found by someone else. A code for
"infinite health" or "one-hit kills" names a RAM address (and sometimes
the exact value/comparison) directly. Decoding the AR code format
(varies, search for the specific format used by codes for that game/
region) can turn a blind search into a five-minute lookup. Always worth
checking before spending search-and-disassemble time.

## Step 1: static value search

`scripts/search_constants.py` searches ARM9 + overlays for a value
encoded as 1/2/4-byte little-endian integers. On its own this is noisy --
```
python3 search_constants.py game.nds --value 100
```
can easily return 100+ hits in a large binary, most of them coincidental
byte patterns unrelated to your target. Two things cut this down a lot:

**Cross-reference two values from the same location.** If you know (or
can reasonably guess) that some value changes between two observable game
states -- health before and after taking a specific hit, ammo before and
after firing once -- search for both and keep only offsets where BOTH
hit (same address, same width). `--also` does this automatically. This is
the single highest-leverage narrowing technique available without a live
debugger.

**Restrict to a specific overlay.** If you have any contextual reason to
believe a specific overlay handles the relevant game mode (check overlay
sizes and how many there are -- a game with distinct "zombie mode" logic
likely has a dedicated overlay for it), search only that overlay with
`--overlay N`. A 5-10KB overlay produces far fewer coincidental hits than
a 700KB ARM9 binary.

**Pick uncommon values when you have the choice.** Searching for `1` or
`0` in a compiled binary is nearly useless -- those bytes are everywhere.
A specific, slightly unusual number (health of 137, not health of 100) is
much more discriminating.

## Step 2: disassemble before touching anything

A raw byte-search hit is not proof of anything. It could be:
- Inside actual executable code (what you want)
- Inside a data table, string, texture, or other non-code region that
  happens to contain that byte pattern
- Code, but not instruction-aligned relative to where you're starting
  disassembly (ARM instructions are 4-byte aligned, THUMB 2-byte -- if
  you disassemble starting mid-instruction, everything after looks like
  garbage even if the underlying bytes are legitimate code)
- Code, but in the *other* instruction mode than you assumed (DS ARM9
  binaries commonly mix ARM and THUMB by function/region)

```python
import capstone
md_arm   = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)
md_thumb = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_THUMB)

for insn in md_arm.disasm(data[start:end], base_address):
    print(f"{insn.address:#x}: {insn.mnemonic}\t{insn.op_str}")
```

**Recognizing real disassembly vs. noise:** real ARM/THUMB code from a
game has a recognizable rhythm -- function prologues (`push {..., lr}`),
epilogues (`pop {..., pc}` or `bl`/`bx lr`), loads/stores to small
constant offsets from a base register (struct field access), branches
with plausible nearby targets, comparisons followed by conditional
branches. Garbage disassembly (wrong alignment or wrong mode) tends to
look locally plausible instruction-by-instruction but not add up to
anything coherent -- weird operand combinations, mnemonics that don't
follow logically from what came before, or instructions decoding across
what should be a function boundary. If it looks off, try: shifting the
start address by 2 bytes (THUMB misalignment), the other instruction
mode, or a different, cleaner-looking hit from your search results.

**Getting the RAM→file-offset conversion right:**
```python
file_offset = ram_address - region_ram_base
```
where `region_ram_base` is `rom.arm9RamAddress` for the main binary or
`overlay.ramAddress` for a specific overlay. Getting this backwards is an
easy, silent mistake -- sanity check by converting a known address both
ways and confirming you land back where you started.

## Step 3: understand what you're looking at before changing it

Once you have plausible real code around a hit, read enough of it to form
a hypothesis about what it's doing before changing anything:
- A comparison immediately followed by a conditional branch is very
  likely a threshold check (e.g. "if health <= 0, branch to death logic")
  -- useful both as confirmation you've found the right value and as a
  map of what else references it.
- A load of a constant into a register, used shortly after in an
  arithmetic op, is a strong candidate for exactly the kind of "simple
  constant" edit that's safest to make.
- A `bl` (branch-with-link, i.e. a function call) near your value might
  mean the value feeds into a shared formula/utility function rather than
  being used directly -- in which case the *function* may be what encodes
  a scaling curve you want to change, not the constant itself.

## Step 4: make the edit

**Prefer changing a constant over changing logic.** If the value is a
plain immediate loaded into a register or written to memory, that's the
lowest-risk edit -- change the bytes that encode the immediate, leave
every surrounding instruction untouched. This preserves instruction
alignment and doesn't risk breaking unrelated control flow.

**When logic itself needs to change** (e.g. "damage scaling should be
slower" implies a formula, not a single constant): identify the smallest
instruction-level change that expresses the new behavior -- adjusting an
immediate in a multiply/shift that implements the scaling, or in the more
invasive cases, changing a comparison operator (e.g. flipping a branch
condition) or NOPing out a call you want to skip entirely. Reassemble
with keystone:

```python
import keystone
ks = keystone.Ks(keystone.KS_ARCH_ARM, keystone.KS_MODE_ARM)  # or MODE_THUMB
encoding, count = ks.asm("MOV R0, #50", addr=target_ram_address)
new_bytes = bytes(encoding)
```

**Keep edits the same length as what they replace.** A same-mode
instruction edit (ARM→ARM, 4 bytes for 4 bytes; THUMB→THUMB, 2 bytes for
2 bytes) never shifts anything else in the file, which is by far the
safest property to preserve -- every other address in the binary stays
valid. Growing or shrinking a code region is possible (e.g. redirecting
to injected code in unused space) but is a much bigger, riskier
undertaking than this skill's default scope; only go there if the edit
genuinely can't be expressed in the same number of bytes, and treat it as
a distinct, higher-risk task requiring more validation, not a routine
step.

## Step 5: write back and validate what you can offline

```python
# ARM9 main binary:
rom.arm9 = rom.arm9[:file_offset] + new_bytes + rom.arm9[file_offset+len(new_bytes):]

# or inside a specific overlay:
overlays = rom.loadArm9Overlays()
ov = overlays[overlay_id]
ov.data = ov.data[:file_offset] + new_bytes + ov.data[file_offset+len(new_bytes):]
rom.saveArm9Overlays(overlays)   # check current ndspy API for the exact save call

rom.saveToFile("game_patched.nds")
```

Offline validation for this workflow is inherently weaker than for asset
patches -- you generally can't simulate "what does the game actually do
now" the way you can simulate a font's draw loop. What you CAN do:
- Re-disassemble the patched region and confirm it decodes to exactly the
  instruction you intended, with no stray garbage from a length mismatch.
- If several instructions changed, re-disassemble a wider surrounding
  window and confirm everything after your edit still decodes as
  plausible code (a length mismatch earlier in the edit would desync
  everything after it).
- State clearly to the user that this is a hypothesis pending their test
  -- don't claim more confidence than "the disassembly looks correct and
  matches my intent," which is a real but limited form of validation.
