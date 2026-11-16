"""Starting test points per device, with placeholder ranges where an interface
standard defines the value. Placeholders are marked as such everywhere, are not
counted as real data, and are replaced by the first known-good capture or
reference value for the same test point."""

import logging
import re
import uuid

from db import db, now
from knowledge import ANY_REV

log = logging.getLogger(__name__)

PLACEHOLDER_SOURCE = "Placeholder"
PLACEHOLDER_NOTE = "Typical value from the interface standard, not measured on this board. Replaced by your first known-good capture."

Range = tuple[float, float, str]
Point = tuple[str, str, str, Range | None]

USB_VBUS: Range = (4.75, 5.25, "USB 5 V ±5 %")
USB_PD_20V: Range = (19.0, 21.0, "USB PD 20 V ±5 %")
LI_ION_CELL: Range = (3.0, 4.45, "typical Li-ion cell working range")
HDMI_5V: Range = (4.8, 5.3, "HDMI +5 V power pin specification")
MAIN_12V: Range = (11.4, 12.6, "12 V supply ±5 %")
COIN_CELL: Range = (2.8, 3.3, "typical CR2032 coin cell")

PHONE: list[Point] = [
    ("USB-C VBUS (5 V charger)", "DCV", "At the charging port with a basic 5 V charger, before fast-charge negotiation", USB_VBUS),
    ("Battery voltage at connector", "DCV", "Battery connected, measured at the battery connector", LI_ION_CELL),
    ("Main battery rail to ground", "DIODE", "Battery disconnected, red probe on ground", None),
    ("Charging current (USB meter)", "AMP", "USB meter between charger and device, screen off", None),
]

LAPTOP: list[Point] = [
    ("USB-C PD input (20 V)", "DCV", "At the USB-C port with a PD charger negotiating 20 V", USB_PD_20V),
    ("Main power rail to ground", "DIODE", "Adapter and battery disconnected, red probe on ground", None),
    ("RTC / CMOS coin cell", "DCV", "At the coin cell or its connector", COIN_CELL),
    ("Battery voltage at connector", "DCV", "Battery connected, at the battery connector", None),
]

CONSOLE_12V: list[Point] = [
    ("12 V input from PSU", "DCV", "Main 12 V input on the board, console on standby. Do not open the PSU", MAIN_12V),
    ("12 V rail to ground", "DIODE", "Power off, red probe on ground", None),
    ("HDMI port pin 18 (+5 V)", "DCV", "Console powered on", HDMI_5V),
    ("SoC / APU core rail to ground", "DIODE", "Power off, at the capacitors beside the main chip", None),
]

DEFAULT_POINTS: dict[str, list[Point]] = {
    "ps5": [
        ("12 V input from PSU", "DCV", "Power supply prongs on the board, console on standby", MAIN_12V),
        ("12 V rail to ground", "DIODE", "Power off, red probe on ground", None),
        ("5 V rail", "DCV", "Main 5 V rail, console on standby", None),
        ("3.3 V standby rail", "DCV", "Console on standby", None),
        ("HDMI port pin 18 (+5 V)", "DCV", "Console powered on", HDMI_5V),
        ("APU core rail to ground", "DIODE", "Power off, at the capacitors beside the APU", None),
    ],
    "xbox-series-x": [
        ("12 V at 10-pin power connector", "DCV", "Console on standby; do not open the PSU", MAIN_12V),
        ("12 V input to ground", "DIODE", "Power off, red probe on ground", None),
        ("HDMI port pin 18 (+5 V)", "DCV", "Console powered on", HDMI_5V),
        ("SoC core rail to ground", "DIODE", "Power off, at the capacitors beside the SoC", None),
        ("SSD 3.3 V", "DCV", "Console powered on, at the M.2 connector", None),
    ],
    "ps4": CONSOLE_12V,
    "xbox-series-s": CONSOLE_12V,
    "xbox-one": CONSOLE_12V,
    "switch": PHONE,
    "switch-2": PHONE,
    "iphone": PHONE,
    "pixel": PHONE,
    "galaxy-s": PHONE,
    "ipad": PHONE,
    "android-tablet": PHONE,
    "macbook": [p for p in LAPTOP if not p[0].startswith("RTC")],
    "windows-laptop": LAPTOP,
}

DEVICE_NAMES = {
    "ps5": "PlayStation 5", "ps4": "PlayStation 4", "xbox-series-x": "Xbox Series X", "xbox-series-s": "Xbox Series S",
    "xbox-one": "Xbox One", "switch": "Nintendo Switch", "switch-2": "Nintendo Switch 2", "iphone": "iPhone",
    "pixel": "Google Pixel", "galaxy-s": "Samsung Galaxy S", "ipad": "iPad", "android-tablet": "Android tablet",
    "macbook": "MacBook", "windows-laptop": "Windows laptop",
}


def is_placeholder(source: str | None) -> bool:
    return str(source or "").startswith(PLACEHOLDER_SOURCE)


def seed_placeholders() -> int:
    added = 0
    for device, points in DEFAULT_POINTS.items():
        for test_point, mode, _hint, placeholder in points:
            if not placeholder:
                continue
            exists = db().reference_values.find_one(
                {"device": device, "mode": mode, "test_point": {"$regex": f"^{re.escape(test_point)}$", "$options": "i"}}
            )
            if exists:
                continue
            lo, hi, basis = placeholder
            stamp = now()
            db().reference_values.insert_one({
                "_id": uuid.uuid4().hex,
                "device": device,
                "device_model": DEVICE_NAMES.get(device, device),
                "board_rev": ANY_REV,
                "test_point": test_point,
                "mode": mode,
                "unit": "A" if mode == "AMP" else "V",
                "expected_min": lo,
                "expected_max": hi,
                "source": f"{PLACEHOLDER_SOURCE}: {basis}",
                "note": PLACEHOLDER_NOTE,
                "placeholder": True,
                "created_at": stamp,
                "updated_at": stamp,
            })
            added += 1
    if added:
        log.info("Seeded %d placeholder reference values", added)
    return added


def drop_placeholders(device: str | None, test_point: str, mode: str, keep_id: str | None = None) -> None:
    query: dict = {
        "device": device,
        "mode": mode,
        "placeholder": True,
        "test_point": {"$regex": f"^{re.escape(test_point.strip())}$", "$options": "i"},
    }
    if keep_id:
        query["_id"] = {"$ne": keep_id}
    db().reference_values.delete_many(query)
