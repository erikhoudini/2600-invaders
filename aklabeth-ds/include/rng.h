/*
 * rng.h - Random Number Generator Header
 */

#ifndef RNG_H
#define RNG_H

#include <stdint.h>

void rng_init(uint32_t seed);
uint32_t rng_next(void);
uint32_t rng_range(uint32_t max);
uint32_t rng_range_inclusive(uint32_t min, uint32_t max);
int32_t rng_signed_range(uint32_t max);
uint32_t rng_dice(uint32_t sides);
uint32_t rng_dice_multiple(uint32_t count, uint32_t sides);

#endif /* RNG_H */
