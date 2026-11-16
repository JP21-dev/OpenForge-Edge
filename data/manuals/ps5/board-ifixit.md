---
title: PS5 (original) board components identified in the iFixit teardown
device: ps5
type: notes
reliability: iFixit teardown; parts marked "likely" were not confirmed by iFixit
url: https://www.ifixit.com/Teardown/PlayStation+5+Teardown/138280
---

# Main processor and memory

APU: Sony Interactive Entertainment / AMD CXD90060GG. It holds the 8-core Zen 2 CPU and the RDNA 2 GPU, and sits under liquid metal inside a foam barrier.

GDDR6: Micron MT61K512M32KPA-14:B, 2 GB per chip, 16 GB in total around the APU.

DDR4: SK Hynix H5AN4G8NBJR-UHC, 512 MB.

# Storage

SSD controller: Sony CXD90062GG, a custom part.

NAND flash: six packages, three on each side of the board, identified as Kioxia (Toshiba) TH58LJT0T24BA4M BiCS flash (likely). Total built-in storage is 825 GB, plus an M.2 expansion slot.

# I/O and interfaces

I/O controller (southbridge): Sony CXD90061GG (likely).

SPI NOR flash: Winbond W25Q16JV, 16 Mbit. This is the BIOS chip linked to the "3 beeps on plug-in" fault.

HDMI: Panasonic MN864739 HDMI redriver/encoder (likely). Common failure after surges.

USB-C: Texas Instruments TUSB1044 10 Gbps redriver.

USB power: Texas Instruments TPS2001D 2 A power switch.

Ethernet: Bothhand GST5009 LF 1000Base-T magnetics module.

Wireless: Sony J20H100 Wi-Fi module (FCC ID AK8M19DFR1) with an antenna connector on the board.

Also on the board: a Murata piezo buzzer and a 3 V backup battery that keeps the clock.

# Power

Infineon XDPE14286A 16-phase PWM controller (likely).

ON Semiconductor NCP252160 power stage modules.

Richtek RT5126 and RT5127 power management ICs (likely).

Texas Instruments TPS53219A synchronous buck controller.

Texas Instruments TLV62090 3 A step-down converter.

A row of capacitors with purple markings does the final filtering in front of the APU.

The board receives power through prongs that plug straight into the internal power supply: a 350 W enclosed unit made by Delta. A heat pipe on the back of the board cools the VRMs.

# Cooling and drive

Cooling: a 120 mm squirrel-cage fan, copper heat pipes and fin stacks; no vapor chamber. Two dust ports beside the fan can be vacuumed.

Optical drive: paired to the motherboard. A drive moved from another console does not read discs.

Credits: iFixit teardown, chip identification by Chunglin Chin. iFixit rates the PS5 7 out of 10 for repairability.
