#ifndef GFX_H
#define GFX_H

#ifndef NDS_SHIM_H
#include <nds.h>
#endif

#define SCR_W 256
#define SCR_H 192
#define GLYPH_W 5
#define GLYPH_H 7

void gfxClear(u16 *fb, u16 color);
void gfxSetPixel(u16 *fb, int x, int y, u16 color);
void gfxFillRect(u16 *fb, int x, int y, int w, int h, u16 color);
void gfxHLine(u16 *fb, int x, int y, int w, u16 color);
void gfxVLine(u16 *fb, int x, int y, int h, u16 color);
void gfxRectOutline(u16 *fb, int x, int y, int w, int h, u16 color);
void gfxFillSquare(u16 *fb, int cx, int cy, int r, u16 color);
void gfxDrawLine(u16 *fb, int x0, int y0, int x1, int y1, u16 color);
void gfxDrawCircle(u16 *fb, int cx, int cy, int r, u16 color);

/* Text. All operate in whole glyph cells (8x8, scale 1 or 2). */
void gfxDrawChar(u16 *fb, int x, int y, char c, int scale, u16 color);
void gfxDrawText(u16 *fb, int x, int y, const char *text, int scale, u16 color);
int  gfxTextWidth(const char *text, int scale);
void gfxDrawTextCentered(u16 *fb, int cx, int y, const char *text, int scale, u16 color);

/* Greedy word-wrap centered text block. Returns number of lines drawn.
   Stops (without drawing further lines) once a line's baseline would
   reach maxY, so long text can't run past a frame border. */
int gfxDrawParagraph(u16 *fb, int cx, int startY, int maxWidthPx, int lineHeight,
                      const char *text, int len, int scale, u16 color, int maxY);

/* Independent horizontal/vertical scale -- used for the "medium"
   question size (1x width, 2x height): same character density as
   the small font so long questions still fit, but visibly bolder
   than plain small text, so all questions share one consistent look
   instead of switching fonts by length. */
void gfxDrawCharXY(u16 *fb, int x, int y, char c, int scaleX, int scaleY, u16 color);
int gfxDrawParagraphXY(u16 *fb, int cx, int startY, int maxWidthPx, int lineHeight,
                        const char *text, int len, int scaleX, int scaleY, u16 color, int maxY);

#endif
