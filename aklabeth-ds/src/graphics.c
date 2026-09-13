/*
 * graphics.c - Graphics routines for Nintendo DS
 * Implements double-buffered rendering and pixel manipulation
 */

#include "nds.h"
#include <stdint.h>

/* Double buffer in main RAM */
static uint16_t g_framebuffer[SCREEN_WIDTH * SCREEN_HEIGHT];

/* Current color (ABGR1555 format) */
static uint16_t g_current_color = 0xFFFF;

/* Convert RGB to ABGR1555 format */
uint16_t graphics_rgb_to_abgr1555(int r, int g, int b, int a)
{
    uint16_t color = 0;
    
    /* Alpha bit (bit 15) */
    if (a) {
        color |= (1 << 15);
    }
    
    /* Blue (bits 0-4) */
    color |= (b & 0x1F);
    
    /* Green (bits 5-9) */
    color |= ((g & 0x1F) << 5);
    
    /* Red (bits 10-14) */
    color |= ((r & 0x1F) << 10);
    
    return color;
}

/* Initialize graphics system */
void graphics_init(void)
{
    /* Set display mode 3: 256-color bitmap on BG2 */
    REG_DISPCNT = MODE_3 | BG2_ENABLE;
    
    /* Clear framebuffer to black */
    graphics_clear(0);
    
    /* Set default color to white */
    g_current_color = 0xFFFF;
}

/* Clear framebuffer with specified color */
void graphics_clear(uint16_t color)
{
    uint32_t* ptr = (uint32_t*)g_framebuffer;
    uint32_t color32 = (color << 16) | color;
    uint32_t count = (SCREEN_WIDTH * SCREEN_HEIGHT) / 2;
    
    while (count--) {
        *ptr++ = color32;
    }
}

/* Set current drawing color */
void graphics_set_color(int r, int g, int b)
{
    g_current_color = graphics_rgb_to_abgr1555(r, g, b, 1);
}

/* Plot a single pixel */
void graphics_plot_pixel(int x, int y)
{
    if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) {
        return;
    }
    
    g_framebuffer[y * SCREEN_WIDTH + x] = g_current_color;
}

/* Plot a pixel with specific color */
void graphics_plot_pixel_color(int x, int y, uint16_t color)
{
    if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) {
        return;
    }
    
    g_framebuffer[y * SCREEN_WIDTH + x] = color;
}

/* Draw a horizontal line */
void graphics_draw_hline(int x1, int x2, int y)
{
    int temp;
    
    if (x1 > x2) {
        temp = x1;
        x1 = x2;
        x2 = temp;
    }
    
    /* Clip to screen bounds */
    if (x2 < 0 || x1 >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) {
        return;
    }
    
    if (x1 < 0) x1 = 0;
    if (x2 >= SCREEN_WIDTH) x2 = SCREEN_WIDTH - 1;
    
    uint16_t* ptr = &g_framebuffer[y * SCREEN_WIDTH + x1];
    int count = x2 - x1 + 1;
    
    while (count--) {
        *ptr++ = g_current_color;
    }
}

/* Draw a vertical line */
void graphics_draw_vline(int x, int y1, int y2)
{
    int temp;
    
    if (y1 > y2) {
        temp = y1;
        y1 = y2;
        y2 = temp;
    }
    
    /* Clip to screen bounds */
    if (x < 0 || x >= SCREEN_WIDTH || y2 < 0 || y1 >= SCREEN_HEIGHT) {
        return;
    }
    
    if (y1 < 0) y1 = 0;
    if (y2 >= SCREEN_HEIGHT) y2 = SCREEN_HEIGHT - 1;
    
    uint16_t* ptr = &g_framebuffer[y1 * SCREEN_WIDTH + x];
    int count = y2 - y1 + 1;
    
    while (count--) {
        ptr += SCREEN_WIDTH;
        *ptr = g_current_color;
    }
}

/* Draw a rectangle outline */
void graphics_draw_rect(int x, int y, int width, int height)
{
    graphics_draw_hline(x, x + width - 1, y);
    graphics_draw_hline(x, x + width - 1, y + height - 1);
    graphics_draw_vline(x, y, y + height - 1);
    graphics_draw_vline(x + width - 1, y, y + height - 1);
}

/* Fill a rectangle */
void graphics_fill_rect(int x, int y, int width, int height)
{
    /* Clip to screen bounds */
    if (x >= SCREEN_WIDTH || y >= SCREEN_HEIGHT || 
        x + width <= 0 || y + height <= 0) {
        return;
    }
    
    if (x < 0) {
        width += x;
        x = 0;
    }
    if (y < 0) {
        height += y;
        y = 0;
    }
    if (x + width > SCREEN_WIDTH) {
        width = SCREEN_WIDTH - x;
    }
    if (y + height > SCREEN_HEIGHT) {
        height = SCREEN_HEIGHT - y;
    }
    
    for (int row = 0; row < height; row++) {
        uint16_t* ptr = &g_framebuffer[(y + row) * SCREEN_WIDTH + x];
        for (int col = 0; col < width; col++) {
            *ptr++ = g_current_color;
        }
    }
}

/* Swap buffers - copy framebuffer to VRAM using DMA */
void graphics_swap_buffers(void)
{
    /* Wait for VBlank to prevent tearing */
    while (REG_VCOUNT >= 160) {
        /* wait in vblank */
    }
    while (REG_VCOUNT < 160) {
        /* wait out of vblank */
    }
    
    /* DMA copy from RAM buffer to VRAM */
    dma_copy(g_framebuffer, FRAMEBUFFER, SCREEN_SIZE * sizeof(uint16_t));
}

/* Get pointer to framebuffer for direct manipulation */
uint16_t* graphics_get_framebuffer(void)
{
    return g_framebuffer;
}
