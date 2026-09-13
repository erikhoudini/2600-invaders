/* Minimal NDS ARM9 binary - displays text on screen */

/* NDS memory-mapped registers */
#define REG_DISPCNT     (*(volatile unsigned short*)0x04000000)
#define REG_DISPSTAT    (*(volatile unsigned short*)0x04000004)
#define REG_VCOUNT      (*(volatile unsigned short*)0x04000006)

/* Video mode and background settings */
#define MODE_0          0x0000
#define BG0_ENABLE      0x0100

/* VRAM for BG0 tile map (Mode 0) */
#define BG0_MAP         ((unsigned short*)0x06000000)
#define BG0_TILES       ((unsigned short*)0x06010000)

/* Simple font data (8x8 tiles, first 32 characters) */
static const unsigned int font_tiles[64] = {
    0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000,
    /* Add more as needed - using simple palette for now */
};

/* Palette for BG0 - color index 1 = white */
#define BG0_PALETTE     ((unsigned short*)0x05000000)

static void wait_for_vblank(void) {
    while (REG_VCOUNT >= 192);
    while (REG_VCOUNT < 192);
}

static void console_init(void) {
    /* Set video mode 0, enable BG0 */
    REG_DISPCNT = MODE_0 | BG0_ENABLE;
    
    /* Set up palette: index 0 = black, index 1 = white */
    BG0_PALETTE[0] = 0x7FFF;  /* White (RGB555) */
    BG0_PALETTE[1] = 0x0000;  /* Black */
    
    /* Clear screen */
    for (int i = 0; i < 32 * 32; i++) {
        BG0_MAP[i] = 0;
    }
}

static void print_char(int x, int y, char c) {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) {
        BG0_MAP[y * 32 + x] = (c & 0xFF) | (1 << 10);  /* Use palette bank 1 */
    }
}

static void print_string(int x, int y, const char* str) {
    while (*str && x < 32) {
        print_char(x++, y, *str++);
    }
}

void _start(void) {
    console_init();
    
    print_string(2, 10, "Hello NDS!");
    print_string(2, 12, "Building works!");
    
    /* Infinite loop */
    while (1) {
        wait_for_vblank();
    }
}
