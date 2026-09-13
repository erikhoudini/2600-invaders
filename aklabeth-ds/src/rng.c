/*
 * rng.c - Random Number Generator
 * Implements LCG seeded from RTC for dungeon generation
 */

#include <stdint.h>

/* Linear Congruential Generator state */
static uint32_t g_rng_state = 0x12345678;

/* Initialize RNG with seed */
void rng_init(uint32_t seed)
{
    /* Ensure non-zero seed */
    g_rng_state = seed ? seed : 0x12345678;
}

/* Generate next random number (0 to 0xFFFFFFFF) */
uint32_t rng_next(void)
{
    /* LCG parameters (same as many C libraries) */
    g_rng_state = g_rng_state * 1103515245 + 12345;
    return g_rng_state;
}

/* Generate random number in range [0, max) */
uint32_t rng_range(uint32_t max)
{
    if (max == 0) {
        return 0;
    }
    return rng_next() % max;
}

/* Generate random number in range [min, max] */
uint32_t rng_range_inclusive(uint32_t min, uint32_t max)
{
    if (min >= max) {
        return min;
    }
    return min + rng_range(max - min + 1);
}

/* Generate random signed integer in range [-max, max] */
int32_t rng_signed_range(uint32_t max)
{
    uint32_t val = rng_range(max * 2 + 1);
    return (int32_t)val - (int32_t)max;
}

/* Simple dice roll: 1dN */
uint32_t rng_dice(uint32_t sides)
{
    return 1 + rng_range(sides);
}

/* Roll multiple dice: NdM */
uint32_t rng_dice_multiple(uint32_t count, uint32_t sides)
{
    uint32_t total = 0;
    while (count--) {
        total += rng_dice(sides);
    }
    return total;
}
