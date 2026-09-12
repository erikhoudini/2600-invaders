# Smokebreak - NDS Homebrew Game Documentation

## Overview

**Smokebreak** is a Nintendo DS homebrew application ported from the HOUDINI web app. It's a conversation-starter card browser designed for DSi and TWiLight Menu++ compatibility. The game features a custom bitmap-framebuffer GUI with a two-color light/dark palette, centered text throughout, and crisp square geometry.

## Project Structure

```
smokebreak_src/
├── Makefile              # Build configuration using devkitARM
├── source/               # Main source code
│   ├── main.c            # Game logic, UI states, data loading (2045 lines)
│   ├── gfx.h             # Graphics API header
│   ├── gfx.c             # Graphics implementation (232 lines)
│   ├── font5x7_data.h    # 5x7 bitmap font data (95 glyphs)
│   └── cig_art.h         # Cigarette art bitmap (248x31, 1bpp)
├── nitrofiles/           # Data files embedded in ROM via NitroFS
│   ├── questions.dat     # Binary question database (38KB, 569 questions)
│   ├── splash_top.bin    # Top screen splash image
│   ├── splash_bottom.bin # Bottom screen splash image
│   ├── check_top.png     # Checkbox graphics
│   └── check_bottom.png  # Checkbox graphics
├── data/                 # Data generation tools
│   ├── gen_data.py       # XML to binary question converter
│   └── img_to_bin.py     # PNG to RGB15 binary converter
└── fontgen2/             # Font generation tools
    ├── build_ext.py      # Font builder script
    └── preview.png       # Font preview sheet
```

## Technical Specifications

### Display System
- **Resolution**: 256x192 per screen (dual screen: top + bottom)
- **Color Format**: ABGR1555 (16-bit with transparency bit)
  - Bit 15: Alpha/transparency flag (1 = opaque, 0 = transparent)
  - Bits 10-14: Blue (5-bit)
  - Bits 5-9: Green (5-bit)
  - Bits 0-4: Red (5-bit)
- **Rendering**: Off-screen double buffering with DMA transfer
  - `g_topBuf` / `g_botBuf`: RAM buffers for rendering
  - `g_topVRAM` / `g_botVRAM`: Actual displayed VRAM
  - `blitToScreen()`: DMA copy before vblank

### Font System
- **Size**: 5x7 pixels per glyph
- **Character Set**: ASCII 32-126 (95 glyphs total)
- **Format**: Flat table indexed by `(ASCII_code - 32)`
- **Storage**: 7 bytes per glyph (one byte per row, 5 bits used)
- **Scaling**: Supports 1x, 2x uniform scale, or independent X/Y scaling
- **Features**:
  - Centered text rendering
  - Greedy word-wrap paragraph rendering
  - Fallback glyph (centered dot) for unsupported characters

### Color Themes
The game includes 7 built-in themes, each with light/dark variants:

| Theme Name      | Light Color (RGB) | Dark Color (RGB) | Hex Values      |
|-----------------|-------------------|------------------|-----------------|
| PAPERBACK       | (22,24,22)        | (7,5,5)          | #b8c2b9 / #382b26 |
| NOIRE TRUTH     | (24,23,21)        | (4,3,6)          | #c6baac / #1e1c32 |
| BITBEE          | (25,21,9)         | (5,5,6)          | #cfab4a / #292b30 |
| CASIO           | (16,21,15)        | (0,0,0)          | #83b07e / #000000 |
| PEPPER          | (29,22,22)        | (2,0,0)          | #ebb5b5 / #100101 |
| BITBALL         | (29,29,12)        | (1,1,3)          | #eef066 / #070918 |
| LSU             | (31,23,0)         | (14,5,12)        | #ffbf00 / #702963 |

Colors are stored as `ARGB16(1, R, G, B)` where the leading `1` sets the alpha bit.

### Application States

```c
typedef enum {
    ST_MAIN,              // Main menu
    ST_QNLIST,            // Questionnaire list
    ST_BROWSE_QNLIST,     // Browse questionnaire list
    ST_BROWSE_QLIST,      // Browse question list
    ST_SWIPE,             // Swipe mode (Tinder-style)
    ST_OPTIONS,           // Settings/options
    ST_CONFIRM_CLEAR,     // Confirmation dialog
    ST_NO_FAVORITES,      // Empty favorites state
    ST_ROLL_YOUR_OWN,     // Custom pack creation
    ST_KEYBOARD_ENTRY,    // On-screen keyboard
    ST_NO_CUSTOM,         // No custom packs state
    ST_BONUS,             // Bonus content
    ST_MY_PACKS,          // User-created packs list
    ST_MOVE_PICKER,       // Move question destination picker
    ST_CONTROLS,          // Controls help
    ST_SPINNER            // Spinner/random selector
} AppState;
```

### Data Formats

#### questions.dat Binary Format
All integers are little-endian.

```
u16 numQuestionnaires
for each questionnaire:
    u8  titleLen
    char title[titleLen]        // No null terminator
    u16 descLen
    char desc[descLen]
    u16 numQuestions
    for each question:
        u16 qLen
        char q[qLen]
```

**Current Database**: 17 questionnaires, 569 total questions, 38,744 bytes

#### Custom Questions File Format (`/smokebreak_custom.txt`)
Text-based format for user-created packs:
```
#PACK:Pack Title Here
Question text line 1
Question text line 2
#PACK:Another Pack
More questions...
```

### Graphics Assets

#### Cigarette Art (`cig_art.h`)
- **Dimensions**: 248x31 pixels
- **Format**: 1-bit per pixel, MSB-first, packed rows
- **Size**: 961 bytes (31 bytes/row × 31 rows)
- **Usage**: Drawn in theme ink (set bits) or theme background (clear bits)

#### Splash Screens
- Stored as raw RGB15 binary in `nitrofiles/splash_*.bin`
- Converted from PNG using `img_to_bin.py`

## Build System

### Requirements
- **Toolchain**: devkitARM (r46+ recommended)
- **Libraries**: libnds, libfat
- **Tools**: ndstool, bin2o

### Building
```bash
export DEVKITARM=/opt/devkitpro/devkitARM
make
```

### Makefile Configuration
- **TARGET**: Auto-derived from directory name
- **SOURCES**: `source/` directory
- **NITRODATA**: `nitrofiles/` directory (embedded via NitroFS)
- **Architecture**: ARMv5TE, ARM946E-S tune, Thumb mode
- **Libraries**: `-lfat -lnds9`

## Key Features

### 1. Double-Buffered Rendering
Prevents screen tearing by rendering to off-screen buffers and copying via DMA:
```c
static u16 g_topBuf[SCR_W * SCR_H];   // Off-screen RAM
static u16 g_topVRAM;                  // Displayed VRAM

static void blitToScreen(void) {
    dmaCopy(g_topBuf, g_topVRAM, SCR_W * SCR_H * sizeof(u16));
}
```

### 2. Custom Question Support
Users can create, edit, and manage custom question packs:
- Multiple user-created packs supported
- Questions can be moved between packs
- Persisted to SD card as `/smokebreak_custom.txt`
- "LOOSIES" pack for quick-add questions

### 3. Daily Mode
Tracks daily usage to provide one question per day:
```c
static long currentDayNumber(void) {
    return (long)(time(NULL) / 86400);  // Days since Unix epoch
}
```

### 4. Favorites System
- Mark questions as favorites
- Persistent storage on SD card
- Pop animation when favoriting

### 5. Mixing Mode
Combine multiple questionnaires for mixed sessions:
- Check/uncheck packs in browse mode
- Long-press activates mixing popup
- Random selection from all checked packs

### 6. Spinner Physics
Integer-only physics simulation for random question selection:
- Uses libnds fixed-point angle units (32768 = 360°)
- Velocity decay: `velocity *= 251/256` per frame
- No floating-point required

## Hardware Considerations

### DSi-Specific Features
- **Touchscreen**: Used for keyboard entry and direct interaction
- **Dual Screens**: Top shows preview/context, bottom shows interactive content
- **ARM7/ARM9 IPC**: Not used in this project (single ARM9 binary)

### Memory Layout
- **Question Data**: Loaded to RAM at startup (~38KB)
- **Frame Buffers**: 256×192×2 bytes × 2 screens = ~192KB RAM
- **Custom Blob**: 4KB reserved for user questions

### Performance Optimizations
1. **Collect Pack Questions Once**: Pre-compute question index lists on state transitions
2. **DMA Transfers**: Hardware-accelerated screen updates
3. **Integer Math**: All physics and positioning uses integer arithmetic
4. **Bitmap Fonts**: No runtime font rasterization

## Extracted Assets Summary

All assets have been extracted to `/workspace/extracted_assets/`:

| File | Description | Size/Count |
|------|-------------|------------|
| `font5x7.bin` | Raw font data | 665 bytes (95 glyphs) |
| `font5x7.json` | Font data with ASCII visualization | 95 glyphs |
| `cig_art.bin` | Raw cigarette art bitmap | 961 bytes |
| `cig_art.txt` | ASCII preview of cigarette art | 248×31 chars |
| `cig_art.json` | Cigarette art metadata | - |
| `questions.json` | All questions in JSON format | 569 questions, 17 packs |
| `all_questions.txt` | Plain text question dump | Human-readable |

## Development Tools

### Data Generation
- **gen_data.py**: Converts XML question database to binary format
- **img_to_bin.py**: Converts 256×192 PNG to RGB15 binary
- **build_ext.py**: Generates font header from Python glyph definitions

### Character Encoding
The game sanitizes non-ASCII characters during data conversion:
- Smart quotes → ASCII quotes
- Pound sign (£) → "GBP "
- Falls back to ASCII replacement for unsupported chars

## Code Quality Notes

### Strengths
1. **Comprehensive Comments**: Extensive documentation of design decisions
2. **Defensive Programming**: Bounds checking throughout
3. **Clean Separation**: Graphics, logic, and data clearly separated
4. **No Dynamic Allocation**: Static arrays for predictable memory usage

### Areas for Improvement
1. **Magic Numbers**: Some layout constants could be better named
2. **State Machine Complexity**: 17 states could benefit from hierarchical states
3. **Error Handling**: Limited error recovery in data loading

## References

### Related Projects
- **HOUDINI Web App**: Original conversation starter application
- **BlocksDS**: Modern NDS development framework
- **TWiLight Menu++**: DSi homebrew launcher compatibility

### Documentation Sources
- libnds reference: https://github.com/devkitPro/libnds
- devkitPro tools: https://devkitpro.org/
- NDS hardware specs: https://problemkaputt.de/gbatek.htm

---

*Generated from smokebreak-src analysis*
*Date: 2024*
