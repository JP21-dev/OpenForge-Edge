---
title: Xbox Series X board and hardware overview
device: xbox-series-x
type: notes
reliability: iFixit teardown; verify part markings on your board
url: https://www.ifixit.com/Teardown/Xbox+Series+X+Teardown/138451
---

# Layout

The Xbox Series X splits its motherboard across two boards with an aluminium center chassis between them, which also spreads heat. A 130 mm fan at the top exhausts upward. The optical drive has its own controller board and is paired to the motherboard. There are two antenna boards: one at the front and one in the tower; the wireless board is modular. The power supply sits at the base of the tower.

All screws are T8 Torx. Two of the back-panel screws hide under stickers. iFixit rates the console 7 out of 10 for repairability.

# Main board (SoC side)

SoC: "Project Scarlett" 100-000000388, an 8-core AMD Zen 2 CPU with an AMD RDNA 2 GPU.

GDDR6: Micron chips marked D9WCW (1 GB) and D9WZX (2 GB), 16 GB in total around the SoC.

Power: Monolithic Power Systems MP86965 power stage modules and an MP2926 multi-phase controller with PMBus. Texas Instruments TPS568230 synchronous step-down regulator.

HDMI: ON Semiconductor NB7NQ621M, a 12 Gbps HDMI/DisplayPort linear redriver. Check this area on no-video faults, along with the HDMI port itself.

# Second board (I/O side)

Southbridge / I/O controller: Microsoft M1139994-001 (marked T6WD5XBG-0004).

Ethernet: Realtek RTL8111HM gigabit controller.

Audio: Nuvoton ISD8104SYI 2 W Class AB amplifier.

Regulators: Richtek RT6256BHGQUF and RT6256CHGQUF synchronous step-down converters with LDO; ON Semiconductor NCP186AMN080TBG 1 A low-dropout regulator.

Also: Texas Instruments LM339A quad comparator, and a part marked "CT08E 2020F1" that iFixit thinks is a sound transducer.

# Storage

The internal SSD is a custom Western Digital SN530, 1 TB, in the short M.2 2230 NVMe size. It uses a SanDisk 20-82-10048-A1 NVMe controller, SanDisk 60662 1T00 NAND flash and a Qorvo (Active-Semi) 90430VM330 power management IC. It sits under a shield with thermal pads on both sides, held by one T8 screw. iFixit warns that replacing it may be blocked by software.

# Optical drive board

Microsoft MS0DDDSP03 ARM controller and a Texas Instruments TPIC2050 9-channel motor and laser driver. The drive is paired to the motherboard: a drive from another console will not work.

# Power supply

The internal PSU delivers 12 V at up to 21.25 A (255 W) on the main rail, plus a 60 W peripheral output, for 315 W in total. It uses polymer capacitors on the 12 V output. Do not open the PSU on the bench: it carries mains voltage.

The motherboard takes power through a 10-pin connector with a locking tab. Squeeze the tab and lift straight up; pull the connector, never the wires.

Source: iFixit Xbox Series X Teardown (guide 138451).
