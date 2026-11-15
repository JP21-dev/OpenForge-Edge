---
title: PS5 motherboard overview
device: ps5
type: notes
reliability: community-sourced, verify against your board
url: https://wiki.recessim.com/view/PlayStation_5_(PS5)
---

# Model families and board revisions

Retail PS5 consoles are labelled CFI-10xx (launch), CFI-11xx and CFI-12xx, with later Slim and Pro models after that. Layout, cooling and power supply design change between these families, so always confirm the board revision printed on the motherboard before trusting a measurement or location.

Board revisions seen in repair reports include EDM-010, EDM-020, EDM-031, EDM-033 and the later Slim board EDM-051. No public source reliably maps every EDM revision to a CFI model number; read the silkscreen on the board itself.

EDM-051 is a revised PS5 Slim board reported to add a replaceable CMOS/clock battery and a redesigned liquid metal barrier.

A Sony "PlayStation 5 Board Service Manual, 1st edition" exists for EDM-020. If you have a legitimate copy, add the PDF to this folder and re-run ingestion.

Sources: wiki.recessim.com/view/PlayStation_5_(PS5); guru3d.com (EDM-051 report); tronicsfixforum.com PS5 threads.

# Known ICs

HDMI encoder: Panasonic MN864739. A roughly 10 mm BGA package located about 20 to 30 mm from the HDMI port. It converts the video signal for the port, handles HDCP negotiation and drives the HDMI lines. It is a common failure after electrical events such as surges.

SPI NOR (BIOS) flash: marked 25Q16JVNIM (Winbond W25Q16JV family, 16 Mbit). Sits next to the southbridge. Associated with the "3 beeps on plug-in" fault.

GDDR6 memory: Micron MT61K512M32KPA-14C, package marking D9XKV. When replacing, match the D9XKV marking; differing date-code prefixes are normal.

Sony custom ICs marked CXD9006x (for example CXD90062GG, CX090061GG) appear in many repair threads. Forum users associate them with the southbridge and SSD controller, but no public source confirms which marking is which; check the part on your board.

TLV62090RGTT: Texas Instruments step-down (buck) converter used on the board; technicians check its output when diagnosing no-power faults.

AOZ1351DI-01 (DFN12, marking AF01): USB power delivery / VBUS current-limit protection switch found on EDM-020.

A 32 MHz crystal sits near the SIE CX09006x IC on EDM-010.

# Liquid metal

The APU uses liquid metal as its thermal interface, held in by a foam barrier. Liquid metal is electrically conductive: if it escapes the barrier it can short nearby components. One EDM-010 repair traced a no-power fault to liquid metal leaking from the APU area, which shorted capacitors near the 12 V area and removed the 3.3 V standby rail. Always inspect around the APU for silver residue on boards with power or stability faults.

# EMI / ferrite bead repairs

On EDM-010, small surface-mount parts on the bottom side near the CX090061GG are sometimes knocked off. A community repair replaced missing ferrite beads with 1206-size beads of roughly 600 to 1000 ohm at 100 MHz, low DC resistance and 0.5 to 2 A rating. Confirm the original values against a known-good board or boardview where possible.
