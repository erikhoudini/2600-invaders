/*
 * graphics.h - Graphics Header
 */

#ifndef GRAPHICS_H
#define GRAPHICS_H

#include <stdint.h>

uint16_t graphics_rgb_to_abgr1555(int r, int g, int b, int a);
void graphics_init(void);
void graphics_clear(uint16_t color);
void graphics_set_color(int r, int g, int b);
void graphics_plot_pixel(int x, int y);
void graphics_plot_pixel_color(int x, int y, uint16_t color);
void graphics_draw_hline(int x1, int x2, int y);
void graphics_draw_vline(int x, int y1, int y2);
void graphics_draw_rect(int x, int y, int width, int height);
void graphics_fill_rect(int x, int y, int width, int height);
void graphics_swap_buffers(void);
uint16_t* graphics_get_framebuffer(void);

#endif /* GRAPHICS_H */
