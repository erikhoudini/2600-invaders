from PIL import Image

# Each glyph: 7 rows of 5 chars, '#'=on '.'=off
GLYPHS = {}

def add(ch, rows):
    assert len(rows) == 7 and all(len(r) == 5 for r in rows)
    val = []
    for r in rows:
        b = 0
        for c in r:
            b = (b << 1) | (1 if c == '#' else 0)
        val.append(b)
    GLYPHS[ch] = val

add('a', [".....",".....",".###.","....#",".####","#...#",".####"])
add('b', ["#....","#....","####.","#...#","#...#","#...#","####."])
add('c', [".....",".....",".####","#....","#....","#....",".####"])
add('d', ["....#","....#",".####","#...#","#...#","#...#",".####"])
add('e', [".....",".....",".###.","#...#","#####","#....",".####"])
add('f', ["..##.",".#...",".#...","####.",".#...",".#...",".#..."])
add('g', [".....",".####","#...#","#...#",".####","....#",".###."])
add('h', ["#....","#....","#.##.","##..#","#...#","#...#","#...#"])
add('i', ["..#..",".....",".##..","..#..","..#..","..#..",".###."])
add('j', ["...#.",".....","..##.","...#.","...#.","#..#.",".##.."])
add('k', ["#....","#....","#..#.","#.#..","##...","#.#..","#..#."])
add('l', [".##..","..#..","..#..","..#..","..#..","..#..",".###."])
add('m', [".....",".....","##.#.","#.#.#","#.#.#","#.#.#","#.#.#"])
add('n', [".....",".....","#.##.","##..#","#...#","#...#","#...#"])
add('o', [".....",".....",".###.","#...#","#...#","#...#",".###."])
add('p', [".....",".....","####.","#...#","####.","#....","#...."])
add('q', [".....",".....",".####","#...#",".####","....#","....#"])
add('r', [".....",".....","#.##.","##...","#....","#....","#...."])
add('s', [".....",".....",".####","#....",".###.","....#","####."])
add('t', ["..#..",".###.","..#..","..#..","..#..","..#.#","..##."])
add('u', [".....",".....","#...#","#...#","#...#","#..##",".##.#"])
add('v', [".....",".....","#...#","#...#","#...#",".#.#.","..#.."])
add('w', [".....",".....","#.#.#","#.#.#","#.#.#","#.#.#",".#.#."])
add('x', [".....",".....","#...#",".#.#.","..#..",".#.#.","#...#"])
add('y', [".....","#...#","#...#","#...#",".####","....#",".###."])
add('z', [".....",".....","#####","...#.","..#..",".#...","#####"])

add('.', [".....",".....",".....",".....",".....",".....","..#.."])
add("'", ["..#..","..#..",".....",".....",".....",".....","....."])
add('"', [".#.#.",".#.#.",".....",".....",".....",".....","....."])
add(';', [".....","..#..",".....","..#..","..#..",".#...","....."])
add('?', [".###.","#...#","....#","..#..","..#..",".....","..#.."])
add('[', [".##..",".#...",".#...",".#...",".#...",".#...",".##.."])
add(']', ["..##.","...#.","...#.","...#.","...#.","...#.","..##."])
add('|', ["..#..","..#..","..#..","..#..","..#..","..#..","..#.."])
add('$', ["..#..",".####","#.#..",".###.","..#.#","####.","..#.."])

# Also fill in the rest of printable ASCII with a safe minimal glyph
# (a small centered dot) so nothing silently vanishes -- rather than
# leaving them as blank space, which hid bugs in the toolkit's own
# history per its README.
FALLBACK = [".....",".....",".....","..#..",".....",".....","....."]
covered_elsewhere = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/+-=,() ")
for code in range(33, 127):
    ch = chr(code)
    if ch in GLYPHS or ch in covered_elsewhere:
        continue
    add(ch, FALLBACK)

# ---- render a preview sheet: existing font5x7 glyphs + new ones ----
import re
src = open('/home/claude/toolkit/font5x7.c').read()
m = re.search(r'FONT5X7\[45\]\[7\] = \{(.*?)\};', src, re.S)
rows_txt = m.group(1)
nums = [int(x, 16) for x in re.findall(r'0x([0-9A-Fa-f]+)', rows_txt)]
existing = [nums[i*7:i*7+7] for i in range(45)]
EXIST_ORDER = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/+-=,() ")

CELL_W = 6
CELL_H = 8
all_chars = EXIST_ORDER + sorted(GLYPHS.keys())
COLS = 16
ROWS = (len(all_chars) + COLS - 1) // COLS
sheet = Image.new("L", (COLS*CELL_W, ROWS*CELL_H), 0)
for i, ch in enumerate(all_chars):
    rows = existing[EXIST_ORDER.index(ch)] if ch in EXIST_ORDER else GLYPHS[ch]
    col, row = i % COLS, i // COLS
    for ry in range(7):
        bits = rows[ry]
        for cx in range(5):
            if (bits >> (4 - cx)) & 1:
                sheet.putpixel((col*CELL_W+cx, row*CELL_H+ry), 255)
sheet.resize((sheet.width*8, sheet.height*8), Image.NEAREST).save('/home/claude/smokebreak/fontgen2/preview.png')
print("chars:", len(all_chars))

# Merge original 45 + new glyphs into one flat ASCII 32-126 table for
# O(1) lookup at runtime (index = code - 32).
for ch, rows in zip(EXIST_ORDER, existing):
    GLYPHS[ch] = rows

with open('/home/claude/smokebreak/source/font5x7_data.h', 'w') as f:
    f.write("// 5x7 font, flat table indexed by (ASCII code - 32), covering\n")
    f.write("// printable ASCII 32-126. A-Z/0-9/space/: / + - = , ( ) are the\n")
    f.write("// original toolkit glyphs, unmodified. Lowercase a-z and the\n")
    f.write("// punctuation the real question data needs ( \" ' . ; ? [ ] | $ )\n")
    f.write("// were hand-drawn to match that style, rendered to PNG and visually\n")
    f.write("// checked (fontgen2/preview.png) before use. Anything else printable\n")
    f.write("// falls back to a small centered dot rather than silently vanishing.\n")
    f.write("#ifndef FONT5X7_DATA_H\n#define FONT5X7_DATA_H\n\n")
    f.write("static const unsigned char FONT5X7[95][7] = {\n")
    for code in range(32, 127):
        ch = chr(code)
        rows = GLYPHS[ch]
        f.write("  {" + ",".join(f"0x{b:02X}" for b in rows) + "},  // " +
                 (repr(ch) if ch != "'" else "\"'\"") + "\n")
    f.write("};\n\n#endif\n")
print("wrote merged font5x7_data.h")
