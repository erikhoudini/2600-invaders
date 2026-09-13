"""
search_constants.py -- find candidate gameplay values (health, damage,
scaling factors, etc.) inside a ROM's ARM9 binary and overlays.

This is the STATIC equivalent of a Cheat Engine / Action Replay style
"search for known value" -- we can't attach to a running emulator here, so
instead we search the compiled code and data for a plausible numeric
constant and let you narrow down from there with disassembly.

Usage:
    # find every place the byte sequence for int16/int32 value 100 appears
    python3 search_constants.py game.nds --value 100

    # narrow by also trying a value you'd expect after some in-game event
    # (e.g. player took damage and health read 84) -- run twice and compare
    python3 search_constants.py game.nds --value 100 --also 84

    # search only a specific overlay (much smaller haystack, fewer false
    # positives) once you have a hunch which one holds gameplay logic
    python3 search_constants.py game.nds --value 100 --overlay 4

This alone will NOT tell you which hit is real -- compiled binaries are
full of coincidental byte patterns. Use it to shortlist locations, then
disassemble around each candidate (see disassemble_region() below, or
references/binary-patching.md) to see whether the surrounding code looks
like plausible game logic (a comparison, a subtraction, a store to a
struct field) versus being inside unrelated data (e.g. a texture or string
table where 100 shows up by accident).
"""
import sys
import argparse
import struct
import ndspy.rom


def search_bytes(data, value, widths=(1, 2, 4), signed_too=True):
    """Search a byte blob for `value` encoded as 1/2/4-byte little-endian
    integers (both unsigned and, optionally, signed range). Returns a list
    of (offset, width, signed) tuples."""
    hits = []
    for width in widths:
        for is_signed in ([False, True] if signed_too else [False]):
            try:
                packed = value.to_bytes(width, "little", signed=is_signed)
            except OverflowError:
                continue
            start = 0
            while True:
                idx = data.find(packed, start)
                if idx == -1:
                    break
                hits.append((idx, width, is_signed))
                start = idx + 1
    return hits


def region_name(rom, offset_in_binary, which):
    return f"{which} +{hex(offset_in_binary)}"


def dump_context(data, offset, width, n=16):
    lo = max(0, offset - n)
    hi = min(len(data), offset + width + n)
    chunk = data[lo:hi]
    marker_pos = offset - lo
    hexstr = chunk.hex(" ")
    return hexstr, marker_pos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom_path")
    ap.add_argument("--value", type=int, required=True, help="value to search for")
    ap.add_argument("--also", type=int, default=None,
                     help="a second value the SAME memory location should hold after some game event -- "
                          "cross-referencing hits between two searches is the single best way to kill false positives")
    ap.add_argument("--overlay", type=int, default=None, help="restrict search to one ARM9 overlay ID")
    ap.add_argument("--widths", default="1,2,4", help="comma-separated byte widths to try (default 1,2,4)")
    ap.add_argument("--context", type=int, default=16, help="bytes of context to show around each hit")
    args = ap.parse_args()

    widths = tuple(int(w) for w in args.widths.split(","))
    rom = ndspy.rom.NintendoDSRom.fromFile(args.rom_path)

    regions = []
    if args.overlay is not None:
        overlays = rom.loadArm9Overlays()
        if args.overlay not in overlays:
            print(f"No overlay with id {args.overlay}. Available: {sorted(overlays.keys())}")
            sys.exit(1)
        regions.append((f"overlay{args.overlay}", bytes(overlays[args.overlay].data)))
    else:
        regions.append(("arm9", bytes(rom.arm9)))
        try:
            overlays = rom.loadArm9Overlays()
            for oid, ov in overlays.items():
                regions.append((f"overlay{oid}", bytes(ov.data)))
        except Exception as e:
            print(f"(skipping overlays, couldn't load: {e})")

    print(f"Searching for value={args.value} across {len(regions)} region(s), widths={widths}\n")

    all_hits = {}  # region_name -> list of (offset, width, signed)
    for name, data in regions:
        hits = search_bytes(data, args.value, widths)
        if hits:
            all_hits[name] = (data, hits)

    total = sum(len(h) for _, h in all_hits.values())
    print(f"Found {total} raw hits for {args.value}.")
    if total > 200:
        print("That's a lot -- this value is too common to be useful alone. Narrow with --also,")
        print("or pick a less common value (avoid 0, 1, small round numbers if possible).\n")

    second_pass = {}
    if args.also is not None:
        print(f"\nCross-referencing against second value={args.also}...")
        for name, data in regions:
            hits2 = search_bytes(data, args.also, widths)
            if hits2:
                second_pass[name] = (data, hits2)

    for name, (data, hits) in all_hits.items():
        # if doing a cross-reference, only show hits whose offset also appears
        # (at the same width) in the second search
        if args.also is not None:
            second_offsets = set()
            if name in second_pass:
                _, hits2 = second_pass[name]
                second_offsets = {(o, w) for o, w, s in hits2}
            hits = [h for h in hits if (h[0], h[1]) in second_offsets]
            if not hits:
                continue
            print(f"\n=== {name}: {len(hits)} hit(s) confirmed at the SAME offset for both values ===")
        else:
            if len(hits) > 40:
                print(f"\n=== {name}: {len(hits)} hits (showing first 40) ===")
                hits = hits[:40]
            else:
                print(f"\n=== {name}: {len(hits)} hit(s) ===")

        for offset, width, signed in hits:
            hexstr, marker_pos = dump_context(data, offset, width, args.context)
            print(f"  offset={hex(offset)} width={width} signed={signed}")
            print(f"    context: {hexstr}")

    if not all_hits:
        print("\nNo hits. Try a different value, wider search, or check byte order/width assumptions.")


if __name__ == "__main__":
    main()
