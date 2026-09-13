# Simple NDS homebrew Makefile
TARGET := hello_nds
DEVKITARM ?= /opt/devkitpro/devkitARM

PREFIX := arm-none-eabi-
CC := $(PREFIX)gcc
LD := $(PREFIX)ld

CFLAGS := -march=armv5te -mtune=arm946e-s -mthumb -O2 -Wall -Wextra
LDFLAGS := -march=armv5te -mtune=arm946e-s -mthumb -nostartfiles -nodefaultlibs -T ds.gba.ld

all: $(TARGET).nds

$(TARGET).nds: $(TARGET).elf
$(DEVKITARM)/bin/ndstool -c $@ -9 $<

$(TARGET).elf: $(TARGET).o ds.gba.ld
$(LD) $(LDFLAGS) -o $@ $<

$(TARGET).o: $(TARGET).c
$(CC) $(CFLAGS) -c -o $@ $<

clean:
rm -f $(TARGET).elf $(TARGET).o $(TARGET).nds

.PHONY: all clean
