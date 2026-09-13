/*
 * input.c - Input handling for Nintendo DS
 * Implements key scanning and touch screen input
 */

#include "nds.h"
#include <stdint.h>

/* Key state tracking */
static uint16_t g_keys_current = 0;
static uint16_t g_keys_previous = 0;
static uint16_t g_keys_pressed = 0;
static uint16_t g_keys_released = 0;

/* Touch screen state */
static int g_touch_x = 0;
static int g_touch_y = 0;
static int g_touch_pressed = 0;

/* Initialize input system */
void input_init(void)
{
    g_keys_current = 0;
    g_keys_previous = 0;
    g_keys_pressed = 0;
    g_keys_released = 0;
    g_touch_x = 0;
    g_touch_y = 0;
    g_touch_pressed = 0;
}

/* Scan input and update state */
void input_scan(void)
{
    /* Store previous state */
    g_keys_previous = g_keys_current;
    
    /* Read current key state (active low) */
    g_keys_current = ~REG_KEYINPUT & 0x03FF;
    
    /* Calculate pressed and released keys */
    g_keys_pressed = g_keys_current & ~g_keys_previous;
    g_keys_released = ~g_keys_current & g_keys_previous;
    
    /* Read touch screen */
    /* Note: Proper touch reading requires ADC sequencing */
    /* This is a simplified version */
    if (REG_TSC_CTRL & 0x8000) {
        g_touch_x = REG_TSC_DATAX & 0x01FF;
        g_touch_y = REG_TSC_DATAY & 0x01FF;
        g_touch_pressed = 1;
    } else {
        g_touch_pressed = 0;
    }
}

/* Check if a key is currently held */
int input_key_held(uint16_t key)
{
    return (g_keys_current & key) != 0;
}

/* Check if a key was just pressed this frame */
int input_key_pressed(uint16_t key)
{
    return (g_keys_pressed & key) != 0;
}

/* Check if a key was just released this frame */
int input_key_released(uint16_t key)
{
    return (g_keys_released & key) != 0;
}

/* Get all currently held keys */
uint16_t input_get_held(void)
{
    return g_keys_current;
}

/* Get all keys pressed this frame */
uint16_t input_get_pressed(void)
{
    return g_keys_pressed;
}

/* Get all keys released this frame */
uint16_t input_get_released(void)
{
    return g_keys_released;
}

/* Get touch screen X position */
int input_touch_x(void)
{
    return g_touch_x;
}

/* Get touch screen Y position */
int input_touch_y(void)
{
    return g_touch_y;
}

/* Check if touch screen is being pressed */
int input_touch_pressed(void)
{
    return g_touch_pressed;
}

/* Wait for a specific key press */
void input_wait_for_key(uint16_t key)
{
    while (1) {
        input_scan();
        if (input_key_pressed(key)) {
            break;
        }
        
        /* Simple VBlank wait */
        while (REG_VCOUNT >= 160) { /* wait in vblank */ }
        while (REG_VCOUNT < 160) { /* wait out of vblank */ }
    }
}
