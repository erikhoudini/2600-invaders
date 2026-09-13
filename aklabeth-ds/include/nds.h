/*
 * nds.h - Nintendo DS Hardware Definitions
 * Minimal header for bare-metal DS development
 */

#ifndef NDS_H
#define NDS_H

#include <stdint.h>

/* Memory-mapped I/O base addresses */
#define REG_BASE            0x04000000
#define VRAM_BASE           0x06000000
#define PALRAM_BASE         0x05000000
#define OAM_BASE            0x07000000

/* Display Control Registers */
#define REG_DISPCNT         (*(volatile uint16_t*)(REG_BASE + 0x0000))
#define REG_DISPSTAT        (*(volatile uint16_t*)(REG_BASE + 0x0004))
#define REG_VCOUNT          (*(volatile uint16_t*)(REG_BASE + 0x0006))
#define REG_BG0CNT          (*(volatile uint16_t*)(REG_BASE + 0x0008))
#define REG_BG1CNT          (*(volatile uint16_t*)(REG_BASE + 0x000A))
#define REG_BG2CNT          (*(volatile uint16_t*)(REG_BASE + 0x000C))
#define REG_BG3CNT          (*(volatile uint16_t*)(REG_BASE + 0x000E))
#define REG_BG0HOFS         (*(volatile uint16_t*)(REG_BASE + 0x0010))
#define REG_BG0VOFS         (*(volatile uint16_t*)(REG_BASE + 0x0012))
#define REG_BG1HOFS         (*(volatile uint16_t*)(REG_BASE + 0x0014))
#define REG_BG1VOFS         (*(volatile uint16_t*)(REG_BASE + 0x0016))
#define REG_BG2HOFS         (*(volatile uint16_t*)(REG_BASE + 0x0018))
#define REG_BG2VOFS         (*(volatile uint16_t*)(REG_BASE + 0x001A))
#define REG_BG3HOFS         (*(volatile uint16_t*)(REG_BASE + 0x001C))
#define REG_BG3VOFS         (*(volatile uint16_t*)(REG_BASE + 0x001E))
#define REG_BG2PA           (*(volatile int16_t*)(REG_BASE + 0x0020))
#define REG_BG2PB           (*(volatile int16_t*)(REG_BASE + 0x0022))
#define REG_BG2PC           (*(volatile int16_t*)(REG_BASE + 0x0024))
#define REG_BG2PD           (*(volatile int16_t*)(REG_BASE + 0x0026))
#define REG_BG2X            (*(volatile int32_t*)(REG_BASE + 0x0028))
#define REG_BG2Y            (*(volatile int32_t*)(REG_BASE + 0x002C))
#define REG_BG3PA           (*(volatile int16_t*)(REG_BASE + 0x0030))
#define REG_BG3PB           (*(volatile int16_t*)(REG_BASE + 0x0032))
#define REG_BG3PC           (*(volatile int16_t*)(REG_BASE + 0x0034))
#define REG_BG3PD           (*(volatile int16_t*)(REG_BASE + 0x0036))
#define REG_BG3X            (*(volatile int32_t*)(REG_BASE + 0x0038))
#define REG_BG3Y            (*(volatile int32_t*)(REG_BASE + 0x003C))

/* Window registers */
#define REG_WIN0H           (*(volatile uint16_t*)(REG_BASE + 0x0040))
#define REG_WIN1H           (*(volatile uint16_t*)(REG_BASE + 0x0042))
#define REG_WIN0V           (*(volatile uint16_t*)(REG_BASE + 0x0044))
#define REG_WIN1V           (*(volatile uint16_t*)(REG_BASE + 0x0046))
#define REG_WININ           (*(volatile uint16_t*)(REG_BASE + 0x0048))
#define REG_WINOUT          (*(volatile uint16_t*)(REG_BASE + 0x004A))
#define REG_BLDCNT          (*(volatile uint16_t*)(REG_BASE + 0x0050))
#define REG_BLDALPHA        (*(volatile uint16_t*)(REG_BASE + 0x0052))
#define REG_BLDY            (*(volatile uint16_t*)(REG_BASE + 0x0054))

/* Sound registers */
#define REG_SOUNDCNT        (*(volatile uint16_t*)(REG_BASE + 0x0082))
#define REG_SOUNDBIAS       (*(volatile uint16_t*)(REG_BASE + 0x0088))

/* DMA registers */
#define REG_DMA0SAD         (*(volatile const void*)(REG_BASE + 0x00B0))
#define REG_DMA0DAD         (*(volatile void*)(REG_BASE + 0x00B4))
#define REG_DMA0CNT         (*(volatile uint32_t*)(REG_BASE + 0x00B8))
#define REG_DMA1SAD         (*(volatile uint32_t*)(REG_BASE + 0x00BC))
#define REG_DMA1DAD         (*(volatile uint32_t*)(REG_BASE + 0x00C0))
#define REG_DMA1CNT         (*(volatile uint32_t*)(REG_BASE + 0x00C4))
#define REG_DMA2SAD         (*(volatile uint32_t*)(REG_BASE + 0x00C8))
#define REG_DMA2DAD         (*(volatile uint32_t*)(REG_BASE + 0x00CC))
#define REG_DMA2CNT         (*(volatile uint32_t*)(REG_BASE + 0x00D0))
#define REG_DMA3SAD         (*(volatile uint32_t*)(REG_BASE + 0x00D4))
#define REG_DMA3DAD         (*(volatile uint32_t*)(REG_BASE + 0x00D8))
#define REG_DMA3CNT         (*(volatile uint32_t*)(REG_BASE + 0x00DC))

/* Timer registers */
#define REG_TM0CNT_L        (*(volatile uint16_t*)(REG_BASE + 0x0100))
#define REG_TM0CNT_H        (*(volatile uint16_t*)(REG_BASE + 0x0102))
#define REG_TM1CNT_L        (*(volatile uint16_t*)(REG_BASE + 0x0104))
#define REG_TM1CNT_H        (*(volatile uint16_t*)(REG_BASE + 0x0106))
#define REG_TM2CNT_L        (*(volatile uint16_t*)(REG_BASE + 0x0108))
#define REG_TM2CNT_H        (*(volatile uint16_t*)(REG_BASE + 0x010A))
#define REG_TM3CNT_L        (*(volatile uint16_t*)(REG_BASE + 0x010C))
#define REG_TM3CNT_H        (*(volatile uint16_t*)(REG_BASE + 0x010E))

/* Interrupt registers */
#define REG_IME             (*(volatile uint16_t*)(REG_BASE + 0x0208))
#define REG_IE              (*(volatile uint16_t*)(REG_BASE + 0x0200))
#define REG_IF              (*(volatile uint16_t*)(REG_BASE + 0x0202))
#define REG_IME_ADDR        0x04000208

/* Key input register */
#define REG_KEYINPUT        (*(volatile uint16_t*)(REG_BASE + 0x0130))
#define REG_KEYCNT          (*(volatile uint16_t*)(REG_BASE + 0x0132))

/* Touch screen registers */
#define REG_TSC_CTRL        (*(volatile uint16_t*)(REG_BASE + 0x0290))
#define REG_TSC_DATAX       (*(volatile uint16_t*)(REG_BASE + 0x0292))
#define REG_TSC_DATAY       (*(volatile uint16_t*)(REG_BASE + 0x0294))

/* Power management */
#define REG_POWERCNT        (*(volatile uint16_t*)(REG_BASE + 0x0204))

/* Bit flags for DISPCNT */
#define MODE_0              0x0000
#define MODE_1              0x0001
#define MODE_2              0x0002
#define MODE_3              0x0003  /* 256-color bitmap */
#define MODE_4              0x0004  /* 256-color bitmap with page flip */
#define MODE_5              0x0005
#define BG0_ENABLE          0x0100
#define BG1_ENABLE          0x0200
#define BG2_ENABLE          0x0400
#define BG3_ENABLE          0x0800
#define OBJ_ENABLE          0x1000
#define BACKSCREEN_ENABLE   0x2000
#define FORCE_BLANK         0x4000

/* Bit flags for KEYINPUT (active low) */
#define KEY_A               0x0001
#define KEY_B               0x0002
#define KEY_SELECT          0x0004
#define KEY_START           0x0008
#define KEY_RIGHT           0x0010
#define KEY_LEFT            0x0020
#define KEY_UP              0x0040
#define KEY_DOWN            0x0080
#define KEY_R               0x0100
#define KEY_L               0x0200
#define KEY_X               0x0400
#define KEY_Y               0x0800

/* Screen dimensions */
#define SCREEN_WIDTH        256
#define SCREEN_HEIGHT       192
#define SCREEN_SIZE         (SCREEN_WIDTH * SCREEN_HEIGHT)

/* VRAM banks */
#define VRAM_A              ((uint16_t*)0x06000000)
#define VRAM_B              ((uint16_t*)0x06020000)
#define VRAM_C              ((uint16_t*)0x06040000)
#define VRAM_D              ((uint16_t*)0x06060000)
#define VRAM_E              ((uint8_t*)0x06080000)
#define VRAM_F              ((uint8_t*)0x06084000)
#define VRAM_G              ((uint8_t*)0x06086000)
#define VRAM_H              ((uint16_t*)0x06090000)
#define VRAM_I              ((uint16_t*)0x060A0000)

/* Framebuffer in VRAM (Mode 3) */
#define FRAMEBUFFER         ((uint16_t*)VRAM_A)

#endif /* NDS_H */
