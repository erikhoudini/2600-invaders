/*
 * input.h - Input Handling Header
 */

#ifndef INPUT_H
#define INPUT_H

#include <stdint.h>

void input_init(void);
void input_scan(void);
int input_key_held(uint16_t key);
int input_key_pressed(uint16_t key);
int input_key_released(uint16_t key);
uint16_t input_get_held(void);
uint16_t input_get_pressed(void);
uint16_t input_get_released(void);
int input_touch_x(void);
int input_touch_y(void);
int input_touch_pressed(void);
void input_wait_for_key(uint16_t key);

#endif /* INPUT_H */
