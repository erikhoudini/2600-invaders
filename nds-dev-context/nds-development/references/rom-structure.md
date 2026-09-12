# NDS ROM structure

`ndspy` (`ndspy.rom.NintendoDSRom`) handles nearly all of this for you --
this doc is for when you need to understand what it's abstracting, or need
a raw header field it doesn't expose directly.

## High-level layout

```
0x000       Header (0x200 bytes) -- game code, title, offsets/sizes for
            everything below, ARM9/ARM7 entry points and RAM addresses
0x200...    ARM9 binary (main CPU program -- almost all game logic lives here)
...         ARM7 binary (secondary CPU -- typically audio, wifi, low-level I/O;
            gameplay values are rarely here, don't start your search in ARM7)
...         Overlay tables (which overlay maps to which file ID + RAM address)
...         FNT (filename table) + FAT (file allocation table) -- together
            these are "the filesystem"
...         Banner (icon + title shown on the DS menu)
...         File data (everything the FNT/FAT point into)
```

`rom.arm9`, `rom.arm7` -- raw bytes of each binary.
`rom.arm9RamAddress` / `rom.arm7RamAddress` -- where each gets loaded in
RAM at runtime. If you ever need to convert a RAM address (e.g. from a
disassembler, a debugger, or a cheat code) into a file offset:
`file_offset = ram_address - rom.arm9RamAddress`. This conversion is easy
to get backwards -- double check which direction you need.

## Overlays

Large games split code into "overlays" -- chunks of ARM9 code loaded in
and out of a fixed RAM region as needed (a boss fight's logic doesn't need
to stay resident during the main menu). This is *exactly* where
game-mode-specific logic (a specific enemy type, a specific level) tends
to live, which makes overlays a good place to narrow a search.

```python
overlays = rom.loadArm9Overlays()   # dict: overlay id -> Overlay object
overlays[5].data                    # raw bytes
overlays[5].ramAddress              # where it loads at runtime
```

If loading fails or looks empty, the ROM may use ARM7 overlays instead
(`rom.loadArm7Overlays()`) or have none at all -- not every game uses them.

## Filesystem (FNT/FAT)

The in-ROM filesystem is a tree of folders, each folder holding files in
a contiguous ID range starting at `folder.firstID`.

```python
def walk(folder, prefix=""):
    out = []
    for name, sub in folder.folders:
        out.extend(walk(sub, prefix + name + "/"))
    for i, name in enumerate(folder.files):
        out.append((prefix + name, folder.firstID + i))   # NOTE: files are
    return out                                              # just names --
                                                             # ID = firstID + index,
                                                             # NOT a stored pair
```
That last point is a real gotcha: `folder.files` is a plain list of
filename strings, not `(name, id)` tuples -- it's tempting to assume
otherwise and unpack it wrong. Get a file's ID with `rom.filenames.idOf(path)`
if you already have the path; use the `firstID + index` scheme above only
when walking the whole tree.

```python
idx = rom.filenames.idOf("font/font_body_14.NFTR")
data = rom.files[idx]              # read
rom.files[idx] = new_bytes         # write (can be a different length --
                                    # ndspy recomputes the FAT on save)
rom.saveToFile("out.nds")
```

Replacing file content in place, same path, same index, is always safe
regardless of size change -- nothing else in the ROM needs to be touched,
since everything else references files by index, and ndspy handles
recomputing the FAT's offsets/lengths for you on save. Inserting, deleting,
or renaming files is a different and much riskier operation -- avoid it
unless the task genuinely requires it, since it changes IDs that may be
referenced from ARM9 code you're not looking at.

## Common asset formats you'll run into

- **NARC** -- an archive-within-the-archive (its own mini filesystem).
  Very common for grouping related assets (e.g. all the graphics for one
  level). `ndspy.narc.NARC.fromFile()` / `.save()` handles these directly.
- **NCGR / NCLR / NCER** -- tile graphics, palette, and cell (sprite
  composition) data respectively, almost always used together. `ndspy`
  has partial support (`ndspy.graphics2d`); check current ndspy docs for
  coverage before writing your own parser.
- **NFTR** -- fonts. See `references/nftr-format.md`.
- **Plain `.bin` with no magic** -- could be anything: a compiled data
  table, raw pixel data, a proprietary text/script format. Check for
  patterns first: fixed-size records (does `filesize % N == 0` for a
  plausible record size?), repeated substructure, ASCII-adjacent bytes
  suggesting embedded text. Don't assume a specific meaning without
  evidence from the actual bytes.
