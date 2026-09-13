# Aklabeth-DS Makefile
# Based on BlocksDS/devkitARM toolchain

# Project settings
TARGET := aklabeth_ds
BUILD_DIR := build
SRC_DIR := src
INCLUDE_DIR := include

# Toolchain setup (try devkitARM first, fall back to system arm-none-eabi)
ifeq ($(wildcard /opt/devkitpro/devkitARM),)
    PREFIX := arm-none-eabi-
    DEVKITPRO := 
else
    export DEVKITPRO := /opt/devkitpro
    export DEVKITARM := $(DEVKITPRO)/devkitARM
    PREFIX := $(DEVKITARM)/bin/arm-none-eabi-
endif

CC := $(PREFIX)gcc
LD := $(PREFIX)ld
OBJCOPY := $(PREFIX)objcopy

# Compiler flags for ARM9 (DS main CPU)
CFLAGS := -march=armv5te -mtune=arm946e-s -mthumb -O2 -Wall -Wextra
CFLAGS += -I$(INCLUDE_DIR)
CFLAGS += -ffunction-sections -fdata-sections

# Linker flags
LDFLAGS := -march=armv5te -mtune=arm946e-s -mthumb -nostartfiles -nodefaultlibs
LDFLAGS += -T ds.ld
LDFLAGS += --gc-sections

# Source files
SRCS := $(wildcard $(SRC_DIR)/*.c)
OBJS := $(SRCS:$(SRC_DIR)/%.c=$(BUILD_DIR)/%.o)

# Default target
all: $(BUILD_DIR)/$(TARGET).nds

# Link ELF file
$(BUILD_DIR)/$(TARGET).elf: $(OBJS)
	@echo "Linking $@"
	$(LD) $(LDFLAGS) -o $@ $^

# Create NDS ROM using ndstool
$(BUILD_DIR)/$(TARGET).nds: $(BUILD_DIR)/$(TARGET).elf
	@echo "Creating NDS ROM: $@"
	ndstool -c $@ -9 $< -b icon.bmp:"Title;Subtitle;Developer"

# Compile C files
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c
	@echo "Compiling $<"
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)/*

# Phony targets
.PHONY: all clean
