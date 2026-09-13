/*
 * dungeon.c - Dungeon generation and management
 */

#include "aklabeth.h"
#include "rng.h"
#include <stdint.h>

/* Forward declarations of helper functions */
static void generate_corridors(Dungeon* dungeon);
static void place_stairs(Dungeon* dungeon, int floor);
static void spawn_enemies(Dungeon* dungeon, int floor);
static void spawn_items(Dungeon* dungeon, int floor);
static int is_valid_room_start(Dungeon* dungeon, int x, int y, int w, int h);
static void carve_room(Dungeon* dungeon, int x, int y, int w, int h);

/* Initialize a dungeon floor */
void dungeon_init(Dungeon* dungeon, int floor)
{
    /* Clear all tiles */
    for (int y = 0; y < DUNGEON_HEIGHT; y++) {
        for (int x = 0; x < DUNGEON_WIDTH; x++) {
            dungeon->tiles[y][x] = TILE_WALL;
        }
    }
    
    /* Clear entities */
    for (int i = 0; i < MAX_ENEMIES; i++) {
        dungeon->enemies[i].active = 0;
        dungeon->enemies[i].type = ENEMY_NONE;
    }
    
    for (int i = 0; i < MAX_ITEMS; i++) {
        dungeon->items[i].active = 0;
        dungeon->items[i].type = ITEM_NONE;
    }
    
    dungeon->enemy_count = 0;
    dungeon->item_count = 0;
    
    /* Generate rooms using simple BSP-like approach */
    int room_count = 4 + rng_range(5);  /* 4-8 rooms */
    int rooms_placed = 0;
    int attempts = 0;
    
    while (rooms_placed < room_count && attempts < 100) {
        int w = 4 + rng_range(6);  /* 4-9 width */
        int h = 3 + rng_range(5);  /* 3-7 height */
        int x = 1 + rng_range(DUNGEON_WIDTH - w - 2);
        int y = 1 + rng_range(DUNGEON_HEIGHT - h - 2);
        
        if (is_valid_room_start(dungeon, x, y, w, h)) {
            carve_room(dungeon, x, y, w, h);
            rooms_placed++;
        }
        
        attempts++;
    }
    
    /* Connect rooms with corridors */
    generate_corridors(dungeon);
    
    /* Place stairs */
    place_stairs(dungeon, floor);
    
    /* Spawn enemies and items */
    spawn_enemies(dungeon, floor);
    spawn_items(dungeon, floor);
}

/* Check if a room can be placed at given position */
static int is_valid_room_start(Dungeon* dungeon, int x, int y, int w, int h)
{
    /* Add 1-tile buffer around room */
    for (int dy = -1; dy <= h; dy++) {
        for (int dx = -1; dx <= w; dx++) {
            int px = x + dx;
            int py = y + dy;
            
            if (px < 0 || px >= DUNGEON_WIDTH || 
                py < 0 || py >= DUNGEON_HEIGHT) {
                return 0;
            }
            
            /* Check if area overlaps with existing rooms */
            if (dungeon->tiles[py][px] != TILE_WALL) {
                return 0;
            }
        }
    }
    
    return 1;
}

/* Carve out a room */
static void carve_room(Dungeon* dungeon, int x, int y, int w, int h)
{
    for (int dy = 0; dy < h; dy++) {
        for (int dx = 0; dx < w; dx++) {
            dungeon->tiles[y + dy][x + dx] = TILE_EMPTY;
        }
    }
}

/* Generate corridors between rooms */
static void generate_corridors(Dungeon* dungeon)
{
    /* Find room centers and connect them */
    int centers_x[16];
    int centers_y[16];
    int count = 0;
    
    /* Scan for room centers */
    for (int y = 2; y < DUNGEON_HEIGHT - 2; y += 3) {
        for (int x = 2; x < DUNGEON_WIDTH - 2; x += 3) {
            if (dungeon->tiles[y][x] == TILE_EMPTY) {
                /* Found a room, find its center */
                int rx = x, ry = y;
                
                /* Expand to find room bounds */
                while (rx > 0 && dungeon->tiles[ry][rx-1] == TILE_EMPTY) rx--;
                while (rx < DUNGEON_WIDTH-1 && dungeon->tiles[ry][rx+1] == TILE_EMPTY) rx++;
                while (ry > 0 && dungeon->tiles[ry-1][rx] == TILE_EMPTY) ry--;
                while (ry < DUNGEON_HEIGHT-1 && dungeon->tiles[ry+1][rx] == TILE_EMPTY) ry++;
                
                centers_x[count] = (x + rx) / 2;
                centers_y[count] = (y + ry) / 2;
                count++;
                
                if (count >= 16) break;
            }
        }
        if (count >= 16) break;
    }
    
    /* Connect consecutive rooms with L-shaped corridors */
    for (int i = 0; i < count - 1; i++) {
        int x1 = centers_x[i];
        int y1 = centers_y[i];
        int x2 = centers_x[i + 1];
        int y2 = centers_y[i + 1];
        
        /* Horizontal then vertical */
        int x = x1;
        while (x != x2) {
            if (dungeon->tiles[y1][x] == TILE_WALL) {
                dungeon->tiles[y1][x] = TILE_EMPTY;
            }
            x += (x2 > x) ? 1 : -1;
        }
        
        int y = y1;
        while (y != y2) {
            if (dungeon->tiles[y][x2] == TILE_WALL) {
                dungeon->tiles[y][x2] = TILE_EMPTY;
            }
            y += (y2 > y) ? 1 : -1;
        }
    }
}

/* Place stairs on the dungeon */
static void place_stairs(Dungeon* dungeon, int floor)
{
    int stairs_placed = 0;
    int attempts = 0;
    
    while (stairs_placed < 2 && attempts < 50) {
        int x = rng_range(DUNGEON_WIDTH);
        int y = rng_range(DUNGEON_HEIGHT);
        
        if (dungeon->tiles[y][x] == TILE_EMPTY) {
            if (floor < DUNGEON_FLOORS - 1) {
                dungeon->tiles[y][x] = TILE_STAIRS_DOWN;
            } else {
                dungeon->tiles[y][x] = TILE_STAIRS_UP;  /* Exit on last floor */
            }
            stairs_placed++;
        }
        
        attempts++;
    }
}

/* Spawn enemies based on floor depth */
static void spawn_enemies(Dungeon* dungeon, int floor)
{
    int enemy_count = 2 + floor + rng_range(3);  /* More enemies on deeper floors */
    if (enemy_count > MAX_ENEMIES) enemy_count = MAX_ENEMIES;
    
    for (int i = 0; i < enemy_count; i++) {
        int attempts = 0;
        while (attempts < 20) {
            int x = rng_range(DUNGEON_WIDTH);
            int y = rng_range(DUNGEON_HEIGHT);
            
            if (dungeon->tiles[y][x] == TILE_EMPTY) {
                /* Determine enemy type based on floor */
                uint8_t type;
                int roll = rng_range(100);
                
                if (floor < 3) {
                    type = (roll < 70) ? ENEMY_RAT : ENEMY_SKELETON;
                } else if (floor < 6) {
                    type = (roll < 50) ? ENEMY_RAT : 
                           (roll < 80) ? ENEMY_SKELETON : ENEMY_ORC;
                } else {
                    type = (roll < 30) ? ENEMY_RAT :
                           (roll < 60) ? ENEMY_SKELETON :
                           (roll < 90) ? ENEMY_ORC : ENEMY_DRAGON;
                }
                
                /* Set enemy stats */
                Enemy* e = &dungeon->enemies[dungeon->enemy_count];
                e->type = type;
                e->active = 1;
                e->x = x;
                e->y = y;
                e->hp = 5 + floor * 2 + rng_range(5);
                e->attack = 2 + floor;
                e->damage = 1 + rng_range(floor + 2);
                
                dungeon->enemy_count++;
                
                if (dungeon->enemy_count >= MAX_ENEMIES) {
                    return;
                }
                
                break;
            }
            
            attempts++;
        }
    }
}

/* Spawn items */
static void spawn_items(Dungeon* dungeon, int floor)
{
    int item_count = 2 + rng_range(4);
    
    for (int i = 0; i < item_count; i++) {
        int attempts = 0;
        while (attempts < 20) {
            int x = rng_range(DUNGEON_WIDTH);
            int y = rng_range(DUNGEON_HEIGHT);
            
            if (dungeon->tiles[y][x] == TILE_EMPTY) {
                Item* item = &dungeon->items[dungeon->item_count];
                
                /* Random item type */
                int roll = rng_range(100);
                if (roll < 40) {
                    item->type = ITEM_POTION;
                    item->value = 5 + rng_range(10);
                } else if (roll < 60) {
                    item->type = ITEM_TREASURE;
                    item->value = 5 + rng_range(20);
                } else if (roll < 80) {
                    item->type = ITEM_SWORD;
                    item->value = 1 + rng_range(3);
                } else if (roll < 90) {
                    item->type = ITEM_SHIELD;
                    item->value = 1 + rng_range(2);
                } else {
                    item->type = ITEM_KEY;
                    item->value = 1;
                }
                
                item->active = 1;
                item->x = x;
                item->y = y;
                
                dungeon->item_count++;
                
                if (dungeon->item_count >= MAX_ITEMS) {
                    return;
                }
                
                break;
            }
            
            attempts++;
        }
    }
}

/* Check if a tile is walkable */
int dungeon_is_walkable(Dungeon* dungeon, int x, int y)
{
    if (x < 0 || x >= DUNGEON_WIDTH || y < 0 || y >= DUNGEON_HEIGHT) {
        return 0;
    }
    
    uint8_t tile = dungeon->tiles[y][x];
    return (tile == TILE_EMPTY || tile == TILE_STAIRS_DOWN || 
            tile == TILE_STAIRS_UP || tile == TILE_DOOR);
}

/* Move player in dungeon */
int dungeon_move_player(Dungeon* dungeon, Player* player, int dx, int dy)
{
    int new_x = player->x + dx;
    int new_y = player->y + dy;
    
    if (!dungeon_is_walkable(dungeon, new_x, new_y)) {
        return 0;  /* Can't move there */
    }
    
    /* Check for enemy collision */
    for (int i = 0; i < dungeon->enemy_count; i++) {
        Enemy* e = &dungeon->enemies[i];
        if (e->active && e->x == new_x && e->y == new_y) {
            return 0;  /* Enemy blocking */
        }
    }
    
    player->x = new_x;
    player->y = new_y;
    
    /* Check for item pickup */
    for (int i = 0; i < dungeon->item_count; i++) {
        Item* item = &dungeon->items[i];
        if (item->active && item->x == new_x && item->y == new_y) {
            /* Pick up item */
            item->active = 0;
            /* Handle item effects in game logic */
        }
    }
    
    return 1;
}
