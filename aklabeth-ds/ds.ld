/* ds.ld - Linker script for Nintendo DS homebrew */

MEMORY
{
    /* ARM9 ITCM - 32KB at 0x01FF8000 (fastest memory for code) */
    ITCM (rwx) : ORIGIN = 0x01FF8000, LENGTH = 32K
    
    /* ARM9 DTCM - 16KB at 0x027FE000 (fast data memory) */
    DTCM (rwx) : ORIGIN = 0x027FE000, LENGTH = 16K
    
    /* Main RAM - ~4MB available */
    RAM (rwx) : ORIGIN = 0x02000000, LENGTH = 4M
}

SECTIONS
{
    .itcm :
    {
        *(.itcm)
        *(.itcm.*)
    } > ITCM

    .dtcm :
    {
        *(.dtcm)
        *(.dtcm.*)
    } > DTCM

    .text :
    {
        *(.text)
        *(.text.*)
        *(.rodata)
        *(.rodata.*)
    } > RAM

    .data :
    {
        _data_start = .;
        *(.data)
        *(.data.*)
        _data_end = .;
    } > RAM

    .bss :
    {
        _bss_start = .;
        *(.bss)
        *(.bss.*)
        *(COMMON)
        _bss_end = .;
    } > RAM

    _heap_start = .;
    _heap_end = ORIGIN(RAM) + LENGTH(RAM);
    
    /* Stack grows down from end of RAM */
    _stack_top = _heap_end;
}

ENTRY(_start)
