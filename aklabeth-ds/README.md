# Aklabeth-DS Development Status

## Project Overview
Aklabeth-DS is a bare-metal roguelike dungeon crawler for Nintendo DS, inspired by the original Aklabeth game. This is a **pre-alpha** project with foundational systems in place but many features incomplete.

## Current Implementation Status

### ✅ Completed Systems

#### 1. Build System
- **Makefile**: Configurable for devkitARM or system arm-none-eabi toolchain
- **Linker Script** (`ds.ld`): Proper memory layout for ARM9 (ITCM, DTCM, RAM)
- **Directory Structure**: Organized src/, include/, assets/, build/ folders

#### 2. Hardware Abstraction Layer
- **nds.h**: Complete register definitions for:
  - Display control (DISPCNT, DISPSTAT, VCOUNT)
  - Background layers (BG0-BG3)
  - DMA controllers (DMA0-DMA3)
  - Timer registers
  - Interrupt system
  - Key input (KEYINPUT, KEYCNT)
  - Touch screen ADC
  - VRAM bank mappings

#### 3. System Initialization (`system.c`)
- BSS zeroing
- Data section initialization  
- VBlank synchronization
- DMA copy implementation
- Minimal memset/memcpy

#### 4. Input System (`input.c`)
- Button state tracking (pressed/held/released)
- All 12 DS buttons supported (A,B,X,Y,L,R,Start,Select,DPad)
- Touch screen input (basic implementation)
- Input debouncing via frame-based scanning

#### 5. Graphics System (`graphics.c`)
- **Double buffering**: RAM framebuffer → VRAM via DMA
- **Display Mode 3**: 256-color bitmap (15-bit ABGR1555)
- Primitive functions:
  - Pixel plotting
  - Horizontal/vertical lines
  - Rectangle fill/outline
  - Screen clearing
- VBlank-synchronized buffer swaps
- Color conversion utilities

#### 6. Random Number Generation (`rng.c`)
- Linear Congruential Generator (LCG)
- Seeded from RTC (placeholder - needs RTC implementation)
- Utility functions:
  - Range-limited random numbers
  - Dice rolling (NdM notation)
  - Signed random values

#### 7. Dungeon Generation (`dungeon.c`)
- **Room generation**: 4-8 random rooms per floor
- **Corridor connecting**: L-shaped corridors between room centers
- **Entity spawning**:
  - Enemies (Rat, Skeleton, Orc, Dragon) scaled by floor depth
  - Items (Potions, Treasure, Swords, Shields, Keys)
- **Tile types**: Wall, Empty, Stairs Up/Down, Door (placeholder)
- Collision detection
- Player movement with validation

#### 8. Game Structures (`aklabeth.h`)
- Player stats (HP, Gold, Attack, Defense, Position, Floor)
- Enemy entities with type-specific stats
- Item system with multiple types
- 10-floor dungeon progression
- Game state machine (Title, Playing, Combat, Game Over, Victory, Paused)

#### 9. Main Game Loop (`main.c`)
- Title screen with "Press Start"
- Top-down dungeon viewport (camera follows player)
- Entity rendering (player, enemies, items as colored rectangles)
- Basic movement controls
- Stair navigation between floors
- HUD placeholder

## 🚧 Incomplete/Broken Systems

### Critical Issues (Must Fix)

1. **No Save System**
   - All progress lost on power-off
   - Need: SD card access or password system
   - Priority: HIGH

2. **RTC Not Implemented**
   - RNG uses fixed seed (0xDEADBEEF)
   - Dungeons are identical every run
   - Need: DS RTC register access
   - Priority: HIGH

3. **No Combat System**
   - Enemies don't attack
   - No combat UI or mechanics
   - Player can walk through enemies (currently blocked, but no attack)
   - Priority: HIGH

4. **Item Pickup Not Functional**
   - Items disappear but have no effect
   - No inventory system
   - Priority: MEDIUM

5. **Touch Screen Incomplete**
   - ADC sequencing not implemented
   - Touch coordinates unreliable
   - Priority: LOW

### Missing Features

6. **Font/Text Rendering**
   - No text display capability
   - Can't show HP, gold, messages, damage numbers
   - Should port font system from Smokebreak project
   - Priority: HIGH

7. **Sprite System**
   - Everything rendered as colored rectangles
   - No OAM sprite management
   - Should integrate sprite tools from Kuriboh Dice
   - Priority: MEDIUM

8. **Sound/Audio**
   - No sound effects or music
   - DS audio registers defined but unused
   - Priority: LOW

9. **Enemy AI**
   - Enemies don't move or chase player
   - No pathfinding
   - Priority: MEDIUM

10. **Diagonal Movement Bug**
    - Current implementation allows diagonal movement
    - May need to restrict to 4-directional only
    - Priority: LOW

11. **No Death/Game Over Logic**
    - Player HP never decreases
    - Game never ends
    - Priority: HIGH

12. **No Victory Condition**
    - Reaching floor 10 does nothing special
    - Priority: LOW

### Polish Issues

13. **Screen Tearing Possible**
    - Double buffering implemented but timing could be improved
    - Priority: LOW

14. **No Input Queue**
    - Fast key presses might be missed
    - Priority: LOW

15. **Viewport Edge Cases**
    - Camera clamping at dungeon boundaries could be smoother
    - Priority: LOW

## 🔧 Known Bugs

1. **Stairs Spawn Point Search**: Uses `goto` statements that may fail to find valid spawn, leaving player in wall
2. **Fixed RNG Seed**: Every dungeon generation is identical until RTC is implemented
3. **Item Array Bounds**: No check if item_count exceeds MAX_ITEMS during generation
4. **Enemy Collision**: Player can potentially push through enemies with rapid input
5. **Memory Safety**: Static arrays could overflow if generation algorithms misbehave

## 📋 Next Development Steps

### Phase 1: Stabilization (Immediate)
- [ ] Implement RTC reading for RNG seeding
- [ ] Add basic combat (attack/defend mechanics)
- [ ] Implement death/game over state
- [ ] Fix stair spawn point logic
- [ ] Add text rendering (port font from Smokebreak)

### Phase 2: Core Gameplay (Short-term)
- [ ] Complete item pickup and effects
- [ ] Implement enemy AI (simple chase behavior)
- [ ] Add save/load system (password or SD card)
- [ ] Create victory condition
- [ ] Balance enemy/item distribution

### Phase 3: Polish (Medium-term)
- [ ] Replace colored rectangles with sprites
- [ ] Add sound effects
- [ ] Improve UI/HUD with proper text
- [ ] Add animations (player movement, combat)
- [ ] Particle effects for spells/combat

### Phase 4: Content (Long-term)
- [ ] More enemy types
- [ ] More item varieties
- [ ] Special dungeon features (traps, secret doors)
- [ ] Multiple character classes
- [ ] Quests/objectives

## 🛠️ Toolchain Requirements

### Currently Available
- ✅ ndstool v2.3.1 (ROM creation)
- ✅ grit v0.9.2 (graphics conversion)
- ✅ Python tools (ndspy, capstone, keystone)
- ⚠️ ARM cross-compiler (NOT INSTALLED - network issues)

### Needed for Building
```bash
# Option 1: Install devkitPro (recommended)
# Download from https://github.com/devkitPro/installer/releases

# Option 2: System packages (if available)
sudo apt-get install gcc-arm-none-eabi binutils-arm-none-eabi

# Option 3: Manual installation
# Extract devkitARM to /opt/devkitpro/devkitARM/
```

## 📁 File Structure

```
aklabeth-ds/
├── Makefile           # Build configuration
├── ds.ld              # Linker script
├── README.md          # This file
├── src/
│   ├── main.c         # Game loop and rendering
│   ├── system.c       # Low-level init, DMA, memory ops
│   ├── graphics.c     # Double-buffered rendering
│   ├── input.c        # Button/touch input
│   ├── dungeon.c      # Procedural generation
│   └── rng.c          # Random number generator
├── include/
│   ├── nds.h          # Hardware register definitions
│   ├── aklabeth.h     # Game structures and constants
│   ├── graphics.h     # Graphics API
│   ├── input.h        # Input API
│   ├── dungeon.h      # Dungeon API
│   └── rng.h          # RNG API
├── assets/            # (Empty - for future sprites/fonts)
└── build/             # (Build output directory)
```

## 💡 Code Quality Notes

- **No dynamic allocation**: All data uses static arrays (DS memory constraints)
- **Minimal dependencies**: Pure C with direct hardware access
- **Performance-focused**: DMA for transfers, VBlank sync, fixed-point math where possible
- **Portable patterns**: Could adapt to other embedded platforms with minimal changes

## 🎮 How to Play (Once Built)

1. Build: `make`
2. Output: `build/aklabeth_ds.nds`
3. Run in emulator (DeSmuME, melonDS) or flashcart
4. Controls:
   - D-Pad: Move
   - A: Use stairs
   - Start: Start game (on title screen)

## 📝 License & Attribution

This project is based on analysis of:
- Original Aklabeth (Richard Garriott, 1980)
- Aklabeth-DS prototype source code
- BlocksDS development patterns
- devkitPro/libnds conventions

All code written for this implementation is original and released for educational purposes.

---

**Last Updated**: Current session
**Status**: Pre-Alpha / Foundation Complete
**Lines of Code**: ~1,500
