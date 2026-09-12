"""
rom_info.py -- quick orientation dump for an NDS ROM.

Usage:
    python3 rom_info.py path/to/game.nds
    python3 rom_info.py path/to/game.nds --list-files
    python3 rom_info.py path/to/game.nds --list-files --filter book

Run this FIRST on any new ROM, before writing any patching code. It answers
the questions you need before choosing a workflow:
  - What's in the filesystem? (candidate asset files to patch directly)
  - How big are ARM9/ARM7 and how many overlays are there? (where compiled
    game logic -- and therefore gameplay constants -- actually live)
  - Does this ROM's NFTR use the same byte-reversed 'RTFN' convention as
    scripts/nftr.py assumes, if you're hunting for fonts?

Requires ndspy (pip install ndspy --break-system-packages).
"""
import sys
import argparse
import ndspy.rom


def walk(folder, prefix=""):
    out = []
    for name, sub in folder.folders:
        out.extend(walk(sub, prefix + name + "/"))
    for i, name in enumerate(folder.files):
        out.append((prefix + name, folder.firstID + i))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom_path")
    ap.add_argument("--list-files", action="store_true", help="list every file in the NDS filesystem")
    ap.add_argument("--filter", default=None, help="only list files whose path contains this substring")
    args = ap.parse_args()

    rom = ndspy.rom.NintendoDSRom.fromFile(args.rom_path)

    print(f"Name: {rom.name}")
    print(f"Game code: {rom.idCode}")
    print(f"ARM9: {len(rom.arm9)} bytes, entry {hex(rom.arm9EntryAddress)}, RAM base {hex(rom.arm9RamAddress)}")
    print(f"ARM7: {len(rom.arm7)} bytes, entry {hex(rom.arm7EntryAddress)}, RAM base {hex(rom.arm7RamAddress)}")

    try:
        overlays9 = rom.loadArm9Overlays()
        print(f"ARM9 overlays: {len(overlays9)}")
        total_ov9 = sum(len(o.data) for o in overlays9.values())
        print(f"  total overlay data: {total_ov9} bytes across {len(overlays9)} overlays")
    except Exception as e:
        print(f"ARM9 overlays: couldn't load ({e})")

    all_files = walk(rom.filenames)
    print(f"\nFilesystem: {len(all_files)} files")

    if args.list_files:
        for path, idx in sorted(all_files):
            if args.filter and args.filter.lower() not in path.lower():
                continue
            size = len(rom.files[idx])
            print(f"  [{idx:4d}] {size:9d}  {path}")
    else:
        # just show top-level folders as a map, and flag likely font files
        exts = {}
        for path, idx in all_files:
            ext = path.rsplit(".", 1)[-1].lower() if "." in path else "(none)"
            exts.setdefault(ext, []).append((path, idx))
        print("\nBy extension (use --list-files --filter <ext> to see all):")
        for ext, items in sorted(exts.items(), key=lambda kv: -len(kv[1])):
            print(f"  .{ext}: {len(items)} files")

        font_like = [p for p, i in all_files if p.upper().endswith(".NFTR") or "font" in p.lower()]
        if font_like:
            print(f"\nLikely font files ({len(font_like)}):")
            for p in font_like[:20]:
                print(f"  {p}")
            if len(font_like) > 20:
                print(f"  ... and {len(font_like)-20} more (use --list-files --filter font)")
            # check the byte-reversed magic convention scripts/nftr.py assumes
            idx = rom.filenames.idOf(font_like[0])
            magic = bytes(rom.files[idx][0:4])
            if magic == b'RTFN':
                print(f"\n  Magic check: '{font_like[0]}' starts with RTFN -- scripts/nftr.py's")
                print(f"  byte-reversed-magic assumption applies to this ROM.")
            elif magic == b'NFTR':
                print(f"\n  Magic check: '{font_like[0]}' starts with NFTR (standard, NOT reversed).")
                print(f"  scripts/nftr.py assumes RTFN -- re-derive struct formats for this ROM")
                print(f"  rather than assuming they transfer. See references/nftr-format.md.")
            else:
                print(f"\n  Magic check: '{font_like[0]}' starts with {magic} -- not a recognized")
                print(f"  NFTR variant, this is some other font/text format entirely.")


if __name__ == "__main__":
    main()
