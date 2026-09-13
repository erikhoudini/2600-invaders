/* Simple linker script for NDS ARM9 homebrew */
MEMORY
{
    RAM (xrw) : ORIGIN = 0x02000000, LENGTH = 4MB
}

SECTIONS
{
    .text : {
        *(.text)
        *(.rodata)
    } > RAM

    .data : {
        *(.data)
        *(.bss)
    } > RAM

    _end = .;
}
