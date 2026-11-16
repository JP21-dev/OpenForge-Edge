import logging
import re
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import reference
from config import settings
from db import db, now, public
from knowledge import ANY_REV, board_rev, collection, device_slug

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["capture"])

MeterMode = Literal["DCV", "ACV", "OHM", "DIODE", "CONT", "AMP"]
UNITS = {"DCV": "V", "ACV": "V", "OHM": "Ω", "DIODE": "V", "CONT": "Ω", "AMP": "A"}

# Generic starting points. Locations and designators differ per revision, so
# techs replace or extend these with their own list (see /capture/import).
DEFAULT_POINTS: dict[str, list[tuple[str, str, str]]] = {
    "ps5": [
        ("12 V input from PSU", "DCV", "Power supply prongs on the board, console on standby"),
        ("12 V rail to ground", "DIODE", "Power off, red probe on ground"),
        ("5 V rail", "DCV", "Main 5 V rail, console on standby"),
        ("3.3 V standby rail", "DCV", "Console on standby"),
        ("HDMI port pin 18 (+5 V)", "DCV", "Console powered on"),
        ("APU core rail to ground", "DIODE", "Power off, at the capacitors beside the APU"),
    ],
    "xbox-series-x": [
        ("12 V at 10-pin power connector", "DCV", "Console on standby; do not open the PSU"),
        ("12 V input to ground", "DIODE", "Power off, red probe on ground"),
        ("HDMI port pin 18 (+5 V)", "DCV", "Console powered on"),
        ("SoC core rail to ground", "DIODE", "Power off, at the capacitors beside the SoC"),
        ("SSD 3.3 V", "DCV", "Console powered on, at the M.2 connector"),
    ],
}


def point_key(test_point: str) -> str:
    return re.sub(r"\s+", " ", test_point.strip().lower())


def _rev_query(rev: str) -> dict | str:
    return {"$in": [rev, ANY_REV]} if rev != ANY_REV else ANY_REV


class PointIn(BaseModel):
    test_point: str = Field(min_length=1, max_length=120)
    mode: MeterMode = "DCV"
    hint: str = Field(default="", max_length=300)
    expected_min: float | None = None
    expected_max: float | None = None
    expected: float | None = None


class AddPoint(PointIn):
    device_model: str = Field(min_length=1, max_length=80)
    board_revision: str = Field(default="", max_length=40)
    source: str = Field(default="", max_length=120)


class ImportBody(BaseModel):
    device_model: str = Field(min_length=1, max_length=80)
    board_revision: str = Field(default="", max_length=40)
    source: str = Field(default="Imported list", max_length=120)
    rows: list[PointIn] = Field(max_length=2000)


class SampleIn(BaseModel):
    device_model: str = Field(min_length=1, max_length=80)
    board_revision: str = Field(default="", max_length=40)
    board_label: str = Field(min_length=1, max_length=80)
    test_point: str = Field(min_length=1, max_length=120)
    mode: MeterMode
    value: float


class BenchReading(BaseModel):
    device_model: str = Field(min_length=1, max_length=80)
    board_revision: str = Field(default="", max_length=40)
    session_id: str = Field(default="", max_length=80)
    step: str = Field(default="", max_length=200)
    test_point: str = Field(min_length=1, max_length=120)
    mode: MeterMode
    value: float | None = None
    expected_min: float | None = None
    expected_max: float | None = None
    status: Literal["ok", "fault", "unknown"] = "unknown"


def _save_point(device_model: str, rev: str, p: PointIn, source: str) -> tuple[bool, bool]:
    device = device_slug(device_model)
    key = point_key(p.test_point)
    existing = db().capture_points.find_one({"device": device, "board_rev": rev, "key": key, "mode": p.mode})
    fields = {"device": device, "device_model": device_model.strip(), "board_rev": rev, "key": key, "mode": p.mode,
              "test_point": p.test_point.strip(), "hint": p.hint.strip(), "source": source.strip(), "updated_at": now()}
    if existing:
        db().capture_points.update_one({"_id": existing["_id"]}, {"$set": fields})
    else:
        db().capture_points.insert_one({"_id": uuid.uuid4().hex, "created_at": fields["updated_at"], **fields})

    lo, hi = p.expected_min, p.expected_max
    if p.expected is not None and lo is None and hi is None:
        spread = max(abs(p.expected) * 0.05, 0.01)
        lo, hi = round(p.expected - spread, 4), round(p.expected + spread, 4)
    has_ref = lo is not None and hi is not None
    if has_ref:
        current = reference.find_reference(device, rev, p.test_point, p.mode)
        reference.save_reference(device_model, rev, p.test_point, p.mode, UNITS[p.mode], lo, hi, source,
                                 measured=(current or {}).get("measured"))
    return not existing, has_ref


@router.post("/capture/points")
def add_point(body: AddPoint) -> dict:
    _save_point(body.device_model, board_rev(body.board_revision), body, body.source or "Added at the bench")
    return {"ok": True}


@router.post("/capture/import")
def import_points(body: ImportBody) -> dict:
    rev = board_rev(body.board_revision)
    added = updated = refs = 0
    for row in body.rows:
        is_new, has_ref = _save_point(body.device_model, rev, row, body.source)
        added += is_new
        updated += not is_new
        refs += has_ref
    return {"added": added, "updated": updated, "reference_values": refs}


@router.delete("/capture/points/{point_id}")
def delete_point(point_id: str) -> dict:
    if not db().capture_points.delete_one({"_id": point_id}).deleted_count:
        raise HTTPException(404, "Test point not found")
    return {"deleted": point_id}


def _stats(device: str, rev: str) -> dict[tuple[str, str], dict]:
    match: dict = {"device": device}
    if rev != ANY_REV:
        match["board_rev"] = rev
    pipeline = [
        {"$match": match},
        {"$group": {"_id": {"key": "$key", "mode": "$mode"}, "count": {"$sum": 1}, "boards": {"$addToSet": "$board_label"},
                    "min": {"$min": "$value"}, "max": {"$max": "$value"}, "test_point": {"$first": "$test_point"}}},
    ]
    return {
        (g["_id"]["key"], g["_id"]["mode"]): {"count": g["count"], "boards": len(g["boards"]), "min": g["min"], "max": g["max"],
                                              "test_point": g["test_point"]}
        for g in db().known_good_samples.aggregate(pipeline)
    }


@router.get("/capture/plan")
def capture_plan(device_model: str, board_revision: str = "", board_label: str = "") -> dict:
    device = device_slug(device_model)
    rev = board_rev(board_revision)
    points: dict[tuple[str, str], dict] = {}

    for tp, mode, hint in DEFAULT_POINTS.get(device or "", []):
        points[(point_key(tp), mode)] = {"id": None, "test_point": tp, "mode": mode, "hint": hint, "origin": "default"}

    frequent = db().bench_readings.aggregate([
        {"$match": {"device": device}},
        {"$group": {"_id": {"key": "$key", "mode": "$mode"}, "test_point": {"$first": "$test_point"}, "n": {"$sum": 1}}},
        {"$match": {"n": {"$gte": 2}}},
        {"$sort": {"n": -1}},
        {"$limit": 30},
    ])
    for f in frequent:
        k = (f["_id"]["key"], f["_id"]["mode"])
        points.setdefault(k, {"id": None, "test_point": f["test_point"], "mode": k[1], "hint": f"Measured {f['n']} times during repairs", "origin": "often measured"})

    for d in db().capture_points.find({"device": device, "board_rev": _rev_query(rev)}).sort("created_at", 1):
        points[(d["key"], d["mode"])] = {"id": d["_id"], "test_point": d["test_point"], "mode": d["mode"], "hint": d.get("hint", ""),
                                          "origin": d.get("source") or "your list"}

    stats = _stats(device, rev)
    for k, s in stats.items():
        points.setdefault(k, {"id": None, "test_point": s["test_point"], "mode": k[1], "hint": "", "origin": "captured"})
    refs ={(point_key(r["test_point"]), r["mode"]): r for r in reference.for_board(device, None if rev == ANY_REV else rev, limit=2000)}
    done_on_board = set()
    if board_label:
        for s in db().known_good_samples.find({"device": device, "board_label": board_label}, {"key": 1, "mode": 1}):
            done_on_board.add((s["key"], s["mode"]))

    out = []
    for k, p in points.items():
        ref = refs.get(k)
        out.append({
            **p,
            "unit": UNITS[p["mode"]],
            "measured": stats.get(k),
            "reference": {"min": ref["expected_min"], "max": ref["expected_max"], "source": ref.get("source", "")} if ref else None,
            "captured_on_board": k in done_on_board,
        })
    return {"device": device, "board_rev": None if rev == ANY_REV else rev, "points": out}


def _margin(lo: float, hi: float) -> float:
    return max(max(abs(lo), abs(hi)) * 0.05, 0.01)


@router.post("/capture/samples")
def add_sample(body: SampleIn) -> dict:
    device = device_slug(body.device_model)
    rev = board_rev(body.board_revision)
    key = point_key(body.test_point)
    db().known_good_samples.update_one(
        {"device": device, "board_rev": rev, "board_label": body.board_label, "key": key, "mode": body.mode},
        {"$set": {"device_model": body.device_model.strip(), "test_point": body.test_point.strip(), "value": body.value,
                  "unit": UNITS[body.mode], "updated_at": now()},
         "$setOnInsert": {"_id": uuid.uuid4().hex, "created_at": now()}},
        upsert=True,
    )
    measured = {k: v for k, v in _stats(device, rev)[(key, body.mode)].items() if k != "test_point"}
    current = reference.find_reference(device, rev, body.test_point, body.mode)
    capture_owned = not current or str(current.get("source", "")).startswith(reference.CAPTURE_SOURCE)
    boards = measured["boards"]
    if capture_owned:
        m = _margin(measured["min"], measured["max"])
        ref = reference.save_reference(
            body.device_model, rev, body.test_point, body.mode, UNITS[body.mode],
            round(measured["min"] - m, 4), round(measured["max"] + m, 4),
            f"{reference.CAPTURE_SOURCE} ({boards} board{'s' if boards != 1 else ''})",
            measured=measured,
        )
    else:
        db().reference_values.update_one({"_id": current["_id"]}, {"$set": {"measured": measured}})
        ref = reference.find_reference(device, rev, body.test_point, body.mode)
        ref = reference._out(ref)
    out_of_ref = not capture_owned and not (current["expected_min"] <= body.value <= current["expected_max"])
    return {"saved": True, "measured": measured, "reference": ref, "outside_reference": out_of_ref}


@router.post("/readings")
def log_reading(body: BenchReading) -> dict:
    doc = {"_id": uuid.uuid4().hex, "device": device_slug(body.device_model), "device_model": body.device_model.strip(),
           "board_rev": board_rev(body.board_revision), "key": point_key(body.test_point), **body.model_dump(exclude={"board_revision", "device_model"}),
           "created_at": now()}
    db().bench_readings.insert_one(doc)
    return {"saved": True, "id": doc["_id"]}


def _chunk_count(device: str | None) -> int:
    if not device:
        return 0
    try:
        return len(collection().get(where={"device": device}, include=[])["ids"])
    except Exception:
        return 0


@router.get("/coverage")
def coverage(device_model: str, board_revision: str = "") -> dict:
    device = device_slug(device_model)
    rev = board_rev(board_revision)
    rev_q = _rev_query(rev)
    counts = {
        "reference_values": db().reference_values.count_documents({"device": device, "board_rev": rev_q}),
        "known_good_boards": len(db().known_good_samples.distinct("board_label", {"device": device, **({"board_rev": rev} if rev != ANY_REV else {})})),
        "repairs": db().repairs.count_documents({"device": device}),
        "schematics": db().schematics.count_documents({"device": device, "board_rev": rev_q}),
        "knowledge_chunks": _chunk_count(device),
        "patterns": db().patterns.count_documents({"device": device, "status": {"$ne": "dismissed"}}),
    }
    if not any(counts.values()):
        level = "none"
    elif counts["reference_values"] < settings.coverage_min_references or counts["repairs"] < settings.coverage_min_repairs:
        level = "low"
    else:
        level = "ok"
    return {"device": device, "board_rev": None if rev == ANY_REV else rev, "level": level, "counts": counts,
            "targets": {"reference_values": settings.coverage_min_references, "repairs": settings.coverage_min_repairs}}
