#include "gfx.h"
#include "font5x7_data.h"
#include <string.h>

void gfxClear(u16 *fb, u16 color) {
    for (int i = 0; i < SCR_W * SCR_H; i++) fb[i] = color;
}

void gfxSetPixel(u16 *fb, int x, int y, u16 color) {
    if (x < 0 || x >= SCR_W || y < 0 || y >= SCR_H) return;
    fb[y * SCR_W + x] = color;
}

void gfxFillRect(u16 *fb, int x, int y, int w, int h, u16 color) {
    int x0 = x < 0 ? 0 : x;
    int y0 = y < 0 ? 0 : y;
    int x1 = x + w; if (x1 > SCR_W) x1 = SCR_W;
    int y1 = y + h; if (y1 > SCR_H) y1 = SCR_H;
    for (int yy = y0; yy < y1; yy++)
        for (int xx = x0; xx < x1; xx++)
            fb[yy * SCR_W + xx] = color;
}

void gfxHLine(u16 *fb, int x, int y, int w, u16 color) {
    gfxFillRect(fb, x, y, w, 1, color);
}

void gfxVLine(u16 *fb, int x, int y, int h, u16 color) {
    gfxFillRect(fb, x, y, 1, h, color);
}

void gfxRectOutline(u16 *fb, int x, int y, int w, int h, u16 color) {
    gfxHLine(fb, x, y, w, color);
    gfxHLine(fb, x, y + h - 1, w, color);
    gfxVLine(fb, x, y, h, color);
    gfxVLine(fb, x + w - 1, y, h, color);
}

static int glyphIndex(char c) {
    if (c < 32 || c > 126) return -1;
    return c - 32;
}

void gfxDrawChar(u16 *fb, int x, int y, char c, int scale, u16 color) {
    int gi = glyphIndex(c);
    if (gi < 0) return;
    const unsigned char *rows = FONT5X7[gi];
    for (int row = 0; row < GLYPH_H; row++) {
        unsigned char bits = rows[row];
        for (int col = 0; col < GLYPH_W; col++) {
            if ((bits >> (GLYPH_W - 1 - col)) & 1) {
                if (scale == 1) {
                    gfxSetPixel(fb, x + col, y + row, color);
                } else {
                    gfxFillRect(fb, x + col * scale, y + row * scale, scale, scale, color);
                }
            }
        }
    }
}

void gfxDrawText(u16 *fb, int x, int y, const char *text, int scale, u16 color) {
    int advance = (GLYPH_W + 1) * scale;
    int cx = x;
    for (const char *c = text; *c; c++) {
        gfxDrawChar(fb, cx, y, *c, scale, color);
        cx += advance;
    }
}

int gfxTextWidth(const char *text, int scale) {
    int len = (int)strlen(text);
    if (len == 0) return 0;
    int advance = (GLYPH_W + 1) * scale;
    return len * advance - scale;
}

void gfxDrawTextCentered(u16 *fb, int cx, int y, const char *text, int scale, u16 color) {
    int w = gfxTextWidth(text, scale);
    gfxDrawText(fb, cx - w / 2, y, text, scale, color);
}

/* Draws a small filled square marker -- used for state indicators
   (favorited item, scrollbar thumb) rather than pure decoration. */
void gfxFillSquare(u16 *fb, int cx, int cy, int r, u16 color) {
    gfxFillRect(fb, cx - r, cy - r, r * 2, r * 2, color);
}

/* Integer Bresenham -- no division, works for any slope/direction. */
void gfxDrawLine(u16 *fb, int x0, int y0, int x1, int y1, u16 color) {
    int dx = x1 > x0 ? x1 - x0 : x0 - x1;
    int dy = y1 > y0 ? y1 - y0 : y0 - y1;
    int sx = x0 < x1 ? 1 : -1;
    int sy = y0 < y1 ? 1 : -1;
    int err = (dx > dy ? dx : -dy) / 2;
    while (1) {
        gfxSetPixel(fb, x0, y0, color);
        if (x0 == x1 && y0 == y1) break;
        int e2 = err;
        if (e2 > -dx) { err -= dy; x0 += sx; }
        if (e2 < dy)  { err += dx; y0 += sy; }
    }
}

/* Integer midpoint circle algorithm (outline only) -- no division,
   no trig, just increments. */
void gfxDrawCircle(u16 *fb, int cx, int cy, int r, u16 color) {
    int x = r, y = 0, err = 0;
    while (x >= y) {
        gfxSetPixel(fb, cx + x, cy + y, color);
        gfxSetPixel(fb, cx + y, cy + x, color);
        gfxSetPixel(fb, cx - y, cy + x, color);
        gfxSetPixel(fb, cx - x, cy + y, color);
        gfxSetPixel(fb, cx - x, cy - y, color);
        gfxSetPixel(fb, cx - y, cy - x, color);
        gfxSetPixel(fb, cx + y, cy - x, color);
        gfxSetPixel(fb, cx + x, cy - y, color);
        y += 1;
        err += 1 + 2 * y;
        if (2 * err - 2 * x + 1 > 0) { x -= 1; err += 1 - 2 * x; }
    }
}

int gfxDrawParagraph(u16 *fb, int cx, int startY, int maxWidthPx, int lineHeight,
                      const char *text, int len, int scale, u16 color, int maxY) {
    int advance = (GLYPH_W + 1) * scale;
    int maxChars = maxWidthPx / advance;
    if (maxChars < 1) maxChars = 1;

    int y = startY;
    int i = 0;
    int lines = 0;
    while (i < len && y + GLYPH_H * scale <= maxY) {
        int lineLen = 0;
        int lastSpace = -1;
        int j = i;
        while (j < len && lineLen < maxChars) {
            if (text[j] == ' ') lastSpace = lineLen;
            j++;
            lineLen++;
        }
        int cut;
        if (j >= len) {
            cut = lineLen;
        } else if (lastSpace >= 0) {
            cut = lastSpace;
        } else {
            cut = lineLen;
        }
        if (cut <= 0) cut = 1;

        char buf[80];
        int n = cut < 79 ? cut : 79;
        memcpy(buf, text + i, n);
        buf[n] = 0;
        gfxDrawTextCentered(fb, cx, y, buf, scale, color);

        i += cut;
        while (i < len && text[i] == ' ') i++;
        y += lineHeight;
        lines++;
    }
    return lines;
}

void gfxDrawCharXY(u16 *fb, int x, int y, char c, int scaleX, int scaleY, u16 color) {
    if (c < 32 || c > 126) return;
    const unsigned char *rows = FONT5X7[c - 32];
    for (int row = 0; row < GLYPH_H; row++) {
        unsigned char bits = rows[row];
        for (int col = 0; col < GLYPH_W; col++) {
            if ((bits >> (GLYPH_W - 1 - col)) & 1)
                gfxFillRect(fb, x + col * scaleX, y + row * scaleY, scaleX, scaleY, color);
        }
    }
}

static int textWidthXY(const char *text, int scaleX) {
    int len = (int)strlen(text);
    if (len == 0) return 0;
    int advance = (GLYPH_W + 1) * scaleX;
    return len * advance - scaleX;
}

static void drawTextCenteredXY(u16 *fb, int cx, int y, const char *text, int scaleX, int scaleY, u16 color) {
    int w = textWidthXY(text, scaleX);
    int advance = (GLYPH_W + 1) * scaleX;
    int x = cx - w / 2;
    for (const char *c = text; *c; c++) {
        gfxDrawCharXY(fb, x, y, *c, scaleX, scaleY, color);
        x += advance;
    }
}

int gfxDrawParagraphXY(u16 *fb, int cx, int startY, int maxWidthPx, int lineHeight,
                        const char *text, int len, int scaleX, int scaleY, u16 color, int maxY) {
    int advance = (GLYPH_W + 1) * scaleX;
    int maxChars = maxWidthPx / advance;
    if (maxChars < 1) maxChars = 1;

    int y = startY;
    int i = 0;
    int lines = 0;
    while (i < len && y + GLYPH_H * scaleY <= maxY) {
        int lineLen = 0;
        int lastSpace = -1;
        int j = i;
        while (j < len && lineLen < maxChars) {
            if (text[j] == ' ') lastSpace = lineLen;
            j++;
            lineLen++;
        }
        int cut;
        if (j >= len) cut = lineLen;
        else if (lastSpace >= 0) cut = lastSpace;
        else cut = lineLen;
        if (cut <= 0) cut = 1;

        char buf[80];
        int n = cut < 79 ? cut : 79;
        memcpy(buf, text + i, n);
        buf[n] = 0;
        drawTextCenteredXY(fb, cx, y, buf, scaleX, scaleY, color);

        i += cut;
        while (i < len && text[i] == ' ') i++;
        y += lineHeight;
        lines++;
    }
    return lines;
}
