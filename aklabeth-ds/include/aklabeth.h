/*
 * aklabeth.h - Aklabeth-DS Game Definitions
 */

#ifndef AKLABETH_H
#define AKLABETH_H

#include <stdint.h>

/* Game constants */
#define DUNGEON_WIDTH       32
#define DUNGEON_HEIGHT      32
#define DUNGEON_FLOORS      10

#define PLAYER_MAX_HP       50
#define PLAYER_MAX_GOLD     999

#define TILE_EMPTY          0
#define TILE_WALL           1
#define TILE_STAIRS_DOWN    2
#define TILE_STAIRS_UP      3
#define TILE_DOOR           4

#define MAX_ENEMIES         16
#define MAX_ITEMS           32

/* Entity types */
#define ENTITY_NONE         0
#define ENTITY_PLAYER       1
#define ENTITY_ENEMY        2
#define ENTITY_ITEM         3

/* Item types */
#define ITEM_NONE           0
#define ITEM_POTION         1
#define ITEM_SWORD          2
#define ITEM_SHIELD         3
#define ITEM_KEY            4
#define ITEM_TREASURE       5

/* Enemy types */
#define ENEMY_NONE          0
#define ENEMY_RAT           1
#define ENEMY_SKELETON      2
#define ENEMY_ORC           3
#define ENEMY_DRAGON        4

/* Player structure */
typedef struct {
    int16_t x;
    int16_t y;
    int16_t floor;
    int16_t hp;
    int16_t max_hp;
    int16_t gold;
    int16_t attack;
    int16_t defense;
    uint8_t facing;  /* 0=N, 1=E, 2=S, 3=W */
} Player;

/* Enemy structure */
typedef struct {
    uint8_t type;
    uint8_t active;
    int8_t x;
    int8_t y;
    int8_t hp;
    int8_t attack;
    uint8_t damage;  /* Damage when defeated */
} Enemy;

/* Item structure */
typedef struct {
    uint8_t type;
    uint8_t active;
    int8_t x;
    int8_t y;
    uint8_t value;   /* Gold value or potion strength */
} Item;

/* Dungeon structure */
typedef struct {
    uint8_t tiles[DUNGEON_HEIGHT][DUNGEON_WIDTH];
    Enemy enemies[MAX_ENEMIES];
    Item items[MAX_ITEMS];
    uint8_t enemy_count;
    uint8_t item_count;
} Dungeon;

/* Game state enumeration */
typedef enum {
    STATE_TITLE = 0,
    STATE_PLAYING,
    STATE_COMBAT,
    STATE_GAME_OVER,
    STATE_VICTORY,
    STATE_PAUSED
} GameState;

/* Global game state */
typedef struct {
    GameState state;
    Player player;
    Dungeon dungeon;
    uint32_t rng_seed;
    uint8_t message_timer;
    char message[32];
} Game;

#endif /* AKLABETH_H */
