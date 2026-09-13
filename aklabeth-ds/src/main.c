/*
 * main.c - Aklabeth-DS Main Entry Point
 * A bare-metal roguelike dungeon crawler for Nintendo DS
 */

#include "nds.h"
#include "aklabeth.h"
#include "graphics.h"
#include "input.h"
#include "dungeon.h"
#include "rng.h"
#include <stdint.h>

/* Global game state */
static Game g_game;

/* Color definitions (ABGR1555) */
#define COLOR_BLACK     0x0000
#define COLOR_WHITE     0x7FFF
#define COLOR_RED       0x001F
#define COLOR_GREEN     0x03E0
#define COLOR_BLUE      0x7C00
#define COLOR_YELLOW    0x03FF
#define COLOR_BROWN     0x028A
#define COLOR_GRAY      0x52AA

/* Draw a simple title screen */
static void draw_title_screen(void)
{
    graphics_clear(COLOR_BLACK);
    
    /* Set color to white */
    graphics_set_color(31, 31, 31);
    
    /* Draw title text area (simplified - just boxes for now) */
    graphics_fill_rect(64, 40, 128, 24);
    
    /* Draw "Press Start" indicator */
    graphics_fill_rect(80, 120, 96, 16);
}

/* Draw the dungeon view */
static void draw_dungeon(void)
{
    graphics_clear(COLOR_BLACK);
    
    Dungeon* dungeon = &g_game.dungeon;
    Player* player = &g_game.player;
    
    /* Calculate viewport offset to center player */
    int view_w = 20;  /* Tiles visible horizontally */
    int view_h = 15;  /* Tiles visible vertically */
    int view_x = player->x - view_w / 2;
    int view_y = player->y - view_h / 2;
    
    /* Clamp viewport */
    if (view_x < 0) view_x = 0;
    if (view_y < 0) view_y = 0;
    if (view_x + view_w > DUNGEON_WIDTH) view_x = DUNGEON_WIDTH - view_w;
    if (view_y + view_h > DUNGEON_HEIGHT) view_y = DUNGEON_HEIGHT - view_h;
    
    /* Tile size in pixels */
    int tile_w = SCREEN_WIDTH / view_w;
    int tile_h = SCREEN_HEIGHT / view_h;
    
    /* Draw tiles */
    for (int y = 0; y < view_h; y++) {
        for (int x = 0; x < view_w; x++) {
            int dx = view_x + x;
            int dy = view_y + y;
            
            uint8_t tile = dungeon->tiles[dy][dx];
            int px = x * tile_w;
            int py = y * tile_h;
            
            switch (tile) {
                case TILE_WALL:
                    graphics_set_color(16, 16, 16);  /* Gray */
                    graphics_fill_rect(px, py, tile_w, tile_h);
                    break;
                case TILE_EMPTY:
                    graphics_set_color(8, 8, 8);  /* Dark gray */
                    graphics_fill_rect(px, py, tile_w, tile_h);
                    break;
                case TILE_STAIRS_DOWN:
                    graphics_set_color(31, 31, 0);  /* Yellow */
                    graphics_fill_rect(px + 2, py + 2, tile_w - 4, tile_h - 4);
                    break;
                case TILE_STAIRS_UP:
                    graphics_set_color(0, 31, 31);  /* Cyan */
                    graphics_fill_rect(px + 2, py + 2, tile_w - 4, tile_h - 4);
                    break;
            }
        }
    }
    
    /* Draw items */
    for (int i = 0; i < dungeon->item_count; i++) {
        Item* item = &dungeon->items[i];
        if (!item->active) continue;
        
        if (item->x >= view_x && item->x < view_x + view_w &&
            item->y >= view_y && item->y < view_y + view_h) {
            
            int px = (item->x - view_x) * tile_w;
            int py = (item->y - view_y) * tile_h;
            
            graphics_set_color(0, 31, 0);  /* Green for items */
            graphics_fill_rect(px + tile_w/3, py + tile_h/3, 
                             tile_w/3, tile_h/3);
        }
    }
    
    /* Draw enemies */
    for (int i = 0; i < dungeon->enemy_count; i++) {
        Enemy* enemy = &dungeon->enemies[i];
        if (!enemy->active) continue;
        
        if (enemy->x >= view_x && enemy->x < view_x + view_w &&
            enemy->y >= view_y && enemy->y < view_y + view_h) {
            
            int px = (enemy->x - view_x) * tile_w;
            int py = (enemy->y - view_y) * tile_h;
            
            graphics_set_color(31, 0, 0);  /* Red for enemies */
            graphics_fill_rect(px + tile_w/4, py + tile_h/4, 
                             tile_w/2, tile_h/2);
        }
    }
    
    /* Draw player */
    int player_px = (player->x - view_x) * tile_w;
    int player_py = (player->y - view_y) * tile_h;
    
    graphics_set_color(31, 31, 31);  /* White for player */
    graphics_fill_rect(player_px + 2, player_py + 2, 
                       tile_w - 4, tile_h - 4);
    
    /* Draw HUD */
    graphics_set_color(0, 0, 0);
    graphics_fill_rect(0, SCREEN_HEIGHT - 20, SCREEN_WIDTH, 20);
    
    graphics_set_color(31, 31, 31);
    /* Simple HP bar would go here */
}

/* Update game logic */
static void update_game(void)
{
    Player* player = &g_game.player;
    Dungeon* dungeon = &g_game.dungeon;
    
    /* Handle input */
    int dx = 0, dy = 0;
    
    if (input_key_pressed(KEY_UP)) {
        dy = -1;
    } else if (input_key_pressed(KEY_DOWN)) {
        dy = 1;
    } else if (input_key_pressed(KEY_LEFT)) {
        dx = -1;
    } else if (input_key_pressed(KEY_RIGHT)) {
        dx = 1;
    }
    
    /* Move player */
    if (dx != 0 || dy != 0) {
        dungeon_move_player(dungeon, player, dx, dy);
    }
    
    /* Check for stairs */
    uint8_t tile = dungeon->tiles[player->y][player->x];
    if (tile == TILE_STAIRS_DOWN && input_key_pressed(KEY_A)) {
        if (player->floor < DUNGEON_FLOORS - 1) {
            player->floor++;
            dungeon_init(dungeon, player->floor);
            /* Find spawn point */
            for (int y = 0; y < DUNGEON_HEIGHT; y++) {
                for (int x = 0; x < DUNGEON_WIDTH; x++) {
                    if (dungeon->tiles[y][x] == TILE_STAIRS_UP) {
                        player->x = x;
                        player->y = y;
                        goto found_spawn;
                    }
                }
            }
            found_spawn:;
        }
    } else if (tile == TILE_STAIRS_UP && input_key_pressed(KEY_A)) {
        if (player->floor > 0) {
            player->floor--;
            dungeon_init(dungeon, player->floor);
            /* Find spawn point */
            for (int y = 0; y < DUNGEON_HEIGHT; y++) {
                for (int x = 0; x < DUNGEON_WIDTH; x++) {
                    if (dungeon->tiles[y][x] == TILE_STAIRS_DOWN) {
                        player->x = x;
                        player->y = y;
                        goto found_spawn_up;
                    }
                }
            }
            found_spawn_up:;
        }
    }
}

/* Initialize game */
static void game_init(void)
{
    g_game.state = STATE_TITLE;
    
    g_game.player.x = 0;
    g_game.player.y = 0;
    g_game.player.floor = 0;
    g_game.player.hp = PLAYER_MAX_HP;
    g_game.player.max_hp = PLAYER_MAX_HP;
    g_game.player.gold = 0;
    g_game.player.attack = 5;
    g_game.player.defense = 2;
    g_game.player.facing = 0;
    
    /* Seed RNG from RTC or fixed value */
    g_game.rng_seed = 0xDEADBEEF;  /* TODO: Read from RTC */
    rng_init(g_game.rng_seed);
    
    /* Generate first floor */
    dungeon_init(&g_game.dungeon, 0);
    
    /* Place player at stairs up (starting position) */
    for (int y = 0; y < DUNGEON_HEIGHT; y++) {
        for (int x = 0; x < DUNGEON_WIDTH; x++) {
            if (g_game.dungeon.tiles[y][x] == TILE_STAIRS_UP) {
                g_game.player.x = x;
                g_game.player.y = y;
                goto player_placed;
            }
        }
    }
    
player_placed:
    /* Default position if no stairs found */
    if (g_game.player.x == 0 && g_game.player.y == 0) {
        g_game.player.x = 1;
        g_game.player.y = 1;
    }
}

/* Main entry point */
void main(void)
{
    /* Initialize systems */
    graphics_init();
    input_init();
    
    /* Initialize game */
    game_init();
    
    /* Main game loop */
    while (1) {
        /* Scan input */
        input_scan();
        
        /* Check for start button on title screen */
        if (g_game.state == STATE_TITLE) {
            if (input_key_pressed(KEY_START)) {
                g_game.state = STATE_PLAYING;
                game_init();
            } else {
                draw_title_screen();
                graphics_swap_buffers();
                continue;
            }
        }
        
        /* Update game logic */
        if (g_game.state == STATE_PLAYING) {
            update_game();
        }
        
        /* Render */
        draw_dungeon();
        
        /* Swap buffers */
        graphics_swap_buffers();
    }
}
