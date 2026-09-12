/*---------------------------------------------------------------------------
  Smokebreak (DSi / TWiLight Menu++)
  Conversation-starter card browser, ported from the HOUDINI web app.

  Sprint 2: full custom bitmap-framebuffer GUI (no text console) -- crisp
  square geometry, centered text throughout, thin rule lines that
  occasionally intersect, two-color light/dark palette. Font is a
  generated 8x8 bitmap (full ASCII incl. lowercase/punctuation) rendered
  and visually verified on the host before use -- see fontgen/.
---------------------------------------------------------------------------*/
#include <nds.h>
#include <fat.h>
#include <filesystem.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "gfx.h"
#include "cig_art.h"

#define MAX_QUESTIONNAIRES 32
#define MAX_QUESTIONS      700
#define MAX_FAVORITES      700

/* ---- palette ----
   16bpp bitmap backgrounds use ABGR1555: bit15 is not part of the
   color, it's the "draw this pixel" flag. RGB15() alone leaves it
   clear, which made every pixel transparent -- the actual cause of
   the black-screen bug. ARGB16(1,...) sets it. */

/* ---- layout constants ---- */
#define FRAME_X 4
#define FRAME_Y 4
#define FRAME_W (SCR_W - 8)
#define FRAME_H (SCR_H - 8)

#define LIST_TOP     30
#define LIST_ROW_H   22
#define LIST_BOTTOM  168
#define LIST_VISIBLE ((LIST_BOTTOM - LIST_TOP) / LIST_ROW_H)
#define SCROLLBAR_X  (FRAME_X + FRAME_W - 4)

#define BTN_TOP    14
#define BTN_H      22
#define BTN_GAP    4
#define BTN_STEP   (BTN_H + BTN_GAP)

/* Tall vertical prev/next buttons on the swipe screen, hugging the
   left/right edges -- replaces touch-drag swipe entirely (see
   handleSwipeInput) so the rest of the bottom screen can be full of
   ordinary tappable buttons without a drag gesture eating those
   touches. D-pad and L/R still work the same as always. */
#define ARROW_W       22
#define ARROW_Y0      40
#define ARROW_Y1      166
#define ARROW_X_LEFT  (FRAME_X + 2)
#define ARROW_X_RIGHT (FRAME_X + FRAME_W - 2 - ARROW_W)
#define CONTENT_X0    (ARROW_X_LEFT + ARROW_W + 6)
#define CONTENT_X1    (ARROW_X_RIGHT - 6)
#define CONTENT_W     (CONTENT_X1 - CONTENT_X0)

/* Spinner button, replacing the old centered "N / M IN THIS SET"
   line -- button on the left, position counter right-justified in
   the same row. */
#define SPIN_BTN_Y    106
#define SPIN_BTN_H    20
#define SPIN_BTN_W    110

typedef struct {
    char title[80];
    char desc[400];
    u16 qStart;
    u16 qCount;
    bool isCustom;
} Questionnaire;

typedef struct {
    const char *text;
    u16 len;
    u16 qnIndex;
} QuestionEntry;

typedef enum {
    ST_MAIN, ST_QNLIST, ST_BROWSE_QNLIST, ST_BROWSE_QLIST,
    ST_SWIPE, ST_OPTIONS, ST_CONFIRM_CLEAR, ST_NO_FAVORITES, ST_ROLL_YOUR_OWN,
    ST_KEYBOARD_ENTRY, ST_NO_CUSTOM, ST_BONUS, ST_MY_PACKS, ST_MOVE_PICKER, ST_CONTROLS, ST_SPINNER
} AppState;

typedef enum { KB_ADD_QUESTION, KB_NEW_PACK, KB_NEW_PACK_AND_MOVE } KbMode;

static Questionnaire g_qn[MAX_QUESTIONNAIRES];
static int g_qnCount = 0;
static QuestionEntry g_questions[MAX_QUESTIONS];
static int g_questionCount = 0;
static u8 *g_blob = NULL;

static int g_favorites[MAX_FAVORITES];
static int g_favoriteCount = 0;
static bool g_dark = false;
static int g_maxQnCount = 0;
static long g_questionsViewed = 0;
static long g_lastDailyDay = -1;

/* Every theme is two colors (it's a 1-bit palette) -- .light is
   whichever of the pair has the higher luminance, used as the
   background in light mode / ink in dark mode; .dark is the other
   way around. g_dark picks which side of the pair is which, exactly
   as it always did -- only the color values are now per-theme instead
   of a single hardcoded pair. RGB15 values converted from the theme's
   hex colors programmatically, not by hand (verified against the
   original Paperback hardcoded values as a sanity check: matched
   exactly). */
typedef struct { const char *name; u16 light; u16 dark; } Theme;
static const Theme THEMES[] = {
    { "PAPERBACK",   ARGB16(1, 22,24,22), ARGB16(1, 7,5,5)   }, /* #b8c2b9 / #382b26 */
    { "NOIRE TRUTH", ARGB16(1, 24,23,21), ARGB16(1, 4,3,6)   }, /* #c6baac / #1e1c32 */
    { "BITBEE",      ARGB16(1, 25,21,9),  ARGB16(1, 5,5,6)   }, /* #cfab4a / #292b30 */
    { "CASIO",       ARGB16(1, 16,21,15), ARGB16(1, 0,0,0)   }, /* #83b07e / #000000 */
    { "PEPPER",      ARGB16(1, 29,22,22), ARGB16(1, 2,0,0)   }, /* #ebb5b5 / #100101 */
    { "BITBALL",     ARGB16(1, 29,29,12), ARGB16(1, 1,1,3)   }, /* #eef066 / #070918 */
    { "LSU",         ARGB16(1, 31,23,0),  ARGB16(1, 14,5,12) }, /* #ffbf00 / #702963 */
};
#define THEME_COUNT (int)(sizeof(THEMES) / sizeof(THEMES[0]))
static int g_themeIndex = 0;

static u16 themeBg(void)  { return g_dark ? THEMES[g_themeIndex].dark  : THEMES[g_themeIndex].light; }
static u16 themeInk(void) { return g_dark ? THEMES[g_themeIndex].light : THEMES[g_themeIndex].dark;  }

static AppState g_state = ST_MAIN;
static int g_selIndex = 0;
static int g_scrollTop = 0;
static int g_browseQn = -1;
static bool g_browseIsCustom = false;
static bool g_dailyMode = false;

/* resolved question-index list for whatever pack is currently being
   browsed -- built once via collectPackQuestions() when a pack is
   selected, rather than re-scanning per row/frame */
static int g_browseQList[MAX_QUESTIONS];
static int g_browseQCount = 0;

/* mixing: which packs (in ST_BROWSE_QNLIST) are checked for a
   combined session */
static bool g_qnChecked[MAX_QUESTIONNAIRES];
static int g_checkedCount = 0;
static u32 g_checkPopStart = 0;
static int g_checkPopIdx = -1;

/* moving a custom question between packs, or deleting one -- both
   reached from the same "MOVE TO..." picker off a custom question */
static int g_moveQuestionIdx = -1;
static int g_movePickerList[MAX_QUESTIONNAIRES];
static int g_movePickerCount = 0;

typedef enum { CONFIRM_CLEAR_FAVORITES, CONFIRM_DELETE_QUESTION } ConfirmKind;
static ConfirmKind g_confirmKind = CONFIRM_CLEAR_FAVORITES;

static KbMode g_kbMode = KB_ADD_QUESTION;

static int g_swipeList[MAX_QUESTIONS];
static int g_swipeCount = 0;
static int g_swipePos = 0;

static u32 g_frame = 0;
static u32 g_selAnimStart = 0;
static u32 g_swipeAnimStart = 0;
static int g_swipeAnimDir = 1;
static u32 g_favPopStart = 0;

/* Spinner: angle/velocity in libnds's fixed-point angle units (32768
   per full circle -- see trig_lut.h) so the whole physics loop is
   integer-only, no float, matching how the DS actually computes trig
   (hardware lookup tables, no FPU). Velocity decays by a fixed
   integer ratio each frame (251/256) rather than a float multiply. */
static int g_spinAngle = 0;
static int g_spinVelocity = 0;
static bool g_spinning = false;

#define SEL_ANIM_FRAMES   8
#define SWIPE_ANIM_FRAMES 14
#define FAV_POP_FRAMES    10

/* g_top/g_bot are off-screen RAM buffers, not VRAM -- every existing
   drawing function is unaffected (they just write to a plain u16*
   array either way). g_topVRAM/g_botVRAM are the actual displayed
   memory; blitToScreen() copies the finished frame across via
   hardware DMA right before it's needed to be visible.

   Why: writing pixels directly into displayed VRAM with a CPU-driven
   draw (clears, per-glyph text loops) has no guarantee of finishing
   before the screen resumes actively scanning out, so a frame could
   be seen half-old/half-new -- a real tear, not an LCD ghosting
   artifact as first (wrongly) diagnosed. Rendering off-screen and
   using DMA for the actual VRAM write means the visible screen only
   ever contains a complete frame, and the copy itself is fast enough
   (hardware-driven, not a per-pixel CPU loop) that it can't be caught
   mid-scan in any visible way. */
static u16 g_topBuf[SCR_W * SCR_H];
static u16 g_botBuf[SCR_W * SCR_H];
static u16 *g_top = g_topBuf;
static u16 *g_bot = g_botBuf;
static u16 *g_topVRAM;
static u16 *g_botVRAM;

static void blitToScreen(void) {
    dmaCopy(g_topBuf, g_topVRAM, SCR_W * SCR_H * sizeof(u16));
    /* While the on-screen keyboard is up, it owns the sub screen's
       VRAM bank as reconfigured tile/map data (see enterKeyboardEntry
       / showKeyboardUI). DMA-copying our stale bottom-screen bitmap
       buffer on top of that -- which happened on every keystroke,
       since the top-screen preview redraw triggered a blit either
       way -- corrupted the keyboard's own graphics mid-display. */
    if (g_state != ST_KEYBOARD_ENTRY)
        dmaCopy(g_botBuf, g_botVRAM, SCR_W * SCR_H * sizeof(u16));
}

/* ---------------- custom questions ("Roll Your Own") ----------------
   Multiple user-created packs can exist (isCustom==true in g_qn[]),
   all appended after the ROM packs in the same g_qn/g_questions
   arrays -- browsing, swiping, and favoriting all work on them
   unmodified. Membership is by QuestionEntry.qnIndex alone (not a
   contiguous qStart/qCount range), specifically so a question can be
   *moved* between packs later just by changing that one field, no
   array surgery needed. Persisted on the SD card as:
     #PACK:<title>
     question text
     question text
     #PACK:<next pack title>
     ...
   Any mutation (add/create/move) does a full rewrite via
   saveCustomFile() -- simple and safe, and cheap at this scale. */
#define CUSTOM_BLOB_SIZE 4096
static char g_customBlob[CUSTOM_BLOB_SIZE];
static int g_customBlobUsed = 0;
static int g_loosiesQnIndex = -1;
static char g_kbBuffer[200];
static int g_kbLen = 0;

/* All questions currently belonging to qnIdx, in load/creation order.
   Cheap at this scale (well under 1000 entries total) -- called only
   on state transitions, never per-frame. */
static int collectPackQuestions(int qnIdx, int *out, int maxOut) {
    int n = 0;
    for (int i = 0; i < g_questionCount && n < maxOut; i++)
        if (g_questions[i].qnIndex == qnIdx) out[n++] = i;
    return n;
}

static int countPackQuestions(int qnIdx) {
    int n = 0;
    for (int i = 0; i < g_questionCount; i++)
        if (g_questions[i].qnIndex == qnIdx) n++;
    return n;
}

/* Nth custom pack in g_qn[] order, and how many exist -- used by the
   "MY PACKS" list and the move-destination picker so both can stay
   simple index-based lists without a separate cached array. */
static int customPackAtIndex(int idx) {
    int n = 0;
    for (int qi = 0; qi < g_qnCount; qi++) {
        if (g_qn[qi].isCustom) {
            if (n == idx) return qi;
            n++;
        }
    }
    return -1;
}

static int customPackCount(void) {
    int n = 0;
    for (int qi = 0; qi < g_qnCount; qi++) if (g_qn[qi].isCustom) n++;
    return n;
}

static int createCustomPackMemory(const char *title) {
    if (g_qnCount >= MAX_QUESTIONNAIRES) return -1;
    int idx = g_qnCount;
    snprintf(g_qn[idx].title, sizeof(g_qn[idx].title), "%s", title);
    snprintf(g_qn[idx].desc, sizeof(g_qn[idx].desc), "A pack you rolled yourself.");
    g_qn[idx].qStart = g_questionCount;
    g_qn[idx].qCount = 0;
    g_qn[idx].isCustom = true;
    g_qnCount++;
    return idx;
}

static int ensureLoosiesPack(void) {
    if (g_loosiesQnIndex >= 0) return g_loosiesQnIndex;
    g_loosiesQnIndex = createCustomPackMemory("LOOSIES");
    return g_loosiesQnIndex;
}

static bool addQuestionToPackMemory(int qnIdx, const char *text, int len) {
    if (qnIdx < 0 || len <= 0) return false;
    if (len > 199) len = 199;
    if (g_customBlobUsed + len > CUSTOM_BLOB_SIZE) return false;
    if (g_questionCount >= MAX_QUESTIONS) return false;
    char *dst = g_customBlob + g_customBlobUsed;
    memcpy(dst, text, len);
    g_questions[g_questionCount].text = dst;
    g_questions[g_questionCount].len = (u16)len;
    g_questions[g_questionCount].qnIndex = qnIdx;
    g_questionCount++;
    g_customBlobUsed += len;
    return true;
}

static void saveCustomFile(void) {
    FILE *f = fopen("/smokebreak_custom.txt", "w");
    if (!f) return;
    for (int qi = 0; qi < g_qnCount; qi++) {
        if (!g_qn[qi].isCustom) continue;
        fprintf(f, "#PACK:%s\n", g_qn[qi].title);
        for (int i = 0; i < g_questionCount; i++) {
            if (g_questions[i].qnIndex == qi) {
                fwrite(g_questions[i].text, 1, g_questions[i].len, f);
                fputc('\n', f);
            }
        }
    }
    fclose(f);
}

static void addCustomQuestion(const char *text) {
    int idx = ensureLoosiesPack();
    addQuestionToPackMemory(idx, text, (int)strlen(text));
    saveCustomFile();
}

static void moveQuestionToPack(int questionIdx, int destQnIdx) {
    if (questionIdx < 0 || questionIdx >= g_questionCount || destQnIdx < 0) return;
    g_questions[questionIdx].qnIndex = (u16)destQnIdx;
    saveCustomFile();
}

static void loadCustomQuestions(void) {
    FILE *f = fopen("/smokebreak_custom.txt", "r");
    if (!f) return;
    int currentPack = -1;
    char line[200];
    while (fgets(line, sizeof(line), f)) {
        int len = (int)strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r')) len--;
        if (len == 0) continue;
        if (strncmp(line, "#PACK:", 6) == 0) {
            currentPack = createCustomPackMemory(line + 6);
            if (strcmp(line + 6, "LOOSIES") == 0) g_loosiesQnIndex = currentPack;
            continue;
        }
        if (currentPack < 0) currentPack = ensureLoosiesPack();
        addQuestionToPackMemory(currentPack, line, len);
    }
    fclose(f);
}

/* ---------------- data loading ---------------- */

static u16 readU16(u8 **p) { u16 v; memcpy(&v, *p, 2); *p += 2; return v; }
static u8  readU8(u8 **p)  { u8 v = **p; *p += 1; return v; }

static void loadData(void) {
    FILE *f = fopen("nitro:/questions.dat", "rb");
    if (!f) {
        gfxClear(g_top, themeBg());
        gfxDrawTextCentered(g_top, SCR_W / 2, 90, "FATAL: DATA MISSING", 1, themeInk());
        blitToScreen();
        while (1) swiWaitForVBlank();
    }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    g_blob = malloc(sz);
    fread(g_blob, 1, sz, f);
    fclose(f);

    u8 *p = g_blob;
    u16 numQ = readU16(&p);
    g_qnCount = numQ < MAX_QUESTIONNAIRES ? numQ : MAX_QUESTIONNAIRES;

    for (int i = 0; i < numQ; i++) {
        u8 titleLen = readU8(&p);
        int tlen = titleLen < 79 ? titleLen : 79;
        if (i < MAX_QUESTIONNAIRES) { memcpy(g_qn[i].title, p, tlen); g_qn[i].title[tlen] = 0; }
        p += titleLen;

        u16 descLen = readU16(&p);
        int dlen = descLen < 399 ? descLen : 399;
        if (i < MAX_QUESTIONNAIRES) { memcpy(g_qn[i].desc, p, dlen); g_qn[i].desc[dlen] = 0; }
        p += descLen;

        u16 qCount = readU16(&p);
        if (i < MAX_QUESTIONNAIRES) {
            g_qn[i].qStart = g_questionCount;
            g_qn[i].qCount = qCount;
            g_qn[i].isCustom = false;
            if (qCount > g_maxQnCount) g_maxQnCount = qCount;
        }
        for (int j = 0; j < qCount; j++) {
            u16 qLen = readU16(&p);
            if (g_questionCount < MAX_QUESTIONS) {
                g_questions[g_questionCount].text = (const char *)p;
                g_questions[g_questionCount].len = qLen;
                g_questions[g_questionCount].qnIndex = i;
                g_questionCount++;
            }
            p += qLen;
        }
    }
}

/* ---------------- settings / favorites persistence ---------------- */

/* Days since the Unix epoch, in the DS's local time. Only needs to be
   stable and change once every 24h -- not calendar-accurate to the
   minute -- so integer division on time() is enough. */
static long currentDayNumber(void) {
    return (long)(time(NULL) / 86400);
}

/* Split in two because they need different things to already be
   loaded. Display settings (theme/dark) are needed before the splash
   screen even runs, so they must load early -- before question data
   exists. Favorites reference question indices, so validating them
   needs g_questionCount to already be populated by loadData(), which
   runs after the splash. Loading everything in one early pass (the
   original design) meant the favorites bounds-check compared against
   g_questionCount==0 always, silently rejecting every saved favorite
   on every single launch -- found while wiring up theme persistence,
   not something anyone would have noticed from a screenshot. */
static void loadDisplaySettings(void) {
    g_dark = false;
    g_themeIndex = 0;
    FILE *f = fopen("/smokebreak.ini", "r");
    if (!f) return;
    char line[128];
    while (fgets(line, sizeof(line), f)) {
        int v;
        if (sscanf(line, "dark=%d", &v) == 1) g_dark = v != 0;
        else if (sscanf(line, "theme=%d", &v) == 1) { if (v >= 0 && v < THEME_COUNT) g_themeIndex = v; }
    }
    fclose(f);
}

static void loadProgressSettings(void) {
    g_favoriteCount = 0;
    g_questionsViewed = 0;
    g_lastDailyDay = -1;
    FILE *f = fopen("/smokebreak.ini", "r");
    if (!f) return;
    char line[128];
    while (fgets(line, sizeof(line), f)) {
        int v;
        long lv;
        if (sscanf(line, "fav=%d", &v) == 1) {
            if (g_favoriteCount < MAX_FAVORITES && v >= 0 && v < g_questionCount)
                g_favorites[g_favoriteCount++] = v;
        } else if (sscanf(line, "viewed=%ld", &lv) == 1) {
            g_questionsViewed = lv;
        } else if (sscanf(line, "lastday=%ld", &lv) == 1) {
            g_lastDailyDay = lv;
        }
    }
    fclose(f);
}

static void saveSettings(void) {
    FILE *f = fopen("/smokebreak.ini", "w");
    if (!f) return;
    fprintf(f, "dark=%d\n", g_dark ? 1 : 0);
    fprintf(f, "theme=%d\n", g_themeIndex);
    fprintf(f, "viewed=%ld\n", g_questionsViewed);
    fprintf(f, "lastday=%ld\n", g_lastDailyDay);
    for (int i = 0; i < g_favoriteCount; i++)
        fprintf(f, "fav=%d\n", g_favorites[i]);
    fclose(f);
}

/* Removes a custom question entirely. Safe to shift the tail of
   g_questions[] because custom questions are always appended AFTER
   every ROM question (loadData runs before loadCustomQuestions) --
   no ROM pack's stored index is ever in the region being shifted.
   g_favorites stores raw indices into this same array, so those need
   fixing up too: drop an exact match, decrement anything after it. */
static void deleteQuestion(int qIdx) {
    if (qIdx < 0 || qIdx >= g_questionCount) return;
    int qnIdx = g_questions[qIdx].qnIndex;
    for (int i = qIdx; i < g_questionCount - 1; i++) g_questions[i] = g_questions[i + 1];
    g_questionCount--;
    if (qnIdx >= 0 && qnIdx < g_qnCount && g_qn[qnIdx].qCount > 0) g_qn[qnIdx].qCount--;

    int w = 0;
    for (int i = 0; i < g_favoriteCount; i++) {
        int f = g_favorites[i];
        if (f == qIdx) continue;
        if (f > qIdx) f--;
        g_favorites[w++] = f;
    }
    g_favoriteCount = w;

    saveCustomFile();
    saveSettings();
}

static int dailyQuestionIndex(void) {
    if (g_questionCount <= 0) return 0;
    return (int)(currentDayNumber() % g_questionCount);
}

static int favIndexOf(int qIdx) {
    for (int i = 0; i < g_favoriteCount; i++)
        if (g_favorites[i] == qIdx) return i;
    return -1;
}

static void toggleFavorite(int qIdx) {
    int idx = favIndexOf(qIdx);
    if (idx >= 0) {
        for (int i = idx; i < g_favoriteCount - 1; i++) g_favorites[i] = g_favorites[i + 1];
        g_favoriteCount--;
    } else if (g_favoriteCount < MAX_FAVORITES) {
        g_favorites[g_favoriteCount++] = qIdx;
    }
    saveSettings();
}

/* ---------------- item counts / labels ---------------- */

static int getItemCount(void) {
    switch (g_state) {
        case ST_MAIN:          return 6;
        case ST_QNLIST:        return g_qnCount;
        case ST_BROWSE_QNLIST: return g_qnCount;
        case ST_BROWSE_QLIST:  return g_browseQCount;
        case ST_OPTIONS:       return 4;
        case ST_ROLL_YOUR_OWN: return 4;
        case ST_BONUS:          return 3;
        case ST_MY_PACKS:      return customPackCount();
        case ST_MOVE_PICKER:   return g_movePickerCount + 2;
        default:               return 0;
    }
}

static void getItemLabel(int idx, char *buf, int buflen) {
    switch (g_state) {
        case ST_MAIN: {
            static const char *labels[6] = {
                "START SMOKING", "BROWSE PACKS", "ROLL YOUR OWN",
                "FAVORITES", "BONUS", "DAILY QUESTION"
            };
            if (idx == 5 && g_lastDailyDay != currentDayNumber())
                snprintf(buf, buflen, "%s [NEW]", labels[idx]);
            else
                snprintf(buf, buflen, "%s", labels[idx]);
            break;
        }
        case ST_QNLIST:
        case ST_BROWSE_QNLIST:
            snprintf(buf, buflen, "%s", g_qn[idx].title);
            break;
        case ST_BROWSE_QLIST: {
            QuestionEntry *qe = &g_questions[g_browseQList[idx]];
            int n = qe->len < (buflen - 1) ? qe->len : (buflen - 1);
            memcpy(buf, qe->text, n);
            buf[n] = 0;
            break;
        }
        case ST_OPTIONS: {
            if (idx == 0) snprintf(buf, buflen, "CLEAR FAVORITES");
            else if (idx == 1) snprintf(buf, buflen, "MODE: %s", g_dark ? "DARK" : "LIGHT");
            else if (idx == 2) snprintf(buf, buflen, "THEME: %s", THEMES[g_themeIndex].name);
            else snprintf(buf, buflen, "BACK");
            break;
        }
        case ST_ROLL_YOUR_OWN: {
            if (idx == 0) snprintf(buf, buflen, "ADD A QUESTION");
            else if (idx == 1) snprintf(buf, buflen, "MY PACKS (%d)", customPackCount());
            else if (idx == 2) snprintf(buf, buflen, "NEW PACK");
            else snprintf(buf, buflen, "BACK");
            break;
        }
        case ST_BONUS: {
            if (idx == 0) snprintf(buf, buflen, "OPTIONS");
            else if (idx == 1) snprintf(buf, buflen, "CONTROLS");
            else snprintf(buf, buflen, "BACK");
            break;
        }
        case ST_MY_PACKS: {
            int qi = customPackAtIndex(idx);
            if (qi >= 0) snprintf(buf, buflen, "%s (%d)", g_qn[qi].title, countPackQuestions(qi));
            else buf[0] = 0;
            break;
        }
        case ST_MOVE_PICKER: {
            if (idx < g_movePickerCount) snprintf(buf, buflen, "%s", g_qn[g_movePickerList[idx]].title);
            else if (idx == g_movePickerCount) snprintf(buf, buflen, "NEW PACK");
            else snprintf(buf, buflen, "DELETE THIS QUESTION");
            break;
        }
        default:
            buf[0] = 0;
    }
}

static const char *headerFor(AppState s) {
    switch (s) {
        case ST_MAIN:          return "SMOKEBREAK";
        case ST_QNLIST:        return "START SMOKING";
        case ST_BROWSE_QNLIST: return "BROWSE PACKS";
        case ST_BROWSE_QLIST:  return "PICK A QUESTION";
        case ST_OPTIONS:       return "OPTIONS";
        case ST_ROLL_YOUR_OWN: return "ROLL YOUR OWN";
        case ST_BONUS:          return "BONUS";
        case ST_MY_PACKS:      return "MY PACKS";
        case ST_MOVE_PICKER:   return "MOVE TO...";
        default:               return "";
    }
}

/* ---------------- rendering ---------------- */

/* Cheap integer ease-out: fast start, settles gently. Used for both
   the selection wipe and the swipe-card slide so the whole UI shares
   one motion signature rather than everything easing differently. */
static int easeOutRange(int elapsed, int total, int range) {
    if (elapsed >= total) return 0;
    int rem = total - elapsed;
    return (range * rem * rem) / (total * total);
}

static void frame(u16 *fb, u16 bg, u16 ink) {
    gfxClear(fb, bg);
    gfxRectOutline(fb, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, ink);

    /* nested corner brackets -- viewfinder/HUD accent doubling the
       plain rectangle at each corner, the Tiger Electronics/Y2K
       device-bezel touch rather than a bare right angle. */
    int arm = 6, inset = 3;
    int x0 = FRAME_X + inset, y0 = FRAME_Y + inset;
    int x1 = FRAME_X + FRAME_W - 1 - inset, y1 = FRAME_Y + FRAME_H - 1 - inset;
    gfxHLine(fb, x0, y0, arm, ink); gfxVLine(fb, x0, y0, arm, ink);
    gfxHLine(fb, x1 - arm + 1, y0, arm, ink); gfxVLine(fb, x1, y0, arm, ink);
    gfxHLine(fb, x0, y1, arm, ink); gfxVLine(fb, x0, y1 - arm + 1, arm, ink);
    gfxHLine(fb, x1 - arm + 1, y1, arm, ink); gfxVLine(fb, x1, y1 - arm + 1, arm, ink);
}

/* Centered header text flanked by rule lines that run to the frame
   edges -- replaces a separate full-width underline with a treatment
   that's tied directly to the title's own width. */
static void headerRule(u16 *fb, int y, const char *text, int scale, u16 ink) {
    int w = gfxTextWidth(text, scale);
    int cx = SCR_W / 2;
    gfxDrawTextCentered(fb, cx, y, text, scale, ink);
    int midY = y + (GLYPH_H * scale) / 2;
    int leftEnd = cx - w / 2 - 6;
    int rightStart = cx + w / 2 + 6;
    if (leftEnd > FRAME_X + 6) gfxHLine(fb, FRAME_X + 6, midY, leftEnd - (FRAME_X + 6), ink);
    if (rightStart < FRAME_X + FRAME_W - 6)
        gfxHLine(fb, rightStart, midY, (FRAME_X + FRAME_W - 6) - rightStart, ink);
}

/* Fixed-position favorite marker -- always present (outline or filled)
   rather than a text label that pops in and out, so the swipe screen's
   layout doesn't shift based on state. */
static void drawFavMarker(u16 *fb, int x, int y, bool filled, u16 ink) {
    if (filled) gfxFillRect(fb, x, y, 8, 8, ink);
    else gfxRectOutline(fb, x, y, 8, 8, ink);
}

/* 1-bit packed art (see cig_art.h), expanded to whichever theme is
   currently active rather than baked to fixed colors -- a set bit is
   source-black -> drawn in ink; a clear bit is source-white -> bg.
   Keeps hand-drawn art correct across every theme (including future
   ones) for a fraction of the size a full RGB15 image would cost:
   248x31 packed 1bpp is 961 bytes versus ~15KB at 1 byte/pixel or
   ~30KB at RGB15. */
static void drawBitmask1bpp(u16 *fb, int x, int y, int w, int h,
                             const unsigned char *bits, u16 inkColor, u16 bgColor) {
    int rowBytes = (w + 7) / 8;
    for (int row = 0; row < h; row++) {
        const unsigned char *rowPtr = bits + row * rowBytes;
        for (int col = 0; col < w; col++) {
            int byteI = col / 8, bitI = 7 - (col % 8);
            int set = (rowPtr[byteI] >> bitI) & 1;
            gfxSetPixel(fb, x + col, y + row, set ? inkColor : bgColor);
        }
    }
}

/* thin cross-tick where a vertical accent crosses a horizontal rule --
   drawn short so it marks the intersection without cutting through
   text above/below it. Used only where it marks a real boundary
   (button gaps), not as generic filler. */
static void crossTick(u16 *fb, int x, int y, u16 ink) {
    gfxVLine(fb, x, y - 2, 5, ink);
}

/* Scrollbar: dotted track for the full list, solid thumb showing the
   visible window. Only drawn when there's actually more to scroll --
   otherwise it's noise for a list that already fits on screen. */
static void drawScrollbar(u16 *fb, u16 ink, int count) {
    if (count <= LIST_VISIBLE) return;
    int trackH = LIST_BOTTOM - LIST_TOP;
    for (int y = LIST_TOP; y < LIST_BOTTOM; y += 2)
        gfxSetPixel(fb, SCROLLBAR_X, y, ink);

    int thumbH = (LIST_VISIBLE * trackH) / count;
    if (thumbH < 6) thumbH = 6;
    int range = trackH - thumbH;
    int maxScroll = count - LIST_VISIBLE;
    int thumbY = LIST_TOP + (maxScroll > 0 ? (g_scrollTop * range) / maxScroll : 0);
    gfxFillRect(fb, SCROLLBAR_X - 1, thumbY, 3, thumbH, ink);
}

static void renderTopContext(u16 bg, u16 ink) {
    frame(g_top, bg, ink);
    int safeBottom = FRAME_Y + FRAME_H - 4;
    switch (g_state) {
        case ST_MAIN:
            headerRule(g_top, 20, "SMOKEBREAK", 2, ink);
            gfxDrawTextCentered(g_top, SCR_W / 2, 60, "by HOUDINI Magazine", 1, ink);
            {
                const char *msg = "Conversation starters for deeper connections.";
                gfxDrawParagraph(g_top, SCR_W / 2, 90, FRAME_W - 20, 12, msg, (int)strlen(msg), 1, ink, safeBottom);
            }
            {
                char buf[32];
                snprintf(buf, sizeof(buf), "%d FAVORITES SAVED", g_favoriteCount);
                gfxDrawTextCentered(g_top, SCR_W / 2, 160, buf, 1, ink);
            }
            break;
        case ST_QNLIST:
        case ST_BROWSE_QNLIST:
            if (getItemCount() > 0) {
                gfxDrawParagraph(g_top, SCR_W / 2, 16, FRAME_W - 20, 12,
                                  g_qn[g_selIndex].title, strlen(g_qn[g_selIndex].title), 1, ink, 44);
                gfxHLine(g_top, FRAME_X, 46, FRAME_W, ink);
                gfxDrawParagraph(g_top, SCR_W / 2, 58, FRAME_W - 24, 12,
                                  g_qn[g_selIndex].desc, strlen(g_qn[g_selIndex].desc), 1, ink, safeBottom);
            }
            break;
        case ST_BROWSE_QLIST:
            if (getItemCount() > 0) {
                QuestionEntry *qe = &g_questions[g_browseQList[g_selIndex]];
                gfxDrawParagraphXY(g_top, SCR_W / 2, 40, FRAME_W - 24, 16, qe->text, qe->len, 1, 2, ink, safeBottom);
            }
            break;
        case ST_OPTIONS:
            headerRule(g_top, 20, "OPTIONS", 2, ink);
            {
                char buf[40];
                snprintf(buf, sizeof(buf), "%d FAVORITES SAVED", g_favoriteCount);
                gfxDrawTextCentered(g_top, SCR_W / 2, 70, buf, 1, ink);
                snprintf(buf, sizeof(buf), "%ld QUESTIONS SMOKED", g_questionsViewed);
                gfxDrawTextCentered(g_top, SCR_W / 2, 86, buf, 1, ink);
            }
            break;
        case ST_ROLL_YOUR_OWN:
            headerRule(g_top, 20, "ROLL YOUR OWN", 2, ink);
            {
                const char *msg = "New questions default to a pack called LOOSIES. "
                                   "Make more packs and move questions into them anytime.";
                gfxDrawParagraph(g_top, SCR_W / 2, 55, FRAME_W - 30, 12, msg, (int)strlen(msg), 1, ink, 130);
            }
            {
                int total = 0;
                for (int qi = 0; qi < g_qnCount; qi++) if (g_qn[qi].isCustom) total += countPackQuestions(qi);
                char buf[32];
                snprintf(buf, sizeof(buf), "%d QUESTIONS ROLLED", total);
                gfxDrawTextCentered(g_top, SCR_W / 2, 155, buf, 1, ink);
            }
            break;
        case ST_BONUS:
            headerRule(g_top, 20, "BONUS", 2, ink);
            {
                const char *msg = "Settings live here now, with new game modes "
                                   "and extras joining them down the line.";
                gfxDrawParagraph(g_top, SCR_W / 2, 60, FRAME_W - 30, 12, msg, (int)strlen(msg), 1, ink, 140);
            }
            break;
        case ST_MY_PACKS:
            headerRule(g_top, 20, "MY PACKS", 2, ink);
            {
                const char *msg = "Pick a pack to view its questions -- from there, "
                                   "Y moves a question to a different pack.";
                gfxDrawParagraph(g_top, SCR_W / 2, 60, FRAME_W - 30, 12, msg, (int)strlen(msg), 1, ink, 140);
            }
            break;
        case ST_MOVE_PICKER:
            headerRule(g_top, 20, "MOVE TO...", 2, ink);
            {
                const char *msg = "Choose where this question goes, or delete it for good.";
                gfxDrawParagraph(g_top, SCR_W / 2, 60, FRAME_W - 30, 12, msg, (int)strlen(msg), 1, ink, 100);
            }
            break;
        default:
            break;
    }
}

static void renderMainMenuButtons(u16 bg, u16 ink) {
    frame(g_bot, bg, ink);

    int count = getItemCount();
    int bx = FRAME_X + 10;
    int bw = FRAME_W - 20;
    u32 selElapsed = g_frame - g_selAnimStart;
    for (int i = 0; i < count; i++) {
        int by = BTN_TOP + i * BTN_STEP;
        char buf[40];
        getItemLabel(i, buf, sizeof(buf));
        if (i == g_selIndex) {
            gfxRectOutline(g_bot, bx, by, bw, BTN_H, ink);
            /* label drawn in its normal (unselected) style FIRST, so
               there's no instant the label just vanishes -- the
               advancing fill covers it incrementally instead. On
               real DS/DSi hardware, hiding it outright then redrawing
               it all at once produced visible LCD ghosting from the
               abrupt luminance jump. */
            gfxDrawTextCentered(g_bot, SCR_W / 2, by + (BTN_H - 8) / 2, buf, 1, ink);
            int fillW = bw - easeOutRange((int)selElapsed, SEL_ANIM_FRAMES, bw);
            if (fillW < 1) fillW = 1;
            gfxFillRect(g_bot, bx, by, fillW, BTN_H, ink);
            if (fillW >= bw)
                gfxDrawTextCentered(g_bot, SCR_W / 2, by + (BTN_H - 8) / 2, buf, 1, bg);
        } else {
            gfxRectOutline(g_bot, bx, by, bw, BTN_H, ink);
            gfxDrawTextCentered(g_bot, SCR_W / 2, by + (BTN_H - 8) / 2, buf, 1, ink);
        }
        /* cross-tick marks the actual boundary between two buttons */
        if (i < count - 1) {
            int gy = by + BTN_H + BTN_GAP / 2;
            gfxHLine(g_bot, bx, gy, bw, ink);
            crossTick(g_bot, SCR_W / 2, gy, ink);
        }
    }
    gfxDrawTextCentered(g_bot, SCR_W / 2, 178, "houdinimagazine.com", 1, ink);
}

static void renderScrollList(u16 bg, u16 ink, bool freshEntry) {
    if (freshEntry) {
        frame(g_bot, bg, ink);
        headerRule(g_bot, 12, headerFor(g_state), 1, ink);
        gfxHLine(g_bot, FRAME_X, LIST_TOP - 4, FRAME_W, ink);
    } else {
        /* Row/scrollbar band -- safe to clear full width, well clear
           of the bottom corner brackets (see frame()).
           Footer-text zone is narrower and shorter than that, on
           purpose: a full-width clear down to the footer row would
           overlap the bottom corner brackets (they sit at roughly
           y=179-184, x near the screen edges) and the outer border
           line -- both only ever redrawn by frame(), which a
           non-fresh update skips. An earlier version of this used one
           full-width rect down to y=186 and silently erased the
           brackets; caught it by diffing an incremental render
           against a full redraw of the same end state -- they must
           be pixel-identical, and weren't. */
        gfxFillRect(g_bot, FRAME_X + 1, LIST_TOP, FRAME_W - 2, LIST_BOTTOM - LIST_TOP, bg);
        gfxFillRect(g_bot, FRAME_X + 16, LIST_BOTTOM, FRAME_W - 32, 16, bg);
    }

    int count = getItemCount();
    if (g_selIndex < g_scrollTop) g_scrollTop = g_selIndex;
    if (g_selIndex >= g_scrollTop + LIST_VISIBLE) g_scrollTop = g_selIndex - LIST_VISIBLE + 1;

    bool showFavMark = (g_state == ST_BROWSE_QLIST);
    bool showCheckbox = (g_state == ST_BROWSE_QNLIST);
    int textMaxW = showCheckbox ? FRAME_W - 40 : FRAME_W - 16;
    u32 selElapsed = g_frame - g_selAnimStart;

    for (int row = 0; row < LIST_VISIBLE; row++) {
        int idx = g_scrollTop + row;
        if (idx >= count) break;
        int ry = LIST_TOP + row * LIST_ROW_H;
        bool sel = (idx == g_selIndex);
        char buf[100];
        getItemLabel(idx, buf, sizeof(buf));
        int textLen = (int)strlen(buf);

        /* checkbox pop: settles in from the left on toggle, same
           ease-out trick the swipe screen's favorite marker uses --
           a small position shift, not an actual size change. */
        int checkX = FRAME_X + 8;
        if (showCheckbox && idx == g_checkPopIdx) {
            u32 checkElapsed = g_frame - g_checkPopStart;
            if (checkElapsed < FAV_POP_FRAMES)
                checkX -= easeOutRange((int)checkElapsed, FAV_POP_FRAMES, 3);
        }

        if (sel) {
            /* label (and checkbox) drawn in normal style FIRST so
               nothing abruptly vanishes -- the advancing fill covers
               it incrementally. Hiding everything until the wipe
               finished, then redrawing it all at once, produced
               visible LCD ghosting on real DS/DSi hardware from the
               sudden luminance jump. */
            gfxDrawParagraph(g_bot, SCR_W / 2, ry + 2, textMaxW, 10, buf, textLen, 1, ink, ry + 20);
            if (showCheckbox)
                drawFavMarker(g_bot, checkX, ry + LIST_ROW_H / 2 - 4, g_qnChecked[idx], ink);
            int rowW = FRAME_W - 2;
            int fillW = rowW - easeOutRange((int)selElapsed, SEL_ANIM_FRAMES, rowW);
            if (fillW < 1) fillW = 1;
            gfxFillRect(g_bot, FRAME_X + 1, ry, fillW, LIST_ROW_H, ink);
            if (fillW >= rowW) {
                gfxDrawParagraph(g_bot, SCR_W / 2, ry + 2, textMaxW, 10, buf, textLen, 1, bg, ry + 20);
                if (showCheckbox)
                    drawFavMarker(g_bot, checkX, ry + LIST_ROW_H / 2 - 4, g_qnChecked[idx], bg);
            }
        } else {
            gfxDrawParagraph(g_bot, SCR_W / 2, ry + 2, textMaxW, 10, buf, textLen, 1, ink, ry + 20);
            if (showFavMark) {
                if (favIndexOf(g_browseQList[idx]) >= 0)
                    gfxFillSquare(g_bot, FRAME_X + 8, ry + LIST_ROW_H / 2, 2, ink);
            }
            if (showCheckbox)
                drawFavMarker(g_bot, checkX, ry + LIST_ROW_H / 2 - 4, g_qnChecked[idx], ink);
        }
        int dividerY = ry + LIST_ROW_H;
        if (idx != count - 1 && dividerY < LIST_BOTTOM)
            gfxHLine(g_bot, FRAME_X, dividerY, FRAME_W, ink);
    }
    if (count == 0 && g_state == ST_BROWSE_QLIST)
        gfxDrawTextCentered(g_bot, SCR_W / 2, (LIST_TOP + LIST_BOTTOM) / 2 - 4,
                             "NOTHING IN THIS PACK YET", 1, ink);
    drawScrollbar(g_bot, ink, count);
    gfxHLine(g_bot, FRAME_X, LIST_BOTTOM, FRAME_W, ink);

    if (g_state == ST_BROWSE_QNLIST) {
        char buf[40];
        if (g_checkedCount >= 1) snprintf(buf, sizeof(buf), "START: MIX (%d)   B: BACK", g_checkedCount);
        else snprintf(buf, sizeof(buf), "TAP [] TO MIX   B: BACK");
        gfxDrawTextCentered(g_bot, SCR_W / 2, 176, buf, 1, ink);
    } else if (g_state == ST_BROWSE_QLIST && g_browseIsCustom && count > 0) {
        gfxDrawTextCentered(g_bot, SCR_W / 2, 176, "Y: MOVE   B: BACK", 1, ink);
    } else {
        gfxDrawTextCentered(g_bot, SCR_W / 2, 176, "B: BACK", 1, ink);
    }
}

/* small corner ticks for the inner "card" box, lighter than the
   screen frame's brackets so the nesting reads as card-within-screen
   rather than two identical frames stacked. */
static void cardCorners(u16 *fb, int x, int y, int w, int h, u16 ink) {
    int arm = 4;
    gfxHLine(fb, x, y, arm, ink); gfxVLine(fb, x, y, arm, ink);
    gfxHLine(fb, x + w - arm, y, arm, ink); gfxVLine(fb, x + w - 1, y, arm, ink);
    gfxHLine(fb, x, y + h - 1, arm, ink); gfxVLine(fb, x, y + h - arm, arm, ink);
    gfxHLine(fb, x + w - arm, y + h - 1, arm, ink); gfxVLine(fb, x + w - 1, y + h - arm, arm, ink);
}

/* Small solid triangle built from stacked horizontal bars (widest at
   vertical center, tapering toward top/bottom) rather than a font
   glyph -- our hand-drawn font has no '<'/'>' characters, and an
   actual arrowhead reads clearer than a text label in a narrow tall
   button anyway. */
static void drawArrow(u16 *fb, int cx, int cy, int size, bool pointLeft, u16 color) {
    int half = size / 2;
    for (int row = 0; row <= size; row++) {
        int dist = row > half ? row - half : half - row;
        int w = half + 1 - dist;
        if (w < 1) continue;
        int y = cy - half + row;
        if (pointLeft) gfxHLine(fb, cx + half - w, y, w, color);
        else gfxHLine(fb, cx - half, y, w, color);
    }
}

/* The question card -- shared between the normal swipe screen and the
   Spinner screen (which keeps the question visible on top while the
   bottom screen becomes the spin UI, so the group can still read what
   they're spinning for). */
static void renderSwipeTopCard(u16 bg, u16 ink) {
    frame(g_top, bg, ink);
    QuestionEntry *qe = &g_questions[g_swipeList[g_swipePos]];
    int isFav = favIndexOf(g_swipeList[g_swipePos]) >= 0;

    /* favorite marker pops larger for a few frames right after Y is
       pressed -- feedback tied to the action, not a passive icon. */
    u32 favElapsed = g_frame - g_favPopStart;
    int favSize = 8;
    if (favElapsed < FAV_POP_FRAMES) favSize = 8 + easeOutRange((int)favElapsed, FAV_POP_FRAMES, 4);
    drawFavMarker(g_top, FRAME_X + FRAME_W - 16 - favSize / 2, FRAME_Y + 14, isFav, ink);

    /* the question sits in its own bordered card -- gives it presence
       as an object rather than floating text sharing the chrome.
       The whole card (border, corner ticks, text) slides together as
       one unit -- previously only the text moved while the border
       stayed put, which read as a bug more than a transition. */
    u32 elapsed = g_frame - g_swipeAnimStart;
    int slideOffset = g_swipeAnimDir * easeOutRange((int)elapsed, SWIPE_ANIM_FRAMES, SCR_W);

    int cardX = FRAME_X + 10 + slideOffset, cardY = 34;
    int cardW = FRAME_W - 20;
    int cardH = g_dailyMode ? 122 : 144;
    gfxRectOutline(g_top, cardX, cardY, cardW, cardH, ink);
    cardCorners(g_top, cardX, cardY, cardW, cardH, ink);

    /* One consistent size for every question, short or long -- medium
       scale (1x width, 2x height) keeps the same character density
       as the small font, so nothing that fit before can overflow,
       while reading noticeably bolder than plain small text. */
    int innerW = cardW - 20;
    int charsPerLine = innerW / (GLYPH_W + 1);
    int lineH = 16;
    int estLines = charsPerLine > 0 ? (qe->len + charsPerLine - 1) / charsPerLine : 1;
    int textH = estLines * lineH;
    int startY = cardY + 8 + ((cardH - 16) - textH) / 2;
    if (startY < cardY + 8) startY = cardY + 8;

    int cx = SCR_W / 2 + slideOffset;
    gfxDrawParagraphXY(g_top, cx, startY, innerW, lineH, qe->text, qe->len, 1, 2, ink, cardY + cardH - 6);

    char buf[80];
    if (g_dailyMode) {
        gfxHLine(g_top, FRAME_X, 168, FRAME_W, ink);
        time_t now = time(NULL);
        struct tm *tmv = localtime(&now);
        strftime(buf, sizeof(buf), "TODAY'S QUESTION -- %Y-%m-%d", tmv);
        gfxDrawTextCentered(g_top, SCR_W / 2, 174, buf, 1, ink);
    }
}

static void renderSwipe(u16 bg, u16 ink) {
    renderSwipeTopCard(bg, ink);
    QuestionEntry *qe = &g_questions[g_swipeList[g_swipePos]];
    char buf[80];

    frame(g_bot, bg, ink);

    if (g_dailyMode) {
        headerRule(g_bot, 20, "ONE A DAY", 1, ink);
        gfxHLine(g_bot, FRAME_X, 34, FRAME_W, ink);
        int bx = FRAME_X + 10, bw = FRAME_W - 20;
        gfxRectOutline(g_bot, bx, 50, bw, 36, ink);
        gfxDrawTextCentered(g_bot, SCR_W / 2, 64, "Y: FAVORITE", 1, ink);
        {
            const char *msg = "Come back tomorrow.";
            gfxDrawParagraph(g_bot, SCR_W / 2, 100, FRAME_W - 40, 12, msg, (int)strlen(msg), 1, ink, 160);
        }
    } else {
        /* cigarette art replaces the old text header -- see cig_art.h.
           Sized to match exactly (248 wide = FRAME_W exactly), themed
           via drawBitmask1bpp rather than baked colors. */
        drawBitmask1bpp(g_bot, FRAME_X, FRAME_Y + 1, CIG_ART_W, CIG_ART_H, CIG_ART, ink, bg);
        gfxHLine(g_bot, FRAME_X, 34, FRAME_W, ink);

        /* tall prev/next buttons hugging the edges -- replaces
           touch-drag swipe entirely (see handleSwipeInput) */
        gfxRectOutline(g_bot, ARROW_X_LEFT, ARROW_Y0, ARROW_W, ARROW_Y1 - ARROW_Y0, ink);
        drawArrow(g_bot, ARROW_X_LEFT + ARROW_W / 2, (ARROW_Y0 + ARROW_Y1) / 2, 14, true, ink);
        gfxRectOutline(g_bot, ARROW_X_RIGHT, ARROW_Y0, ARROW_W, ARROW_Y1 - ARROW_Y0, ink);
        drawArrow(g_bot, ARROW_X_RIGHT + ARROW_W / 2, (ARROW_Y0 + ARROW_Y1) / 2, 14, false, ink);

        int bx = CONTENT_X0, bw = (CONTENT_W - 8) / 2;
        int gapMid = bx + bw + 4;
        gfxRectOutline(g_bot, bx, 46, bw, 40, ink);
        gfxDrawTextCentered(g_bot, bx + bw / 2, 60, "Y: FAV", 1, ink);
        gfxVLine(g_bot, gapMid, 46, 40, ink);
        gfxRectOutline(g_bot, bx + bw + 8, 46, bw, 40, ink);
        gfxDrawTextCentered(g_bot, bx + bw + 8 + bw / 2, 60, "X: RANDOM", 1, ink);

        /* segmented meter -- LCD battery/signal-bar motif standing in
           for a progress bar: solid segments up to the current
           position, outlined ahead. Real proportional position, not
           decoration for its own sake. */
        int segN = 10;
        int totalW = CONTENT_W;
        int segGap = 2;
        int segW = (totalW - segGap * (segN - 1)) / segN;
        int filled = g_swipeCount > 1 ? (((g_swipePos) * segN) / (g_swipeCount - 1)) + 1 : segN;
        if (filled > segN) filled = segN;
        for (int i = 0; i < segN; i++) {
            int sx = CONTENT_X0 + i * (segW + segGap);
            if (i < filled) gfxFillRect(g_bot, sx, 88, segW, 14, ink);
            else gfxRectOutline(g_bot, sx, 88, segW, 14, ink);
        }

        snprintf(buf, sizeof(buf), "%d/%d", g_swipePos + 1, g_swipeCount);
        int counterW = gfxTextWidth(buf, 1);
        gfxRectOutline(g_bot, CONTENT_X0, SPIN_BTN_Y, SPIN_BTN_W, SPIN_BTN_H, ink);
        gfxDrawTextCentered(g_bot, CONTENT_X0 + SPIN_BTN_W / 2, SPIN_BTN_Y + 6, "SPINNER", 1, ink);
        gfxDrawText(g_bot, CONTENT_X1 - counterW, SPIN_BTN_Y + 6, buf, 1, ink);

        /* full pack name, moved here from the top screen where it had
           to be truncated to one line -- wraps over up to two lines
           so the whole title is actually readable. */
        snprintf(buf, sizeof(buf), "%s", g_qn[qe->qnIndex].title);
        gfxDrawParagraph(g_bot, SCR_W / 2, 128, CONTENT_W - 8, 12, buf, (int)strlen(buf), 1, ink, 166);
    }

    gfxHLine(g_bot, FRAME_X, 168, FRAME_W, ink);
    gfxDrawTextCentered(g_bot, SCR_W / 2, 178, "B: BACK TO MENU", 1, ink);
}

/* "Spin the bottle"-style party mechanic: keeps the question visible
   on top (same card as the normal swipe screen) while the bottom
   screen becomes a spinning arrow -- set the DS flat on a table,
   whoever the arrow lands on answers. */
#define SPIN_GO_Y 150
#define SPIN_GO_H 16
#define SPIN_GO_W 90
#define SPIN_GO_X (SCR_W / 2 - SPIN_GO_W / 2)

static void renderSpinner(u16 bg, u16 ink) {
    renderSwipeTopCard(bg, ink);

    frame(g_bot, bg, ink);
    headerRule(g_bot, 12, "SPIN THE ARROW", 1, ink);
    gfxHLine(g_bot, FRAME_X, LIST_TOP - 4, FRAME_W, ink);

    int cx = SCR_W / 2, cy = 98, radius = 46;
    gfxDrawCircle(g_bot, cx, cy, radius, ink);

    /* angle/velocity are libnds fixed-point angle units already (see
       globals) -- sinLerp/cosLerp read them directly, no conversion. */
    int sinV = sinLerp(g_spinAngle), cosV = cosLerp(g_spinAngle);
    int lineLen = radius - 6;
    int ex = cx + (sinV * lineLen) / 4096;
    int ey = cy - (cosV * lineLen) / 4096;
    gfxDrawLine(g_bot, cx, cy, ex, ey, ink);
    gfxFillSquare(g_bot, ex, ey, 3, ink);
    gfxFillSquare(g_bot, cx, cy, 2, ink);

    gfxRectOutline(g_bot, SPIN_GO_X, SPIN_GO_Y, SPIN_GO_W, SPIN_GO_H, ink);
    gfxDrawTextCentered(g_bot, SCR_W / 2, SPIN_GO_Y + 4, g_spinning ? "SPINNING..." : "TAP TO SPIN", 1, ink);

    gfxHLine(g_bot, FRAME_X, 168, FRAME_W, ink);
    gfxDrawTextCentered(g_bot, SCR_W / 2, 178, "B: BACK", 1, ink);
}

static bool handleSpinnerInput(int pressed, bool touched, touchPosition touch) {
    if (pressed & KEY_B) { g_state = ST_SWIPE; return true; }
    if (touched && touch.py >= 168) { g_state = ST_SWIPE; return true; }
    bool tappedGo = touched && touch.px >= SPIN_GO_X && touch.px < SPIN_GO_X + SPIN_GO_W &&
                    touch.py >= SPIN_GO_Y && touch.py < SPIN_GO_Y + SPIN_GO_H;
    if ((tappedGo || (pressed & KEY_A)) && !g_spinning) {
        g_spinning = true;
        g_spinVelocity = 1400 + (rand() % 700);
        return true;
    }
    return false;
}

/* Advances the spin physics one frame -- integer-only (no float, no
   division beyond a compiler-optimized shift-by-constant), matching
   how the DS itself has no FPU and a slow software divide. Runs every
   frame while spinning regardless of input, so it needs to be called
   from the main loop directly, not just from handleSpinnerInput. */
static bool updateSpinner(void) {
    if (!g_spinning) return false;
    g_spinAngle = (g_spinAngle + g_spinVelocity) & 32767;
    g_spinVelocity = (g_spinVelocity * 251) >> 8;
    if (g_spinVelocity < 30) { g_spinVelocity = 0; g_spinning = false; }
    return true;
}

static void renderConfirmClear(u16 bg, u16 ink) {
    frame(g_top, bg, ink);
    frame(g_bot, bg, ink);
    const char *msg = (g_confirmKind == CONFIRM_DELETE_QUESTION)
                           ? "DELETE THIS QUESTION?" : "CLEAR ALL FAVORITES?";
    gfxDrawTextCentered(g_bot, SCR_W / 2, 70, msg, 1, ink);
    gfxHLine(g_bot, FRAME_X + 40, 90, FRAME_W - 80, ink);
    crossTick(g_bot, SCR_W / 2, 90, ink);
    gfxDrawTextCentered(g_bot, SCR_W / 2, 100, "A: YES        B: NO", 1, ink);
}

static void renderNoFavorites(u16 bg, u16 ink) {
    frame(g_top, bg, ink);
    frame(g_bot, bg, ink);
    gfxDrawTextCentered(g_bot, SCR_W / 2, 60, "NO FAVORITES YET", 1, ink);
    {
        const char *msg = "Hit Y on any question to save it here.";
        gfxDrawParagraph(g_bot, SCR_W / 2, 80, FRAME_W - 40, 12, msg, (int)strlen(msg), 1, ink, 140);
    }
    gfxDrawTextCentered(g_bot, SCR_W / 2, 150, "PRESS ANY BUTTON", 1, ink);
}

static void renderNoCustom(u16 bg, u16 ink) {
    frame(g_top, bg, ink);
    frame(g_bot, bg, ink);
    gfxDrawTextCentered(g_bot, SCR_W / 2, 60, "NOTHING ROLLED YET", 1, ink);
    {
        const char *msg = "Use Add A Question to write your first one.";
        gfxDrawParagraph(g_bot, SCR_W / 2, 80, FRAME_W - 40, 12, msg, (int)strlen(msg), 1, ink, 140);
    }
    gfxDrawTextCentered(g_bot, SCR_W / 2, 150, "PRESS ANY BUTTON", 1, ink);
}

static void renderControls(u16 bg, u16 ink) {
    frame(g_top, bg, ink);
    frame(g_bot, bg, ink);
    headerRule(g_top, 20, "CONTROLS", 2, ink);
    static const char *rows[] = {
        "D-PAD / TAP: MOVE / SELECT",
        "A: SELECT",
        "B: BACK",
        "Y: FAVORITE / MOVE / CHECK",
        "X: RANDOM QUESTION",
        "L / R: PREV / NEXT QUESTION",
        "START: MIX CHECKED PACKS",
    };
    int y = 50;
    for (unsigned i = 0; i < sizeof(rows) / sizeof(rows[0]); i++) {
        gfxDrawTextCentered(g_top, SCR_W / 2, y, rows[i], 1, ink);
        y += 17;
    }
    gfxDrawTextCentered(g_bot, SCR_W / 2, 150, "PRESS ANY BUTTON", 1, ink);
}

/* Keyboard entry only ever touches the top screen -- the bottom screen
   belongs to libnds's own on-screen keyboard while this state is
   active (same physical BG layer our bitmap UI normally owns, just
   reconfigured for the duration -- see enter/exitKeyboardEntry). */
static void renderKeyboardEntry(u16 bg, u16 ink) {
    frame(g_top, bg, ink);
    headerRule(g_top, 16, "ROLL YOUR OWN", 2, ink);
    gfxHLine(g_top, FRAME_X, 40, FRAME_W, ink);
    const char *prompt = "TYPE YOUR QUESTION BELOW";
    if (g_kbMode == KB_NEW_PACK || g_kbMode == KB_NEW_PACK_AND_MOVE) prompt = "NAME YOUR NEW PACK BELOW";
    gfxDrawTextCentered(g_top, SCR_W / 2, 48, prompt, 1, ink);

    int cardX = FRAME_X + 10, cardY = 62, cardW = FRAME_W - 20, cardH = 92;
    gfxRectOutline(g_top, cardX, cardY, cardW, cardH, ink);
    cardCorners(g_top, cardX, cardY, cardW, cardH, ink);
    gfxDrawParagraph(g_top, SCR_W / 2, cardY + 8, cardW - 16, 12,
                      g_kbBuffer, g_kbLen, 1, ink, cardY + cardH - 6);

    gfxHLine(g_top, FRAME_X, 162, FRAME_W, ink);
    gfxDrawTextCentered(g_top, SCR_W / 2, 170, "ENTER: SAVE   B: CANCEL", 1, ink);
}

static AppState g_lastRenderedState = ST_MAIN;
static bool g_lastRenderedDark = false;
static int g_lastRenderedTheme = 0;
static bool g_firstRenderDone = false;

static void render(void) {
    u16 bg = themeBg();
    u16 ink = themeInk();

    bool freshEntry = !g_firstRenderDone || g_state != g_lastRenderedState ||
                       g_dark != g_lastRenderedDark || g_themeIndex != g_lastRenderedTheme;
    g_lastRenderedState = g_state;
    g_lastRenderedDark = g_dark;
    g_lastRenderedTheme = g_themeIndex;
    g_firstRenderDone = true;

    switch (g_state) {
        case ST_MAIN:
            renderTopContext(bg, ink);
            renderMainMenuButtons(bg, ink);
            break;
        case ST_QNLIST:
        case ST_BROWSE_QNLIST:
        case ST_BROWSE_QLIST:
        case ST_OPTIONS:
        case ST_ROLL_YOUR_OWN:
        case ST_BONUS:
        case ST_MY_PACKS:
        case ST_MOVE_PICKER:
            renderTopContext(bg, ink);
            renderScrollList(bg, ink, freshEntry);
            break;
        case ST_SWIPE:
            renderSwipe(bg, ink);
            break;
        case ST_SPINNER:
            renderSpinner(bg, ink);
            break;
        case ST_CONFIRM_CLEAR:
            renderConfirmClear(bg, ink);
            break;
        case ST_NO_FAVORITES:
            renderNoFavorites(bg, ink);
            break;
        case ST_NO_CUSTOM:
            renderNoCustom(bg, ink);
            break;
        case ST_CONTROLS:
            renderControls(bg, ink);
            break;
        case ST_KEYBOARD_ENTRY:
            renderKeyboardEntry(bg, ink);
            break;
    }
}

/* ---------------- state transitions ---------------- */

static void initBottomBitmapBG(void) {
    int botBg = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    g_botVRAM = bgGetGfxPtr(botBg);
}

static void goBack(void) {
    /* leaving the swipe screen is the natural checkpoint to persist
       the view counter -- avoids writing to the SD card on every
       single L/R press while still saving before the number is lost. */
    if (g_state == ST_SWIPE) saveSettings();
    switch (g_state) {
        case ST_QNLIST:        g_state = ST_MAIN; break;
        case ST_BROWSE_QNLIST: g_state = ST_MAIN; break;
        case ST_BROWSE_QLIST:  g_state = g_browseIsCustom ? ST_MY_PACKS : ST_BROWSE_QNLIST; break;
        case ST_OPTIONS:       g_state = ST_BONUS; break;
        case ST_ROLL_YOUR_OWN: g_state = ST_MAIN; break;
        case ST_BONUS:          g_state = ST_MAIN; break;
        case ST_CONTROLS:       g_state = ST_BONUS; break;
        case ST_MY_PACKS:      g_state = ST_ROLL_YOUR_OWN; break;
        case ST_MOVE_PICKER:   g_state = ST_BROWSE_QLIST; break;
        case ST_SWIPE:         g_state = ST_MAIN; break;
        case ST_SPINNER:       g_state = ST_SWIPE; break;
        case ST_CONFIRM_CLEAR: g_state = ST_OPTIONS; break;
        default:                g_state = ST_MAIN;
    }
    g_selIndex = 0;
    g_scrollTop = 0;
}

/* Reconfigures the sub screen for libnds's own on-screen keyboard,
   which by default wants BG3 of the sub display -- same layer our
   bitmap UI normally owns there, so we swap what it's configured as
   rather than fighting over VRAM for a second layer.

   Bug fix: MODE_5_2D (what we normally run) only allows BG3 to be an
   extended/bitmap background, not plain text -- so a Text4bpp BG3
   under that mode silently fails to display anything (touch input
   still works, since hit-testing doesn't care about display config,
   which is exactly the "touching types but the screen is black"
   symptom). The keyboard needs a mode where BG3-as-text is valid, so
   we switch the SUB screen only (never the main/top screen, which
   keeps using our bitmap UI for the live preview throughout) to
   MODE_0_2D for the duration, then back to MODE_5_2D + reinit our
   bitmap on exit. */
static void showKeyboardUI(void) {
    videoSetModeSub(MODE_0_2D);
    keyboardInit(NULL, 3, BgType_Text4bpp, BgSize_T_256x512, 20, 0, false, true);
    keyboardShow();
}

static void enterKeyboardEntry(void) {
    showKeyboardUI();
    g_kbBuffer[0] = 0;
    g_kbLen = 0;
    g_kbMode = KB_ADD_QUESTION;
    g_state = ST_KEYBOARD_ENTRY;
}

static void enterKeyboardNewPack(void) {
    showKeyboardUI();
    g_kbBuffer[0] = 0;
    g_kbLen = 0;
    g_kbMode = KB_NEW_PACK;
    g_state = ST_KEYBOARD_ENTRY;
}

static void enterKeyboardNewPackAndMove(void) {
    showKeyboardUI();
    g_kbBuffer[0] = 0;
    g_kbLen = 0;
    g_kbMode = KB_NEW_PACK_AND_MOVE;
    g_state = ST_KEYBOARD_ENTRY;
}

static void exitKeyboardEntry(void) {
    keyboardHide();
    videoSetModeSub(MODE_5_2D);
    initBottomBitmapBG();
    if (g_kbMode == KB_NEW_PACK_AND_MOVE) {
        g_browseQCount = collectPackQuestions(g_browseQn, g_browseQList, MAX_QUESTIONS);
        if (g_selIndex >= g_browseQCount) g_selIndex = g_browseQCount > 0 ? g_browseQCount - 1 : 0;
        g_state = ST_BROWSE_QLIST;
    } else if (g_kbMode == KB_NEW_PACK) {
        g_state = ST_MY_PACKS;
        g_selIndex = 0;
        g_scrollTop = 0;
    } else {
        g_state = ST_ROLL_YOUR_OWN;
        g_selIndex = 0;
    }
}

/* Every pack (ROM or custom) is enumerated by scanning for matching
   qnIndex rather than trusting a contiguous qStart/qCount range --
   custom packs stop being contiguous the moment a question is moved
   between them, so this is the one code path that stays correct for
   both. Cheap at this scale (under 1000 entries total). */
static void enterSwipeForQuestionnaire(int qnIdx, int startPos) {
    g_swipeCount = collectPackQuestions(qnIdx, g_swipeList, MAX_QUESTIONS);
    g_swipePos = startPos;
    g_swipeAnimDir = 1;
    g_swipeAnimStart = g_frame;
    g_dailyMode = false;
    g_questionsViewed++;
    g_state = ST_SWIPE;
}

static void enterSwipeFromList(const int *list, int count, int startPos) {
    if (count <= 0) return;
    if (count > MAX_QUESTIONS) count = MAX_QUESTIONS;
    g_swipeCount = count;
    memcpy(g_swipeList, list, sizeof(int) * count);
    g_swipePos = startPos;
    g_swipeAnimDir = 1;
    g_swipeAnimStart = g_frame;
    g_dailyMode = false;
    g_questionsViewed++;
    g_state = ST_SWIPE;
}

static void shuffleSwipeList(void) {
    for (int i = g_swipeCount - 1; i > 0; i--) {
        int j = rand() % (i + 1);
        int tmp = g_swipeList[i];
        g_swipeList[i] = g_swipeList[j];
        g_swipeList[j] = tmp;
    }
}

/* Combines every checked pack's questions into one shuffled session --
   "mixing" means genuinely interleaved, not just concatenated blocks
   pack by pack. Uses static scratch storage rather than stack arrays:
   two MAX_QUESTIONS-sized int buffers is ~5.6KB, a lot to put on an
   embedded ARM9 stack for one function call. */
static int g_mixScratch[MAX_QUESTIONS];

static void enterSwipeMixed(void) {
    int n = 0;
    for (int qi = 0; qi < g_qnCount && n < MAX_QUESTIONS; qi++) {
        if (!g_qnChecked[qi]) continue;
        n += collectPackQuestions(qi, g_mixScratch + n, MAX_QUESTIONS - n);
    }
    if (n == 0) return;
    enterSwipeFromList(g_mixScratch, n, 0);
    shuffleSwipeList();
}

static void enterSwipeFavorites(void) {
    if (g_favoriteCount == 0) { g_state = ST_NO_FAVORITES; return; }
    g_swipeCount = g_favoriteCount;
    memcpy(g_swipeList, g_favorites, sizeof(int) * g_favoriteCount);
    g_swipePos = 0;
    g_swipeAnimDir = 1;
    g_swipeAnimStart = g_frame;
    g_dailyMode = false;
    g_questionsViewed++;
    g_state = ST_SWIPE;
}

/* Daily Question: a single card, deterministically chosen from the
   real date so it's the same all day and changes at midnight. First
   view of the day is persisted immediately (not deferred to goBack)
   so the *NEW* badge clears reliably even if the DS loses power
   before the user backs out normally. */
static void enterDailyQuestion(void) {
    g_swipeList[0] = dailyQuestionIndex();
    g_swipeCount = 1;
    g_swipePos = 0;
    g_swipeAnimDir = 1;
    g_swipeAnimStart = g_frame;
    g_dailyMode = true;
    g_lastDailyDay = currentDayNumber();
    g_questionsViewed++;
    saveSettings();
    g_state = ST_SWIPE;
}

/* ---------------- input handling ---------------- */

static bool pointInMainButton(touchPosition touch, int count, int *outIdx) {
    int bx = FRAME_X + 10;
    int bw = FRAME_W - 20;
    for (int i = 0; i < count; i++) {
        int by = BTN_TOP + i * BTN_STEP;
        if (touch.px >= bx && touch.px < bx + bw && touch.py >= by && touch.py < by + BTN_H) {
            *outIdx = i;
            return true;
        }
    }
    return false;
}

static bool handleMainInput(int pressed, bool touched, touchPosition touch) {
    bool changed = false;
    int count = getItemCount();
    int prevSel = g_selIndex;

    if (pressed & KEY_UP)   { if (g_selIndex > 0) { g_selIndex--; changed = true; } }
    if (pressed & KEY_DOWN) { if (g_selIndex < count - 1) { g_selIndex++; changed = true; } }

    int activated = -1;
    if (touched) {
        int idx;
        if (pointInMainButton(touch, count, &idx)) { g_selIndex = idx; activated = idx; changed = true; }
    }
    if (pressed & KEY_A) activated = g_selIndex;

    if (activated >= 0) {
        if (activated == 0)      { g_state = ST_QNLIST; g_selIndex = 0; g_scrollTop = 0; }
        else if (activated == 1) {
            g_state = ST_BROWSE_QNLIST; g_selIndex = 0; g_scrollTop = 0;
            memset(g_qnChecked, 0, sizeof(g_qnChecked));
            g_checkedCount = 0;
        }
        else if (activated == 2) { g_state = ST_ROLL_YOUR_OWN; }
        else if (activated == 3) { enterSwipeFavorites(); }
        else if (activated == 4) { g_state = ST_BONUS; g_selIndex = 0; g_scrollTop = 0; }
        else if (activated == 5) { enterDailyQuestion(); }
        changed = true;
    }
    if (g_selIndex != prevSel) g_selAnimStart = g_frame;
    return changed;
}

static bool handleListInput(int pressed, bool touched, bool touchHeld, touchPosition touch) {
    bool changed = false;
    int count = getItemCount();
    int prevSel = g_selIndex;

    if (pressed & KEY_UP)   { if (g_selIndex > 0) { g_selIndex--; changed = true; } }
    if (pressed & KEY_DOWN) { if (g_selIndex < count - 1) { g_selIndex++; changed = true; } }
    if (pressed & KEY_B)    { goBack(); return true; }
    if (touched && touch.py >= LIST_BOTTOM) { goBack(); return true; }

    /* Scrollbar drag: uses held state, not just the press edge, so
       moving the stylus while still touching keeps scrolling rather
       than only reacting to the initial contact frame. A tap (which
       is "held" for at least that one frame) also jump-scrolls to
       that position, which falls out naturally rather than needing
       separate handling. Checked before row-tap handling below, and
       when it applies, replaces it entirely for this frame -- a
       touch on the scrollbar shouldn't also activate whatever row
       happens to sit at that Y position. */
    bool scrollbarZone = (touch.px >= SCROLLBAR_X - 6 && touch.px <= SCROLLBAR_X + 3);
    if (touchHeld && scrollbarZone && touch.py >= LIST_TOP && touch.py < LIST_BOTTOM && count > LIST_VISIBLE) {
        int trackH = LIST_BOTTOM - LIST_TOP;
        int maxScroll = count - LIST_VISIBLE;
        int rel = touch.py - LIST_TOP;
        if (rel < 0) rel = 0;
        if (rel > trackH) rel = trackH;
        int newScrollTop = (rel * maxScroll) / trackH;
        if (newScrollTop < 0) newScrollTop = 0;
        if (newScrollTop > maxScroll) newScrollTop = maxScroll;
        if (newScrollTop != g_scrollTop) {
            g_scrollTop = newScrollTop;
            g_selIndex = g_scrollTop;
            changed = true;
        }
        return changed;
    }

    /* Browse Packs: Y (or tapping a row's checkbox strip) toggles
       that pack into the mix; START begins a shuffled session across
       everything checked. A/tap elsewhere still opens that one pack
       normally, unchanged. */
    if (g_state == ST_BROWSE_QNLIST && (pressed & KEY_Y) && g_selIndex < count) {
        g_qnChecked[g_selIndex] = !g_qnChecked[g_selIndex];
        g_checkedCount += g_qnChecked[g_selIndex] ? 1 : -1;
        g_checkPopStart = g_frame;
        g_checkPopIdx = g_selIndex;
        changed = true;
    }
    if (g_state == ST_BROWSE_QNLIST && (pressed & KEY_START) && g_checkedCount >= 1) {
        enterSwipeMixed();
        return true;
    }

    /* Custom pack management: Y moves the highlighted question to a
       different pack. Only offered when browsing via "My Packs" --
       moving a ROM pack's questions wouldn't make sense. */
    if (g_state == ST_BROWSE_QLIST && g_browseIsCustom && (pressed & KEY_Y) && g_browseQCount > 0) {
        g_moveQuestionIdx = g_browseQList[g_selIndex];
        g_movePickerCount = 0;
        for (int qi = 0; qi < g_qnCount && g_movePickerCount < MAX_QUESTIONNAIRES; qi++)
            if (g_qn[qi].isCustom && qi != g_browseQn) g_movePickerList[g_movePickerCount++] = qi;
        g_state = ST_MOVE_PICKER;
        g_selIndex = 0;
        g_scrollTop = 0;
        return true;
    }

    int activated = -1;
    if (touched && touch.py >= LIST_TOP && touch.py < LIST_BOTTOM &&
        touch.px >= FRAME_X && touch.px < FRAME_X + FRAME_W) {
        int row = (touch.py - LIST_TOP) / LIST_ROW_H;
        int idx = g_scrollTop + row;
        if (idx < count) {
            if (g_state == ST_BROWSE_QNLIST && touch.px < FRAME_X + 24) {
                g_qnChecked[idx] = !g_qnChecked[idx];
                g_checkedCount += g_qnChecked[idx] ? 1 : -1;
                g_checkPopStart = g_frame;
                g_checkPopIdx = idx;
                g_selIndex = idx;
                changed = true;
            } else {
                g_selIndex = idx; activated = idx; changed = true;
            }
        }
    }
    if (pressed & KEY_A) activated = g_selIndex;

    if (activated >= 0 && count > 0) {
        switch (g_state) {
            case ST_QNLIST:
                enterSwipeForQuestionnaire(activated, 0);
                changed = true;
                break;
            case ST_BROWSE_QNLIST:
                g_browseQn = activated;
                g_browseIsCustom = false;
                g_browseQCount = collectPackQuestions(activated, g_browseQList, MAX_QUESTIONS);
                g_state = ST_BROWSE_QLIST;
                g_selIndex = 0;
                g_scrollTop = 0;
                changed = true;
                break;
            case ST_BROWSE_QLIST:
                enterSwipeFromList(g_browseQList, g_browseQCount, activated);
                changed = true;
                break;
            case ST_OPTIONS:
                if (activated == 0) {
                    g_confirmKind = CONFIRM_CLEAR_FAVORITES;
                    g_state = ST_CONFIRM_CLEAR;
                } else if (activated == 1) {
                    g_dark = !g_dark;
                    saveSettings();
                } else if (activated == 2) {
                    g_themeIndex = (g_themeIndex + 1) % THEME_COUNT;
                    saveSettings();
                } else if (activated == 3) {
                    g_state = ST_BONUS;
                    g_selIndex = 0;
                }
                changed = true;
                break;
            case ST_ROLL_YOUR_OWN:
                if (activated == 0) {
                    enterKeyboardEntry();
                } else if (activated == 1) {
                    if (customPackCount() > 0) {
                        g_state = ST_MY_PACKS;
                        g_selIndex = 0;
                        g_scrollTop = 0;
                    } else {
                        g_state = ST_NO_CUSTOM;
                    }
                } else if (activated == 2) {
                    enterKeyboardNewPack();
                } else if (activated == 3) {
                    g_state = ST_MAIN;
                    g_selIndex = 0;
                }
                changed = true;
                break;
            case ST_BONUS:
                if (activated == 0) {
                    g_state = ST_OPTIONS;
                    g_selIndex = 0;
                } else if (activated == 1) {
                    g_state = ST_CONTROLS;
                } else if (activated == 2) {
                    g_state = ST_MAIN;
                    g_selIndex = 0;
                }
                changed = true;
                break;
            case ST_MY_PACKS: {
                int qi = customPackAtIndex(activated);
                if (qi >= 0) {
                    g_browseQn = qi;
                    g_browseIsCustom = true;
                    g_browseQCount = collectPackQuestions(qi, g_browseQList, MAX_QUESTIONS);
                    g_state = ST_BROWSE_QLIST;
                    g_selIndex = 0;
                    g_scrollTop = 0;
                }
                changed = true;
                break;
            }
            case ST_MOVE_PICKER:
                if (activated < g_movePickerCount) {
                    moveQuestionToPack(g_moveQuestionIdx, g_movePickerList[activated]);
                    g_browseQCount = collectPackQuestions(g_browseQn, g_browseQList, MAX_QUESTIONS);
                    g_state = ST_BROWSE_QLIST;
                    g_selIndex = 0;
                    g_scrollTop = 0;
                } else if (activated == g_movePickerCount) {
                    enterKeyboardNewPackAndMove();
                } else {
                    g_confirmKind = CONFIRM_DELETE_QUESTION;
                    g_state = ST_CONFIRM_CLEAR;
                }
                changed = true;
                break;
            default:
                break;
        }
    }
    if (g_selIndex != prevSel) g_selAnimStart = g_frame;
    return changed;
}

static bool handleSwipeInput(int pressed, bool touched, touchPosition touch) {
    bool changed = false;

    /* Daily Question is a single fixed card -- no prev/next/random,
       that's the point of it being "the one for today" rather than
       just another browsable set. Favorite + back still work. */
    if (!g_dailyMode) {
        if (pressed & KEY_L) {
            g_swipePos = (g_swipePos - 1 + g_swipeCount) % g_swipeCount;
            g_swipeAnimDir = -1; g_swipeAnimStart = g_frame; g_questionsViewed++; changed = true;
        }
        if (pressed & KEY_R) {
            g_swipePos = (g_swipePos + 1) % g_swipeCount;
            g_swipeAnimDir = 1; g_swipeAnimStart = g_frame; g_questionsViewed++; changed = true;
        }
        if (pressed & KEY_X) {
            if (g_swipeCount > 1) {
                int newPos = rand() % g_swipeCount;
                g_swipeAnimDir = (newPos >= g_swipePos) ? 1 : -1;
                g_swipePos = newPos;
                g_swipeAnimStart = g_frame;
                g_questionsViewed++;
            }
            changed = true;
        }
        /* tall prev/next buttons -- swipe-drag is gone entirely (see
           renderSwipe), so a tap anywhere else on the bottom screen
           is free to be an ordinary button instead of accidentally
           starting a drag gesture. */
        if (touched && touch.py >= ARROW_Y0 && touch.py < ARROW_Y1) {
            if (touch.px >= ARROW_X_LEFT && touch.px < ARROW_X_LEFT + ARROW_W) {
                g_swipePos = (g_swipePos - 1 + g_swipeCount) % g_swipeCount;
                g_swipeAnimDir = -1; g_swipeAnimStart = g_frame; g_questionsViewed++; changed = true;
            } else if (touch.px >= ARROW_X_RIGHT && touch.px < ARROW_X_RIGHT + ARROW_W) {
                g_swipePos = (g_swipePos + 1) % g_swipeCount;
                g_swipeAnimDir = 1; g_swipeAnimStart = g_frame; g_questionsViewed++; changed = true;
            }
        }
        if (touched && touch.px >= CONTENT_X0 && touch.px < CONTENT_X0 + SPIN_BTN_W &&
            touch.py >= SPIN_BTN_Y && touch.py < SPIN_BTN_Y + SPIN_BTN_H) {
            g_state = ST_SPINNER;
            g_spinning = false;
            g_spinVelocity = 0;
            changed = true;
        }
    }

    /* Y:FAV / X:RANDOM boxes -- these were drawn as buttons but had
       no touch hit-testing at all, so only the physical Y/X buttons
       worked (the reported bug). Geometry mirrors renderSwipe. */
    if (g_dailyMode) {
        int bx = FRAME_X + 10, bw = FRAME_W - 20;
        if (touched && touch.py >= 50 && touch.py < 86 && touch.px >= bx && touch.px < bx + bw) {
            toggleFavorite(g_swipeList[g_swipePos]);
            g_favPopStart = g_frame;
            changed = true;
        }
    } else if (touched && touch.py >= 46 && touch.py < 86) {
        int bx = CONTENT_X0, bw = (CONTENT_W - 8) / 2;
        if (touch.px >= bx && touch.px < bx + bw) {
            toggleFavorite(g_swipeList[g_swipePos]);
            g_favPopStart = g_frame;
            changed = true;
        } else if (touch.px >= bx + bw + 8 && touch.px < bx + bw + 8 + bw) {
            if (g_swipeCount > 1) {
                int newPos = rand() % g_swipeCount;
                g_swipeAnimDir = (newPos >= g_swipePos) ? 1 : -1;
                g_swipePos = newPos;
                g_swipeAnimStart = g_frame;
                g_questionsViewed++;
            }
            changed = true;
        }
    }

    if (pressed & KEY_Y) {
        toggleFavorite(g_swipeList[g_swipePos]);
        g_favPopStart = g_frame;
        changed = true;
    }
    if (pressed & KEY_B) { goBack(); return true; }
    if (touched && touch.py >= 168) { goBack(); return true; }
    return changed;
}

static void confirmYes(void) {
    if (g_confirmKind == CONFIRM_DELETE_QUESTION) {
        deleteQuestion(g_moveQuestionIdx);
        g_browseQCount = collectPackQuestions(g_browseQn, g_browseQList, MAX_QUESTIONS);
        if (g_selIndex >= g_browseQCount) g_selIndex = g_browseQCount > 0 ? g_browseQCount - 1 : 0;
        g_state = ST_BROWSE_QLIST;
    } else {
        g_favoriteCount = 0;
        saveSettings();
        g_state = ST_OPTIONS;
        g_selIndex = 0;
    }
}

static void confirmNo(void) {
    g_state = (g_confirmKind == CONFIRM_DELETE_QUESTION) ? ST_BROWSE_QLIST : ST_OPTIONS;
    g_selIndex = 0;
}

static bool handleConfirmInput(int pressed, bool touched, touchPosition touch) {
    if (pressed & KEY_A) { confirmYes(); return true; }
    if (pressed & KEY_B) { confirmNo(); return true; }
    /* "A: YES   B: NO" -- left half of the row taps as yes, right
       half as no, matching where each label actually sits. */
    if (touched && touch.py >= 92 && touch.py < 108) {
        if (touch.px < SCR_W / 2) confirmYes(); else confirmNo();
        return true;
    }
    return false;
}

/* keyboardUpdate() must be called every frame the keyboard is shown
   (it drives the keyboard's own touch handling and animation), so
   this runs unconditionally regardless of whether we detect a change
   worth redrawing our own top-screen preview for. */
static bool handleKeyboardInput(int pressed) {
    bool changed = false;
    int key = keyboardUpdate();

    if (key == DVK_ENTER) {
        if (g_kbLen > 0) {
            if (g_kbMode == KB_ADD_QUESTION) {
                addCustomQuestion(g_kbBuffer);
            } else if (g_kbMode == KB_NEW_PACK) {
                createCustomPackMemory(g_kbBuffer);
                saveCustomFile();
            } else if (g_kbMode == KB_NEW_PACK_AND_MOVE) {
                int newIdx = createCustomPackMemory(g_kbBuffer);
                if (newIdx >= 0) moveQuestionToPack(g_moveQuestionIdx, newIdx);
            }
        }
        exitKeyboardEntry();
        return true;
    }
    if (pressed & KEY_B) {
        exitKeyboardEntry();
        return true;
    }
    if (key == DVK_BACKSPACE) {
        if (g_kbLen > 0) { g_kbLen--; g_kbBuffer[g_kbLen] = 0; changed = true; }
    } else if (key >= 32 && key < 127 && g_kbLen < (int)sizeof(g_kbBuffer) - 1) {
        g_kbBuffer[g_kbLen++] = (char)key;
        g_kbBuffer[g_kbLen] = 0;
        changed = true;
    }
    return changed;
}

/* ---------------- boot sequence ---------------- */

/* Splash artwork ships as raw RGB15 framebuffer dumps (256x192, one
   u16 per pixel) via NitroFS -- see data/img_to_bin.py. Dissolves in
   from black, holds briefly, dissolves back out, then the app loads
   its data and drops into the main menu. */
#define SPLASH_DISSOLVE_FRAMES 10
#define SPLASH_HOLD_FRAMES     40

static void loadSplashImage(const char *path, u16 *dst) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        for (int i = 0; i < SCR_W * SCR_H; i++) dst[i] = themeBg();
        return;
    }
    fread(dst, sizeof(u16), SCR_W * SCR_H, f);
    fclose(f);
}

/* Dissolve toward (t/maxT) of the way from black to the source image.
   The ARM9 has no hardware integer divide -- a naive per-pixel `* t /
   maxT` compiles to a software division call, and doing that 3x per
   pixel across 2 full screens was the actual cause of the splash
   taking forever (roughly 5.9 million emulated divisions over the old
   20-frame dissolve). A channel only has 32 possible input values, so
   the whole scale factor is precomputed once per frame into a tiny
   table and the hot loop becomes pure table lookups -- no division
   left in the per-pixel path at all. */
static void dissolveBlit(u16 *fb, const u16 *img, int t, int maxT) {
    u8 lut[32];
    for (int v = 0; v < 32; v++) lut[v] = (u8)(v * t / maxT);
    for (int i = 0; i < SCR_W * SCR_H; i++) {
        u16 s = img[i];
        int r = lut[s & 0x1F];
        int g = lut[(s >> 5) & 0x1F];
        int b = lut[(s >> 10) & 0x1F];
        fb[i] = (u16)((1 << 15) | r | (g << 5) | (b << 10));
    }
}

/* ---------------- main ---------------- */

int main(int argc, char **argv) {
    videoSetMode(MODE_5_2D);
    videoSetModeSub(MODE_5_2D);
    vramSetBankA(VRAM_A_MAIN_BG);
    vramSetBankC(VRAM_C_SUB_BG);

    int topBg = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    int botBg = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    g_topVRAM = bgGetGfxPtr(topBg);
    g_botVRAM = bgGetGfxPtr(botBg);

    gfxClear(g_top, 0);
    gfxClear(g_bot, 0);
    blitToScreen();

    nitroFSInit(NULL);
    fatInitDefault();
    loadDisplaySettings();

    u16 *splashTop = malloc(SCR_W * SCR_H * sizeof(u16));
    u16 *splashBot = malloc(SCR_W * SCR_H * sizeof(u16));
    loadSplashImage("nitro:/splash_top.bin", splashTop);
    loadSplashImage("nitro:/splash_bottom.bin", splashBot);

    for (int f = 0; f < SPLASH_DISSOLVE_FRAMES; f++) {
        swiWaitForVBlank();
        g_frame = f;
        dissolveBlit(g_top, splashTop, f + 1, SPLASH_DISSOLVE_FRAMES);
        dissolveBlit(g_bot, splashBot, f + 1, SPLASH_DISSOLVE_FRAMES);
        blitToScreen();
    }
    for (int f = 0; f < SPLASH_HOLD_FRAMES; f++) swiWaitForVBlank();
    for (int f = 0; f < SPLASH_DISSOLVE_FRAMES; f++) {
        swiWaitForVBlank();
        int t = SPLASH_DISSOLVE_FRAMES - f - 1;
        dissolveBlit(g_top, splashTop, t, SPLASH_DISSOLVE_FRAMES);
        dissolveBlit(g_bot, splashBot, t, SPLASH_DISSOLVE_FRAMES);
        blitToScreen();
    }

    free(splashTop);
    free(splashBot);

    /* respect the user's theme/dark-mode preference here too -- both
       already loaded (loadDisplaySettings ran before the splash), so
       this was showing default-theme light colors even otherwise. */
    gfxClear(g_top, themeBg());
    gfxDrawTextCentered(g_top, SCR_W / 2, 90, "LOADING...", 1, themeInk());
    blitToScreen();

    loadData();
    loadCustomQuestions();
    loadProgressSettings();
    srand(time(NULL));

    g_state = ST_MAIN;
    g_selAnimStart = g_frame;

    while (pmMainLoop()) {
        swiWaitForVBlank();
        g_frame++;
        scanKeys();

        touchPosition touch;
        touchRead(&touch);
        int pressed = keysDown();
        bool touched = (pressed & KEY_TOUCH) != 0;
        bool touchHeld = (keysHeld() & KEY_TOUCH) != 0;
        bool changed = false;

        switch (g_state) {
            case ST_MAIN:
                changed = handleMainInput(pressed, touched, touch);
                break;
            case ST_QNLIST:
            case ST_BROWSE_QNLIST:
            case ST_BROWSE_QLIST:
            case ST_OPTIONS:
            case ST_ROLL_YOUR_OWN:
            case ST_BONUS:
            case ST_MY_PACKS:
            case ST_MOVE_PICKER:
                changed = handleListInput(pressed, touched, touchHeld, touch);
                break;
            case ST_SWIPE:
                changed = handleSwipeInput(pressed, touched, touch);
                break;
            case ST_SPINNER:
                changed = handleSpinnerInput(pressed, touched, touch);
                break;
            case ST_CONFIRM_CLEAR:
                changed = handleConfirmInput(pressed, touched, touch);
                break;
            case ST_NO_FAVORITES:
                if (pressed & (KEY_B | KEY_A | KEY_TOUCH)) {
                    g_state = ST_MAIN;
                    g_selIndex = 0;
                    g_scrollTop = 0;
                    changed = true;
                }
                break;
            case ST_NO_CUSTOM:
                if (pressed & (KEY_B | KEY_A | KEY_TOUCH)) {
                    g_state = ST_ROLL_YOUR_OWN;
                    g_selIndex = 0;
                    g_scrollTop = 0;
                    changed = true;
                }
                break;
            case ST_CONTROLS:
                if (pressed & (KEY_B | KEY_A | KEY_TOUCH)) {
                    g_state = ST_BONUS;
                    g_selIndex = 0;
                    g_scrollTop = 0;
                    changed = true;
                }
                break;
            case ST_KEYBOARD_ENTRY:
                changed = handleKeyboardInput(pressed);
                break;
        }

        /* Only redraw on an actual change or while an animation is
           still in flight -- a static screen (the common case) costs
           nothing per frame instead of a full two-screen flat-fill
           every vblank regardless of whether anything moved.
           Uses <= so one guaranteed render happens at the exact frame
           an animation completes (elapsed == total, ease = 0) -- with
           strict <, that final settled frame was never drawn and the
           screen froze one frame short: a near-full but not-quite
           selection fill with no label, permanently. */
        bool listLike = (g_state != ST_SWIPE && g_state != ST_KEYBOARD_ENTRY &&
                         g_state != ST_CONFIRM_CLEAR && g_state != ST_NO_FAVORITES &&
                         g_state != ST_NO_CUSTOM && g_state != ST_CONTROLS && g_state != ST_SPINNER);
        if (g_state == ST_SPINNER && updateSpinner()) changed = true;
        bool animating = (listLike && (g_frame - g_selAnimStart <= SEL_ANIM_FRAMES)) ||
                          (g_state == ST_BROWSE_QNLIST && (g_frame - g_checkPopStart <= FAV_POP_FRAMES)) ||
                          (g_state == ST_SWIPE &&
                           ((g_frame - g_swipeAnimStart <= SWIPE_ANIM_FRAMES) ||
                            (g_frame - g_favPopStart <= FAV_POP_FRAMES)));
        if (changed || animating) {
            render();
            blitToScreen();
        }
    }
    return 0;
}
