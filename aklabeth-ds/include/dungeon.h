/*
 * dungeon.h - Dungeon Generation Header
 */

#ifndef DUNGEON_H
#define DUNGEON_H

#include "aklabeth.h"

void dungeon_init(Dungeon* dungeon, int floor);
int dungeon_is_walkable(Dungeon* dungeon, int x, int y);
int dungeon_move_player(Dungeon* dungeon, Player* player, int dx, int dy);

#endif /* DUNGEON_H */
