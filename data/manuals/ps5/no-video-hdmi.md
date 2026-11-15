---
title: PS5 no video / no HDMI signal
device: ps5
type: procedure
reliability: community-sourced, verify against your board
url: https://harktech.co.uk/help/ps5-hdmi-port-vs-hdmi-ic-fault
---

# Port fault or HDMI IC fault

The two common causes of no picture are the HDMI port (mechanical damage) and the MN864739 HDMI encoder IC (electrical damage). The port is a passive connector with about 20 signal solder joints and 4 ground-shield tabs. The IC is a BGA part 20 to 30 mm from the port.

Signs pointing to the port:
- Bent tongue, pushed-in pins, or a port that wobbles.
- Picture comes and goes when the cable is wiggled.
- Works with some HDMI cables but not others.
- Fault started after the console was moved or the cable was yanked.

Signs pointing to the IC:
- Fault started after a storm, power surge, failing AV receiver or nearby lightning.
- No signal in safe mode and on every TV, with a port that looks perfect.
- Picture works briefly, then cuts out after a few minutes under load (possible overheating IC).
- Cannot select 4K modes, or the signal flickers.

If none of these settle it, the fault needs bench diagnosis.

# Bench checks

1. Open the console and inspect the port under magnification. Damage is often hidden behind an intact-looking shell: pins can lift, and badly damaged ports tear pads off with them.
2. Use an HDMI breakout board to test each signal line, and take diode-mode readings on the port pins. Compare against a known-good board or boardview values; no public source lists reference readings.
3. Check continuity through the chokes between the port and the HDMI IC.
4. Check for shorts around the HDMI IC.
5. After replacing a port, retest with the breakout board before reassembly.

A port replacement is roughly a 2 to 3 hour job. An HDMI IC replacement is BGA rework, typically 4 to 6 hours, and needs proper reballing equipment.

Note: a console that boots to a solid white light with no signal after an HDMI IC replacement can still have another fault; one forum responder noted the GPU side of the APU can also cause no video.

Sources: harktech.co.uk/help/ps5-hdmi-port-vs-hdmi-ic-fault; tronicsfixforum.com/t/hdmi-problem-port-ok-diagnostic-help/12801; tronicsfixforum.com/t/ps5-slim-no-video-output/16831.
