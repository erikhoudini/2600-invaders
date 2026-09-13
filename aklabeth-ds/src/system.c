/*
 * system.c - System initialization and low-level routines
 * Minimal startup code for Nintendo DS bare-metal development
 */

#include "nds.h"
#include <stdint.h>

/* External symbols from linker script */
extern uint32_t _data_start;
extern uint32_t _data_end;
extern uint32_t _bss_start;
extern uint32_t _bss_end;
extern uint32_t _stack_top;

/* Forward declarations */
void _start(void);
void main(void);
static void init_bss(void);
static void init_data(void);
static void wait_vblank(void);

/* Entry point - called by bootloader */
void _start(void)
{
    /* Initialize memory sections */
    init_bss();
    init_data();
    
    /* Wait for VBlank to ensure display is ready */
    wait_vblank();
    
    /* Call user main function */
    main();
    
    /* Infinite loop if main returns */
    while (1) {
        __asm__ volatile ("wfi");
    }
}

/* Clear BSS section to zero */
static void init_bss(void)
{
    uint32_t* dst = &_bss_start;
    uint32_t* end = &_bss_end;
    
    while (dst < end) {
        *dst++ = 0;
    }
}

/* Copy data section from ROM to RAM */
static void init_data(void)
{
    /* Note: In a full implementation, we'd copy from ROM location */
    /* For now, assume data is already in place or handled by loader */
}

/* Wait for vertical blank */
static void wait_vblank(void)
{
    /* Wait until we're NOT in VBlank */
    while (REG_VCOUNT < 160) {
        /* spin */
    }
    
    /* Wait until we ARE in VBlank */
    while (REG_VCOUNT >= 160) {
        /* spin */
    }
}

/* Simple memset implementation */
void* memset(void* s, int c, unsigned long n)
{
    unsigned char* p = (unsigned char*)s;
    while (n--) {
        *p++ = (unsigned char)c;
    }
    return s;
}

/* Simple memcpy implementation */
void* memcpy(void* dest, const void* src, unsigned long n)
{
    const unsigned char* s = (const unsigned char*)src;
    unsigned char* d = (unsigned char*)dest;
    while (n--) {
        *d++ = *s++;
    }
    return dest;
}

/* DMA copy for fast memory transfers */
void dma_copy(const void* src, void* dst, uint32_t size)
{
    /* Use DMA3 for general purpose copies */
    REG_DMA3SAD = (uint32_t)src;
    REG_DMA3DAD = (uint32_t)dst;
    REG_DMA3CNT = (size >> 1) | (1 << 26) | (1 << 31);  /* 16-bit, enable */
    
    /* Wait for DMA to complete */
    while (REG_DMA3CNT & (1 << 31)) {
        /* spin */
    }
}
