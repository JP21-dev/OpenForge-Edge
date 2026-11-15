---
title: PS5 no power, beeps and shutdowns
device: ps5
type: procedure
reliability: community-sourced, verify against your board
url: https://repair.wiki/w/PlayStation_5_Not_turning_on_repair
---

# Order of checks for no power

1. Confirm the internal power supply produces 12 V. A missing 12 V line can be a failed power supply, or a short on the motherboard that stops the supply from starting.
2. If 12 V is present, check for 5 V.
3. If 5 V is present, check that the southbridge is receiving its voltages from the PMIC.
4. Check fuses for continuity. Repair Wiki's no-power guide names fuse F7002; designators can differ between board revisions, so confirm on your boardview.
5. Look for shorted capacitors, especially around the 12 V area and the APU. Inspect for liquid metal leakage from the APU barrier.
6. If every voltage is present and nothing is shorted, the southbridge itself can be faulty; they sometimes fail without showing a short.

This order comes from Repair Wiki's PS5 Pro no-power guide and general PS5 repair threads; the PS5 Pro and standard PS5 boards differ, so treat it as a starting point.

# 3 beeps when power is plugged in

Three beeps on plug-in points to the SPI NOR (BIOS) flash, marked 25Q16JVNIM, next to the southbridge. The repair is to desolder the chip, read it with an SPI programmer, and replace or reprogram it. In one reported case a short in the southbridge area disappeared after replacing the southbridge and removing the BIOS chip from the board for about 20 minutes.

# One beep, blue light, then shuts off

Symptom reported on EDM-010: one beep when the power button is pressed, blue light for a few seconds, then shutdown. Plug-in current briefly spiked to about 310 mA and then settled near 9 mA. A thermal camera showed a CXD9006x IC heating at power-on.

Recommended approach from an experienced forum responder:
1. Read the UART output, or dump the NOR flash, to get the last error codes before swapping any chips.
2. Error code 80801120 was reported as a GDDR6 fault on bank 6.
3. To separate a RAM fault from an APU fault, swap the suspect GDDR6 chip with a neighbouring one and see whether the error moves.
4. In that thread a replacement Micron D9XKV chip on bank 6 did not clear the error, pointing at the APU or its connection to the board.

# Shutdown after southbridge replacement

An EDM-010 thread reports shutdowns with error CE-108262-9 after a southbridge replacement, traced to XDPE (multiphase voltage controller) phase issues. Check the APU power phases if a board shuts down under load after rework.

# BGA rework notes

Without proper BGA tools and experience, attempting southbridge, RAM or HDMI IC replacement risks turning the board into a donor. Dark oxidised pads can be cleaned by lightly scraping with tweezers, then fluxing and tinning; avoid scraping with the iron, which damages the solder mask.

Sources: repair.wiki PS5 not-turning-on, 3-beeps and PS5 Pro no-power guides (via search summaries); tronicsfixforum.com/t/ps5-no-power-one-beep-no-fuses-blown-010/13712; tronicsfixforum.com EDM-010 southbridge/CE-108262-9 thread; tronicsfixforum.com/t/ps5-south-bridge-and-crystal-oscillator/9988.
