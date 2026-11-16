---
title: General bench workflow for board repairs
device: general
type: procedure
reliability: general bench practice; device notes take priority
---

# Heat damage and burn marks

First decide what is burnt. Discoloured flux, thermal paste or liquid metal residue on top of a chip often cleans off with isopropyl alcohol; a scorched package, cracked or bulged chip, or charred board under it does not.

A burn on a main chip (APU, SoC, GPU, CPU) or on the board directly under it usually means the chip or board is damaged. Before powering on, check that chip's core and memory rails for a short to ground and compare with a known-good board. A short on a chip's rail is more often a failed capacitor beside it than the chip itself: find the shorted part before condemning the chip.

A burnt small part (capacitor, inductor, fuse, MOSFET) is usually the result of a short or overcurrent, not the cause. Replace it, then find what pulled too much current before powering the board again.

Charred board material is conductive. Remove it completely before reassembly.

If the main chip itself is damaged, the repair becomes a chip replacement (BGA rework, often needing a donor part) or a board swap. Tell the customer before going further.

# Thermal paste, pads and liquid metal

Clean the old compound off both surfaces completely with isopropyl alcohol.

Replace thermal pads with pads of the same thickness as the originals.

Liquid metal is electrically conductive. Use only enough for a thin, complete layer, keep the original barrier or foam seal in place, and check that no beads have escaped onto nearby components before closing up.

# Before powering on after a repair

Check the main input rail and the rails around anything you replaced for a short to ground.

Look for loose screws, solder balls, liquid metal beads and debris on the board and in the case.

Check that every connector and ribbon cable is fully seated and that the heatsink is mounted with even pressure.

# Testing before returning the device to the customer

Power on and let it boot to the home screen.

Run a demanding game or stress test for at least 30 to 60 minutes. Watch temperatures and fan behaviour: the fan should ramp up and settle, and the device should not shut down, freeze or throttle hard.

Test every function the customer uses: video output, every USB port, Wi-Fi and Bluetooth, controllers, the disc drive, speakers, charging and the battery.

Listen and smell for anything unusual: coil whine that wasn't there before, rattles, or a hot electronics smell.

Record what was found, what was replaced and the test results with the Finish repair (flag) button, so the next similar job can learn from it.

# Handing the device back

Tell the customer what was wrong, what was replaced, and anything that may fail later (for example, a chip that showed heat damage but still works).
